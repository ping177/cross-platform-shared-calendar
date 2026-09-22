begin;

select plan(67);

select has_table('public', 'reminder_deliveries', 'reminder delivery ledger exists');
select has_column('public', 'reminder_deliveries', 'id', 'delivery id exists');
select has_column('public', 'reminder_deliveries', 'event_id', 'delivery event id exists');
select has_column('public', 'reminder_deliveries', 'recipient_user_id', 'delivery recipient user id exists');
select has_column('public', 'reminder_deliveries', 'subscription_id', 'delivery subscription id exists');
select has_column('public', 'reminder_deliveries', 'due_at', 'delivery due timestamp exists');
select has_column('public', 'reminder_deliveries', 'status', 'delivery status exists');
select has_column('public', 'reminder_deliveries', 'result_code', 'delivery result code exists');
select has_column('public', 'reminder_deliveries', 'provider_status', 'delivery provider status exists');
select col_type_is('public', 'reminder_deliveries', 'provider_status', 'smallint', 'delivery provider status uses the approved smallint type');
select has_column('public', 'reminder_deliveries', 'created_at', 'delivery created timestamp exists');
select has_column('public', 'reminder_deliveries', 'updated_at', 'delivery updated timestamp exists');
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.reminder_deliveries'::regclass
      and conname in (
        'reminder_deliveries_status_check',
        'reminder_deliveries_provider_status_check',
        'reminder_deliveries_result_shape_check',
        'reminder_deliveries_occurrence_identity_key'
      )
  ),
  4::bigint,
  'delivery ledger has the minimum status, provider, result-shape, and idempotency constraints'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.reminder_deliveries'::regclass
      and contype = 'f'
  ),
  0::bigint,
  'delivery audit rows have no event, user, or subscription foreign keys'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reminder_deliveries'::regclass),
  'delivery ledger RLS is enabled'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'reminder_deliveries'),
  0::bigint,
  'delivery ledger exposes no client RLS policy'
);
select ok(
  not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reminder_deliveries'
  ),
  'delivery ledger is not published to Realtime'
);

select ok(not has_table_privilege('anon', 'public.reminder_deliveries', 'SELECT'), 'anon cannot select delivery rows');
select ok(not has_table_privilege('anon', 'public.reminder_deliveries', 'INSERT'), 'anon cannot insert delivery rows');
select ok(not has_table_privilege('anon', 'public.reminder_deliveries', 'UPDATE'), 'anon cannot update delivery rows');
select ok(not has_table_privilege('anon', 'public.reminder_deliveries', 'DELETE'), 'anon cannot delete delivery rows');
select ok(not has_table_privilege('authenticated', 'public.reminder_deliveries', 'SELECT'), 'authenticated cannot select delivery rows');
select ok(not has_table_privilege('authenticated', 'public.reminder_deliveries', 'INSERT'), 'authenticated cannot insert delivery rows');
select ok(not has_table_privilege('authenticated', 'public.reminder_deliveries', 'UPDATE'), 'authenticated cannot update delivery rows');
select ok(not has_table_privilege('authenticated', 'public.reminder_deliveries', 'DELETE'), 'authenticated cannot delete delivery rows');
select ok(has_table_privilege('service_role', 'public.reminder_deliveries', 'SELECT'), 'service role can select delivery rows');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'INSERT'), 'service role must use the atomic claim function instead of direct insert');
select ok(has_table_privilege('service_role', 'public.reminder_deliveries', 'UPDATE'), 'service role can update delivery rows');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'DELETE'), 'service role cannot delete durable delivery rows');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'TRUNCATE'), 'service role cannot truncate durable delivery rows');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'REFERENCES'), 'service role cannot create references to delivery rows');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'TRIGGER'), 'service role cannot create triggers on the delivery ledger');
select ok(not has_table_privilege('service_role', 'public.reminder_deliveries', 'MAINTAIN'), 'service role cannot maintain the delivery ledger');

