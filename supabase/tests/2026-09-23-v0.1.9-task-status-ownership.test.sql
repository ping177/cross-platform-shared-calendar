begin;

select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000001941', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'status-a@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001942', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'status-b@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001943', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'status-outsider@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values ('00000000-0000-4000-8000-000000001944', 'Status test', 'V019STAT', '00000000-0000-4000-8000-000000001941');

insert into public.space_members (space_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000001944', '00000000-0000-4000-8000-000000001941', 'owner'),
  ('00000000-0000-4000-8000-000000001944', '00000000-0000-4000-8000-000000001942', 'member');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001941', true);

insert into public.tasks (id, space_id, title)
values ('00000000-0000-4000-8000-000000001945', '00000000-0000-4000-8000-000000001944', 'Shared');
insert into public.tasks (id, space_id, title, assigned_to_user_id)
values ('00000000-0000-4000-8000-000000001946', '00000000-0000-4000-8000-000000001944', 'Assigned', '00000000-0000-4000-8000-000000001942');

select lives_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001945'$$, 'A completes Shared');
select lives_ok($$update public.tasks set status = 'open' where id = '00000000-0000-4000-8000-000000001945'$$, 'A reopens Shared');
select throws_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001946'$$, 'P0001', 'Only the current Task assignee may change status', 'A cannot complete B assigned Task');
select throws_ok($$update public.tasks set assigned_to_user_id = '00000000-0000-4000-8000-000000001941', status = 'completed' where id = '00000000-0000-4000-8000-000000001946'$$, 'P0001', 'Only the current Task assignee may change status', 'A cannot reassign and complete in one update');
select lives_ok($$update public.tasks set title = 'Edited by A', due_on = '2031-02-03' where id = '00000000-0000-4000-8000-000000001946'$$, 'A may edit title and due date on B Task');
select lives_ok($$update public.tasks set assigned_to_user_id = '00000000-0000-4000-8000-000000001941' where id = '00000000-0000-4000-8000-000000001946'$$, 'A may take over B Task');
select lives_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001946'$$, 'A completes after separate reassignment');
select lives_ok($$update public.tasks set status = 'open', assigned_to_user_id = '00000000-0000-4000-8000-000000001942' where id = '00000000-0000-4000-8000-000000001946'$$, 'Old assignee A may reopen while reassigning');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001942', true);
select lives_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001945'$$, 'B completes Shared');
select lives_ok($$update public.tasks set status = 'open' where id = '00000000-0000-4000-8000-000000001945'$$, 'B reopens Shared');
select lives_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001946'$$, 'B completes B assigned Task');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001941', true);
select throws_ok($$update public.tasks set status = 'open' where id = '00000000-0000-4000-8000-000000001946'$$, 'P0001', 'Only the current Task assignee may change status', 'A cannot reopen B assigned Task');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001942', true);
select lives_ok($$update public.tasks set status = 'open' where id = '00000000-0000-4000-8000-000000001946'$$, 'B reopens B assigned Task');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001941', true);
select throws_ok($$update public.tasks set status = 'completed' where id = '00000000-0000-4000-8000-000000001946'$$, 'P0001', 'Only the current Task assignee may change status', 'A still cannot complete after B regains assignment');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001943', true);
select is((select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001944'), 0::bigint, 'non-member cannot see Tasks');

select * from finish();
rollback;
