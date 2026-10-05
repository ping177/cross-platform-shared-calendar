"""v0.1.19 fresh/upgrade parity in guarded disposable local Docker DBs only."""
import argparse
import json
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
from important_dates_local import Database, ROOT, SUPPORT, LEGACY, admin

BASELINE = '34e52dfb94bdb7b2ca355a4ad2d00a8deb32618c'
PATCH = ROOT / 'supabase/patches/2026-10-05-v0.1.19-task-reminders.sql'


def old_rows(db, table):
    excluded = "-'task_id'" if table == 'reminder_deliveries' else "-'reminder_kind'-'time_zone'-'reminder_schedule_changed_at'"
    return db.sql(f"select coalesce(jsonb_agg(to_jsonb(t){excluded} order by id),'[]') from public.{table} t;")


def legacy_functions(db):
    return db.sql("""select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('body',pg_get_functiondef(oid),'acl',proacl))
from pg_proc where pronamespace='public'::regnamespace and (proname like '%important_date%' or proname in
('claim_reminder_delivery','claim_recurring_reminder_delivery','prepare_event_reminder_schedule','enforce_task_status_owner','validate_task_identity'));""")


def scan_pages(db):
    # Real RPC pagination fed to the existing scanner; disposable fixtures only.
    owner, space = [str(uuid.uuid4()) for _ in range(2)]
    db.sql(f"""begin;
update public.tasks set reminder_kind=null;
insert into auth.users(id,email) values('{owner}','task-scan@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values('{space}','Scan','personal','{uuid.uuid4().hex[:8]}','{owner}');
insert into public.space_members(space_id,user_id,role) values('{space}','{owner}','owner');
commit;""")
    for count in [1000,1001]:
        db.sql(f"""begin;
insert into public.tasks(id,space_id,created_by,title,due_on,reminder_kind,time_zone)
select ('99100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'{space}','{owner}','Scan',current_date,'all_day_same_day_08','UTC' from generate_series(1,{count}) n;
alter table public.tasks disable trigger tasks_prepare_reminder_schedule;
update public.tasks set reminder_schedule_changed_at='2000-01-01 00:00:00.123456Z' where space_id='{space}';
alter table public.tasks enable trigger tasks_prepare_reminder_schedule;
commit;""")
        pages, after = [], None
        for index in range(11):
            limit = 100 if index<10 else 1
            cursor = 'null' if after is None else f"'{after}'::uuid"
            rows = json.loads(db.sql(f"set role service_role; select coalesce(jsonb_agg(t),'[]') from public.list_task_reminder_candidates({cursor},{limit}) t;"))
            pages.append(dict(afterId=after,limit=limit,rows=rows))
            if rows: after=rows[-1]['id']
        script = f"""
import assert from 'node:assert/strict';
import {{scanReminderCandidates}} from {json.dumps((ROOT/'supabase/functions/send-reminders/logic.ts').as_uri())};
const pages=JSON.parse(await new Promise(resolve=>{{let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>resolve(s));}}));
let calls=0;
const result=await scanReminderCandidates(async req=>{{const page=pages[calls++];assert.equal(req.afterId,page.afterId);assert.equal(req.limit,page.limit);return page.rows;}});
assert.equal(result.candidates.length,1000);assert.equal(result.candidateTruncated,{str(count>1000).lower()});assert.equal(calls,11);
for(const row of result.candidates) assert.equal(row.reminder_schedule_changed_at,'2000-01-01T00:00:00.123456+00:00');
"""
        subprocess.run(['node','--input-type=module','--eval',script],input=json.dumps(pages),text=True,capture_output=True,check=True)
        db.sql(f"delete from public.tasks where space_id='{space}';")
        print(f'PASS actual Task RPC/scanner {count} keyset sources/raw marker')
    # Personal Space fixture disappears with the enclosing disposable database.


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--red', action='store_true'); args = parser.parse_args()
    suffix = uuid.uuid4().hex[:10]
    # Reuse the existing strict disposable-name guard, never the local main DB.
    databases = [Database(f'v018_task2_v019_{mode}_{suffix}') for mode in ['upgrade','fresh']]
    created = []
    try:
        for db in databases:
            admin(f'create database "{db.name}" template template0;'); created.append(db); db.sql(SUPPORT)
        upgrade, fresh = databases
        upgrade.sql(subprocess.run(['git','show',f'{BASELINE}:supabase/schema.sql'],cwd=ROOT,text=True,capture_output=True,check=True).stdout)
        if args.red:
            output = upgrade.sql("begin; select no_plan(); select has_column('public','tasks','reminder_kind','Task reminder exists'); select * from finish(); rollback;")
            assert 'not ok 1' in output, output
            print('RED confirmed: frozen v0.1.18 lacks Task reminders'); return
        upgrade.sql(LEGACY)
        before = [old_rows(upgrade, table) for table in ['tasks','reminder_deliveries']]
        functions = legacy_functions(upgrade)
        upgrade.sql('alter table public.reminder_deliveries drop constraint reminder_deliveries_source_identity_check;')
        drift = upgrade.dump(); upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.dump() == drift, 'drift rejection not atomic'
        upgrade.sql('alter table public.reminder_deliveries add constraint reminder_deliveries_source_identity_check check ((event_id is null)<>(important_date_id is null));')
        upgrade.sql(PATCH.read_text())
        assert before == [old_rows(upgrade, table) for table in ['tasks','reminder_deliveries']], 'historical business/audit rows changed'
        assert legacy_functions(upgrade) == functions, 'Event/Important Date or Task authorization changed'
        assert upgrade.sql('select bool_and(reminder_kind is null and time_zone is null) from public.tasks;') == 't'
        replay = upgrade.dump(); upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.dump() == replay, 'replay rejection not atomic'
        fresh.sql((ROOT/'supabase/schema.sql').read_text())
        assert fresh.dump() == upgrade.dump(), 'full public schema/ACL parity mismatch'
        print('PASS fresh/upgrade catalog/ACL parity, legacy rows/functions, null history, atomic drift/replay')
        from task_reminder_concurrency import run_concurrency
        for db in databases:
            total = 0
            for path in sorted((ROOT/'supabase/tests').glob('*.test.sql')):
                count = db.tap(path); total += count; print(f'PASS {db.name.split("_")[-2]} {path.name}: {count}')
            print(f'PASS SQL {total} assertions')
            print(f'PASS concurrency {run_concurrency(db)} observed waits')
            scan_pages(db)
    finally:
        for db in reversed(created): admin(f'drop database "{db.name}" with (force);')


if __name__ == '__main__': main()
