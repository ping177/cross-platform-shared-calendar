begin;

select plan(58);

select has_table('public', 'tasks', 'Task table exists');
select is(
  (
    select string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
  ),
  'id,space_id,created_by,assigned_to_user_id,title,status,due_on,created_at,updated_at',
  'Task table contains exactly the frozen Slice 1 columns'
);
select has_pk('public', 'tasks', 'Task table has a primary key');
select is(
  (select count(*) from pg_constraint where conrelid = 'public.tasks'::regclass and contype = 'f'),
  3::bigint,
  'Task table has Space, creator, and same-Space assignee foreign keys'
);
select has_index(
  'public',
  'tasks',
  'tasks_space_status_due_created_id_idx',
  'Task list order has one purpose-built index'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
  'Task RLS is enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tasks'),
  4::bigint,
  'Task table has exactly four CRUD policies'
);
select is(
  (select relreplident from pg_class where oid = 'public.tasks'::regclass),
  'f'::"char",
  'Task table uses REPLICA IDENTITY FULL'
);
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ),
  'Task table belongs to the existing Realtime publication'
);
select ok(has_table_privilege('authenticated', 'public.tasks', 'SELECT'), 'authenticated has Task SELECT privilege');
select ok(has_table_privilege('authenticated', 'public.tasks', 'INSERT'), 'authenticated has Task INSERT privilege');
select ok(has_table_privilege('authenticated', 'public.tasks', 'UPDATE'), 'authenticated has Task UPDATE privilege');
select ok(has_table_privilege('authenticated', 'public.tasks', 'DELETE'), 'authenticated has Task DELETE privilege');
select has_function('public', 'validate_task_identity', 'Task identity validation function exists');
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.tasks'::regclass
      and tgname = 'tasks_validate_identity'
      and not tgisinternal
  ),
  'Task immutable identity trigger exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.tasks'::regclass
      and tgname = 'tasks_touch_updated_at'
      and not tgisinternal
  ),
  'Task reuses the shared updated_at trigger'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000001901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-member@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasks-outsider@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values
  ('00000000-0000-4000-8000-000000001911', 'Task test space', 'V019TASK', '00000000-0000-4000-8000-000000001901'),
  ('00000000-0000-4000-8000-000000001912', 'Task outsider space', 'V019OUTS', '00000000-0000-4000-8000-000000001903');

