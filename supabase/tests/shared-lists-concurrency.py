"""Local-only two-session Shared Lists lock-order and stale-order checks."""

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
LISTS = []


def sql(command, *, error=None):
    result = subprocess.run(PSQL, input=command, text=True, capture_output=True, timeout=45, check=False)
    if error is None:
        assert result.returncode == 0, result.stderr
    else:
        assert result.returncode != 0 and error in result.stderr, result.stderr
        assert "deadlock" not in result.stderr.lower(), result.stderr
    return result.stdout.strip()


def actor_sql(actor, statement):
    return f"""begin;
set local statement_timeout='15s';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','{actor}',true);
{statement}
commit;
"""


def pair(first, second, *, second_error=None):
    process = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert process.stdin and process.stdout and process.stderr
    process.stdin.write(actor_sql(OWNER, f"{first} select 'LOCKED'; select pg_sleep(0.6);"))
    process.stdin.close()
    for _ in range(15):
        line = process.stdout.readline()
        assert line, f"first session ended before lock marker: {process.stderr.read()}"
        if line.strip() == "LOCKED":
            break
    else:
        raise AssertionError("first session did not acquire its mutation lock")
    sql(actor_sql(MEMBER, second), error=second_error)
    process.wait(timeout=45)
    assert process.returncode == 0, process.stderr.read()


def new_list(contents=(), *, completed=(), section=False):
    list_id = str(uuid.uuid4())
    LISTS.append(list_id)
    section_id = str(uuid.uuid4()) if section else None
    statements = [f"insert into public.lists(id,space_id,name,created_by) values ('{list_id}','{SPACE}','Concurrency','{OWNER}');"]
    if section_id:
        statements.append(f"insert into public.list_sections(id,list_id,name,sort_order,created_by) values ('{section_id}','{list_id}','Section',1,'{OWNER}');")
    item_ids = {}
    for position, content in enumerate(contents, 1):
        item_id = str(uuid.uuid4())
        item_ids[content] = item_id
        region = f"'{section_id}'" if section_id else "null"
        done = "true" if content in completed else "false"
        statements.append(f"insert into public.list_items(id,list_id,space_id,section_id,content,completed,sort_order,created_by) values ('{item_id}','{list_id}','{SPACE}',{region},'{content}',{done},{position},'{OWNER}');")
    sql("begin;\n" + "\n".join(statements) + "\ncommit;")
    return list_id, section_id, item_ids


def create_item(list_id, content, section_id=None):
    region = f"'{section_id}'" if section_id else "null"
    return f"select public.create_list_item('{list_id}',{region},'{content}');"


def reorder(list_id, ids, section_id=None, completed=False):
    region = f"'{section_id}'" if section_id else "null"
    group = "true" if completed else "false"
    ordered = ",".join(f"'{item_id}'" for item_id in ids)
    return f"select public.reorder_list_items('{list_id}',{region},{group},array[{ordered}]::uuid[]);"


def complete(item_id, value):
    return f"select public.set_list_item_completed('{item_id}',{str(value).lower()});"


def order(list_id, *, section_id=None):
    region = f"section_id='{section_id}'" if section_id else "section_id is null"
    return sql(f"select coalesce(string_agg(content||':'||sort_order||':'||completed,',' order by sort_order),'') from public.list_items where list_id='{list_id}' and {region};")


def check_positions(list_id):
    gaps = sql(f"""with numbered as (
      select sort_order,row_number() over(partition by section_id order by sort_order) as position
      from public.list_items where list_id='{list_id}'
    ) select count(*) from numbered where sort_order<>position;""")
    assert gaps == "0", f"noncontiguous Item positions in {list_id}: {gaps}"
    section_gaps = sql(f"""with numbered as (
      select sort_order,row_number() over(order by sort_order) as position
      from public.list_sections where list_id='{list_id}'
    ) select count(*) from numbered where sort_order<>position;""")
    assert section_gaps == "0", f"noncontiguous Section positions in {list_id}: {section_gaps}"


