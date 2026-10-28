"""Review CAS verification in owned disposable databases in the existing local container.

No linked project, credentials, Production, resets, or pre-existing data mutations.
"""
import ast
import json
import pathlib
import re
import subprocess
import sys
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCKER = ['docker', '--context', 'desktop-linux']
CONTAINER = 'supabase_db_cross-platform-shared-calendar'
PSQL = DOCKER + ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1']
BASE = '608fcd1066752070e9d93ace51d5bc1cafaffa5d'
PATCH = ROOT / 'supabase/patches/2026-10-17-v0.1.21-review-entry-conflict.sql'
TEST = ROOT / 'supabase/tests/2026-10-17-v0.1.21-review-entry-conflict.test.sql'
OWNED = set()


def sql(db, source, *, error=None):
    assert db in OWNED, 'Only databases created by this run are permitted'
    r = subprocess.run(PSQL + ['-d', db], input=source, text=True, capture_output=True, timeout=40)
    if error:
        assert r.returncode != 0 and error in r.stderr, r.stderr + r.stdout
    else:
        assert r.returncode == 0, r.stderr + r.stdout[-4000:]
    return r.stdout.strip()


def admin(source):
    return subprocess.run(PSQL + ['-d', 'postgres'], input=source, text=True,
                          capture_output=True, check=True, timeout=40).stdout.strip()


def actor(user, source, commit=True):
    return f"begin; set local statement_timeout='15s'; set local role authenticated; select set_config('request.jwt.claim.sub','{user}',true);\n{source}\n" + ('commit;\n' if commit else '')


def fixture(db):
    a, b, space = [str(uuid.uuid4()) for _ in range(3)]
    sql(db, f"""begin;
insert into auth.users(id,email) values ('{a}','a@review-cas.invalid'),('{b}','b@review-cas.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Review CAS','shared','{uuid.uuid4().hex}','{a}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{a}','owner'),('{space}','{b}','member'); commit;""")
    sql(db, actor(a, f"select public.set_space_module_enabled('{space}','review',true);"))
    review = sql(db, actor(a, f"select (public.create_review_round('{space}','2031-01-01')).id;"))
    return a, b, review.splitlines()[-1]


