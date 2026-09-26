"""Local-only two-session review numbering and module-lock checks."""

import subprocess
import uuid


CONTAINER = "supabase_db_cross-platform-shared-calendar"
PSQL = [
    "docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1",
]
OWNER = str(uuid.uuid4())
MEMBER = str(uuid.uuid4())
SPACE = str(uuid.uuid4())


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


def ordered_pair(first, second, *, second_fails=False):
    process = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert process.stdin and process.stdout and process.stderr
    process.stdin.write(first)
    process.stdin.close()
    first_lines = []
    for _ in range(12):
        line = process.stdout.readline()
        assert line, f"first session ended before lock marker: {process.stderr.read()}"
        first_lines.append(line.strip())
        if line.strip() == "LOCKED":
            break
    else:
        raise AssertionError(f"no lock marker: {first_lines}")
    second_output = sql(second, expect_error=second_fails)
    process.wait(timeout=45)
    assert process.returncode == 0, process.stderr.read()
    first_output = "\n".join(first_lines) + process.stdout.read()
    return first_output, second_output


def main():
    invite = uuid.uuid4().hex[:8].upper()
    try:
        sql(f"""begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('{OWNER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-concurrency-a@example.invalid','not-used',now(),'{{}}','{{}}',now(),now()),
       ('{MEMBER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-concurrency-b@example.invalid','not-used',now(),'{{}}','{{}}',now(),now());
insert into public.spaces(id,name,kind,invite_code,created_by)
values ('{SPACE}','review concurrency','shared','{invite}','{OWNER}');
insert into public.space_members(space_id,user_id,role)
values ('{SPACE}','{OWNER}','owner'),('{SPACE}','{MEMBER}','member');
commit;""")
        sql(actor_sql(OWNER, f"select public.set_space_module_enabled('{SPACE}','review',true);"))

        create = lambda review_date: f"select (public.create_review_round('{SPACE}',date '{review_date}')).round_no;"
        first, _ = ordered_pair(
            actor_sql(OWNER, f"{create('2026-09-26')} select 'LOCKED'; select pg_sleep(1);"),
            actor_sql(MEMBER, create('2026-09-26')),
            second_fails=True,
        )
        assert "1" in first.splitlines(), first
        assert sql(f"select count(*) from public.review_rounds where space_id='{SPACE}';") == "1"
        assert sql(f"select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='{SPACE}';") == "2"
        print("PASS concurrent same-date create allows one round with no orphan entries")

        first, second = ordered_pair(
            actor_sql(OWNER, f"{create('2026-09-27')} select 'LOCKED'; select pg_sleep(1);"),
            actor_sql(MEMBER, create('2026-09-25')),
        )
        assert "2" in first.splitlines(), first
        assert "3" in second.splitlines(), second
        assert sql(f"select string_agg(round_no::text||':'||review_date::text,',' order by round_no) from public.review_rounds where space_id='{SPACE}';") == "1:2026-09-26,2:2026-09-27,3:2026-09-25"
        assert sql(f"select string_agg(review_date::text,',' order by review_date desc) from public.review_rounds where space_id='{SPACE}';") == "2026-09-27,2026-09-26,2026-09-25"
        print("PASS concurrent different-date create keeps round sequence technical and chronology date-driven")

        first, _ = ordered_pair(
            actor_sql(OWNER, f"select public.set_space_module_enabled('{SPACE}','review',false); select 'LOCKED'; select pg_sleep(1);"),
            actor_sql(MEMBER, create('2026-09-28')),
            second_fails=True,
        )
        assert "LOCKED" in first
        assert sql(f"select count(*) from public.review_rounds where space_id='{SPACE}';") == "3"
        print("PASS disable first rejects a concurrent create")

        sql(actor_sql(OWNER, f"select public.set_space_module_enabled('{SPACE}','review',true);"))
        first, _ = ordered_pair(
            actor_sql(OWNER, f"{create('2026-09-28')} select 'LOCKED'; select pg_sleep(1);"),
            actor_sql(OWNER, f"select public.set_space_module_enabled('{SPACE}','review',false);"),
        )
        assert "4" in first.splitlines(), first
        assert sql(f"select count(*) from public.review_rounds where space_id='{SPACE}';") == "4"
        assert sql(f"select enabled from public.space_modules where space_id='{SPACE}' and module_key='review';") == "f"
        print("PASS create first commits before concurrent disable; history remains")
    finally:
        sql(f"delete from public.spaces where id='{SPACE}';")
        sql(f"delete from auth.users where id in ('{OWNER}','{MEMBER}');")


if __name__ == "__main__":
    main()
