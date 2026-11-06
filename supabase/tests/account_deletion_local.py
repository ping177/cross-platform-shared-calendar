"""Audit snapshot tests in an owned, network-isolated, disposable PostgreSQL.

Uses a cached image only. No existing containers/databases, linked Supabase,
credentials, host ports, bind mounts, or Production access. Auth is a SQL stub;
this harness does not establish Auth Admin / Session / Storage readiness.
"""
import argparse
import ast
import pathlib
import re
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCKER = ['docker', '--context', 'desktop-linux']
IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.127'
BASE = '4b1032e1924ee64d6f7f5faa24f36ec7af831161'
PATCH = ROOT / 'supabase/patches/2026-11-05-account-deletion-audit-snapshots.sql'
TEST = ROOT / 'supabase/tests/2026-11-05-account-deletion-audit-snapshots.test.sql'
TABLES = ['profiles', 'spaces', 'space_members', 'space_modules', 'events', 'tasks',
          'event_occurrence_exceptions', 'review_rounds', 'review_entries', 'lists',
          'list_sections', 'list_items', 'important_dates', 'push_subscriptions', 'reminder_deliveries']

# Minimal SQL policy fixture, not the managed Storage schema or HTTP service.
STORAGE_SUPPORT = """
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated,service_role;
"""


def normalized_dump(source, *, remove_audit_fks=False):
    if remove_audit_fks:
        source, count = re.subn(
            r'ALTER TABLE ONLY public\.(?:spaces|events|tasks|review_rounds)\n'
            r'    ADD CONSTRAINT (?:spaces|events|tasks|review_rounds)_created_by_fkey[^;]*;\n', '', source)
        assert count == 4, f'Expected exactly four audit FK definitions, got {count}'
    # pg_dump still emits object-name headers with --no-comments; removing a FK
    # also removes that header. Compare actual DDL, not dump annotations/nonces.
    return '\n'.join(line for line in source.splitlines()
                     if line.strip() and not line.startswith(('--', '\\restrict ', '\\unrestrict ')))


