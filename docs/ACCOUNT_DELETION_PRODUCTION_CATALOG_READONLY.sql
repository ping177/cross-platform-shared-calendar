-- Author: Ping Weng
-- Production metadata ONLY. Not a migration. Do NOT run the entire file.
-- Select Q0 only first. Then run one labelled SELECT at a time in Dashboard.
-- On timeout/error: STOP, report label + sanitized error; do not repeat.
-- SELECT-only: no SET/DDL/DML, no user/config table rows, no function bodies.
-- See ACCOUNT_DELETION_CATALOG_MANUAL_GUIDE.md for steps and evidence limits.

-- Q0: connection gate. Must return 1 before any catalog query.
SELECT 1 AS connection_ok;

-- Q1: Database / objects / columns. Run this SELECT alone.
select jsonb_build_object(
 'server',jsonb_build_object('version',current_setting('server_version'),'isolation',current_setting('transaction_isolation'),'read_only',current_setting('transaction_read_only')),
 'namespaces',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname in ('public','private','auth','storage','cron','net','vault','supabase_migrations')),
 'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'owner',pg_get_userbyid(extowner))) from pg_extension where extname in ('pg_cron','pg_net','supabase_vault','pgcrypto')),
 'relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'acl',c.relacl::text) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relkind in ('r','p','v','m')) or (n.nspname,c.relname) in (('private','account_deletions'),('private','account_deletion_admission'),('storage','objects'),('storage','buckets'),('net','http_request_queue'),('net','_http_response'),('vault','decrypted_secrets'),('cron','job'),('supabase_migrations','schema_migrations'))),
 'business_storage_auth_columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'acl',a.attacl::text) order by n.nspname,c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and not a.attisdropped and (n.nspname='public' or (n.nspname,c.relname) in (('private','account_deletions'),('private','account_deletion_admission'),('storage','objects'),('auth','users'),('auth','sessions'),('net','http_request_queue'))))
) as q1_metadata;

-- Q2: Auth / Profile and business foreign keys. Run this SELECT alone.
select jsonb_build_object(
 'foreign_keys',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'target',c.confrelid::regclass::text,'definition',pg_get_constraintdef(c.oid),'validated',c.convalidated,'deferrable',c.condeferrable) order by c.conrelid::regclass::text,c.conname) from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and (c.confrelid in (to_regclass('auth.users'),to_regclass('public.profiles')) or (n.nspname='public' and t.relname in ('spaces','space_members','space_modules','events','event_occurrence_exceptions','tasks','lists','list_sections','list_items','important_dates','review_rounds','review_entries','reminder_deliveries'))))
) as q2_metadata;

-- Q3A: Function identity / owner / body hashes. Run this SELECT alone.
select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'source_md5',md5(p.prosrc),'acl',p.proacl::text,'safe_settings',(select jsonb_agg(v) from unnest(p.proconfig) v where v like 'search_path=%' or v like 'statement_timeout=%' or v like 'lock_timeout=%')) order by n.nspname,p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' or (n.nspname='public' and (p.proname like '%deletion%' or p.proname like '%space%' or p.proname like '%review%' or p.proname like '%account%' or p.proname like '%reminder%' or p.proname like '%push%' or p.proname='are_users_in_same_space')))
) as q3a_metadata;

