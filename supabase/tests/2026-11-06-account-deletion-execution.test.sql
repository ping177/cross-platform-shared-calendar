-- Catalog/authority assertions on the real local schema, no simulated Auth.
begin;
do $$
begin
  if has_function_privilege('authenticated','public.claim_account_deletion()','EXECUTE')
    or has_function_privilege('anon','public.claim_account_deletion()','EXECUTE') then raise exception 'Client can claim job'; end if;
  if has_function_privilege('service_role','public.cleanup_account_business(uuid,bigint)','EXECUTE') then raise exception 'Unleased cleanup still granted'; end if;
  if has_function_privilege('authenticated','public.advance_deletion_execution(uuid,bigint,uuid,text)','EXECUTE') then raise exception 'Client can advance job'; end if;
  if has_function_privilege('anon','public.read_deletion_receipt(text)','EXECUTE') then raise exception 'Receipt lookup directly exposed'; end if;
  if has_function_privilege('service_role','private.resume_account_deletion(uuid)','EXECUTE') then raise exception 'Public recovery bypass'; end if;
  if has_table_privilege('authenticated','private.account_deletions','SELECT') or has_table_privilege('service_role','private.account_deletions','UPDATE') then raise exception 'Job table exposed'; end if;
  if pg_has_role('service_role','account_deletion_executor','MEMBER') or pg_has_role('authenticated','account_deletion_executor','MEMBER') then raise exception 'Cleanup role exposed'; end if;
  if exists(select 1 from pg_roles where rolname='account_deletion_executor' and (rolcanlogin or rolbypassrls or rolsuper)) then raise exception 'Cleanup role elevated'; end if;
  if (select prosecdef from pg_proc where oid='public.delete_lifecycle_event_set(uuid,uuid)'::regprocedure) then raise exception 'Lifecycle identity lost'; end if;
end;$$;
set local role service_role;
do $$begin
  begin
    perform public.advance_deletion_execution('ad000000-0000-4000-8000-000000000001',0,'ad000000-0000-4000-8000-000000000002','complete');
    raise exception 'Fake completion succeeded';
  exception when insufficient_privilege then null; end;
end;$$;
reset role;
rollback;