def command(args, *, source=None, timeout=60):
    return subprocess.run(args, input=source, text=True, capture_output=True, timeout=timeout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--red', action='store_true')
    parser.add_argument('--barrier', action='store_true')
    parser.add_argument('--trusted', action='store_true')
    parser.add_argument('--historical-baseline', action='store_true')
    args = parser.parse_args()
    if args.trusted or args.historical_baseline: args.barrier = True
    endpoint = subprocess.check_output(DOCKER + ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    assert endpoint.startswith('unix://'), 'Only local Unix-socket Docker is allowed'
    name = 'calendar_account_audit_' + uuid.uuid4().hex[:12]
    assert re.fullmatch(r'calendar_account_audit_[a-f0-9]{12}', name)
    owned = False

    def sql(db, source, *, fail=False):
        assert db in ('postgres', 'audit_red', 'audit_upgrade', 'audit_fresh')
        result = command(DOCKER + ['exec', '-i', name, 'psql', '-h', '/tmp', '-U', 'postgres',
                                  '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], source=source)
        assert (result.returncode != 0) if fail else (result.returncode == 0), result.stderr + result.stdout[-6000:]
        return result.stdout

    def tap(db, path, *, red=False):
        output = sql(db, path.read_text())
        failures = re.findall(r'^not ok[^\n]*', output, re.M)
        if red:
            assert failures, 'Expected a semantic failing regression on the baseline'
            print('RED confirmed: ' + '; '.join(failures), flush=True)
        else:
            assert not failures and not re.search(r'^# Looks like', output, re.M), output
            plan = re.search(r'^1\.\.(\d+)$', output, re.M)
            assert plan, output
            print(f'PASS {db} {path.name}: {plan.group(1)} assertions', flush=True)

    def dump(db):
        result = command(DOCKER + ['exec', name, 'pg_dump', '-h', '/tmp', '-U', 'postgres',
                                  '-d', db, '--schema-only', '--schema=public', '--no-owner', '--no-comments']
                         + (['--schema=private','--schema=storage'] if args.barrier else []))
        assert result.returncode == 0, result.stderr
        return result.stdout

    def fingerprint(db):
        return [sql(db, f"select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.{table} t;")
                for table in TABLES]

    try:
        # Skip image initialization scripts and all existing app volumes.
        started = command(DOCKER + ['run', '--detach', '--rm', '--pull', 'never', '--network', 'none',
                                   '--name', name, '--user', 'postgres', '--tmpfs', '/tmp:mode=1777',
                                   '--entrypoint', 'sh', IMAGE, '-c',
                                   'initdb -D /tmp/audit_pgdata -A trust --no-locale --encoding=UTF8 >/dev/null && '
                                   'exec postgres -D /tmp/audit_pgdata -c listen_addresses= -c unix_socket_directories=/tmp'])
        assert started.returncode == 0, started.stderr
        owned = True
        for _ in range(60):
            ready = command(DOCKER + ['exec', name, 'pg_isready', '-h', '/tmp', '-U', 'postgres'])
            if ready.returncode == 0:
                break
            time.sleep(0.25)
        else:
            raise AssertionError('Disposable PostgreSQL did not become ready')
        sql('postgres', 'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;')
        tree = ast.parse((ROOT / 'supabase/tests/important_dates_local.py').read_text())
        support = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                       and any(isinstance(t, ast.Name) and t.id == 'SUPPORT' for t in n.targets))
        baseline = subprocess.check_output(['git', 'show', BASE + ':supabase/schema.sql'], cwd=ROOT, text=True)
        dumps = []
        for mode in (['red'] if args.red else ['upgrade', 'fresh']):
            db = 'audit_' + mode
            sql('postgres', f'create database {db} template template0;')
            sql(db, support)
            if args.barrier:
                sql(db, STORAGE_SUPPORT)
            canonical = (ROOT / 'supabase/schema.sql').read_text()
            canonical = canonical.split('-- ACCOUNT_DELETION_EXECUTION_BEGIN')[0]
            if not args.trusted:
                canonical = canonical.split('-- ACCOUNT_DELETION_TRUSTED_BEGIN')[0]
            if not args.barrier:
                # Keep the independently repeatable Slice 1 checkpoint suite.
                canonical = canonical.split('-- ACCOUNT_DELETION_BARRIER_BEGIN')[0]
            sql(db, canonical if mode == 'fresh' else baseline)
            if mode == 'upgrade':
                sql(db, """begin;
insert into auth.users(id,email) values ('ae000000-0000-4000-8000-000000000001','upgrade@audit.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 ('ae000000-0000-4000-8000-000000000010','Existing Shared','shared','AUDITUPGRADE','ae000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
 ('ae000000-0000-4000-8000-000000000010','ae000000-0000-4000-8000-000000000001','owner');
insert into public.tasks(space_id,created_by,title,assigned_to_user_id) values
 ('ae000000-0000-4000-8000-000000000010','ae000000-0000-4000-8000-000000000001','Keep exact legacy row','ae000000-0000-4000-8000-000000000001');
commit;""")
                before_rows = fingerprint(db)
                before_schema = dump(db)
                # Inject only our own extra fixture FK; unknown dependencies must
                # reject before any of the four real constraints is removed.
                sql(db, 'alter table public.tasks add constraint audit_unexpected_fkey foreign key(created_by) references auth.users(id);')
                sql(db, PATCH.read_text(), fail=True)
                sql(db, 'alter table public.tasks drop constraint audit_unexpected_fkey;')
                assert normalized_dump(before_schema) == normalized_dump(dump(db)), 'Failed preflight mutated schema'
                sql(db, PATCH.read_text())
                assert before_rows == fingerprint(db), 'Upgrade changed existing business rows'
                assert normalized_dump(before_schema, remove_audit_fks=True) == normalized_dump(dump(db)), 'Patch changed more than the four audit FKs'
                sql(db, PATCH.read_text(), fail=True)
                assert before_rows == fingerprint(db), 'Replay failure changed business rows'
                print('PASS upgrade: 15 table fingerprints unchanged; only four audit FKs differ; unknown-FK/replay rejection', flush=True)
            if args.barrier:
                barrier_test = ROOT / 'supabase/tests/2026-11-05-account-deletion-barrier.test.sql'
                if args.red:
                    output = sql(db, barrier_test.read_text().split('-- Runtime cases')[0] + '\nselect * from finish(); rollback;')
                    assert len(re.findall(r'^not ok', output, re.M)) == 4, output
                    print('RED confirmed: four missing state/barrier contract assertions', flush=True)
                    continue
                if mode == 'upgrade':
                    before_state_rows = fingerprint(db)
                    state_patch = (ROOT / 'supabase/patches/2026-11-05-account-deletion-barrier.sql').read_text()
                    if args.historical_baseline:
                        history = (ROOT / 'supabase/patches/2026-09-23-v0.1.10-multispace-foundation.sql').read_text()
                        definitions = []
                        for function in ('ensure_personal_space', 'join_space_by_invite_code'):
                            match = re.search(r'create or replace function public\.' + function
                                              + r'\([^;]*?as \$\$.*?\$\$;', history, re.S)
                            assert match, function
                            definitions.append(match.group())
                        sql(db, '\n'.join(definitions))
                    # An unreviewed body (even a comment-only change) must fail
                    # closed for either function, without partial DDL or row changes.
                    for signature in ('public.ensure_personal_space()', 'public.join_space_by_invite_code(text)'):
                        definition = sql(db, f"select pg_get_functiondef('{signature}'::regprocedure);")
                        delimiter = re.search(r'AS (\$\w*\$)', definition).group(1)
                        at = definition.rindex(delimiter)
                        altered = definition[:at] + '\n-- unreviewed baseline fixture\n' + definition[at:]
                        sql(db, altered)
                        before_rejection = normalized_dump(dump(db))
                        sql(db, state_patch, fail=True)
                        assert before_rejection == normalized_dump(dump(db)), 'Rejected patch changed schema/ACL'
                        assert before_state_rows == fingerprint(db), 'Rejected patch changed business data'
                        sql(db, definition)
                        print('PASS unknown body rejected atomically: ' + signature, flush=True)
                    sql(db, state_patch)
                    sql(db, state_patch, fail=True)
                    assert before_state_rows == fingerprint(db), 'Barrier installation changed business rows'
                if args.trusted and mode=='upgrade':
                    trusted_patch=(ROOT/'supabase/patches/2026-11-06-account-deletion-trusted.sql').read_text()
                    sql(db,trusted_patch)
                    sql(db,trusted_patch,fail=True)
                if args.trusted:
                    sql(db, "update private.account_deletion_admission set enabled=true where singleton;")
                tap(db, barrier_test)
                if args.trusted:
                    tap(db,ROOT/'supabase/tests/2026-11-06-account-deletion-trusted.test.sql')
                from account_deletion_barrier_concurrency import run
                run(db, sql, DOCKER + ['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d',db,
                                      '-X','-q','-t','-A','-v','ON_ERROR_STOP=1'])
            tap(db, TEST, red=args.red)
            if not args.red:
                for filename in ['2026-09-25-v0.1.13-space-lifecycle-slice1a.test.sql',
                                 '2026-09-26-v0.1.15-shared-lists-slice1.test.sql',
                                 '2026-10-15-event-collaboration.test.sql',
                                 '2026-10-17-v0.1.21-review-entry-conflict.test.sql']:
                    tap(db, ROOT / 'supabase/tests' / filename)
                dumps.append(normalized_dump(dump(db)))
        if not args.red:
            assert dumps[0] == dumps[1], 'Fresh/upgrade public schema and ACL differ'
            print('PASS fresh/upgrade schema + ACL parity' + (' (public/private/Storage SQL fixture)' if args.barrier else ' (public)') + ('; restricted accepted-job business cleanup only, no Auth/finalizer' if args.trusted else '; no application deletion entry point'), flush=True)
    finally:
        if owned:
            removed = command(DOCKER + ['rm', '--force', name])
            assert removed.returncode == 0, removed.stderr
            print('Removed only the owned ephemeral test container and its tmpfs databases', flush=True)


if __name__ == '__main__':
    main()
