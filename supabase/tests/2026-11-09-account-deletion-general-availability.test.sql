-- Disposable database only. All fixture users, sessions and jobs roll back.
begin;
select plan(8);
insert into auth.users(id,email) values
  ('ac000000-0000-4000-8000-000000000001','first@example.invalid'),
  ('ac000000-0000-4000-8000-000000000002','second@example.invalid');
insert into auth.sessions(id,user_id) values
  ('ac000000-0000-4000-8000-000000000011','ac000000-0000-4000-8000-000000000001'),
  ('ac000000-0000-4000-8000-000000000012','ac000000-0000-4000-8000-000000000002');
update private.account_deletion_admission set allowed_user_ids=null where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"ac000000-0000-4000-8000-000000000011"}',true);
select throws_ok('select public.prepare_my_account_deletion()', '42501',
  'NEW_DELETION_REQUESTS_DISABLED','disabled admission still rejects with a NULL list');
reset role;
update private.account_deletion_admission set enabled=true where singleton;
set local role authenticated;
select lives_ok('select public.prepare_my_account_deletion()','GA admits the first unlisted identity');
select lives_ok($test$do $$
begin
  if (public.prepare_my_account_deletion()->>'send_needed')::boolean is distinct from false then
    raise exception 'Repeated preparation issued another challenge';
  end if;
end;
$$$test$,'repeat preparation reuses the active challenge');
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000002',true);
select throws_ok('select public.prepare_my_account_deletion()', '42501',
  'DELETION_SESSION_REQUIRED','GA cannot borrow another identity session');
select set_config('request.jwt.claims','{"session_id":"ac000000-0000-4000-8000-000000000012"}',true);
select lives_ok('select public.prepare_my_account_deletion()','GA admits the second unlisted identity independently');
reset role;
update private.account_deletion_admission set allowed_user_ids='{}' where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()', '42501',
  'NEW_DELETION_REQUESTS_DISABLED','empty list still rejects everyone');
reset role;
update private.account_deletion_admission
set allowed_user_ids=array['ac000000-0000-4000-8000-000000000001'::uuid] where singleton;
set local role authenticated;
select throws_ok('select public.prepare_my_account_deletion()', '42501',
  'NEW_DELETION_REQUESTS_DISABLED','explicit list still rejects unlisted callers');
reset role;
select is((select count(*) from private.account_deletions where accepted_at is not null),0::bigint,
  'preparation never accepts a deletion');
select * from finish();
rollback;
