"""Local-only two-session checks for v0.1.13 Slice 1A.

Run with the existing Supabase PostgreSQL Docker container. No Production URL or
credentials are used. Test fixtures are removed in finally, including ledger rows.
"""

import subprocess
import time
import uuid


CONTAINER = "supabase_db_cross-platform-shared-calendar"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"]
OWNER = str(uuid.uuid4())
MEMBER = str(uuid.uuid4())
SPACES = []


def sql(command, *, expect_error=False):
    result = subprocess.run(PSQL, input=command, text=True, capture_output=True, timeout=45, check=False)
    if expect_error:
        assert result.returncode != 0, f"expected rejection: {result.stdout}"
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def actor_sql(actor, statement):
    return f"""begin;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','{actor}',true);
{statement}
commit;
"""


def service_sql(statement):
    return f"begin; set local role service_role; {statement}\ncommit;"


def ordered_pair(first, second, *, second_fails=False, second_result=None):
    """Wait for the first transaction's SQL LOCKED marker before starting B."""
    process = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert process.stdin and process.stdout and process.stderr
    process.stdin.write(first)
    process.stdin.close()
    lines = []
    for _ in range(20):
        line = process.stdout.readline()
        assert line, f"first session ended before lock marker: {process.stderr.read()}"
        lines.append(line.strip())
        if line.strip() == "LOCKED":
            break
    else:
        raise AssertionError(f"no lock marker: {lines}")
    second_output = sql(second, expect_error=second_fails)
    process.wait(timeout=45)
    first_output = "\n".join(lines) + process.stdout.read()
    first_error = process.stderr.read()
    assert process.returncode == 0, first_error
    if second_result is not None:
        assert second_result in second_output.splitlines(), second_output
    return first_output, second_output


def new_space():
    space = str(uuid.uuid4())
    SPACES.append(space)
    invite = uuid.uuid4().hex[:8].upper()
    sql(f"""begin;
insert into public.spaces(id,name,kind,invite_code,created_by)
values ('{space}','concurrency fixture','shared','{invite}','{OWNER}');
insert into public.space_members(space_id,user_id,role)
values ('{space}','{OWNER}','owner'),('{space}','{MEMBER}','member');
commit;""")
    return space


def new_event(space, *, recurring=False):
    event = str(uuid.uuid4())
    rule = "'{\"version\":1,\"frequency\":\"daily\",\"interval\":1,\"time_zone\":\"UTC\"}'" if recurring else "null"
    sql(f"""insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,recurrence_rule,time_zone,reminder_kind)
values ('{event}','{space}','{MEMBER}','personal','{MEMBER}','race fixture',now()+interval '1 second',{rule},'UTC','timed_at_start');""")
    if recurring:
        sql(f"update public.events set series_id=id where id='{event}';")
    return event


def new_subscription():
    subscription = str(uuid.uuid4())
    installation = str(uuid.uuid4())
    sql(f"""insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
values ('{subscription}','{MEMBER}','{installation}','https://fcm.googleapis.com/{subscription}','key','auth');""")
    return subscription


def claim_sql(event, subscription, recurring):
    snapshot = sql(f"select quote_literal(starts_at),quote_literal(updated_at),quote_literal(reminder_schedule_changed_at) from public.events where id='{event}';").split("|")
    assert len(snapshot) == 3, snapshot
    due, updated, marker = snapshot
    if recurring:
        call = f"public.claim_recurring_reminder_delivery('{event}','{event}',current_date,'{MEMBER}','{subscription}',{due},{updated},{marker},null,null,null,{marker})"
    else:
        call = f"public.claim_reminder_delivery('{event}','{MEMBER}','{subscription}',{due},{marker})"
    return f"select coalesce({call}::text,'NULL');"


def count(query):
    return int(sql(query).splitlines()[-1])


def check_event_orders():
    space = new_space()
    event = str(uuid.uuid4())
    insert = f"insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at) values ('{event}','{space}','{MEMBER}','personal','{MEMBER}','write first',now()+interval '1 day');"
    first = actor_sql(MEMBER, f"{insert}\nselect 'LOCKED'; select pg_sleep(1);" )
    second = actor_sql(MEMBER, f"select public.leave_shared_space('{space}');")
    ordered_pair(first, second)
    assert count(f"select count(*) from public.events where id='{event}';") == 0
    print("PASS personal Event first -> leave removes committed Event")

    space = new_space()
    event = str(uuid.uuid4())
    insert = f"insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at) values ('{event}','{space}','{MEMBER}','personal','{MEMBER}','write after leave',now()+interval '1 day');"
    first = actor_sql(MEMBER, f"select public.leave_shared_space('{space}'); select 'LOCKED'; select pg_sleep(1);")
    second = actor_sql(MEMBER, insert)
    ordered_pair(first, second, second_fails=True)
    assert count(f"select count(*) from public.events where id='{event}';") == 0
    print("PASS leave first -> personal Event write rejected")


