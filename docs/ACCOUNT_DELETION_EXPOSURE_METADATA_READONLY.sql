-- Author: Ping Weng. Metadata ONLY; run one SELECT at a time, stop on error.
-- No RPC invocation, queue/Vault rows, function bodies or secret values returned.
-- E1: only schema-name configuration; NULL is NOT proof of gateway defaults.
select current_setting('pgrst.db_schemas',true) as session_exposed_schemas,
 d.datname,r.rolname,split_part(v,'=',1) as setting_name,
 substring(v from position('=' in v)+1) as schema_names
from pg_db_role_setting s
left join pg_database d on d.oid=s.setdatabase
left join pg_roles r on r.oid=s.setrole
cross join lateral unnest(s.setconfig) v
where split_part(v,'=',1) in ('pgrst.db_schemas','pgrst.db_extra_search_path');

-- E2: inventory ALL functions in known API schemas, not only previous Q3 name filters.
-- If Dashboard lists other exposed schemas, report names FIRST; scope must be extended.
-- Flags are triage clues, not a full call graph or proof that dynamic SQL is safe.
select n.nspname,p.oid::regprocedure::text as signature,
 pg_get_userbyid(p.proowner) as owner,l.lanname,p.prosecdef,
 md5(p.prosrc) as body_md5,
 has_schema_privilege('anon',n.oid,'USAGE') and has_function_privilege('anon',p.oid,'EXECUTE') as anon_callable,
 has_schema_privilege('authenticated',n.oid,'USAGE') and has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_callable,
 p.prosrc ~* '\m(net|vault)\M|http_request_queue|decrypted_secrets' as mentions_sensitive_objects,
 p.prosrc ~* '\mexecute\M|dblink|query_to_xml' as dynamic_or_generic_sql_hint,
 (select jsonb_agg(v) from unnest(p.proconfig) v where v like 'search_path=%') as search_path
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname in ('public','graphql_public') and p.prokind='f'
order by n.nspname,p.proname,p.oid;

-- E3: view metadata/direct dependency edges. No view rows or definitions.
-- Inspect intermediate view/function dependencies if the returned targets require it.
select n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,
 md5(pg_get_viewdef(c.oid,true)) as definition_md5,
 pg_get_viewdef(c.oid,true) ~* '\m(net|vault)\M|http_request_queue|decrypted_secrets' as mentions_sensitive_objects,
 (select jsonb_agg(o) from unnest(c.reloptions) o where o like 'security_invoker=%') as invoker_option,
 has_schema_privilege('anon',n.oid,'USAGE') and has_table_privilege('anon',c.oid,'SELECT') as anon_select,
 has_schema_privilege('authenticated',n.oid,'USAGE') and has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
 (select jsonb_agg(distinct jsonb_build_object('schema',tn.nspname,'object',t.relname))
  from pg_rewrite rw join pg_depend dp on dp.classid='pg_rewrite'::regclass and dp.objid=rw.oid
  join pg_class t on dp.refclassid='pg_class'::regclass and t.oid=dp.refobjid
  join pg_namespace tn on tn.oid=t.relnamespace
  where rw.ev_class=c.oid and t.oid<>c.oid) as direct_relation_dependencies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','graphql_public') and c.relkind in ('v','m')
order by n.nspname,c.relname;

-- E4: targeted rls_auto_enable metadata ONLY. Do not invoke this function/RPC.
-- E2's anon_callable is an ACL predicate, not proof of an executable RPC.
select p.oid::regprocedure::text as signature,p.pronargs,
 pg_get_function_result(p.oid) as returns_type,l.lanname,
 pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proacl::text as acl,
 md5(p.prosrc) as body_md5,
 (select jsonb_agg(v) from unnest(p.proconfig) v where v like 'search_path=%') as search_path,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_schema_privilege('anon','public','CREATE') as anon_create_public,
 has_schema_privilege('authenticated','public','CREATE') as authenticated_create_public,
 (select jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,
   'enabled',e.evtenabled,'tags',e.evttags,'owner',pg_get_userbyid(e.evtowner)))
  from pg_event_trigger e where e.evtfoid=p.oid) as event_trigger_bindings,
 (select jsonb_agg(jsonb_build_object('schema',tn.nspname,'table',t.relname,
   'name',g.tgname,'enabled',g.tgenabled))
  from pg_trigger g join pg_class t on t.oid=g.tgrelid
  join pg_namespace tn on tn.oid=t.relnamespace where g.tgfoid=p.oid) as table_trigger_bindings,
 (select jsonb_agg(q.oid::regprocedure::text)
  from pg_proc q join pg_namespace qn on qn.oid=q.pronamespace
  where q.oid<>p.oid and qn.nspname in ('public','graphql_public')
    and q.prokind='f' and q.prosrc ~* '\mrls_auto_enable\M') as api_wrapper_text_hints
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='public' and p.proname='rls_auto_enable';
