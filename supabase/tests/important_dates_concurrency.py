"""Real two-session ordering checks; caller supplies a disposable local Database."""

import subprocess
import time
import uuid


def actor(actor_id, statement):
    return f"begin; set local role authenticated; select set_config('request.jwt.claim.sub','{actor_id}',true); {statement}"


def ordered_pair(db, first, second, *, error=None, wait_event="advisory", after_wait=None):
    app = "v018_task2_waiter_" + uuid.uuid4().hex[:10]
    holder = subprocess.Popen(db.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    waiter = None
    try:
        holder.stdin.write(first + " select 'LOCKED';\n")
        holder.stdin.flush()
        for _ in range(20):
            line = holder.stdout.readline()
            assert line, "Holder ended before lock marker"
            if line.strip() == "LOCKED":
                break
        else:
            raise AssertionError("Missing holder lock marker")
        waiter = subprocess.Popen(db.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        waiter.stdin.write(f"set application_name='{app}'; {second} commit;\n")
        waiter.stdin.close()
        waiter.stdin = None
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            waiting = db.sql(f"select wait_event from pg_stat_activity where datname=current_database() and application_name='{app}' and wait_event_type='Lock';")
            if waiting:
                assert waiting == wait_event, (waiting, wait_event)
                break
            assert waiter.poll() is None, "Waiter completed without waiting on the required lock"
            time.sleep(0.03)
        else:
            raise AssertionError("No observed database lock wait")
        if after_wait is not None:
            after_wait()
        holder.stdin.write("commit;\n")
        holder.stdin.close()
        holder.stdin = None
        _, holder_error = holder.communicate(timeout=15)
        assert holder.returncode == 0, holder_error
        output, waiter_error = waiter.communicate(timeout=15)
        if error:
            assert waiter.returncode != 0 and error in waiter_error, waiter_error
            assert "deadlock" not in waiter_error.lower(), waiter_error
        else:
            assert waiter.returncode == 0, waiter_error
        return output
    finally:
        for process in [holder, waiter]:
            if process is not None and process.poll() is None:
                process.kill()
                process.communicate(timeout=10)


def fixture(db):
    owner, member, space = (str(uuid.uuid4()) for _ in range(3))
    db.sql(f"""begin;
insert into auth.users(id,email) values ('{owner}','owner@example.invalid'),('{member}','member@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Concurrency','shared','{uuid.uuid4().hex[:8]}','{owner}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{owner}','owner'),('{space}','{member}','member');
commit;""")
    db.sql(actor(owner, f"select public.set_space_module_enabled('{space}','important_dates',true); commit;"))
    row_id = db.sql(actor(member, f"select (public.create_important_date('{space}','Original',null,'annual',9,30,2030,'UTC')).id; commit;")).splitlines()[-1]
    return owner, member, space, row_id


def run_concurrency(db):
    count = 0
    for transition in ["disable", "leave", "remove", "space-delete"]:
        for mutation in ["create", "update", "delete"]:
            owner, member, space, row = fixture(db)
            first = {
                "disable": actor(owner, f"select public.set_space_module_enabled('{space}','important_dates',false);"),
                "leave": actor(member, f"select public.leave_shared_space('{space}');"),
                "remove": actor(owner, f"select public.remove_space_member('{space}','{member}');"),
                "space-delete": actor(owner, f"select public.delete_shared_space('{space}');"),
            }[transition]
            statement = {
                "create": f"select public.create_important_date('{space}','Late',null,'annual',1,1,null,'UTC');",
                "update": f"select public.update_important_date('{row}','Late',null,'annual',1,1,null);",
                "delete": f"select public.delete_important_date('{row}');",
            }[mutation]
            error = "Space not found" if transition == "space-delete" else (
                "Important Dates module is disabled" if transition == "disable" else "Current Important Date Space membership is required")
            ordered_pair(db, first, actor(member, statement), error=error)
            assert db.sql(f"select count(*) from public.important_dates where space_id='{space}';") == ("0" if transition == "space-delete" else "1")
            if transition != "space-delete":
                assert db.sql(f"select name from public.important_dates where id='{row}';") == "Original"
            count += 1
            print(f"PASS {transition} first rejects waiting {mutation}")

    for mutation in ["update", "delete"]:
        owner, member, space, row = fixture(db)
        statement = (f"select public.update_important_date('{row}','Late',null,'annual',1,1,null);"
                     if mutation == "update" else f"select public.delete_important_date('{row}');")
        ordered_pair(db, actor(owner, f"select public.delete_important_date('{row}');"), actor(member, statement), error="Important Date not found")
        count += 1
        print(f"PASS object delete first rejects waiting {mutation} after identity reread")

    owner, member, space, row = fixture(db)
    ordered_pair(db, actor(member, f"select public.create_important_date('{space}','First',null,'annual',1,1,null,'UTC');"),
                 actor(owner, f"select public.set_space_module_enabled('{space}','important_dates',false);"))
    assert db.sql(f"select count(*) from public.important_dates where space_id='{space}';") == "2"
    assert db.sql(f"select enabled from public.space_modules where space_id='{space}' and module_key='important_dates';") == "f"
    count += 1
    print("PASS mutation first commits before disable; canonical data retained")

    owner, member, space, row = fixture(db)
    ordered_pair(db, actor(owner, f"select public.transfer_space_ownership('{space}','{member}');"),
                 actor(owner, f"select public.set_space_module_enabled('{space}','important_dates',false);"), error="Only the Space owner may change modules")
    count += 1
    print("PASS owner toggle revalidates transferred ownership after waiting")

    owner, member, space, row = fixture(db)
    ordered_pair(db, actor(owner, f"select public.transfer_space_ownership('{space}','{member}');"),
                 actor(owner, f"select public.update_important_date('{row}','Still member',null,'annual',9,30,2030);"))
    assert db.sql(f"select name from public.important_dates where id='{row}';") == "Still member"
    count += 1
    print("PASS transferred former owner retains member CRUD authority")

    owner, member, space, row = fixture(db)
    ordered_pair(db, f"begin; delete from public.space_members where space_id='{space}' and user_id='{member}';",
                 actor(member, f"select public.update_important_date('{row}','Late',null,'annual',1,1,null);"),
                 error="Current Important Date Space membership is required", wait_event="transactionid")
    count += 1
    print("PASS parent-row-only membership removal is revalidated after Space row wait")

    owner, member, space, row = fixture(db)
    ordered_pair(db, f"begin; delete from auth.users where id='{member}';",
                 actor(member, f"select public.delete_important_date('{row}');"),
                 error="Current Important Date Space membership is required", wait_event="transactionid")
    assert db.sql(f"select created_by::text from public.important_dates where id='{row}';") == member
    count += 1
    print("PASS Auth cascade revokes member access but retains creator audit and canonical row")
    return count
