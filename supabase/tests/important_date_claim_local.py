"""T2B fresh/5d5cfdc upgrade, pgTAP and real races in disposable DBs only."""
import argparse
import json
import subprocess
import sys
import uuid

sys.dont_write_bytecode = True
from important_dates_local import Database, ROOT, SUPPORT, LEGACY, admin
from important_date_claim_concurrency import fixture, run_concurrency

BASELINE = '5d5cfdcaf2636160d39c6fca23b2a8e7b1cdc79d'
PATCH = ROOT / 'supabase/patches/2026-10-02-v0.1.18-important-date-reminder-claim.sql'


def existing_functions(db):
    return db.sql("""select jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl))
from pg_proc where pronamespace='public'::regnamespace
and proname not in ('claim_important_date_reminder_delivery','check_important_date_reminder_delivery','important_date_reminder_is_eligible');""")


def ledger_rows(db):
    return db.sql("select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.reminder_deliveries t;")


def occurrence_parity(db):
    core = (ROOT / 'supabase/functions/_shared/important-date.ts').as_uri()
    script = f"""
import {{resolveImportantDateOccurrence}} from {json.dumps(core)};
const cases=[];
for(const fields of [{{repeat_kind:'annual',year:null,month:2,day:29}},
 {{repeat_kind:'annual',year:2028,month:2,day:29}},{{repeat_kind:'annual',year:2032,month:2,day:29}},
 {{repeat_kind:'annual',year:2030,month:1,day:1}},{{repeat_kind:'none',year:2028,month:2,day:29}},
 {{repeat_kind:'none',year:2030,month:1,day:1}}])
for(const year of [1900,1999,2000,2027,2028,2029,2030,2032,2100,2400]) {{
 const resolved=resolveImportantDateOccurrence(fields,year);
 for(const day of [28,29]) {{
  if(day===29 && !(year%4===0&&(year%100!==0||year%400===0))) continue;
  const date={{year,month:2,day}};
  cases.push({{fields,date,ok:JSON.stringify(date)===JSON.stringify(resolved)}});
 }}
 const date={{year,month:1,day:1}};
 cases.push({{fields,date,ok:JSON.stringify(date)===JSON.stringify(resolved)}});
}}
process.stdout.write(JSON.stringify(cases));
"""
    cases = json.loads(subprocess.run(['node','--input-type=module','--eval',script],capture_output=True,text=True,check=True).stdout)
    _, member, _, source, subscription, _ = fixture(db)
    lines = ['begin; select no_plan();']
    for case in cases:
        fields = json.dumps(case['fields']).replace("'", "''")
        date = '{year:04}-{month:02}-{day:02}'.format(**case['date'])
        lines.append(f"""select is(public.important_date_reminder_is_eligible(
(select jsonb_populate_record(null::public.important_dates,to_jsonb(d)||'{fields}'::jsonb) from public.important_dates d where id='{source}'),
'{date}','{member}','{subscription}',clock_timestamp()-interval '1 second','all_day_same_day_08','2000-01-01 00:00:00.123456Z',clock_timestamp()),
{str(case['ok']).lower()},'canonical resolver occurrence membership');""")
    output = db.sql('\n'.join(lines)+'\nselect * from finish(); rollback;')
    assert 'not ok' not in output, output
    print(f'PASS {len(cases)} SQL eligibility/canonical resolver parity cases')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--red',action='store_true')
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
        old_schema = subprocess.run(['git','show',f'{BASELINE}:supabase/schema.sql'],cwd=ROOT,text=True,capture_output=True,check=True).stdout
        upgrade.sql(old_schema)
        if args.red:
            output=upgrade.sql("begin; select no_plan(); select has_function('public','claim_important_date_reminder_delivery',array['uuid','date','uuid','uuid','timestamp with time zone','text','timestamp with time zone'],'Important Date claim exists'); select * from finish(); rollback;")
            assert 'not ok 1' in output, output
            print('RED confirmed: frozen T2A baseline has no Important Date claim')
            return
        bootstrap.sql((ROOT/'supabase/schema.sql').read_text())
        upgrade.sql(LEGACY)
        upgrade.sql("insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status,result_code) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'2026-10-01','2026-10-01 08:00:00.123456Z','failed','unexpected_task_error');")
        before_rows, before_functions = ledger_rows(upgrade), existing_functions(upgrade)
        upgrade.sql('alter table public.reminder_deliveries drop constraint reminder_deliveries_source_identity_check;')
        before_drift = upgrade.dump()
        upgrade.sql(PATCH.read_text(),expect_error=True)
        assert upgrade.dump() == before_drift, 'Drift rejection was not atomic'
        upgrade.sql('alter table public.reminder_deliveries add constraint reminder_deliveries_source_identity_check check ((event_id is null)<>(important_date_id is null));')
        upgrade.sql(PATCH.read_text())
        assert ledger_rows(upgrade)==before_rows, 'Historical ledger changed'
        assert existing_functions(upgrade)==before_functions, 'Existing Event claim/CRUD/marker changed'
        before_replay = upgrade.dump()
        upgrade.sql(PATCH.read_text(),expect_error=True)
        assert upgrade.dump()==before_replay, 'Replay rejection was not atomic'
        assert upgrade.dump()==bootstrap.dump(), 'Full public catalog/ACL mismatch'
        print('PASS bootstrap/upgrade catalog/ACL parity; historical rows/functions unchanged; atomic drift/replay rejection')
        for db in databases:
            for test in sorted((ROOT/'supabase/tests').glob('*.test.sql')):
                print(f'PASS {db.name.split("_")[2]} {test.name}: {db.tap(test)} assertions')
            occurrence_parity(db)
            print(f'PASS {db.name.split("_")[2]} T2B concurrency: {run_concurrency(db)} observed waits')
    finally:
        for db in reversed(created):
            admin(f'drop database "{db.name}" with (force);')


if __name__=='__main__':
    main()