select has_function(
  'public',
  'claim_reminder_delivery',
  array['uuid', 'uuid', 'uuid', 'timestamp with time zone', 'timestamp with time zone'],
  'atomic reminder delivery claim function exists'
);
select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
  ),
  'claim function is SECURITY DEFINER'
);
select ok(
  (
    select proconfig @> array['search_path=pg_catalog, pg_temp']
    from pg_proc
    where oid = 'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
  ),
  'claim function pins a safe search_path'
);
select ok(
  not exists (
    select 1
    from pg_proc function_definition
    cross join lateral aclexplode(
      coalesce(function_definition.proacl, acldefault('f', function_definition.proowner))
    ) function_acl
    where function_definition.oid = 'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute the claim function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon cannot execute the claim function'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated cannot execute the claim function'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ),
  'service role can execute the claim function'
);

select throws_ok(
  $$insert into public.reminder_deliveries (event_id, recipient_user_id, subscription_id, due_at, status)
    values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', clock_timestamp(), 'queued')$$,
  '23514',
  'new row for relation "reminder_deliveries" violates check constraint "reminder_deliveries_result_shape_check"',
  'unknown delivery status is rejected'
);
select throws_ok(
  $$insert into public.reminder_deliveries (event_id, recipient_user_id, subscription_id, due_at, status, result_code, provider_status)
    values ('30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000013', clock_timestamp(), 'failed', 'provider_error', 99)$$,
  '23514',
  'new row for relation "reminder_deliveries" violates check constraint "reminder_deliveries_provider_status_check"',
  'provider status outside HTTP range is rejected'
);
select throws_ok(
  $$insert into public.reminder_deliveries (event_id, recipient_user_id, subscription_id, due_at, status, result_code)
    values ('30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000023', clock_timestamp(), 'claimed', 'unexpected')$$,
  '23514',
  'new row for relation "reminder_deliveries" violates check constraint "reminder_deliveries_result_shape_check"',
  'claimed rows cannot carry a result'
);
select throws_ok(
  $$insert into public.reminder_deliveries (event_id, recipient_user_id, subscription_id, due_at, status, result_code, provider_status)
    values ('30000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000033', clock_timestamp(), 'sent', 'delivered', 500)$$,
  '23514',
  'new row for relation "reminder_deliveries" violates check constraint "reminder_deliveries_result_shape_check"',
  'sent rows require a successful provider status'
);
select throws_ok(
  $$insert into public.reminder_deliveries (event_id, recipient_user_id, subscription_id, due_at, status)
    values ('30000000-0000-4000-8000-000000000041', '30000000-0000-4000-8000-000000000042', '30000000-0000-4000-8000-000000000043', clock_timestamp(), 'failed')$$,
  '23514',
  'new row for relation "reminder_deliveries" violates check constraint "reminder_deliveries_result_shape_check"',
  'failed rows require a result code'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('31000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-member@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-former-member@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1-former-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.spaces (id, name, invite_code, created_by)
values
  ('32000000-0000-4000-8000-000000000001', 'C1 shared fixture', 'C1SHARED', '31000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000002', 'C1 former owner fixture', 'C1FORMER', '31000000-0000-4000-8000-000000000004');

insert into public.space_members (space_id, user_id, role)
values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'owner'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'member'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'member'),
  ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000004', 'owner');

insert into public.events (
  id, space_id, created_by, scope, owner_user_id, title, starts_at, reminder_kind, time_zone
)
values
  ('33000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'shared', null, 'C1 shared reminder', clock_timestamp() + interval '1 hour', 'timed_at_start', 'UTC'),
  ('33000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'personal', '31000000-0000-4000-8000-000000000001', 'C1 personal reminder', clock_timestamp() + interval '1 hour', 'timed_at_start', 'UTC'),
  ('33000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'shared', null, 'C1 disabled reminder', clock_timestamp() + interval '1 hour', null, null),
  ('33000000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000004', 'personal', '31000000-0000-4000-8000-000000000004', 'C1 former owner reminder', clock_timestamp() + interval '1 hour', 'timed_at_start', 'UTC'),
  ('33000000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'shared', null, 'C1 durable audit reminder', clock_timestamp() + interval '1 hour', 'timed_at_start', 'UTC'),
  ('33000000-0000-4000-8000-000000000007', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'shared', null, 'C1 expired grace reminder', clock_timestamp() + interval '1 hour', 'timed_at_start', 'UTC');

insert into public.events (
  id, space_id, created_by, scope, title, starts_at, time_zone, recurrence_rule, series_id
)
values (
  '33000000-0000-4000-8000-000000000004',
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'shared',
  'C1 recurring reminder rejection',
  clock_timestamp() + interval '1 hour',
  'UTC',
  '{"version": 1, "frequency": "daily", "interval": 1, "time_zone": "UTC"}'::jsonb,
  '33000000-0000-4000-8000-000000000004'
);

alter table public.events disable trigger events_prepare_reminder_schedule;
update public.events
set reminder_schedule_changed_at = clock_timestamp() - interval '20 minutes'
where id = '33000000-0000-4000-8000-000000000007';
alter table public.events enable trigger events_prepare_reminder_schedule;

insert into public.push_subscriptions (
  id, user_id, installation_id, endpoint, p256dh, auth, expiration_time, disabled_at
)
values
  ('34000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', 'https://fcm.googleapis.com/fcm/send/c1-owner', 'p256dh', 'auth', null, null),
  ('34000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000002', 'https://fcm.googleapis.com/fcm/send/c1-member', 'p256dh', 'auth', null, null),
  ('34000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003', '35000000-0000-4000-8000-000000000003', 'https://fcm.googleapis.com/fcm/send/c1-former-member', 'p256dh', 'auth', null, null),
  ('34000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000004', '35000000-0000-4000-8000-000000000004', 'https://fcm.googleapis.com/fcm/send/c1-former-owner', 'p256dh', 'auth', null, null),
  ('34000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000005', 'https://fcm.googleapis.com/fcm/send/c1-disabled', 'p256dh', 'auth', null, clock_timestamp()),
  ('34000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000006', 'https://fcm.googleapis.com/fcm/send/c1-expired', 'p256dh', 'auth', clock_timestamp() - interval '1 minute', null),
  ('34000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000007', 'https://fcm.googleapis.com/fcm/send/c1-delete-audit', 'p256dh', 'auth', null, null),
  ('34000000-0000-4000-8000-000000000008', '31000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000008', 'https://fcm.googleapis.com/fcm/send/c1-disable-audit', 'p256dh', 'auth', null, null);

delete from public.space_members
where (space_id, user_id) in (
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000004')
);

create temporary table c1_claim_inputs (
  label text primary key,
  due_at timestamptz not null,
  marker timestamptz not null
) on commit drop;

insert into c1_claim_inputs (label, due_at, marker)
select 'first', clock_timestamp(), reminder_schedule_changed_at
from public.events
where id = '33000000-0000-4000-8000-000000000001'
union all
select 'audit', clock_timestamp(), reminder_schedule_changed_at
from public.events
where id = '33000000-0000-4000-8000-000000000006';

grant select on c1_claim_inputs to service_role;

create temporary table c1_claim_results (
  label text primary key,
  delivery_id uuid
) on commit drop;

set local role service_role;

select isnt(
  public.claim_reminder_delivery(
    '33000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001',
    (select due_at from c1_claim_inputs where label = 'first'),
    (select marker from c1_claim_inputs where label = 'first')
  ),
  null::uuid,
  'first valid claim succeeds as the service role'
);

reset role;

select is(
  public.claim_reminder_delivery(
    '33000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001',
    (select due_at from c1_claim_inputs where label = 'first'),
    (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')
  ),
  null::uuid,
  'duplicate identical claim returns null'
);
select is(
  (
    select count(*)
    from public.reminder_deliveries
    where event_id = '33000000-0000-4000-8000-000000000001'
      and subscription_id = '34000000-0000-4000-8000-000000000001'
      and due_at = (select due_at from c1_claim_inputs where label = 'first')
  ),
  1::bigint,
  'duplicate identical claim keeps one ledger row'
);

select is(public.claim_reminder_delivery('33999999-0000-4000-8000-000000000099', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp(), clock_timestamp()), null::uuid, 'missing event is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000003')), null::uuid, 'disabled reminder is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000004')), null::uuid, 'recurring event is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp(), (select reminder_schedule_changed_at + interval '1 microsecond' from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'stale schedule marker is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', (select reminder_schedule_changed_at - interval '1 microsecond' from public.events where id = '33000000-0000-4000-8000-000000000002'), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000002')), null::uuid, 'due time before the schedule marker is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp() + interval '1 minute', (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000002')), null::uuid, 'future due time is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', clock_timestamp() - interval '11 minutes', (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000007')), null::uuid, 'due time older than the ten-minute grace window is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', '34000000-0000-4000-8000-000000000003', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'former shared member is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000002', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000002')), null::uuid, 'non-owner personal recipient is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000004', '34000000-0000-4000-8000-000000000004', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000005')), null::uuid, 'personal owner without current membership is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '34999999-0000-4000-8000-000000000099', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'missing subscription is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'subscription owned by another user is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000005', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'disabled subscription is rejected');
select is(public.claim_reminder_delivery('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000006', clock_timestamp(), (select reminder_schedule_changed_at from public.events where id = '33000000-0000-4000-8000-000000000001')), null::uuid, 'expired subscription is rejected');

