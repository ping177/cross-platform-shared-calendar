begin;

select plan(32);

select has_column('public', 'reminder_deliveries', 'occurrence_date', 'ledger has nullable recurring occurrence identity');
select col_type_is('public', 'reminder_deliveries', 'occurrence_date', 'date', 'occurrence identity uses date');
select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_recurring_reminder_unsupported_check'
  ),
  'temporary recurring Reminder constraint is removed'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.reminder_deliveries'::regclass
      and conname = 'reminder_deliveries_occurrence_identity_key'
  ),
  'ledger has the recurrence-aware idempotency constraint'
);
select has_function(
  'public',
  'claim_recurring_reminder_delivery',
  array[
    'uuid', 'uuid', 'date', 'uuid', 'uuid', 'timestamp with time zone',
    'timestamp with time zone', 'timestamp with time zone', 'uuid',
    'timestamp with time zone', 'text', 'timestamp with time zone'
  ],
  'recurring atomic claim exists'
);
select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)'::regprocedure
  ),
  'recurring claim is SECURITY DEFINER'
);
select ok(
  (
    select proconfig @> array['search_path=pg_catalog, pg_temp']
    from pg_proc
    where oid = 'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)'::regprocedure
  ),
  'recurring claim pins a hardened search_path'
);
select ok(
  not exists (
    select 1
    from pg_proc function_definition
    cross join lateral aclexplode(
      coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))
    ) function_acl
    where function_definition.oid = 'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)'::regprocedure
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute recurring claim'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon cannot execute recurring claim'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated cannot execute recurring claim'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'service role can execute recurring claim'
);
select ok(
  not has_table_privilege('service_role', 'public.reminder_deliveries', 'INSERT'),
  'service role still cannot bypass atomic claims with direct ledger inserts'
);
select ok(
  position(
    'recurring_occurrence_instant'
    in lower(pg_get_functiondef('public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)'::regprocedure))
  ) = 0,
  'recurring claim does not implement recurrence expansion in SQL'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('61000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice3-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'slice3-former@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values ('62000000-0000-4000-8000-000000000001', 'Slice 3 fixture', 'SLICE3DB', '61000000-0000-4000-8000-000000000001');

insert into public.space_members (space_id, user_id, role)
values ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner');

select lives_ok(
  $$insert into public.events (
      id, space_id, created_by, scope, title, starts_at, reminder_kind, time_zone,
      recurrence_rule, series_id
    ) values (
      '63000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'shared', 'Recurring Reminder fixture', clock_timestamp() + interval '1 day',
      'timed_at_start', 'UTC',
      '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
      '63000000-0000-4000-8000-000000000001'
    )$$,
  'recurring source Event can persist an event-level Reminder'
);

insert into public.events (
  id, space_id, created_by, scope, title, starts_at, reminder_kind, time_zone,
  recurrence_rule, series_id
)
select
  fixture.id,
  '62000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'shared',
  fixture.title,
  clock_timestamp() + interval '1 day',
  'timed_at_start',
  'UTC',
  '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
  fixture.id
from (values
  ('63000000-0000-4000-8000-000000000002'::uuid, 'Source race'),
  ('63000000-0000-4000-8000-000000000003'::uuid, 'Absence race'),
  ('63000000-0000-4000-8000-000000000004'::uuid, 'Exception race'),
  ('63000000-0000-4000-8000-000000000005'::uuid, 'Title override'),
  ('63000000-0000-4000-8000-000000000006'::uuid, 'Schedule override')
) as fixture(id, title);

insert into public.events (
  id, space_id, created_by, scope, title, starts_at, reminder_kind, time_zone
)
values (
  '63000000-0000-4000-8000-000000000007',
  '62000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'shared', 'Ordinary identity fixture', clock_timestamp() + interval '1 day',
  'timed_at_start', 'UTC'
);

insert into public.push_subscriptions (
  id, user_id, installation_id, endpoint, p256dh, auth, disabled_at
)
values
  ('64000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000001', 'https://fcm.googleapis.com/fcm/send/slice3-owner', 'p256dh', 'auth', null),
  ('64000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000002', 'https://fcm.googleapis.com/fcm/send/slice3-disabled', 'p256dh', 'auth', clock_timestamp()),
  ('64000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000002', '65000000-0000-4000-8000-000000000003', 'https://fcm.googleapis.com/fcm/send/slice3-former', 'p256dh', 'auth', null);

create temporary table slice3_snapshots as
select id, updated_at, reminder_schedule_changed_at
from public.events;

create temporary table slice3_due (due_at timestamptz not null) on commit drop;
insert into slice3_due values (clock_timestamp());

grant select on slice3_snapshots, slice3_due to service_role;

set local role service_role;

select isnt(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
    (select due_at from slice3_due),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ),
  null::uuid,
  'valid normal recurring occurrence claim succeeds'
);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
    (select due_at from slice3_due),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ),
  null::uuid,
  'duplicate recurring occurrence claim is rejected'
);
select is(
  (select count(*) from public.reminder_deliveries where event_id = '63000000-0000-4000-8000-000000000001' and occurrence_date = '2026-09-22'),
  1::bigint,
  'duplicate recurring claim keeps one row'
);
select isnt(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-23',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
    (select due_at from slice3_due),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ),
  null::uuid,
  'a distinct occurrence date remains deliverable at the same effective due instant'
);
select is(
  (select count(*) from public.reminder_deliveries where event_id = '63000000-0000-4000-8000-000000000001' and due_at = (select due_at from slice3_due)),
  2::bigint,
  'colliding recurring due instants retain two occurrence identities'
);

