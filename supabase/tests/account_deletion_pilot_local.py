"""Run the preparation gate on a disposable, network-disabled PostgreSQL fixture."""
import ast
import re
import subprocess
import time
import uuid

from account_deletion_local import DOCKER, IMAGE, ROOT, STORAGE_SUPPORT, command


def main():
    endpoint = subprocess.check_output(DOCKER + [
        'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}',
    ], text=True).strip()
    assert endpoint.startswith('unix://'), 'Only local Unix-socket Docker is allowed'
    name = 'calendar_deletion_pilot_' + uuid.uuid4().hex[:12]
    dbs = ('postgres', 'pilot_upgrade', 'pilot_fresh')
    tree = ast.parse((ROOT / 'supabase/tests/important_dates_local.py').read_text())
    support = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == 'SUPPORT' for t in n.targets))
    schema = (ROOT / 'supabase/schema.sql').read_text()
    marker = '-- ACCOUNT_DELETION_PILOT_BEGIN'
    ga_marker = '-- ACCOUNT_DELETION_GA_BEGIN'
    pilot_schema, ga_definition = schema.split(ga_marker)
    baseline = pilot_schema.split(marker)[0]
    patch = (ROOT / 'supabase/patches/2026-11-08-account-deletion-pilot-preparation.sql').read_text()
    test = (ROOT / 'supabase/tests/2026-11-08-account-deletion-pilot-preparation.test.sql').read_text()
    ga_patch = (ROOT / 'supabase/patches/2026-11-09-account-deletion-general-availability.sql').read_text()
    ga_test = (ROOT / 'supabase/tests/2026-11-09-account-deletion-general-availability.test.sql').read_text()
    assert pilot_schema.split(marker)[1].rstrip() == patch.split(marker)[1].removesuffix('commit;\n').rstrip()
    assert ga_definition == ga_patch.split(ga_marker)[1].removesuffix('commit;\n')

    def sql(db, source, *, fail=False):
        assert db in dbs
        result = command(DOCKER + ['exec', '-i', name, 'psql', '-h', '/tmp', '-U', 'postgres',
                                   '-d', db, '-XqAt', '-v', 'ON_ERROR_STOP=1'], source=source)
        assert bool(result.returncode) == fail, result.stderr + result.stdout[-3000:]
        return result.stderr if fail else result.stdout

    def other_functions(db):
        return sql(db, """select md5(jsonb_agg(to_jsonb(p) - 'oid' order by p.oid)::text)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname in ('private','public') and p.proname<>'prepare_my_account_deletion';""")

    result = command(DOCKER + [
        'run', '--detach', '--rm', '--pull', 'never', '--network', 'none', '--name', name,
        '--user', 'postgres', '--tmpfs', '/tmp:mode=1777', '--entrypoint', 'sh', IMAGE, '-c',
        'initdb -D /tmp/pilot_pgdata -A trust --no-locale --encoding=UTF8 >/dev/null && '
        'exec postgres -D /tmp/pilot_pgdata -c listen_addresses= -c unix_socket_directories=/tmp',
    ])
    assert result.returncode == 0, result.stderr
    try:
        for _ in range(60):
            if not command(DOCKER + ['exec', name, 'pg_isready', '-h', '/tmp', '-U', 'postgres']).returncode:
                break
            time.sleep(.25)
        else:
            raise AssertionError('Disposable PostgreSQL did not become ready')
        sql('postgres', 'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;')
        for db in dbs[1:]:
            sql('postgres', f'create database {db} template template0;')
            sql(db, support + STORAGE_SUPPORT + """
              alter table storage.objects add column owner uuid;
              create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
            """)
            if db=='pilot_upgrade':
                sql(db, baseline)
                red = sql(db, test)
                assert re.search(r'^not ok .*closed admission rejects A', red, re.M), red
                print('RED: prior preparation RPC accepts requests while admission is closed', flush=True)
                definition = sql(db, "select pg_get_functiondef('public.prepare_my_account_deletion()'::regprocedure);")
                unexpected = re.sub(r'(\bbegin\n)', r'\1  -- fixture drift\n', definition, count=1)
                assert unexpected != definition
                sql(db, unexpected)
                assert 'Account deletion preparation baseline drift' in sql(db, patch, fail=True)
                assert sql(db, "select pg_get_functiondef('public.prepare_my_account_deletion()'::regprocedure);") == unexpected
                sql(db, definition)
                others_before = other_functions(db)
                acl_before = sql(db, "select proacl::text from pg_proc where oid='public.prepare_my_account_deletion()'::regprocedure;")
                sql(db, patch)
                sql(db, patch)
                assert other_functions(db) == others_before
                assert sql(db, "select proacl::text from pg_proc where oid='public.prepare_my_account_deletion()'::regprocedure;") == acl_before
                print('PASS drift refusal, repeat application, existing ACL and all other functions unchanged', flush=True)
                output = sql(db, test)
                assert not re.search(r'^not ok|^# Looks like', output, re.M), output
                assert len(re.findall(r'^ok ', output, re.M)) == 15, output
                red = sql(db, ga_test)
                assert re.search(r'^not ok .*GA admits the first unlisted identity', red, re.M), red
                sql(db, 'update private.account_deletion_admission set enabled=true where singleton;')
                assert 'Close new account deletion admission' in sql(db, ga_patch, fail=True)
                sql(db, 'update private.account_deletion_admission set enabled=false where singleton;')
                sql(db, ga_patch)
                sql(db, ga_patch)
                assert other_functions(db) == others_before
                assert sql(db, "select proacl::text from pg_proc where oid='public.prepare_my_account_deletion()'::regprocedure;") == acl_before
                assert sql(db, 'select enabled from private.account_deletion_admission where singleton;').strip() == 'f'
                print('PASS 15 pilot assertions and GA migration guard, reapplication and ACL', flush=True)
            else:
                sql(db, schema)
            output = sql(db, ga_test)
            assert not re.search(r'^not ok|^# Looks like', output, re.M), output
            assert len(re.findall(r'^ok ', output, re.M)) == 8, output
            assert sql(db, 'select count(*) from private.account_deletions;').strip() == '0'
            print(f'PASS {db}: 8 GA pgTAP assertions, preparation fixtures rolled back', flush=True)
    finally:
        removed = command(DOCKER + ['rm', '--force', name])
        assert removed.returncode == 0, removed.stderr


if __name__ == '__main__':
    main()
