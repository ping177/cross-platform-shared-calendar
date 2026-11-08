-- Disposable database only. All fixture users, sessions and preparation rows roll back.
begin;
select plan(15);

insert into auth.users(id,email) values
  ('ab000000-0000-4000-8000-000000000001','pilot-a@example.invalid'),
  ('ab000000-0000-4000-8000-000000000002','pilot-b@example.invalid');
insert into auth.sessions(id,user_id) values
  ('ab000000-0000-4000-8000-000000000011','ab000000-0000-4000-8000-000000000001'),
  ('ab000000-0000-4000-8000-000000000012','ab000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"ab000000-0000-4000-8000-000000000011"}',true);
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','closed admission rejects A');
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"ab000000-0000-4000-8000-000000000012"}',true);
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','closed admission rejects B');
reset role;

update private.account_deletion_admission set enabled=true,allowed_user_ids=null where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','NULL allowlist fails closed');
reset role;
update private.account_deletion_admission set allowed_user_ids='{}' where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','empty allowlist fails closed');
reset role;
update private.account_deletion_admission
set allowed_user_ids=array['ab000000-0000-4000-8000-000000000001'::uuid] where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','B cannot directly prepare under A-only allowlist');
select is(public.current_account_active(),true,'B remains active for ordinary app access');
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','DELETION_SESSION_REQUIRED','A identity with B session is rejected');
select set_config('request.jwt.claim.sub','',true);
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','DELETION_SESSION_REQUIRED','missing Auth identity is rejected');
reset role;
set local role anon;
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','permission denied for function prepare_my_account_deletion','anonymous RPC access is denied');
reset role;
select is((select count(*) from private.account_deletions),0::bigint,'all refused callers leave no preparation');

set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"ab000000-0000-4000-8000-000000000011"}',true);
select ok((public.prepare_my_account_deletion()->>'send_needed')::boolean,'A may prepare with its own session');
select is((public.prepare_my_account_deletion()->>'send_needed')::boolean,false,'same A session can reuse the preparation');
reset role;
select results_eq(
  $$select user_id,status,accepted_at is null from private.account_deletions$$,
  $$values ('ab000000-0000-4000-8000-000000000001'::uuid,'preparing'::text,true)$$,
  'only A has a preparation and no request was accepted');

update private.account_deletion_admission set enabled=false where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()',
  '42501','NEW_DELETION_REQUESTS_DISABLED','closed admission also refuses existing preparations');
reset role;
select ok(has_function_privilege('service_role','public.claim_account_deletion()','EXECUTE')
  and not has_function_privilege('authenticated','public.claim_account_deletion()','EXECUTE'),
  'Worker claim remains service-only without invoking it');

select * from finish();
rollback;
