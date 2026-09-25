begin;

select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000001a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v010-a@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v010-b@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000001a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v010-c@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values
  ('00000000-0000-4000-8000-000000001a11', 'Legacy shared', 'V010LEGA', '00000000-0000-4000-8000-000000001a01'),
  ('00000000-0000-4000-8000-000000001a12', 'Other shared', 'V010OTHR', '00000000-0000-4000-8000-000000001a03');
insert into public.space_members (space_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000001a11', '00000000-0000-4000-8000-000000001a01', 'owner'),
  ('00000000-0000-4000-8000-000000001a11', '00000000-0000-4000-8000-000000001a02', 'member'),
  ('00000000-0000-4000-8000-000000001a12', '00000000-0000-4000-8000-000000001a03', 'owner');

select is((select kind from public.spaces where id = '00000000-0000-4000-8000-000000001a11'), 'shared', 'legacy Space defaults to shared');
select is((select enabled from public.space_modules where space_id = '00000000-0000-4000-8000-000000001a11' and module_key = 'tasks'), true, 'existing Shared Space has Tasks enabled');
select is((select count(*) from public.space_modules where space_id = '00000000-0000-4000-8000-000000001a11' and module_key <> 'tasks'), 0::bigint, 'unimplemented modules default absent');
select is(public.is_space_module_enabled('00000000-0000-4000-8000-000000001a11', 'lists'), false, 'missing module row means disabled');
select ok(to_regclass('public.one_space_per_user_idx') is null, 'one-user-one-space index was removed');
select ok(to_regclass('public.spaces_personal_created_by_idx') is not null, 'partial Personal Space owner index exists');
select ok(not has_table_privilege('authenticated', 'public.space_modules', 'INSERT'), 'clients cannot insert module state directly');
select ok(not has_table_privilege('authenticated', 'public.space_modules', 'UPDATE'), 'clients cannot update module state directly');
select ok(not has_table_privilege('authenticated', 'public.space_modules', 'DELETE'), 'clients cannot delete module state directly');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001a01', true);

select lives_ok($$select public.create_space_with_invite('A second Shared Space')$$, 'existing member can create another Shared Space');
select lives_ok($$select public.create_space_with_invite('A third Shared Space')$$, 'one creator can create multiple Shared Spaces');
select is((select count(*) from public.spaces where created_by = auth.uid() and kind = 'shared'), 3::bigint, 'creator has three Shared Spaces');
select is((select count(*) from public.space_members where user_id = auth.uid()), 3::bigint, 'membership identity permits multiple Shared Spaces');
select is((select count(*) from public.space_modules sm join public.spaces s on s.id = sm.space_id where s.created_by = auth.uid() and sm.module_key = 'tasks' and sm.enabled), 3::bigint, 'new Shared Spaces default Tasks on');

select lives_ok($$select public.ensure_personal_space()$$, 'authenticated user may ensure Personal Space');
select is((select count(*) from public.spaces where kind = 'personal' and created_by = auth.uid()), 1::bigint, 'only one Personal Space was created');
select is((select (public.ensure_personal_space()).id), (select id from public.spaces where kind = 'personal' and created_by = auth.uid()), 'repeat ensure returns same Personal Space');
select is((select count(*) from public.spaces where kind = 'personal' and created_by = auth.uid()), 1::bigint, 'repeat ensure does not duplicate Personal Space');
select is((select count(*) from public.space_members sm join public.spaces s on s.id = sm.space_id where s.kind = 'personal' and s.created_by = auth.uid() and sm.user_id = auth.uid() and sm.role = 'owner'), 1::bigint, 'Personal creator is sole owner member');
select is((select enabled from public.space_modules sm join public.spaces s on s.id = sm.space_id where s.kind = 'personal' and s.created_by = auth.uid() and sm.module_key = 'tasks'), true, 'new Personal Space defaults Tasks on');
select lives_ok($$select public.set_space_module_enabled((select id from public.spaces where kind = 'personal' and created_by = auth.uid()), 'tasks', false)$$, 'Personal owner can disable Tasks');
select is((select count(*) from public.space_modules sm join public.spaces s on s.id = sm.space_id where s.kind = 'personal' and s.created_by = auth.uid() and sm.module_key = 'tasks' and not sm.enabled), 1::bigint, 'Personal Tasks state changed');
select lives_ok($$select public.set_space_module_enabled((select id from public.spaces where kind = 'personal' and created_by = auth.uid()), 'tasks', true)$$, 'Personal owner can re-enable Tasks');
select throws_ok($$select public.set_space_module_enabled('00000000-0000-4000-8000-000000001a11', 'lists', true)$$, 'P0001', 'Only Tasks and Review modules may be toggled in this version', 'future modules cannot be toggled yet');
select throws_ok($$update public.spaces set kind = 'shared' where kind = 'personal' and created_by = auth.uid()$$, 'P0001', 'Space kind is immutable', 'client cannot change Personal Space kind');
select throws_ok($$update public.spaces set created_by = '00000000-0000-4000-8000-000000001a02' where kind = 'personal' and created_by = auth.uid()$$, 'P0001', 'Space created_by is immutable', 'client cannot change Personal Space creator');
select throws_ok($$update public.spaces set invite_code = 'V010EDIT' where kind = 'personal' and created_by = auth.uid()$$, 'P0001', 'Personal Space invite code is immutable', 'client cannot change Personal invite code directly');

select set_config('test.v010_personal_invite', (select invite_code from public.spaces where kind = 'personal' and created_by = auth.uid()), true);
select throws_ok($$select public.rotate_invite_code((select id from public.spaces where kind = 'personal' and created_by = auth.uid()))$$, 'P0001', 'Personal Space invite codes cannot be rotated', 'Personal invite cannot rotate');
select throws_ok($$insert into public.events (space_id, scope, title, starts_at) select id, 'shared', 'Invalid shared', now() from public.spaces where kind = 'personal' and created_by = auth.uid()$$, 'P0001', 'Personal Space events must belong to the Space owner', 'Personal Space rejects shared Event');
select lives_ok($$insert into public.events (space_id, scope, owner_user_id, title, starts_at) select id, 'personal', auth.uid(), 'Private', now() from public.spaces where kind = 'personal' and created_by = auth.uid()$$, 'Personal owner Event is accepted');
select lives_ok($$insert into public.tasks (space_id, title) select id, 'Private Task' from public.spaces where kind = 'personal' and created_by = auth.uid()$$, 'Personal Space reuses Task schema');
select is((select assigned_to_user_id from public.tasks where title = 'Private Task'), null::uuid, 'Personal Task defaults to unassigned');

select lives_ok($$insert into public.events (space_id, scope, owner_user_id, title, starts_at) values ('00000000-0000-4000-8000-000000001a11', 'personal', '00000000-0000-4000-8000-000000001a02', 'Shared Space personal', now())$$, 'Shared Space personal Event meaning is preserved');
select lives_ok($$insert into public.tasks (space_id, title) values ('00000000-0000-4000-8000-000000001a11', 'Existing shared Task')$$, 'Shared Space Task creation remains permitted');
select lives_ok($$insert into public.tasks (space_id, title, status) values ('00000000-0000-4000-8000-000000001a11', 'Completed shared Task', 'completed')$$, 'existing completed Task is available for reopen test');

select is((select count(*) from public.space_modules where space_id = '00000000-0000-4000-8000-000000001a11' and module_key = 'tasks'), 1::bigint, 'owner can read module state');
select lives_ok($$select public.set_space_module_enabled('00000000-0000-4000-8000-000000001a11', 'tasks', false)$$, 'Shared owner can disable Tasks');
select is((select enabled from public.space_modules where space_id = '00000000-0000-4000-8000-000000001a11' and module_key = 'tasks'), false, 'Task state is disabled');
select is((select count(*) from public.tasks where space_id = '00000000-0000-4000-8000-000000001a11'), 2::bigint, 'Task history remains readable while disabled');
select throws_ok($$insert into public.tasks (space_id, title) values ('00000000-0000-4000-8000-000000001a11', 'Blocked create')$$, '42501', 'new row violates row-level security policy for table "tasks"', 'disabled Tasks reject create');
with changed as (update public.tasks set title = 'Blocked edit', status = 'completed', assigned_to_user_id = auth.uid() where title = 'Existing shared Task' returning id)
select is((select count(*) from changed), 0::bigint, 'disabled Tasks reject edit, complete, and reassign');
with reopened as (update public.tasks set status = 'open' where title = 'Completed shared Task' returning id)
select is((select count(*) from reopened), 0::bigint, 'disabled Tasks reject reopen');
with removed as (delete from public.tasks where title = 'Existing shared Task' returning id)
select is((select count(*) from removed), 0::bigint, 'disabled Tasks reject delete');
select lives_ok($$select public.set_space_module_enabled('00000000-0000-4000-8000-000000001a11', 'tasks', true)$$, 'owner can re-enable Tasks');
with changed as (update public.tasks set title = 'Restored Task' where title = 'Existing shared Task' returning id)
select is((select count(*) from changed), 1::bigint, 'historical Task becomes editable again');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001a02', true);
select lives_ok($$select public.join_space_by_invite_code('V010OTHR')$$, 'member of one Space can join another Shared Space');
select throws_ok($$select public.join_space_by_invite_code('V010OTHR')$$, 'P0001', 'You are already a member of this space', 'duplicate target membership is rejected');
select throws_ok(format('select public.join_space_by_invite_code(%L)', current_setting('test.v010_personal_invite')), 'P0001', 'Personal Spaces cannot be joined by invite code', 'Personal Space cannot be joined');
select is((select count(*) from public.space_modules where space_id = '00000000-0000-4000-8000-000000001a11' and module_key = 'tasks'), 1::bigint, 'ordinary member reads module state');
select throws_ok($$select public.set_space_module_enabled('00000000-0000-4000-8000-000000001a11', 'tasks', false)$$, 'P0001', 'Only the Space owner may change modules', 'ordinary member cannot toggle modules');
select is((select count(*) from public.events where title = 'Private'), 0::bigint, 'other Shared member cannot read Personal Event');
select is((select count(*) from public.tasks where title = 'Private Task'), 0::bigint, 'other Shared member cannot read Personal Task');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001a01', true);
select throws_ok($$select public.join_space_by_invite_code('V010OTHR')$$, 'P0001', 'This space is already full', 'Shared Space two-member cap remains');

reset role;
select throws_ok($$insert into public.space_members (space_id, user_id, role) select id, '00000000-0000-4000-8000-000000001a02', 'member' from public.spaces where kind = 'personal' and created_by = '00000000-0000-4000-8000-000000001a01'$$, 'P0001', 'Personal Space may only contain its owner', 'direct membership write cannot add a second Personal member');
select throws_ok($$delete from public.space_members where space_id = (select id from public.spaces where kind = 'personal' and created_by = '00000000-0000-4000-8000-000000001a01')$$, 'P0001', 'Personal Space owner membership cannot be removed', 'direct membership write cannot remove sole Personal owner');
select throws_ok($$update public.space_members set role = 'member' where space_id = (select id from public.spaces where kind = 'personal' and created_by = '00000000-0000-4000-8000-000000001a01')$$, 'P0001', 'Personal Space owner membership cannot be changed', 'direct membership write cannot demote Personal owner');
select throws_ok($$insert into public.spaces (name, invite_code, created_by, kind) values ('Second Personal', 'V010PERS', '00000000-0000-4000-8000-000000001a01', 'personal')$$, '23505', null, 'partial unique index rejects second Personal Space');
select throws_ok($$insert into public.events (space_id, scope, owner_user_id, title, starts_at) select id, 'personal', '00000000-0000-4000-8000-000000001a02', 'Wrong owner', now() from public.spaces where kind = 'personal' and created_by = '00000000-0000-4000-8000-000000001a01'$$, 'P0001', 'Personal Space events must belong to the Space owner', 'database rejects wrong Personal Event owner');

select * from finish();
rollback;