def races(db):
    observed = []
    for mode in ['same-field', 'different-field', 'identical-payload', 'participants', 'mark-then-save', 'save-then-mark']:
        a, b, review = fixture(db)
        def save(focus, progress, rev=0):
            return f"select public.save_my_review_entry('{review}','{focus}','{progress}','Problem','Plan',{rev});"
        if mode == 'different-field':
            sql(db, actor(a, save('Initial', 'Progress')))
            first_action = save('First', 'Progress', 1)
            second_action = save('Initial', 'Desktop progress', 1)
        elif mode == 'mark-then-save':
            sql(db, actor(a, save('First', 'Progress')))
            first_action = f"select public.mark_my_review_filled('{review}',1);"
            second_action = save('Changed after mark', 'Progress', 1)
        else:
            first_action = save('First', 'Progress')
            second_action = save('First' if mode == 'identical-payload' else 'Old', 'Progress')
            if mode == 'save-then-mark': second_action = f"select public.mark_my_review_filled('{review}',0);"
        first = subprocess.Popen(PSQL + ['-d', db], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        label = 'review_cas_wait_' + uuid.uuid4().hex
        second = None
        try:
            first.stdin.write(actor(a, first_action + "select 'CAS_LOCKED';", commit=False)); first.stdin.flush()
            while first.stdout.readline().strip() != 'CAS_LOCKED':
                assert first.poll() is None, first.stderr.read()
            second = subprocess.Popen(PSQL + ['-d', db], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            second.stdin.write(f"set application_name='{label}'; set statement_timeout='15s';\n" + actor(b if mode == 'participants' else a, second_action))
            second.stdin.close()
            wait = None
            for _ in range(100):
                result = sql(db, f"select json_build_object('wait',wait_event,'blockers',pg_blocking_pids(pid)) from pg_stat_activity where application_name='{label}' and wait_event_type='Lock';")
                if result:
                    wait = json.loads(result); break
                time.sleep(0.03)
            assert wait and wait['blockers'], 'No real PostgreSQL lock dependency was observed'
            first.stdin.write('commit;\n'); first.stdin.close(); first.wait(timeout=20); second.wait(timeout=20)
            assert first.returncode == 0, first.stderr.read()
            rejected = mode not in ['participants', 'mark-then-save']
            stderr = second.stderr.read()
            assert (second.returncode != 0) == rejected, stderr
            if rejected: assert 'REVIEW_ENTRY_CONFLICT' in stderr, stderr
            state = json.loads(sql(db, f"select json_agg(json_build_object('user',user_id,'focus',focus,'progress',progress,'revision',content_revision,'filled',filled_revision) order by user_id) from public.review_entries where review_id='{review}';"))
            own = next(e for e in state if e['user'] == a)
            if rejected: assert own['focus'] == 'First' and own['progress'] == 'Progress' and own['revision'] == (2 if mode == 'different-field' else 1)
            if mode == 'participants': assert all(e['revision'] == 1 for e in state)
            if mode == 'mark-then-save': assert own['revision'] == 2 and own['filled'] == 1
            observed.append(dict(mode=mode, baseline_revision=1 if mode in ['different-field','mark-then-save'] else 0, wait=wait, second='conflict' if rejected else 'success', final=state))
        finally:
            for process in [second, first]:
                if process and process.poll() is None:
                    process.terminate(); process.wait(timeout=5)
    print(json.dumps({'database': db, 'observed_races': observed}), flush=True)


def main():
    endpoint = subprocess.check_output(DOCKER + ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    assert endpoint.startswith('unix://'), 'Local Unix socket required'
    tree = ast.parse((ROOT / 'supabase/tests/important_dates_local.py').read_text())
    support = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'SUPPORT' for t in n.targets))
    baseline = subprocess.check_output(['git', 'show', BASE + ':supabase/schema.sql'], cwd=ROOT, text=True)
    red = '--red' in sys.argv
    signatures = None
    try:
        for mode in (['red'] if red else ['upgrade', 'fresh']):
            db = f'review_cas_{mode}_{uuid.uuid4().hex[:12]}'
            assert re.fullmatch(r'review_cas_(red|upgrade|fresh)_[a-f0-9]{12}', db)
            admin(f'create database "{db}" template template0;'); OWNED.add(db)
            sql(db, support)
            sql(db, baseline if mode != 'fresh' else (ROOT / 'supabase/schema.sql').read_text())
            if mode == 'upgrade':
                a, b, review = fixture(db)
                sql(db, actor(a, f"select public.save_my_review_entry('{review}','Legacy',null,null,'Keep');"))
                query = 'select jsonb_agg(to_jsonb(e) order by review_id,user_id) from public.review_entries e;'
                before = sql(db, query)
                sql(db, PATCH.read_text())
                assert sql(db, query) == before, 'Patch changed historical entry rows'
                sql(db, PATCH.read_text(), error='already exist')
                assert sql(db, query) == before, 'Rejected repeat patch changed entries'
            source = TEST.read_text()
            if red: source = source[:source.index('insert into auth.users')] + 'select * from finish(); rollback;'
            result = sql(db, source)
            if red:
                assert re.search(r'^not ok', result, re.M), result
                print('RED confirmed: checked RPCs absent on unchanged HEAD baseline', flush=True)
                return
            assert not re.search(r'^not ok|^# Looks like', result, re.M), result
            print(mode + ': focused pgTAP ' + re.search(r'^1\.\.(\d+)', result, re.M)[0], flush=True)
            current = sql(db, "select jsonb_agg(jsonb_build_array(pg_get_functiondef(oid),proacl::text) order by oid::regprocedure::text) from pg_proc where pronamespace='public'::regnamespace and proname in ('save_my_review_entry','mark_my_review_filled');")
            if signatures is not None: assert current == signatures, 'Upgrade/fresh definitions or ACL differ'
            signatures = current
            races(db)
            for file in ['2026-09-26-v0.1.14-review-foundation.test.sql', '2026-09-26-v0.1.14-review-date-chronology.test.sql', '2026-10-15-review-delete.test.sql']:
                result = sql(db, (ROOT / 'supabase/tests' / file).read_text())
                assert not re.search(r'^not ok|^# Looks like', result, re.M), file + '\n' + result
                print(mode + ': regression ' + file + ' ' + re.search(r'^1\.\.(\d+)', result, re.M)[0], flush=True)
    finally:
        for db in sorted(OWNED):
            admin(f'drop database "{db}";')
            print('CLEANED ' + db, flush=True)
        assert not admin("select datname from pg_database where datname in (" + ','.join("'" + db + "'" for db in OWNED) + ');') if OWNED else True


if __name__ == '__main__':
    main()
