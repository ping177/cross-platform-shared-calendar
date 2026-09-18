begin;

select plan(22);

select has_table('public', 'push_subscriptions', 'push subscription table exists');
select has_column('public', 'push_subscriptions', 'user_id', 'push subscription user id exists');
select has_column('public', 'push_subscriptions', 'installation_id', 'push subscription installation id exists');
select has_column('public', 'push_subscriptions', 'endpoint', 'push subscription endpoint exists');
select has_column('public', 'push_subscriptions', 'p256dh', 'push subscription p256dh exists');
select has_column('public', 'push_subscriptions', 'auth', 'push subscription auth exists');
select has_column('public', 'push_subscriptions', 'disabled_at', 'push subscription disabled timestamp exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'push subscription RLS is enabled'
);
select has_function('public', 'register_push_subscription', array['uuid', 'text', 'text', 'text', 'timestamp with time zone', 'text'], 'register RPC exists');
select has_function('public', 'disable_push_subscription', array['uuid'], 'disable RPC exists');
select ok(
  not has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT'),
  'authenticated cannot enumerate push subscriptions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.push_subscriptions', 'UPDATE'),
  'authenticated cannot mutate push subscriptions directly'
);
select ok(
  not has_function_privilege('anon', 'public.register_push_subscription(uuid,text,text,text,timestamp with time zone,text)', 'EXECUTE'),
  'anon cannot execute the register RPC'
);
select ok(
  not has_function_privilege('anon', 'public.disable_push_subscription(uuid)', 'EXECUTE'),
  'anon cannot execute the disable RPC'
);

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
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-owner@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-other@example.com', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.register_push_subscription(
    '20000000-0000-4000-8000-000000000001',
    'https://fcm.googleapis.com/fcm/send/owner-first',
    'owner-p256dh',
    'owner-auth',
    null,
    'desktop'
  )$$,
  'authenticated user can register the current installation'
);

select lives_ok(
  $$select public.register_push_subscription(
    '20000000-0000-4000-8000-000000000001',
    'https://fcm.googleapis.com/fcm/send/owner-updated',
    'owner-p256dh-updated',
    'owner-auth-updated',
    null,
    'desktop'
  )$$,
  'same user and installation can upsert a rotated endpoint'
);

reset role;

select is(
  (select count(*) from public.push_subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'same installation upsert keeps one row'
);
select is(
  (select endpoint from public.push_subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  'https://fcm.googleapis.com/fcm/send/owner-updated',
  'same installation upsert replaces endpoint and keys'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select public.register_push_subscription(
  '20000000-0000-4000-8000-000000000002',
  'https://web.push.apple.com/Q/other-installation',
  'other-p256dh',
  'other-auth',
  null,
  'ios-standalone'
);

select throws_ok(
  $$select public.register_push_subscription(
    '20000000-0000-4000-8000-000000000003',
    'https://fcm.googleapis.com/fcm/send/owner-updated',
    'spoof-p256dh',
    'spoof-auth',
    null,
    'desktop'
  )$$,
  '23505',
  'Push endpoint is already registered',
  'another user cannot take over an existing endpoint'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is(
  public.disable_push_subscription('20000000-0000-4000-8000-000000000001'),
  true,
  'user can disable the current installation'
);

reset role;

select ok(
  (select disabled_at is not null from public.push_subscriptions where user_id = '10000000-0000-4000-8000-000000000001'),
  'current installation is marked disabled'
);
select ok(
  (select disabled_at is null from public.push_subscriptions where user_id = '10000000-0000-4000-8000-000000000002'),
  'disabling one installation leaves another user installation active'
);

select * from finish();

rollback;
