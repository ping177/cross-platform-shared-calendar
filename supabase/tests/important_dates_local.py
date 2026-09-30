"""Disposable databases inside the existing local Supabase Docker container only."""

import argparse
import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import uuid

sys.dont_write_bytecode = True
from important_dates_concurrency import run_concurrency

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTAINER = "supabase_db_cross-platform-shared-calendar"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"]
PATCH = ROOT / "supabase/patches/2026-09-30-v0.1.18-important-dates-foundation.sql"
TEST = ROOT / "supabase/tests/2026-09-30-v0.1.18-important-dates-foundation.test.sql"
LEGACY_ACL = ROOT / "supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql"
BASELINE = "012d151ff9c1ee5ebbd703f6538bc1de40d5820c"

SUPPORT = """
create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth,public,extensions to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
create extension pgtap;
create publication supabase_realtime;
"""

LEGACY = """
begin;
insert into auth.users(id,email) values ('97000000-0000-4000-8000-000000000001','legacy-a@example.invalid'),('97000000-0000-4000-8000-000000000002','legacy-b@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('97000000-0000-4000-8000-000000000011','Legacy','shared','IDLEGACY','97000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values ('97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000001','owner'),('97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000002','member');
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
select public.set_space_module_enabled('97000000-0000-4000-8000-000000000011','review',true);
select public.set_space_module_enabled('97000000-0000-4000-8000-000000000011','lists',true);
select public.create_review_round('97000000-0000-4000-8000-000000000011','2026-09-30');
insert into public.lists(id,space_id,name) values ('97000000-0000-4000-8000-000000000021','97000000-0000-4000-8000-000000000011','Legacy List');
select public.create_list_section('97000000-0000-4000-8000-000000000021','Section');
select public.create_list_item('97000000-0000-4000-8000-000000000021',null,'Item');
insert into public.tasks(space_id,title,assigned_to_user_id,due_on) values ('97000000-0000-4000-8000-000000000011','Legacy Task','97000000-0000-4000-8000-000000000002','2028-01-01');
insert into public.events(id,space_id,created_by,scope,title,starts_at,all_day,reminder_kind,time_zone) values ('97000000-0000-4000-8000-000000000031','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000001','shared','Legacy Event','2028-01-01T00:00:00Z',true,'all_day_same_day_08','UTC');
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) values ('97000000-0000-4000-8000-000000000041','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000042','https://fcm.googleapis.com/fake-important-date-test','fake','fake');
insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,due_at,status) values ('97000000-0000-4000-8000-000000000031','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000041','2028-01-01T08:00:00Z','sent');
commit;
"""


def fingerprint(db):
    tables = ['profiles','spaces','space_members','space_modules','events','event_occurrence_exceptions','tasks',
              'review_rounds','review_entries','lists','list_sections','list_items','push_subscriptions','reminder_deliveries']
    return [db.sql(f"select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.{table} t;") for table in tables]


def date_matrix(db):
    core = (ROOT / 'supabase/functions/_shared/important-date.ts').as_uri()
    script = f"""
      import {{validateImportantDateFields}} from {json.dumps(core)};
      const cases=[];
      const limit=Math.floor(Number.MAX_SAFE_INTEGER/366);
      for(const repeat_kind of ['annual','none'])
      for(const year of [null,-1,0,1,4,99,100,400,1900,2000,2027,2028,2030,2100,10000,limit-1,limit,limit+1,9007199254740991])
      for(const month of [0,1,2,4,12,13])
      for(const day of [0,1,28,29,30,31,32]) {{
        const fields={{repeat_kind,year,month,day}};
        cases.push({{...fields,ok:validateImportantDateFields(fields).ok}});
      }}
      process.stdout.write(JSON.stringify(cases));
    """
    cases = json.loads(subprocess.run(['node','--input-type=module','--eval',script], capture_output=True,text=True,check=True).stdout)
    setup = """begin; select no_plan();
insert into auth.users(id,email) values ('96000000-0000-4000-8000-000000000001','matrix@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('96000000-0000-4000-8000-000000000011','Matrix','personal','IDMATRIX','96000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values ('96000000-0000-4000-8000-000000000011','96000000-0000-4000-8000-000000000001','owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
select public.set_space_module_enabled('96000000-0000-4000-8000-000000000011','important_dates',true);
"""
    lines = [setup]
    for case in cases:
        year = 'null' if case['year'] is None else str(case['year'])
        call = f"select public.create_important_date('96000000-0000-4000-8000-000000000011','Matrix',null,'{case['repeat_kind']}',{case['month']},{case['day']},{year},'UTC')"
        lines.append(f"select lives_ok($${call}$$,'valid civil input');" if case['ok']
                     else f"select throws_ok($${call}$$,'23514',null,'invalid civil input');")
    output = db.sql('\n'.join(lines) + '\nselect * from finish(); rollback;')
    assert not re.search(r'^not ok\b|^# Looks like', output, re.M), output
    print(f"PASS {len(cases)} SQL/shared-helper date validation parity cases")