def check_claim_orders(recurring):
    label = "recurring" if recurring else "ordinary"
    subscription = new_subscription()
    space = new_space()
    event = new_event(space, recurring=recurring)
    claim = claim_sql(event, subscription, recurring)
    time.sleep(1.2)
    first = service_sql(f"{claim} select 'LOCKED'; select pg_sleep(1);")
    second = actor_sql(MEMBER, f"select public.leave_shared_space('{space}');")
    first_output, _ = ordered_pair(first, second)
    assert "NULL" not in first_output
    assert count(f"select count(*) from public.reminder_deliveries where event_id='{event}' and status='claimed';") == 1
    sql(f"update public.reminder_deliveries set status='sent',result_code='delivered',provider_status=201 where event_id='{event}';")
    assert count(f"select count(*) from public.reminder_deliveries where event_id='{event}' and status='sent';") == 1
    print(f"PASS {label} claim first -> in-flight ledger can finalize after leave")

    space = new_space()
    event = new_event(space, recurring=recurring)
    claim = claim_sql(event, subscription, recurring)
    time.sleep(1.2)
    first = actor_sql(MEMBER, f"select public.leave_shared_space('{space}'); select 'LOCKED'; select pg_sleep(1);")
    second = service_sql(claim)
    ordered_pair(first, second, second_result="NULL")
    assert count(f"select count(*) from public.reminder_deliveries where event_id='{event}';") == 0
    print(f"PASS {label} leave first -> no new claim or ledger")


def check_lifecycle_orders():
    space = new_space()
    first = actor_sql(OWNER, f"select public.transfer_space_ownership('{space}','{MEMBER}'); select 'LOCKED'; select pg_sleep(1);")
    second = actor_sql(OWNER, f"select public.leave_shared_space('{space}');")
    ordered_pair(first, second)
    assert count(f"select count(*) from public.space_members where space_id='{space}' and role='owner' and user_id='{MEMBER}';") == 1
    print("PASS transfer first -> former owner leaves as member")

    space = new_space()
    first = actor_sql(OWNER, f"select public.remove_space_member('{space}','{MEMBER}'); select 'LOCKED'; select pg_sleep(1);")
    second = actor_sql(OWNER, f"select public.transfer_space_ownership('{space}','{MEMBER}');")
    ordered_pair(first, second, second_fails=True)
    assert count(f"select count(*) from public.space_members where space_id='{space}' and role='owner' and user_id='{OWNER}';") == 1
    print("PASS remove first -> stale transfer rejected")

    space = new_space()
    first = actor_sql(OWNER, f"select public.delete_shared_space('{space}'); select 'LOCKED'; select pg_sleep(1);")
    second = actor_sql(MEMBER, f"select public.leave_shared_space('{space}');")
    ordered_pair(first, second, second_fails=True)
    assert count(f"select count(*) from public.spaces where id='{space}';") == 0
    print("PASS hard delete first -> stale leave rejected")


def cleanup():
    if SPACES:
        ids = ",".join(f"'{space}'" for space in SPACES)
        sql(f"""do $$ declare sid uuid; begin
for sid in select id from public.spaces where id in ({ids}) loop
  perform public.delete_lifecycle_event_set(sid,null);
end loop;
end $$;
delete from public.spaces where id in ({ids});""")
    sql(f"delete from public.reminder_deliveries where recipient_user_id='{MEMBER}';")
    sql(f"delete from auth.users where id in ('{OWNER}','{MEMBER}');")


def main():
    sql(f"""insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('{OWNER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','race-owner-{OWNER}@example.invalid','not-used',now(),'{{}}','{{}}',now(),now()),
('{MEMBER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','race-member-{MEMBER}@example.invalid','not-used',now(),'{{}}','{{}}',now(),now());""")
    try:
        check_event_orders()
        check_claim_orders(False)
        check_claim_orders(True)
        check_lifecycle_orders()
    finally:
        cleanup()


if __name__ == "__main__":
    main()
