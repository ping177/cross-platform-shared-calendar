"""Space Rename tests in disposable databases in the existing LOCAL container only."""
import argparse
import importlib.util
import pathlib
import re
import subprocess
import time
import uuid
from important_dates_local import SUPPORT

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTAINER = 'supabase_db_cross-platform-shared-calendar'
DOCKER = ['docker', '--context', 'desktop-linux']
PSQL = DOCKER + ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
PATCH = ROOT / 'supabase/patches/2026-10-14-space-rename.sql'
TEST = ROOT / 'supabase/tests/2026-10-14-space-rename.test.sql'
BASELINE = 'b69251c08142b686db48a1dd817f56688252a874'

def sql(name, source, expect_error=False):
    if name != 'postgres' and not re.fullmatch(r'space_rename_(fresh|upgrade)_[0-9a-f]{12}', name):
        raise ValueError('Only generated disposable databases are permitted')
    result = subprocess.run(PSQL + ['-d', name], input=source, text=True, capture_output=True, timeout=60)
    assert (result.returncode != 0) if expect_error else (result.returncode == 0), result.stderr + result.stdout[-4000:]
    return result.stdout.strip()

def tap(name, path):
    output = sql(name, path.read_text())
    assert not re.search(r'^not ok\b|^# Looks like', output, re.M), output
    plan = re.search(r'^1\.\.(\d+)$', output, re.M)
    assert plan, output
    return int(plan[1])

def dump(name):
    output = subprocess.run(DOCKER + ['exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', name,
                                     '--schema-only', '--schema=public', '--no-owner', '--no-comments'],
                            capture_output=True, text=True, timeout=60, check=True).stdout
    return '\n'.join(line for line in output.splitlines() if not line.startswith(('\\restrict ', '\\unrestrict ')))

def concurrency(name):
    spec = importlib.util.spec_from_file_location('rename_races', ROOT / 'supabase/tests/space-lifecycle-concurrency.py')
    races = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(races)
    races.PSQL = PSQL + ['-d', name]
    owner, member = str(uuid.uuid4()), str(uuid.uuid4())
    sql(name, f"insert into auth.users(id,email) values ('{owner}','race-a@example.invalid'),('{member}','race-b@example.invalid');")
    for first_action in ['transfer', 'rename']:
        space = str(uuid.uuid4())
        sql(name, f"""begin;
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Race','shared','{uuid.uuid4().hex}','{owner}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{owner}','owner'),('{space}','{member}','member'); commit;""")
        transfer = f"select public.transfer_space_ownership('{space}','{member}');"
        rename = f"update public.spaces set name='Confirmed' where id='{space}';"
        first, second = (transfer, rename) if first_action == 'transfer' else (rename, transfer)
        connection = subprocess.Popen(PSQL + ['-d', name], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True)
        connection.stdin.write(races.actor_sql(owner, first).rsplit('commit;', 1)[0] + "select 'LOCKED';\n")
        connection.stdin.flush()
        while connection.stdout.readline().strip() != 'LOCKED':
            assert connection.poll() is None, 'First transaction ended before its lock marker'
        label = 'rename_wait_' + uuid.uuid4().hex
        waiter = subprocess.Popen(PSQL + ['-d', name], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True)
        waiter.stdin.write(f"set application_name='{label}';\n" + races.actor_sql(owner, second))
        waiter.stdin.close()
        observed = False
        try:
            for _ in range(100):
                if sql(name, f"select exists(select 1 from pg_stat_activity where application_name='{label}' and wait_event_type='Lock');") == 't':
                    observed = True
                    break
                time.sleep(0.02)
        finally:
            connection.stdin.write('commit;\n')
            connection.stdin.close()
            connection.wait(timeout=30)
            waiter.wait(timeout=30)
        assert observed, 'Second session did not reach an observed PostgreSQL lock wait'
        assert connection.returncode == 0, connection.stderr.read()
        assert (waiter.returncode != 0) == (first_action == 'transfer'), waiter.stderr.read()
        sql(name, races.actor_sql(owner, f"update public.spaces set name='Forbidden' where id='{space}';"), expect_error=True)
        sql(name, races.actor_sql(member, f"update public.spaces set name='New owner' where id='{space}';"))
        assert sql(name, f"select name from public.spaces where id='{space}';") == 'New owner'
    return 2

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--red', action='store_true')
    args = parser.parse_args()
    endpoint = subprocess.run(DOCKER[:3] + ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', 'desktop-linux'],
                              capture_output=True, text=True, check=True).stdout.strip()
    assert endpoint.startswith('unix://'), 'A local Unix-socket Docker context is required'
    suffix = uuid.uuid4().hex[:12]
    names = [f'space_rename_{mode}_{suffix}' for mode in ['upgrade', 'fresh']]
    created = []
    try:
        baseline = subprocess.run(['git', 'show', f'{BASELINE}:supabase/schema.sql'], cwd=ROOT,
                                  capture_output=True, text=True, check=True).stdout
        for name in names:
            sql('postgres', f'create database "{name}" template template0;')
            created.append(name)
            sql(name, SUPPORT)
        upgrade, fresh = names
        sql(upgrade, baseline)
        if args.red:
            output = sql(upgrade, TEST.read_text())
            assert re.search(r'not ok.*Shared member cannot bypass', output), output
            print('RED confirmed: member direct UPDATE bypasses the existing name boundary')
            return
        sql(fresh, (ROOT / 'supabase/schema.sql').read_text())
        sql(upgrade, """begin;
insert into auth.users(id,email) values ('99000000-0000-4000-8000-000000000001','legacy-rename@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('99000000-0000-4000-8000-000000000011','  '||repeat('旧',90)||'  ','shared','LEGACYRN','99000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values ('99000000-0000-4000-8000-000000000011','99000000-0000-4000-8000-000000000001','owner'); commit;""")
        before = sql(upgrade, "select jsonb_agg(to_jsonb(s) order by id) from public.spaces s;")
        function_before = sql(upgrade, "select pg_get_functiondef('public.validate_space_identity()'::regprocedure);")
        sql(upgrade, 'alter table public.spaces disable trigger spaces_validate_identity;')
        sql(upgrade, PATCH.read_text(), expect_error=True)
        assert sql(upgrade, "select pg_get_functiondef('public.validate_space_identity()'::regprocedure);") == function_before
        sql(upgrade, 'alter table public.spaces enable trigger spaces_validate_identity;')
        sql(upgrade, PATCH.read_text())
        sql(upgrade, PATCH.read_text(), expect_error=True)
        assert sql(upgrade, "select jsonb_agg(to_jsonb(s) order by id) from public.spaces s;") == before
        assert dump(upgrade) == dump(fresh), 'Canonical/upgrade schema and ACL differ'
        print('PASS canonical/upgrade full public schema+ACL parity; historical names unchanged')
        for name in names:
            mode = name.split('_')[2]
            print(f'PASS {mode} rename SQL: {tap(name, TEST)} assertions')
            for test in ['2026-09-23-v0.1.10-multispace-foundation.test.sql', '2026-09-25-v0.1.13-space-lifecycle-slice1a.test.sql']:
                print(f'PASS {mode} {test}: {tap(name, ROOT / "supabase/tests" / test)} assertions')
            print(f'PASS {mode} Owner Transfer/rename: {concurrency(name)} observed lock races')
    finally:
        for name in reversed(created):
            sql('postgres', f'drop database "{name}";')

if __name__ == '__main__':
    main()
