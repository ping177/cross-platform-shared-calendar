"""Two real PostgreSQL sessions; simulated authenticated roles, no Auth HTTP.

Receives only an owned disposable database command from the local harness.
Uses observed pg_blocking_pids, not sleeps, to establish the race ordering.
"""
import subprocess
import time
import uuid


def run(db, sql, psql):
    def fixture():
        a, b, c, shared, other, task, event, request = [str(uuid.uuid4()) for _ in range(8)]
        sql(db, f"""begin;
insert into auth.users(id,email) values ('{a}','a@race.invalid'),('{b}','b@race.invalid'),('{c}','c@race.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 ('{shared}','Race Shared','shared','{uuid.uuid4().hex.upper()}','{a}'),
 ('{other}','Join target','shared','{uuid.uuid4().hex.upper()}','{c}');
insert into public.space_members(space_id,user_id,role) values
 ('{shared}','{a}','owner'),('{shared}','{b}','member'),('{other}','{c}','owner');
insert into public.tasks(id,space_id,created_by,title) values ('{task}','{shared}','{a}','Keep Task');
insert into public.events(id,space_id,created_by,scope,title,starts_at) values ('{event}','{shared}','{a}','shared','Keep Event','2030-01-01');
select private.prepare_account_deletion('{b}','{request}'); commit;""")
        return dict(a=a,b=b,c=c,shared=shared,other=other,task=task,event=event,request=request)

    def actor(user, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub','{user}',true);\n{body}\n"

    def accept(f):
        return f"select private.accept_account_deletion('{f['b']}','{f['request']}');"

    def pair(first_body, second_body, *, error=None, waits=True):
        label = 'account_barrier_wait_' + uuid.uuid4().hex
        first = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second = None
        try:
            first.stdin.write("begin; set local statement_timeout='6s';\n" + first_body + "\n\\echo BARRIER_READY\n")
            first.stdin.flush()
            while first.stdout.readline().strip() != 'BARRIER_READY':
                assert first.poll() is None, first.stderr.read()
            second = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            second.stdin.write(f"begin; set local statement_timeout='6s'; set application_name='{label}';\n" + second_body + '\ncommit;\n')
            second.stdin.close()
            if waits:
                observed = None
                for _ in range(60):
                    observed = sql(db, f"select wait_event from pg_stat_activity where application_name='{label}' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0;").strip()
                    if observed:
                        break
                    assert second.poll() is None, second.stderr.read()
                    time.sleep(0.02)
                assert observed == 'advisory', f'Expected a real account advisory wait, got {observed!r}'
            else:
                second.wait(timeout=4)
            first.stdin.write('commit;\n'); first.stdin.close()
            first.wait(timeout=8); second.wait(timeout=8)
            assert first.returncode == 0, first.stderr.read()
            stderr = second.stderr.read()
            if error:
                assert second.returncode != 0 and error in stderr, stderr
            else:
                assert second.returncode == 0, stderr
        finally:
            for process in (second, first):
                if process and process.poll() is None:
                    process.terminate(); process.wait(timeout=5)

    cases = ['event-before-accept','accept-before-event','ensure-before-accept','join-before-accept',
             'accept-before-join','leave-before-accept','remove-with-accept','transfer-before-accept',
             'accept-before-transfer','assign-before-accept','accept-before-assign','owner-create-before-accept',
             'same-request-two-acceptors','competing-preparation']
    for case in cases:
        f = fixture()
        b = f['b']
        event = actor(b, f"insert into public.events(space_id,created_by,scope,title,starts_at) values ('{f['shared']}','{b}','shared','Race new','2030-01-01');")
        assign = actor(f['a'], f"update public.tasks set assigned_to_user_id='{b}' where id='{f['task']}';")
        transfer = actor(f['a'], f"select public.transfer_space_ownership('{f['shared']}','{b}');")
        join = actor(b, f"select public.join_space_by_invite_code('{sql(db, f'''select invite_code from public.spaces where id='{f['other']}';''').strip()}');")
        if case == 'event-before-accept':
            pair(event, accept(f))
        elif case == 'accept-before-event':
            pair(accept(f), event, error='ACCOUNT_ACCESS_REVOKED')
        elif case == 'ensure-before-accept':
            pair(actor(b, 'select public.ensure_personal_space();'), accept(f))
        elif case == 'join-before-accept':
            pair(join, accept(f))
        elif case == 'accept-before-join':
            pair(accept(f), join, error='ACCOUNT_ACCESS_REVOKED')
        elif case == 'leave-before-accept':
            pair(actor(b, f"select public.leave_shared_space('{f['shared']}');"), accept(f))
        elif case == 'remove-with-accept':
            pair(actor(f['a'], f"select public.remove_space_member('{f['shared']}','{b}');"), accept(f), waits=False)
        elif case == 'transfer-before-accept':
            pair(transfer, accept(f), error='SHARED_OWNERSHIP_REQUIRES_ACTION')
        elif case == 'accept-before-transfer':
            pair(accept(f), transfer, error='ACCOUNT_ACCESS_REVOKED')
        elif case == 'assign-before-accept':
            pair(assign, accept(f))
        elif case == 'accept-before-assign':
            pair(accept(f), assign, error='ACCOUNT_ACCESS_REVOKED')
        elif case == 'owner-create-before-accept':
            pair(actor(b, "select public.create_space_with_invite('New Owner');"), accept(f), error='SHARED_OWNERSHIP_REQUIRES_ACTION')
        elif case == 'same-request-two-acceptors':
            pair(accept(f), accept(f))
        else:
            pair(f"select private.prepare_account_deletion('{b}','{f['request']}');",
                 f"select private.prepare_account_deletion('{b}','{uuid.uuid4()}');", error='ACCOUNT_DELETION_INTENT_CONFLICT')
        # Shared source rows survive every race; only existing member actions may
        # change membership/assignment/ownership. Acceptance itself never deletes.
        assert sql(db, f"select title from public.tasks where id='{f['task']}';").strip() == 'Keep Task'
        assert sql(db, f"select title from public.events where id='{f['event']}';").strip() == 'Keep Event'
        expected = 'preparing' if case in ('transfer-before-accept','owner-create-before-accept','competing-preparation') else 'accepted'
        assert sql(db, f"select status from private.account_deletions where user_id='{b}';").strip() == expected
        print(f'PASS {db} concurrency {case}: observed ordering, no deadlock, shared rows intact', flush=True)

    # Long-lived snapshots fail closed rather than reading a pre-acceptance view.
    f = fixture()
    read = sql(db, f"begin isolation level repeatable read; {actor(f['b'], 'select public.current_account_active(); select count(*) from public.profiles;')} rollback;")
    assert read.strip().splitlines()[-2:] == ['f','0'], read
    sql(db, f"begin isolation level repeatable read; {actor(f['b'], 'select public.ensure_personal_space();')} commit;", fail=True)
    print(f'PASS {db} non-READ-COMMITTED access fails closed', flush=True)
