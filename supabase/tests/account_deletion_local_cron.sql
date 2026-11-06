-- ISOLATED LOCAL ONLY. No credentials, no Production URL or deployed resource.
-- The harness provisions an ephemeral Vault secret over stdin before scheduling.
-- Install as the isolated platform/table owner, never an Edge runtime identity.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
-- pg_net queues the Authorization header in this transient table. Cached
-- defaults grant clients SELECT; revoke it before creating any wake secret.
revoke select on net.http_request_queue from public,anon,authenticated;
do $$begin
  if has_table_privilege('anon','net.http_request_queue','SELECT')
    or has_table_privilege('authenticated','net.http_request_queue','SELECT')
    or (has_schema_privilege('anon','vault','USAGE') and has_table_privilege('anon','vault.decrypted_secrets','SELECT'))
    or (has_schema_privilege('authenticated','vault','USAGE') and has_table_privilege('authenticated','vault.decrypted_secrets','SELECT')) then
    raise exception 'Local scheduler credential boundary is not safe';
  end if;
end;$$;
create function private.wake_account_deletions_local()
returns bigint language sql security definer set search_path=pg_catalog,pg_temp as $$
  select net.http_post('http://deletion:9000/', '{"action":"work"}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||decrypted_secret),20000)
  from vault.decrypted_secrets where name='account_deletion_local_wake';
$$;
revoke all on function private.wake_account_deletions_local() from public,anon,authenticated,service_role;
grant execute on function private.wake_account_deletions_local() to postgres;
-- No schedule is installed merely by reading/applying the canonical schema.
-- The local test explicitly schedules this owner-only function with pg_cron.