reset role;

update public.events set title = 'Source changed after scan' where id = '63000000-0000-4000-8000-000000000002';
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000002'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000002'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000002')
  ), null::uuid, 'source mutation after scan rejects the stale recurring claim'
);

insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type, override_data)
values ('63000000-0000-4000-8000-000000000003', '2026-09-22', 'override', '{"title":"added after scan"}'::jsonb);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000003', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000003'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000003'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000003')
  ), null::uuid, 'an exception added after an absence snapshot rejects the claim'
);

insert into public.event_occurrence_exceptions (id, event_id, occurrence_date, exception_type, override_data)
values (
  '66000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000004', '2026-09-22',
  'override', '{"title":"before"}'::jsonb
);
create temporary table slice3_exception_snapshots as
select id, event_id, updated_at, exception_type
from public.event_occurrence_exceptions
where id = '66000000-0000-4000-8000-000000000001';
update public.event_occurrence_exceptions set override_data = '{"title":"after"}'::jsonb where id = '66000000-0000-4000-8000-000000000001';
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000004', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004'),
    (select id from slice3_exception_snapshots), (select updated_at from slice3_exception_snapshots), 'override',
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004')
  ), null::uuid, 'override mutation after scan rejects the stale exception snapshot'
);

truncate slice3_exception_snapshots;
insert into slice3_exception_snapshots select id, event_id, updated_at, exception_type from public.event_occurrence_exceptions where id = '66000000-0000-4000-8000-000000000001';
update public.event_occurrence_exceptions set exception_type = 'deleted', override_data = null where id = '66000000-0000-4000-8000-000000000001';
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000004', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004'),
    (select id from slice3_exception_snapshots), (select updated_at from slice3_exception_snapshots), 'override',
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000004')
  ), null::uuid, 'override deletion after scan rejects the stale claim'
);

insert into public.event_occurrence_exceptions (id, event_id, occurrence_date, exception_type, override_data)
values
  ('66000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000005', '2026-09-22', 'override', '{"title":"title only"}'::jsonb),
  ('66000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000006', '2026-09-22', 'override', '{"starts_at":"2026-09-22T12:00:00Z"}'::jsonb);

select isnt(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000005', '63000000-0000-4000-8000-000000000005', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000005'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000005'),
    '66000000-0000-4000-8000-000000000002',
    (select updated_at from public.event_occurrence_exceptions where id = '66000000-0000-4000-8000-000000000002'),
    'override',
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000005')
  ), null::uuid, 'title-only override may use the source schedule marker'
);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000006', '63000000-0000-4000-8000-000000000006', '2026-09-22',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
    (select updated_at - interval '1 microsecond' from public.event_occurrence_exceptions where id = '66000000-0000-4000-8000-000000000003'),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000006'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000006'),
    '66000000-0000-4000-8000-000000000003',
    (select updated_at from public.event_occurrence_exceptions where id = '66000000-0000-4000-8000-000000000003'),
    'override',
    (select updated_at from public.event_occurrence_exceptions where id = '66000000-0000-4000-8000-000000000003')
  ), null::uuid, 'schedule-changing override due before its exception marker is rejected'
);

select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-24',
    '61000000-0000-4000-8000-000000000002', '64000000-0000-4000-8000-000000000003', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ), null::uuid, 'former Space member is rejected by recurring claim'
);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-24',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000002', clock_timestamp(),
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ), null::uuid, 'disabled subscription is rejected by recurring claim'
);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-24',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp() + interval '1 minute',
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ), null::uuid, 'future recurring due is rejected'
);
select is(
  public.claim_recurring_reminder_delivery(
    '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '2026-09-24',
    '61000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', clock_timestamp() - interval '11 minutes',
    (select updated_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001'),
    null, null, null,
    (select reminder_schedule_changed_at from slice3_snapshots where id = '63000000-0000-4000-8000-000000000001')
  ), null::uuid, 'recurring due outside grace is rejected'
);

select isnt(
  public.claim_reminder_delivery(
    '63000000-0000-4000-8000-000000000007',
    '61000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    clock_timestamp(),
    (select reminder_schedule_changed_at from public.events where id = '63000000-0000-4000-8000-000000000007')
  ), null::uuid, 'ordinary claim remains valid after the ledger identity extension'
);
select is(
  public.claim_reminder_delivery(
    '63000000-0000-4000-8000-000000000007',
    '61000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    (select due_at from public.reminder_deliveries where event_id = '63000000-0000-4000-8000-000000000007'),
    (select reminder_schedule_changed_at from public.events where id = '63000000-0000-4000-8000-000000000007')
  ), null::uuid, 'ordinary duplicate identity remains unchanged'
);
select is(
  (select occurrence_date from public.reminder_deliveries where event_id = '63000000-0000-4000-8000-000000000007'),
  null::date,
  'ordinary ledger rows require no occurrence backfill'
);

select * from finish();

rollback;
