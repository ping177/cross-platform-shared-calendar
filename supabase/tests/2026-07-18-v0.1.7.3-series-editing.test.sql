begin;

select plan(15);

select has_function('public', 'upsert_occurrence_override', 'only-this override RPC exists');
select has_function('public', 'delete_occurrence', 'only-this delete RPC exists');
select has_function('public', 'split_recurring_event', 'split RPC exists');
select has_function('public', 'delete_logical_series', 'logical-series delete RPC exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000001731', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0173-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000001732', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0173-member@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000001733', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v0173-outsider@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values ('00000000-0000-0000-0000-000000001741', 'v0.1.7.3 test space', 'V0173DB', '00000000-0000-0000-0000-000000001731');

insert into public.space_members (space_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000001741', '00000000-0000-0000-0000-000000001731', 'owner'),
  ('00000000-0000-0000-0000-000000001741', '00000000-0000-0000-0000-000000001732', 'member');

insert into public.events (
  id, space_id, created_by, scope, owner_user_id, title, starts_at, ends_at, recurrence_rule, series_id
)
values (
  '00000000-0000-0000-0000-000000001751',
  '00000000-0000-0000-0000-000000001741',
  '00000000-0000-0000-0000-000000001731',
  'shared', null, 'v0.1.7.3 weekly source',
  '2026-08-03T12:00:00Z', '2026-08-03T13:00:00Z',
  '{"version": 1, "frequency": "weekly", "interval": 1, "time_zone": "UTC", "days_of_week": [1]}'::jsonb,
  '00000000-0000-0000-0000-000000001751'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001731', true);

select is(
  (select exception_type from public.upsert_occurrence_override(
    '00000000-0000-0000-0000-000000001751', '2026-08-10', '{"starts_at":"2026-08-10T13:00:00Z","title":"only this"}'::jsonb, null
  )),
  'override',
  'manager can create an only-this override'
);

select is(
  (select override_data ->> 'starts_at' from public.event_occurrence_exceptions
    where event_id = '00000000-0000-0000-0000-000000001751' and occurrence_date = '2026-08-10'),
  '2026-08-10T13:00:00Z',
  'override stores only the supplied safe data'
);

select throws_ok(
  $$select public.upsert_occurrence_override('00000000-0000-0000-0000-000000001751', '2026-08-11', '{"title":"not scheduled"}'::jsonb, null)$$,
  'P0001',
  'Occurrence date is not scheduled by the source event',
  'only-this override rejects a non-candidate date'
);

select is(
  (select exception_type from public.delete_occurrence('00000000-0000-0000-0000-000000001751', '2026-08-10', null)),
  'deleted',
  'delete-this replaces an override with a deleted exception'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001733', true);
select throws_ok(
  $$select public.delete_occurrence('00000000-0000-0000-0000-000000001751', '2026-08-17', null)$$,
  'P0001',
  'Not permitted to manage this event',
  'non-member cannot invoke a destructive recurrence RPC'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001731', true);
select public.upsert_occurrence_override(
  '00000000-0000-0000-0000-000000001751', '2026-08-17', '{"title":"stays on old segment"}'::jsonb, null
);

select public.split_recurring_event(
    '00000000-0000-0000-0000-000000001751', '2026-08-17',
    'split child', null, '2026-08-17T13:00:00Z', '2026-08-17T14:00:00Z', false,
    '{"version": 1, "frequency": "weekly", "interval": 1, "time_zone": "UTC", "days_of_week": [1]}'::jsonb,
    null
  );

select is(
  (select recurrence_until from public.events where id = '00000000-0000-0000-0000-000000001751'),
  '2026-08-17 12:00:00+00'::timestamptz,
  'split closes the old segment immediately before the selected scheduled occurrence'
);

select is(
  (select count(*) from public.events where parent_event_id = '00000000-0000-0000-0000-000000001751' and series_id = '00000000-0000-0000-0000-000000001751'),
  1::bigint,
  'split creates one child in the same logical series'
);

select is(
  (select count(*) from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000001751' and occurrence_date = '2026-08-17'),
  1::bigint,
  'split leaves exceptions attached to the original segment'
);

select throws_ok(
  $$select public.split_recurring_event(
    '00000000-0000-0000-0000-000000001751', '2026-08-24', 'stale child', null,
    '2026-08-24T13:00:00Z', '2026-08-24T14:00:00Z', false,
    '{"version": 1, "frequency": "weekly", "interval": 1, "time_zone": "UTC", "days_of_week": [1]}'::jsonb,
    '2000-01-01T00:00:00Z'::timestamptz
  )$$,
  'P0001',
  'Event was modified concurrently',
  'split rejects a stale optimistic-concurrency token'
);

select public.delete_logical_series('00000000-0000-0000-0000-000000001751', null);

select is(
  (select count(*) from public.events where coalesce(series_id, id) = '00000000-0000-0000-0000-000000001751'),
  0::bigint,
  'logical-series delete removes root and child segments'
);

select is(
  (select count(*) from public.event_occurrence_exceptions where event_id = '00000000-0000-0000-0000-000000001751'),
  0::bigint,
  'logical-series delete removes exceptions'
);

reset role;
select * from finish();
rollback;
