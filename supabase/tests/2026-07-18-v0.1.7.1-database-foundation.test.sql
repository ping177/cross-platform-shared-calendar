begin;

select plan(18);

select has_column('public', 'events', 'series_id', 'events has series_id');
select has_column('public', 'events', 'parent_event_id', 'events has parent_event_id');
select has_column('public', 'events', 'recurrence_until', 'events has recurrence_until');
select has_table('public', 'event_occurrence_exceptions', 'exception table exists');
select has_column('public', 'event_occurrence_exceptions', 'event_id', 'exception event_id exists');
select has_column('public', 'event_occurrence_exceptions', 'occurrence_date', 'exception occurrence_date exists');
select has_column('public', 'event_occurrence_exceptions', 'exception_type', 'exception type exists');
select has_column('public', 'event_occurrence_exceptions', 'override_data', 'exception override data exists');
select has_pk('public', 'event_occurrence_exceptions', 'exception table has primary key');
select has_fk('public', 'event_occurrence_exceptions', 'exception table has event foreign key');
select has_index('public', 'event_occurrence_exceptions', 'event_occurrence_exceptions_event_occurrence_date_key', 'exception uniqueness is indexed');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0171-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0171-member@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000713', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0171-outsider@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values ('00000000-0000-0000-0000-000000000721', 'v0.1.7.1 test space', 'V0171DB', '00000000-0000-0000-0000-000000000711');

insert into public.space_members (space_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000711', 'owner'),
  ('00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000712', 'member');

insert into public.events (
  id,
  space_id,
  created_by,
  scope,
  owner_user_id,
  title,
  starts_at,
  recurrence_rule,
  series_id
)
values (
  '00000000-0000-0000-0000-000000000731',
  '00000000-0000-0000-0000-000000000721',
  '00000000-0000-0000-0000-000000000711',
  'shared',
  null,
  'v0.1.7.1 recurring event',
  '2026-07-20T12:00:00Z',
  '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
  '00000000-0000-0000-0000-000000000731'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000711', true);

insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type)
values ('00000000-0000-0000-0000-000000000731', '2026-07-21', 'deleted');

select is(
  (select exception_type from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000000731' and occurrence_date = '2026-07-21'),
  'deleted',
  'event manager can insert a deleted exception'
);

update public.event_occurrence_exceptions
set exception_type = 'override', override_data = '{"title": "Moved occurrence"}'::jsonb
where event_id = '00000000-0000-0000-0000-000000000731'
  and occurrence_date = '2026-07-21';

select is(
  (select override_data ->> 'title' from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000000731' and occurrence_date = '2026-07-21'),
  'Moved occurrence',
  'event manager can update an exception to an override'
);

select throws_ok(
  $$insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type, override_data)
    values ('00000000-0000-0000-0000-000000000731', '2026-07-22', 'deleted', '{}'::jsonb)$$,
  '23514',
  'new row for relation "event_occurrence_exceptions" violates check constraint "event_occurrence_exceptions_override_shape_check"',
  'deleted exceptions reject override data'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000712', true);

select is(
  (select count(*) from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000000731'),
  1::bigint,
  'a space member can read an event exception'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000713', true);

select is(
  (select count(*) from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000000731'),
  0::bigint,
  'a non-member cannot read an event exception'
);

delete from public.event_occurrence_exceptions
where event_id = '00000000-0000-0000-0000-000000000731'
  and occurrence_date = '2026-07-21';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000711', true);

select is(
  (select count(*) from public.event_occurrence_exceptions
    where event_id = '00000000-0000-0000-0000-000000000731'
      and occurrence_date = '2026-07-21'),
  1::bigint,
  'a non-member cannot delete an event exception'
);

delete from public.event_occurrence_exceptions
where event_id = '00000000-0000-0000-0000-000000000731'
  and occurrence_date = '2026-07-21';

select is(
  (select count(*) from public.event_occurrence_exceptions
    where event_id = '00000000-0000-0000-0000-000000000731'
      and occurrence_date = '2026-07-21'),
  0::bigint,
  'event manager can delete an exception'
);

reset role;

select * from finish();

rollback;