select ok(
  (
    select
      lower(pg_get_functiondef('public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure))
        like '%insert into public.reminder_deliveries%'
      and lower(pg_get_functiondef('public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure))
        like '%on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing%'
  ),
  'claim uses one atomic insert with conflict suppression for concurrent identical claims'
);

insert into c1_claim_results (label, delivery_id)
values
  (
    'audit-delete',
    public.claim_reminder_delivery(
      '33000000-0000-4000-8000-000000000006',
      '31000000-0000-4000-8000-000000000001',
      '34000000-0000-4000-8000-000000000007',
      (select due_at from c1_claim_inputs where label = 'audit'),
      (select marker from c1_claim_inputs where label = 'audit')
    )
  ),
  (
    'audit-disable',
    public.claim_reminder_delivery(
      '33000000-0000-4000-8000-000000000006',
      '31000000-0000-4000-8000-000000000001',
      '34000000-0000-4000-8000-000000000008',
      (select due_at from c1_claim_inputs where label = 'audit'),
      (select marker from c1_claim_inputs where label = 'audit')
    )
  );

select ok(
  (select bool_and(delivery_id is not null) from c1_claim_results where label like 'audit-%'),
  'audit durability fixtures are claimed successfully'
);

delete from public.events where id = '33000000-0000-4000-8000-000000000006';
select is((select count(*) from public.reminder_deliveries where event_id = '33000000-0000-4000-8000-000000000006'), 2::bigint, 'delivery audit rows survive event deletion');

delete from public.push_subscriptions where id = '34000000-0000-4000-8000-000000000007';
select is((select count(*) from public.reminder_deliveries where subscription_id = '34000000-0000-4000-8000-000000000007'), 1::bigint, 'delivery audit row survives subscription deletion');

update public.push_subscriptions
set disabled_at = clock_timestamp()
where id = '34000000-0000-4000-8000-000000000008';
select is((select count(*) from public.reminder_deliveries where subscription_id = '34000000-0000-4000-8000-000000000008'), 1::bigint, 'delivery audit row survives subscription disable');

select * from finish();

rollback;
