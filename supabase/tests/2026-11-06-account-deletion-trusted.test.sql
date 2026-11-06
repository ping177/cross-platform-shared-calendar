-- Role/catalog regressions only; real SMTP OTP is tested in the HTTP harness.
begin;
select no_plan();
select ok(not rolcanlogin and not rolbypassrls and not rolsuper and not rolcreatedb and not rolcreaterole,
  'cleanup owner is a restricted NOLOGIN role') from pg_roles where rolname='account_deletion_executor';
select ok(not pg_has_role('service_role','account_deletion_executor','MEMBER'),'service role cannot SET cleanup role');
select ok(not pg_has_role('authenticated','account_deletion_executor','MEMBER'),'client cannot SET cleanup role');
select ok(not has_schema_privilege('account_deletion_executor','public','CREATE'),'executor cannot create public functions');
select ok(not has_table_privilege('account_deletion_executor','public.events','INSERT'),'executor cannot insert Events');
select ok(not has_table_privilege('account_deletion_executor','public.events','TRUNCATE'),'executor cannot truncate Events');
select ok(not has_function_privilege('authenticated','public.cleanup_account_business(uuid,bigint)','EXECUTE'),'client has no cleanup API authority');
select ok(has_function_privilege('service_role','public.cleanup_account_business(uuid,bigint)','EXECUTE'),'trusted backend has narrow job cleanup API');
select ok(not has_function_privilege('authenticated','public.finish_deletion_verification(uuid,uuid,uuid,uuid,uuid,text)','EXECUTE'),'client cannot issue verification permit');
select ok(not has_function_privilege('service_role','private.accept_account_deletion(uuid,uuid)','EXECUTE'),'arbitrary UUID internal accept remains private');
select ok(not has_function_privilege('authenticated','public.delete_lifecycle_event_set(uuid,uuid)','EXECUTE'),'lifecycle algorithm still internal');
select is((select r.rolname from pg_proc p join pg_roles r on p.proowner=r.oid where p.oid='public.cleanup_account_business(uuid,bigint)'::regprocedure),
  'account_deletion_executor','cleanup function owner is restricted executor');
select ok(not prosecdef,'reused lifecycle helper preserves invoker identity') from pg_proc where oid='public.delete_lifecycle_event_set(uuid,uuid)'::regprocedure;
set local role service_role;
select set_config('app.deletion_request','bb000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.cleanup_account_business('bb000000-0000-4000-8000-000000000001',0)$$,
  '42501','TRUSTED_ACCEPTED_JOB_REQUIRED','spoofed context without accepted proof cannot clean');
reset role;
select * from finish();
rollback;
