begin;

select plan(30);

select has_column('public', 'events', 'reminder_kind', 'events has reminder_kind');
select has_column('public', 'events', 'time_zone', 'events has time_zone');
select has_column('public', 'events', 'reminder_schedule_changed_at', 'events has reminder schedule marker');
select has_function('public', 'prepare_event_reminder_schedule', 'reminder schedule trigger function exists');
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.events'::regclass
      and tgname = 'events_prepare_reminder_schedule'
      and not tgisinternal
  ),
  'reminder schedule trigger exists'
);
select is(
  (select count(*) from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname in (
        'events_reminder_kind_check',
        'events_reminder_kind_matches_all_day_check',
        'events_reminder_requires_time_zone_check',
        'events_recurring_time_zone_consistency_check'
      )),
  4::bigint,
  'events keeps the four canonical Reminder constraints after Slice 3 removes the temporary restriction'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000001821',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'v0182-owner@example.com',
  'not-used',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.spaces (id, name, invite_code, created_by)
values (
  '00000000-0000-0000-0000-000000001822',
  'v0.1.8.2 test space',
  'V0182DB',
  '00000000-0000-0000-0000-000000001821'
);

insert into public.space_members (space_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000001822',
  '00000000-0000-0000-0000-000000001821',
  'owner'
);

insert into public.events (
  id, space_id, created_by, scope, title, starts_at
)
values (
  '00000000-0000-0000-0000-000000001823',
  '00000000-0000-0000-0000-000000001822',
  '00000000-0000-0000-0000-000000001821',
  'shared',
  'Historical ordinary fixture',
  '2030-01-01T09:00:00Z'
);

select is(
  (select reminder_kind from public.events where id = '00000000-0000-0000-0000-000000001823'),
  null::text,
  'ordinary Event keeps reminder disabled when omitted'
);
select is(
  (select time_zone from public.events where id = '00000000-0000-0000-0000-000000001823'),
  null::text,
  'ordinary Event keeps timezone null when omitted'
);

insert into public.events (
  id, space_id, created_by, scope, title, starts_at, recurrence_rule, time_zone, series_id
)
values (
  '00000000-0000-0000-0000-000000001824',
  '00000000-0000-0000-0000-000000001822',
  '00000000-0000-0000-0000-000000001821',
  'shared',
  'Recurring fixture',
  '2030-01-01T09:00:00Z',
  '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
  'UTC',
  '00000000-0000-0000-0000-000000001824'
);

select is(
  (select time_zone from public.events where id = '00000000-0000-0000-0000-000000001824'),
  'UTC',
  'recurring Event stores the authoritative recurrence timezone'
);

select throws_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, reminder_kind, time_zone)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Invalid kind', '2030-01-01T09:00:00Z', 'timed_custom', 'UTC')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_reminder_kind_check"',
  'invalid reminder kind is rejected'
);
select throws_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, all_day, reminder_kind, time_zone)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Mismatched kind', '2030-01-01T09:00:00Z', true, 'timed_at_start', 'UTC')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_reminder_kind_matches_all_day_check"',
  'timed reminder is rejected for an all-day Event'
);
select throws_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, reminder_kind)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Missing timezone', '2030-01-01T09:00:00Z', 'timed_at_start')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_reminder_requires_time_zone_check"',
  'enabled reminder requires a timezone'
);
select throws_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, time_zone)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Invalid timezone', '2030-01-01T09:00:00Z', 'Not/A_Time_Zone')$$,
  'P0001',
  'Event time_zone must be a valid IANA timezone',
  'invalid timezone is rejected'
);
select lives_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, recurrence_rule, reminder_kind, time_zone)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Recurring reminder', '2030-01-01T09:00:00Z', '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb, 'timed_at_start', 'UTC')$$,
  'recurring source Event may carry an event-level Reminder in Slice 3'
);
select throws_ok(
  $$insert into public.events (space_id, created_by, scope, title, starts_at, recurrence_rule, time_zone)
    values ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001821', 'shared', 'Recurring mismatch', '2030-01-01T09:00:00Z', '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb, 'Asia/Shanghai')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_recurring_time_zone_consistency_check"',
  'recurring Event timezone mismatch is rejected'
);

create temporary table marker_snapshots (
  label text primary key,
  marker timestamptz not null
) on commit drop;

insert into marker_snapshots
select 'initial', reminder_schedule_changed_at
from public.events where id = '00000000-0000-0000-0000-000000001823';

select ok(
  (select reminder_schedule_changed_at is not null from public.events where id = '00000000-0000-0000-0000-000000001823'),
  'insert creates a non-null schedule marker'
);

update public.events set title = 'Title changed' where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'title does not change marker');

update public.events set description = 'Description changed' where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'description does not change marker');

update public.events set ends_at = '2030-01-01T10:00:00Z' where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'ends_at does not change marker');

update public.events set recurrence_until = '2030-01-02T09:00:00Z' where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'recurrence_until does not change marker');

update public.events set starts_at = starts_at where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'same-value schedule rewrite does not change marker');

update public.events set starts_at = '2030-01-01T09:30:00Z' where id = '00000000-0000-0000-0000-000000001823';
select isnt((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'initial'), 'starts_at changes marker');
insert into marker_snapshots select 'after_start', reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823';

update public.events set all_day = true where id = '00000000-0000-0000-0000-000000001823';
select isnt((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'after_start'), 'all_day changes marker');

update public.events set all_day = false, time_zone = 'Asia/Shanghai' where id = '00000000-0000-0000-0000-000000001823';
insert into marker_snapshots select 'before_reminder', reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823';
update public.events set reminder_kind = 'timed_10m_before' where id = '00000000-0000-0000-0000-000000001823';
select isnt((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'before_reminder'), 'reminder_kind changes marker');

insert into marker_snapshots select 'before_timezone', reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823';
update public.events set time_zone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-000000001823';
select isnt((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'before_timezone'), 'time_zone changes marker');

insert into marker_snapshots select 'before_direct', reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823';
update public.events set reminder_schedule_changed_at = '2000-01-01T00:00:00Z' where id = '00000000-0000-0000-0000-000000001823';
select is((select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001823'), (select marker from marker_snapshots where label = 'before_direct'), 'direct marker mutation is ignored');

update public.events
set reminder_kind = 'timed_at_start'
where id = '00000000-0000-0000-0000-000000001824';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001821', true);

select lives_ok(
  $$select public.split_recurring_event(
    '00000000-0000-0000-0000-000000001824',
    '2030-01-02',
    'Split child',
    null,
    '2030-01-02T09:00:00Z',
    null,
    false,
    '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
    (select updated_at from public.events where id = '00000000-0000-0000-0000-000000001824')
  )$$,
  'split succeeds with the preserved recurrence timezone'
);
select is(
  (select time_zone from public.events where parent_event_id = '00000000-0000-0000-0000-000000001824'),
  'UTC',
  'split child inherits source Event timezone'
);
select is(
  (select reminder_kind from public.events where parent_event_id = '00000000-0000-0000-0000-000000001824'),
  'timed_at_start',
  'split child inherits source Event reminder'
);
select ok(
  (select reminder_schedule_changed_at from public.events where parent_event_id = '00000000-0000-0000-0000-000000001824')
    > (select reminder_schedule_changed_at from public.events where id = '00000000-0000-0000-0000-000000001824'),
  'split child receives a fresh schedule marker that prevents newly-past catch-up'
);

select * from finish();
rollback;