def main():
    invite = uuid.uuid4().hex[:8].upper()
    try:
        sql(f"""begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('{OWNER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lists-concurrency-a@example.invalid','not-used',now(),'{{}}','{{}}',now(),now()),
       ('{MEMBER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lists-concurrency-b@example.invalid','not-used',now(),'{{}}','{{}}',now(),now());
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{SPACE}','Lists concurrency','shared','{invite}','{OWNER}');
insert into public.space_members(space_id,user_id,role) values ('{SPACE}','{OWNER}','owner'),('{SPACE}','{MEMBER}','member');
commit;""")
        sql(actor_sql(OWNER, f"select public.set_space_module_enabled('{SPACE}','lists',true);"))

        list_id, _, _ = new_list()
        pair(create_item(list_id, "A"), create_item(list_id, "B"))
        assert order(list_id) == "A:1:false,B:2:false"
        print("PASS concurrent append retains both Items with unique contiguous slots")

        list_id, _, items = new_list(("A", "B", "C"))
        pair(reorder(list_id, [items["C"], items["A"], items["B"]]), reorder(list_id, [items["B"], items["C"], items["A"]]))
        assert order(list_id) == "B:1:false,C:2:false,A:3:false"
        print("PASS concurrent reorder serializes; last complete set wins")

        list_id, _, items = new_list(("A", "B", "C"))
        pair(reorder(list_id, [items["C"], items["A"], items["B"]]), create_item(list_id, "D"))
        assert order(list_id) == "C:1:false,A:2:false,B:3:false,D:4:false"
        print("PASS reorder then append preserves both operations")

        list_id, _, items = new_list(("A", "B", "C"))
        pair(create_item(list_id, "D"), reorder(list_id, [items["C"], items["A"], items["B"]]), second_error="Stale List Item order; reload")
        assert order(list_id) == "A:1:false,B:2:false,C:3:false,D:4:false"
        print("PASS append before stale reorder rejects omitted Item")

        list_id, _, items = new_list(("A", "B", "C"))
        pair(f"select public.delete_list_item('{list_id}','{items['B']}');", reorder(list_id, [items["C"], items["A"], items["B"]]), second_error="Stale List Item order; reload")
        assert order(list_id) == "A:1:false,C:2:false"
        print("PASS delete before stale reorder rejects missing Item")

        list_id, _, items = new_list(("A", "B", "C"))
        pair(complete(items["B"], True), reorder(list_id, [items["C"], items["A"], items["B"]]), second_error="Stale List Item order; reload")
        assert order(list_id) == "A:1:false,B:2:true,C:3:false"
        print("PASS completion before active reorder invalidates its full group")

        list_id, _, items = new_list(("A", "X", "B", "C"), completed=("X",))
        pair(complete(items["X"], False), reorder(list_id, [items["C"], items["A"], items["B"]]), second_error="Stale List Item order; reload")
        assert order(list_id) == "A:1:false,X:2:false,B:3:false,C:4:false"
        print("PASS reopen before active reorder invalidates its full group")

        list_id, _, items = new_list(("A", "X", "B"), completed=("X",))
        pair(reorder(list_id, [items["B"], items["A"]]), complete(items["X"], False))
        assert order(list_id) == "B:1:false,X:2:false,A:3:false"
        print("PASS reorder first then reopen keeps the completed Item's canonical slot")

        list_id, _, items = new_list(("A", "B"))
        pair(f"select public.delete_list_item('{list_id}','{items['A']}');", complete(items["A"], True), second_error="Item not found")
        assert order(list_id) == "B:1:false"
        print("PASS Item delete before completion leaves no stale write")

        list_id, _, items = new_list(("A", "B"))
        pair(complete(items["A"], True), f"select public.delete_list_item('{list_id}','{items['A']}');")
        assert order(list_id) == "B:1:false"
        print("PASS completion then Item delete leaves no orphan or gap")

        list_id, section_id, items = new_list(("A", "B"), section=True)
        pair(f"select public.delete_list_section('{list_id}','{section_id}',true);", complete(items["A"], True))
        assert order(list_id) == "A:1:true,B:2:false"
        print("PASS preserve-Section deletion then completion finds moved Item")

        list_id, section_id, items = new_list(("A", "B"), section=True)
        pair(f"select public.delete_list_section('{list_id}','{section_id}',false);", complete(items["A"], True), second_error="Item not found")
        assert order(list_id, section_id=section_id) == ""
        print("PASS destructive Section deletion rejects later completion")

        list_id, _, items = new_list(("A",))
        pair(complete(items["A"], True), complete(items["A"], False))
        assert order(list_id) == "A:1:false"
        print("PASS concurrent explicit completion writes serialize; later value wins")

        list_id, section_id, _ = new_list(section=True)
        pair(f"select public.delete_list_section('{list_id}','{section_id}',true);", create_item(list_id, "Late", section_id), second_error="Section not found in List")
        assert order(list_id) == ""
        print("PASS Section delete before Item insert rejects removed parent")

        list_id, section_id, _ = new_list(section=True)
        pair(create_item(list_id, "Early", section_id), f"select public.delete_list_section('{list_id}','{section_id}',true);")
        assert order(list_id) == "Early:1:false"
        print("PASS Item insert before preserve-Section deletion retains Item")

        list_id, _, _ = new_list()
        pair(f"select public.delete_list('{list_id}');", create_item(list_id, "Late"), second_error="List not found")
        assert sql(f"select count(*) from public.list_items where list_id='{list_id}';") == "0"
        print("PASS List delete before child creation rejects removed parent")

        for list_id in LISTS:
            check_positions(list_id)
        assert sql("select count(*) from public.list_items i left join public.lists l on l.id=i.list_id where l.id is null;") == "0"
        print("PASS all final List/Section/Item positions are contiguous with no orphan Items")
    finally:
        sql(f"delete from public.spaces where id='{SPACE}'; delete from auth.users where id in ('{OWNER}','{MEMBER}');")


if __name__ == "__main__":
    main()