insert into public.space_members (space_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000001911', '00000000-0000-4000-8000-000000001901', 'owner'),
  ('00000000-0000-4000-8000-000000001911', '00000000-0000-4000-8000-000000001902', 'member'),
  ('00000000-0000-4000-8000-000000001912', '00000000-0000-4000-8000-000000001903', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001901', true);

select lives_ok(
  $$insert into public.tasks (id, space_id, title)
    values ('00000000-0000-4000-8000-000000001931', '00000000-0000-4000-8000-000000001911', 'Shared task')$$,
  'member can create a shared Task through direct CRUD'
);
select is(
  (select status from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  'open',
  'Task status defaults to open'
);
select is(
  (select created_by from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  '00000000-0000-4000-8000-000000001901'::uuid,
  'Task creator defaults to auth.uid()'
);
select is(
  (select due_on from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  null::date,
  'Task due date is optional'
);
select lives_ok(
  $$insert into public.tasks (id, space_id, assigned_to_user_id, title, due_on)
    values (
      '00000000-0000-4000-8000-000000001932',
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001902',
      'Assigned task',
      '2031-02-03'
    )$$,
  'same-Space member assignment and optional due date are accepted'
);
select is(
  (select assigned_to_user_id from public.tasks where id = '00000000-0000-4000-8000-000000001932'),
  '00000000-0000-4000-8000-000000001902'::uuid,
  'Task stores a same-Space assignee'
);
select is(
  (select due_on from public.tasks where id = '00000000-0000-4000-8000-000000001932'),
  '2031-02-03'::date,
  'Task stores due_on as a date'
);
select lives_ok(
  $$insert into public.tasks (id, space_id, title)
    values ('00000000-0000-4000-8000-000000001933', '00000000-0000-4000-8000-000000001911', 'Canonical title')$$,
  'canonical title is accepted'
);
select throws_ok(
  $$insert into public.tasks (space_id, title, status)
    values ('00000000-0000-4000-8000-000000001911', 'Invalid status', 'blocked')$$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_status_check"',
  'invalid Task status is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, title)
    values ('00000000-0000-4000-8000-000000001911', '')$$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_title_format_check"',
  'empty Task title is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, title)
    values ('00000000-0000-4000-8000-000000001911', E' \t\n ')$$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_title_format_check"',
  'whitespace-only Task title is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, title)
    values ('00000000-0000-4000-8000-000000001911', repeat('x', 201))$$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_title_format_check"',
  'Task title longer than 200 characters is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, title)
    values ('00000000-0000-4000-8000-000000001911', ' not canonical ')$$,
  '23514',
  'new row for relation "tasks" violates check constraint "tasks_title_format_check"',
  'untrimmed Task title is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, assigned_to_user_id, title)
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001903',
      'Other-space assignment'
    )$$,
  '23503',
  'insert or update on table "tasks" violates foreign key constraint "tasks_assigned_member_fkey"',
  'other-Space assignee is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, assigned_to_user_id, title)
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001999',
      'Missing assignment'
    )$$,
  '23503',
  'insert or update on table "tasks" violates foreign key constraint "tasks_assigned_member_fkey"',
  'nonexistent assignee is rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001902', true);
select lives_ok(
  $$insert into public.tasks (id, space_id, title)
    values ('00000000-0000-4000-8000-000000001934', '00000000-0000-4000-8000-000000001911', 'Member-created task')$$,
  'non-owner current member can create a Task'
);
select is(
  (select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001911'),
  4::bigint,
  'current member can view all Tasks in the Space'
);
select lives_ok(
  $$update public.tasks
    set title = 'Member-updated task',
        due_on = '2031-04-05',
        assigned_to_user_id = '00000000-0000-4000-8000-000000001902'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'current member can edit title, due date, and assignment'
);
select is(
  (
    select title || '|' || due_on::text || '|' || assigned_to_user_id::text
    from public.tasks
    where id = '00000000-0000-4000-8000-000000001931'
  ),
  'Member-updated task|2031-04-05|00000000-0000-4000-8000-000000001902',
  'allowed collaborative Task fields persist together'
);
select lives_ok(
  $$update public.tasks set status = 'completed'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'current member can complete a Task'
);
select is(
  (select status from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  'completed',
  'completed status persists'
);
select lives_ok(
  $$update public.tasks set status = 'open'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'current member can reopen a Task'
);
select is(
  (select status from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  'open',
  'reopened status persists'
);
select lives_ok(
  $$delete from public.tasks where id = '00000000-0000-4000-8000-000000001934'$$,
  'current member can delete a Task'
);
select is(
  (select count(*) from public.tasks where id = '00000000-0000-4000-8000-000000001934'),
  0::bigint,
  'member-deleted Task is gone'
);
select throws_ok(
  $$update public.tasks
    set space_id = '00000000-0000-4000-8000-000000001912'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'P0001',
  'Task space_id is immutable',
  'direct Task space_id mutation is rejected'
);
select throws_ok(
  $$update public.tasks
    set created_by = '00000000-0000-4000-8000-000000001902'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'P0001',
  'Task created_by is immutable',
  'direct Task creator mutation is rejected'
);
select throws_ok(
  $$insert into public.tasks (space_id, created_by, title)
    values (
      '00000000-0000-4000-8000-000000001911',
      '00000000-0000-4000-8000-000000001901',
      'Forged creator'
    )$$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'member cannot forge another Task creator'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001903', true);
select is(
  (select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001911'),
  0::bigint,
  'non-member cannot view Tasks in another Space'
);
select throws_ok(
  $$insert into public.tasks (space_id, title)
    values ('00000000-0000-4000-8000-000000001911', 'Outsider insert')$$,
  '42501',
  'new row violates row-level security policy for table "tasks"',
  'non-member cannot insert a Task into another Space'
);
select lives_ok(
  $$update public.tasks set title = 'Outsider update'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'non-member update is filtered by RLS without exposing the row'
);

reset role;
select is(
  (select title from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  'Member-updated task',
  'non-member update did not mutate the Task'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001903', true);
select lives_ok(
  $$delete from public.tasks where id = '00000000-0000-4000-8000-000000001931'$$,
  'non-member delete is filtered by RLS without exposing the row'
);

reset role;
select is(
  (select count(*) from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  1::bigint,
  'non-member delete did not remove the Task'
);
select lives_ok(
  $$delete from public.space_members
    where space_id = '00000000-0000-4000-8000-000000001911'
      and user_id = '00000000-0000-4000-8000-000000001902'$$,
  'member removal succeeds with assigned Tasks present'
);
select is(
  (select count(*) from public.tasks
    where id in (
        '00000000-0000-4000-8000-000000001931',
        '00000000-0000-4000-8000-000000001932'
      )
      and assigned_to_user_id is null),
  2::bigint,
  'member removal converts every affected assignment to shared responsibility'
);
select is(
  (select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001911'),
  3::bigint,
  'Tasks survive assignee membership removal'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001902', true);
select is(
  (select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001911'),
  0::bigint,
  'former member can no longer view Tasks'
);
select lives_ok(
  $$update public.tasks set title = 'Former member update'
    where id = '00000000-0000-4000-8000-000000001931'$$,
  'former member update is filtered by RLS'
);

reset role;
select is(
  (select title from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  'Member-updated task',
  'former member update did not mutate the Task'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001902', true);
select lives_ok(
  $$delete from public.tasks where id = '00000000-0000-4000-8000-000000001931'$$,
  'former member delete is filtered by RLS'
);

reset role;
select is(
  (select count(*) from public.tasks where id = '00000000-0000-4000-8000-000000001931'),
  1::bigint,
  'former member delete did not remove the Task'
);

select * from finish();
rollback;