-- Q3B: stage-specific patch fingerprints; not all stages should match.
-- Run only after Q1 confirms referenced public types exist; otherwise STOP.
with expected(before_step,signature,source_md5) as (values
('before_barrier','public.is_space_member(uuid)','fe14b15cfd531007bcfeff98359c53cb'),
('before_barrier','public.are_users_in_same_space(uuid,uuid)','72659b5f92b3f0db42f83ebfb38845e2'),
('before_barrier','public.can_read_review_round(uuid)','b84d89a43a7f3b41b98d408a3ba00c95'),
('before_barrier','public.ensure_personal_space()','5a0443ce56e48fc97286beeec613ce05'),
('before_barrier','public.join_space_by_invite_code(text)','3760c175a4ff5c1972b858e722272280'),
('before_barrier','public.get_my_previous_review_plan(uuid)','21af3a28d35c58df5a5a7a854180313d'),
('before_barrier','public.important_date_reminder_is_eligible(public.important_dates,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz)','6f71ff73d961945a33f14fc194afca28'),
('before_barrier','public.task_reminder_is_eligible(public.tasks,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz)','7f9b56b47a6a4661ff33142fa78e6d85'),
('before_barrier','public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)','970c56d90893135a18f54e1b2792a836'),
('before_trusted','private.guard_account_deletion_state()','73d095c99de2cfc491136cdc2e6ed6ab'),
('before_trusted','private.prepare_account_deletion(uuid,uuid)','208b740a1d340a2b13ce6ebbc09352df'),
('before_trusted','private.accept_account_deletion(uuid,uuid)','99ffab5f63b5c09fd9896ed907c53b2c'),
('before_trusted','public.guard_personal_space_delete()','de1809afcf4175c949e2d369fca06d5c'),
('before_trusted','public.delete_lifecycle_event_set(uuid,uuid)','9200f39002c70c9c87788b83224a07fd'),
('before_execution','private.guard_account_deletion_state()','114805e5d0cbd070e528992981630af4'),
('before_execution','public.cleanup_account_business(uuid,bigint)','e0cf2283983dd32789ea9aee1f2a2eb6')
) select before_step,signature,source_md5 as expected_md5,md5(p.prosrc) as actual_md5,
  p.prosecdef as security_definer,pg_get_userbyid(p.proowner) as owner,
  md5(p.prosrc)=source_md5 as matches_canonical_baseline,
  case when p.oid is null then false else md5(p.prosrc)=source_md5
    or (before_step='before_barrier' and signature='public.ensure_personal_space()'
      and md5(p.prosrc)='8a0d5b46299e724c5cfa25756504ec11')
    or (before_step='before_barrier' and signature='public.join_space_by_invite_code(text)'
      and md5(p.prosrc)='a3ef55f1c186a61ab9781a4a7446b4f6') end as matches
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) order by before_step,signature;

-- Q4: RLS / triggers / roles / ACL. Run this SELECT alone.
select jsonb_build_object(
 'policies',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when x=0 then 'PUBLIC' else pg_get_userbyid(x) end) from unnest(p.polroles) x),'using_md5',md5(pg_get_expr(p.polqual,p.polrelid)),'check_md5',md5(pg_get_expr(p.polwithcheck,p.polrelid))) order by n.nspname,c.relname,p.polname) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','storage')),
 'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'function',t.tgfoid::regprocedure::text,'definition_md5',md5(pg_get_triggerdef(t.oid))) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private','storage','auth')),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,'bypass',rolbypassrls,'createrole',rolcreaterole)) from pg_roles where rolname in ('postgres','supabase_admin','supabase_storage_admin','supabase_auth_admin','authenticator','anon','authenticated','service_role','account_deletion_executor')),
 'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member),
 'default_acls',(select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'kind',d.defaclobjtype,'acl',d.defaclacl::text)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ('public','private','storage','net','vault') or d.defaclnamespace=0)
) as q4_metadata;

-- Q5: effective queue/Vault ACL booleans. Missing objects return NULL.
-- Never reads queue headers, responses, Vault values, Cron commands or jobs.
with objects as (
 select to_regnamespace('net') as net_schema,
        to_regnamespace('vault') as vault_schema,
        to_regclass('net.http_request_queue') as queue,
        to_regclass('vault.decrypted_secrets') as secrets_view
)
select r.rolname,r.rolcanlogin,
 has_schema_privilege(r.oid,o.net_schema,'USAGE') as net_usage,
 has_table_privilege(r.oid,o.queue,'SELECT') as queue_select,
 case when a.attnum is null then null
      else has_column_privilege(r.oid,o.queue,a.attnum,'SELECT') end as queue_headers_select,
 has_schema_privilege(r.oid,o.vault_schema,'USAGE') as vault_usage,
 has_table_privilege(r.oid,o.secrets_view,'SELECT') as decrypted_secret_select
from pg_roles r cross join objects o
left join pg_attribute a on a.attrelid=o.queue and a.attname='headers'
 and a.attnum>0 and not a.attisdropped
where r.rolcanlogin or r.rolname in
 ('anon','authenticated','service_role','account_deletion_executor')
order by r.rolname;
