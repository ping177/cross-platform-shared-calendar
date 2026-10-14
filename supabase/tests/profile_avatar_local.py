"""Avatar contract in disposable databases in the existing LOCAL Docker container.

Copies only the real local Storage schema, not files or user data. Never targets
Production or writes the existing local app database. Database removal is limited
to generated avatar_test_* names created by this run.
"""
import argparse
import pathlib
import re
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
from important_dates_local import SUPPORT

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCKER = ['docker', '--context', 'desktop-linux']
CONTAINER = 'supabase_db_cross-platform-shared-calendar'
PSQL = DOCKER + ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
BASELINE = '3512e1f89fea066a8366d54aee802ae7ed0e4a44'

def sql(name, source, fails=False):
    if name != 'postgres' and not re.fullmatch(r'avatar_test_(upgrade|fresh)_[a-f0-9]{12}', name):
        raise ValueError('Only generated disposable databases allowed')
    result = subprocess.run(PSQL + ['-d', name], input=source, text=True, capture_output=True, timeout=60)
    assert (result.returncode != 0) if fails else (result.returncode == 0), result.stderr + result.stdout[-2500:]
    return result.stdout

def tap(name, path):
    output = sql(name, path.read_text())
    assert not re.search(r'^not ok|^# Looks like', output, re.M), output
    plan = re.search(r'^1\.\.(\d+)', output, re.M)
    assert plan, output
    return int(plan[1])

def dump(name, schema):
    return subprocess.run(DOCKER + ['exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', name,
        '--schema-only', '--schema=' + schema, '--no-owner', '--no-comments'], text=True, capture_output=True, check=True, timeout=60).stdout

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--red', action='store_true'); args = parser.parse_args()
    endpoint = subprocess.run(DOCKER + ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], capture_output=True, text=True, check=True).stdout.strip()
    assert endpoint.startswith('unix://'), 'Local Unix-socket Docker context required'
    storage = dump('postgres', 'storage')
    # Storage bootstrap dump can contain arbitrary pre-existing policies/buckets;
    # tests require the actual schema to have no pre-existing app policies.
    assert 'CREATE POLICY' not in storage, 'Local Storage policy baseline requires review'
    baseline = subprocess.run(['git','show',BASELINE + ':supabase/schema.sql'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    suffix = uuid.uuid4().hex[:12]; created = []
    try:
        for mode in ['upgrade', 'fresh']:
            name = f'avatar_test_{mode}_{suffix}'
            sql('postgres', f'create database "{name}" template template0;'); created.append(name)
            sql(name, SUPPORT); sql(name, storage)
            sql(name, baseline if mode == 'upgrade' or args.red else (ROOT/'supabase/schema.sql').read_text())
            if args.red:
                sql(name, "select avatar_path from public.profiles;", fails=True)
                print('RED confirmed: baseline has no persisted avatar contract'); return
            if mode == 'upgrade':
                before = sql(name, "select jsonb_agg(row_to_json(p)) from pg_policies p where schemaname='public';")
                patch = (ROOT/'supabase/patches/2026-10-14-profile-avatar.sql').read_text()
                sql(name, 'create policy unexpected on storage.objects for select to authenticated using (true);')
                sql(name, patch, fails=True)
                assert sql(name, "select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_path';").strip() == '0'
                sql(name, 'drop policy unexpected on storage.objects;'); sql(name, patch); sql(name, patch, fails=True)
                assert before == sql(name, "select jsonb_agg(row_to_json(p)) from pg_policies p where schemaname='public';")
                print('PASS unknown Storage policy drift/replay rejection; existing public RLS unchanged')
            for test in ['2026-10-14-profile-avatar.test.sql','2026-10-14-space-rename.test.sql','2026-09-25-v0.1.13-space-lifecycle-slice1a.test.sql']:
                print(f'PASS {mode} {test}: {tap(name, ROOT/"supabase/tests"/test)} assertions')
        for schema in ['public','storage']:
            normalize = lambda s: '\n'.join(line for line in s.splitlines() if not line.startswith(('\\restrict ', '\\unrestrict ')))
            assert normalize(dump(created[0],schema)) == normalize(dump(created[1],schema)), f'{schema} canonical/upgrade mismatch'
        print('PASS canonical/upgrade full public and Storage schema/ACL parity')
    finally:
        for name in reversed(created): sql('postgres', f'drop database "{name}";')

if __name__ == '__main__': main()