class Database:
    def __init__(self, name):
        if not re.fullmatch(r"v018_task2_[a-z0-9_]+", name):
            raise ValueError("Only a disposable v018_task2 database may be targeted")
        self.name = name
        self.command = PSQL + ["-d", name]

    def sql(self, source, *, expect_error=False):
        result = subprocess.run(self.command, input=source, text=True, capture_output=True, timeout=45, check=False)
        if expect_error:
            assert result.returncode != 0, "Expected SQL rejection"
        else:
            assert result.returncode == 0, result.stderr + "\n" + result.stdout[-6500:]
        return result.stdout.strip()

    def tap(self, path):
        output = self.sql(path.read_text())
        assert not re.search(r"^not ok\b|^# Looks like", output, re.M), output
        plan = re.search(r"^1\.\.(\d+)$", output, re.M)
        assert plan, output
        return int(plan[1])

    def dump(self):
        result = subprocess.run(
            ["docker", "exec", CONTAINER, "pg_dump", "-U", "postgres", "-d", self.name,
             "--schema-only", "--schema=public", "--no-owner", "--no-comments"],
            capture_output=True, text=True, timeout=45, check=True,
        )
        return "\n".join(line for line in result.stdout.splitlines()
                         if not line.startswith(("\\restrict ", "\\unrestrict ")))


def admin(source):
    subprocess.run(PSQL + ["-d", "postgres"], input=source, text=True, capture_output=True, timeout=45, check=True)


def legacy_concurrency(db):
    # Existing scripts default to the local main DB; override before invoking any SQL.
    for name in ['review-foundation-concurrency', 'shared-lists-concurrency', 'space-lifecycle-concurrency']:
        spec = importlib.util.spec_from_file_location(name, ROOT / 'supabase/tests' / f'{name}.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.PSQL = db.command
        module.main()
        print(f"PASS {db.name.split('_')[2]} existing {name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--red", action="store_true", help="Prove the new table assertion fails on the frozen baseline")
    args = parser.parse_args()
    suffix = uuid.uuid4().hex[:12]
    databases = [Database(f"v018_task2_{mode}_{suffix}") for mode in ["upgrade", "bootstrap"]]
    created = []
    try:
        for db in databases:
            admin(f'create database "{db.name}" template template0;')
            created.append(db)
            db.sql(SUPPORT)
        upgrade, bootstrap = databases
        baseline = subprocess.run(["git", "show", f"{BASELINE}:supabase/schema.sql"],
                                  cwd=ROOT, capture_output=True, text=True, check=True).stdout
        upgrade.sql(baseline)
        # Recorded pre-existing backend correction; baseline bootstrap alone retains
        # broad service_role ledger defaults. Do not change that historical subsystem.
        upgrade.sql(LEGACY_ACL.read_text())
        if args.red:
            output = upgrade.sql("begin; select no_plan(); select ok(to_regclass('public.important_dates') is not null,'canonical table exists'); select * from finish(); rollback;")
            assert "not ok 1" in output, output
            print("RED confirmed: baseline has no Important Dates table")
            return
        bootstrap.sql((ROOT / "supabase/schema.sql").read_text())
        bootstrap.sql(LEGACY_ACL.read_text())
        upgrade.sql(LEGACY)
        before_data = fingerprint(upgrade)
        # A changed SECURITY DEFINER contract must stop before creating any objects.
        upgrade.sql('alter function public.set_space_module_enabled(uuid,text,boolean) security invoker;')
        upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.sql("select to_regclass('public.important_dates') is null;") == 't'
        upgrade.sql('alter function public.set_space_module_enabled(uuid,text,boolean) security definer;')
        upgrade.sql(PATCH.read_text())
        assert fingerprint(upgrade) == before_data, 'Upgrade changed legacy business/module/ledger rows'
        before_replay = upgrade.dump()
        upgrade.sql(PATCH.read_text(), expect_error=True)
        assert upgrade.dump() == before_replay, "Replay rejection changed schema"
        assert upgrade.dump() == bootstrap.dump(), "Bootstrap/upgrade public schema or ACL mismatch"
        print("PASS bootstrap/upgrade full public schema and ACL parity; drift/replay rejected atomically; legacy rows unchanged")
        for db in databases:
            print(f"PASS {db.name.split('_')[2]} Important Dates pgTAP {db.tap(TEST)} assertions")
            for test in sorted((ROOT / 'supabase/tests').glob('*.test.sql')):
                if test != TEST:
                    print(f"PASS {db.name.split('_')[2]} regression {test.name}: {db.tap(test)}")
            date_matrix(db)
            print(f"PASS {db.name.split('_')[2]} concurrency {run_concurrency(db)} observed lock races")
            legacy_concurrency(db)
    finally:
        for db in reversed(created):
            admin(f'drop database "{db.name}" with (force);')


if __name__ == "__main__":
    main()
