"""T2A bootstrap/ead7a211 upgrade in disposable local Docker databases only."""
import argparse
import json
import subprocess
import sys
import uuid

sys.dont_write_bytecode = True
from important_dates_local import Database, ROOT, SUPPORT, LEGACY, LEGACY_ACL, admin

BASELINE = "ead7a211990f477265a3bc1a6b857a3ddec42ec0"
PATCH = ROOT / "supabase/patches/2026-10-01-v0.1.18-important-date-reminder-capability.sql"


def baseline_sql():
    return subprocess.run(["git", "show", f"{BASELINE}:supabase/schema.sql"],
                          cwd=ROOT, text=True, capture_output=True, check=True).stdout


def ledger_rows(db):
    # New nullable column is the only legacy row-shape change.
    return db.sql("select coalesce(jsonb_agg(to_jsonb(t)-'important_date_id' order by id),'[]') from public.reminder_deliveries t;")


def existing_functions(db):
    return db.sql("""select jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid))
from pg_proc where pronamespace='public'::regnamespace
and (proname in ('claim_reminder_delivery','claim_recurring_reminder_delivery','prepare_important_date_schedule')
or oid in ('public.create_important_date(uuid,text,text,text,integer,integer,bigint,text)'::regprocedure,
'public.update_important_date(uuid,text,text,text,integer,integer,bigint)'::regprocedure));""")


def scan_pages(db):
    # Invoke the actual existing scanner against JSON returned by the candidate RPC.
    source = (ROOT / 'supabase/functions/send-reminders/logic.ts').as_uri()
    script = f"""
import assert from 'node:assert/strict';
import {{scanReminderCandidates}} from {json.dumps(source)};
const pages=JSON.parse(await new Promise(resolve=>{{let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>resolve(s));}}));
let calls=0;
const result=await scanReminderCandidates(async request=>{{
  const page=pages[calls++]; assert.equal(request.afterId,page.afterId); assert.equal(request.limit,page.limit);
  return page.rows;
 }});
assert.equal(result.candidates.length,1000);
assert.equal(result.candidatesScanned,1000+pages.at(-1).rows.length);
assert.equal(result.candidateTruncated,pages.at(-1).rows.length===1);
for(const row of result.candidates) assert.equal(row.reminder_schedule_changed_at,'2026-10-01T12:34:56.123456+00:00');
assert.equal(calls,11); process.stdout.write('PASS existing scanner 1000/probe boundary');
"""
    for count in [1000, 1001]:
        db.sql(f"""begin;
insert into auth.users(id,email) values ('95000000-0000-4000-8000-000000000001','scan@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('95000000-0000-4000-8000-000000000011','Scan','shared','T2ASCAN','95000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values ('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000001','owner');
insert into public.space_modules(space_id,module_key,enabled) values ('95000000-0000-4000-8000-000000000011','important_dates',true);
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,reminder_kind,created_by)
select ('95000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,'95000000-0000-4000-8000-000000000011','Scan','annual',1,1,'UTC','all_day_same_day_08','95000000-0000-4000-8000-000000000001' from generate_series(1,{count}) n;
alter table public.important_dates disable trigger important_dates_prepare_schedule;
update public.important_dates set reminder_schedule_changed_at='2026-10-01 12:34:56.123456Z'
where space_id='95000000-0000-4000-8000-000000000011';
alter table public.important_dates enable trigger important_dates_prepare_schedule;
commit;""")
        pages, after = [], None
        for index in range(11):
            limit = 100 if index < 10 else 1
            cursor = 'null' if after is None else f"'{after}'::uuid"
            rows = json.loads(db.sql(f"set role service_role; select coalesce(jsonb_agg(t),'[]') from public.list_important_date_reminder_candidates({cursor},{limit}) t;"))
            pages.append(dict(afterId=after, limit=limit, rows=rows))
            if rows:
                after = rows[-1]['id']
        result = subprocess.run(['node','--input-type=module','--eval',script],
                                input=json.dumps(pages), capture_output=True, text=True, check=True)
        print(f"PASS {count} actual SQL candidates: {result.stdout}")
        db.sql("delete from public.spaces where id='95000000-0000-4000-8000-000000000011'; delete from auth.users where id='95000000-0000-4000-8000-000000000001';")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--red', action='store_true')
    args = parser.parse_args()
    suffix = uuid.uuid4().hex[:12]
    databases = [Database(f'v018_task2_{mode}_{suffix}') for mode in ['upgrade','bootstrap']]
    created = []
    try:
        for db in databases:
            admin(f'create database "{db.name}" template template0;')
            created.append(db)
            db.sql(SUPPORT)
        upgrade, bootstrap = databases
        upgrade.sql(baseline_sql())
        # Recorded deployed ACL correction supplements the frozen historical schema.
        upgrade.sql(LEGACY_ACL.read_text())
        if args.red:
            output = upgrade.sql("begin; select no_plan(); select has_column('public','reminder_deliveries','important_date_id','Important Date source identity'); select * from finish(); rollback;")
            assert 'not ok 1' in output, output
            print('RED confirmed: frozen baseline lacks Important Date ledger capability')
            return
        bootstrap.sql((ROOT / 'supabase/schema.sql').read_text())
        upgrade.sql(LEGACY)
        upgrade.sql("""insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,occurrence_date,due_at,status,result_code,provider_status)
select '97000000-0000-4000-8000-000000000031','97000000-0000-4000-8000-000000000001',
 '97000000-0000-4000-8000-000000000041',date '2028-01-01'+n,'2028-01-01 08:00:00.123456Z',
 case n when 0 then 'claimed' when 1 then 'sent' else 'failed' end,
 case n when 0 then null when 1 then 'delivered' else 'upstream_error' end,
 case n when 0 then null when 1 then 201 else 500 end
from generate_series(0,2) n;""")
        before_rows, before_functions = ledger_rows(upgrade), existing_functions(upgrade)
        # Fail closed on an incompatible existing ledger, without partial objects.
        upgrade.sql('alter table public.reminder_deliveries drop constraint reminder_deliveries_occurrence_identity_key;')
        before_drift = upgrade.dump()
        upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.dump() == before_drift, 'Drift rejection was not atomic'
        upgrade.sql('alter table public.reminder_deliveries add constraint reminder_deliveries_occurrence_identity_key unique nulls not distinct(event_id,occurrence_date,subscription_id,due_at);')
        upgrade.sql(PATCH.read_text())
        assert ledger_rows(upgrade) == before_rows, 'Legacy ledger rows changed'
        assert existing_functions(upgrade) == before_functions, 'Old claims/CRUD/marker changed'
        before_replay = upgrade.dump()
        upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.dump() == before_replay, 'Replay rejection was not atomic'
        assert upgrade.dump() == bootstrap.dump(), 'Bootstrap/upgrade schema or ACL mismatch'
        print('PASS full public catalog/ACL parity, old rows/functions unchanged, atomic drift/replay rejection')
        for db in databases:
            for test in sorted((ROOT / 'supabase/tests').glob('*.test.sql')):
                print(f'PASS {db.name.split("_")[2]} {test.name}: {db.tap(test)} assertions')
            scan_pages(db)
    finally:
        for db in reversed(created):
            admin(f'drop database "{db.name}" with (force);')


if __name__ == '__main__':
    main()
