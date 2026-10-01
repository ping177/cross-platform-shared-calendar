begin;
select no_plan();

select col_is_null('public','reminder_deliveries','event_id','Event identity can be absent');
select col_type_is('public','reminder_deliveries','important_date_id','uuid','Important Date identity is uuid');
select is((select count(*) from pg_constraint where conrelid='public.reminder_deliveries'::regclass and contype='f'),0::bigint,'ledger remains independent historical audit');
select ok(not has_table_privilege('service_role','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service role has no direct Important Date privileges');
select ok(has_table_privilege('service_role','public.reminder_deliveries','SELECT,UPDATE')
  and not has_table_privilege('service_role','public.reminder_deliveries','INSERT,DELETE,TRUNCATE'),'ledger ACL unchanged');
select ok(not exists(select 1 from pg_publication_tables where schemaname='public' and tablename='reminder_deliveries'),'ledger remains off Realtime');
select is((select count(*) from pg_policy where polrelid='public.reminder_deliveries'::regclass),0::bigint,'no client ledger policies');
select ok(prosecdef and proconfig=array['search_path=pg_catalog, pg_temp'] and pronargdefaults=0,'new functions hardened; no ambiguous defaults')
from pg_proc where oid in (
 'public.list_important_date_reminder_candidates(uuid,integer)'::regprocedure,
 'public.create_important_date(uuid,text,text,text,integer,integer,bigint,text,text)'::regprocedure,
 'public.update_important_date(uuid,text,text,text,integer,integer,bigint,text)'::regprocedure);
select ok(has_function_privilege('service_role','public.list_important_date_reminder_candidates(uuid,integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.list_important_date_reminder_candidates(uuid,integer)','EXECUTE')
 and not has_function_privilege('anon','public.list_important_date_reminder_candidates(uuid,integer)','EXECUTE'),'candidate ACL service only');
select ok(has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')
 and not has_function_privilege('service_role',oid,'EXECUTE'),'new CRUD authenticated only') from pg_proc where oid in (
 'public.create_important_date(uuid,text,text,text,integer,integer,bigint,text,text)'::regprocedure,
 'public.update_important_date(uuid,text,text,text,integer,integer,bigint,text)'::regprocedure);
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.pronamespace='public'::regnamespace and p.proname in ('list_important_date_reminder_candidates','create_important_date','update_important_date')
 and a.grantee=0 and a.privilege_type='EXECUTE'),'no PUBLIC execution');

-- Source constraints and full identities, including namespace collisions.
insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,due_at,status)
values('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003','2028-01-01 08:00Z','claimed');
select throws_ok($$insert into public.reminder_deliveries(recipient_user_id,subscription_id,due_at,status) values(gen_random_uuid(),gen_random_uuid(),now(),'claimed')$$,'23514',null,'neither source rejected');
select throws_ok($$insert into public.reminder_deliveries(event_id,important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'2028-01-01',now(),'claimed')$$,'23514',null,'both sources rejected');
select throws_ok($$insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,due_at,status) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),now(),'claimed')$$,'23514',null,'Important Date requires civil occurrence');
select throws_ok($$insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,due_at,status) values('94000000-0000-4000-8000-000000000001',gen_random_uuid(),'94000000-0000-4000-8000-000000000003','2028-01-01 08:00Z','claimed')$$,'23505',null,'ordinary Event null occurrence duplicate still rejected');
insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status)
values('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003','2028-01-01','2028-01-01 08:00Z','claimed');
select lives_ok($$insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003','2028-01-01','2028-01-01 08:00Z','claimed')$$,'recurring Event and Important Date same uuid/date/subscription/due stay distinct');
select throws_ok($$update public.reminder_deliveries set event_id=gen_random_uuid() where important_date_id='94000000-0000-4000-8000-000000000001'$$,'23514',null,'UPDATE cannot create two source identities');
select throws_ok($$insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values('94000000-0000-4000-8000-000000000001',gen_random_uuid(),'94000000-0000-4000-8000-000000000003','2028-01-01','2028-01-01 08:00Z','claimed')$$,'23505',null,'Important Date duplicate rejected independent of recipient');
select lives_ok($$insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values
('94000000-0000-4000-8000-000000000004',gen_random_uuid(),'94000000-0000-4000-8000-000000000003','2028-01-01','2028-01-01 08:00Z','claimed'),
('94000000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),'2028-01-01','2028-01-01 08:00Z','claimed'),
('94000000-0000-4000-8000-000000000001',gen_random_uuid(),'94000000-0000-4000-8000-000000000003','2028-01-02','2028-01-01 08:00Z','claimed'),
('94000000-0000-4000-8000-000000000001',gen_random_uuid(),'94000000-0000-4000-8000-000000000003','2028-01-01','2028-01-01 08:00:00.000001Z','claimed')$$,'source/subscription/occurrence/due each distinguish identity, preserving microseconds');

insert into auth.users(id,email) select ('94000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,'t2a-'||n||'@example.invalid' from generate_series(1,3) n;
insert into public.spaces(id,name,kind,invite_code,created_by) values
('94000000-0000-4000-8001-000000000011','T2A Shared','shared','T2ASHARE','94000000-0000-4000-8001-000000000001'),
('94000000-0000-4000-8001-000000000012','T2A Personal','personal','T2APERSON','94000000-0000-4000-8001-000000000001'),
('94000000-0000-4000-8001-000000000013','T2A Disabled','shared','T2ADISAB','94000000-0000-4000-8001-000000000001'),
('94000000-0000-4000-8001-000000000014','T2A Absent','shared','T2AABSENT','94000000-0000-4000-8001-000000000001');
insert into public.space_members(space_id,user_id,role) values
('94000000-0000-4000-8001-000000000011','94000000-0000-4000-8001-000000000001','owner'),
('94000000-0000-4000-8001-000000000011','94000000-0000-4000-8001-000000000002','member'),
('94000000-0000-4000-8001-000000000012','94000000-0000-4000-8001-000000000001','owner'),
('94000000-0000-4000-8001-000000000013','94000000-0000-4000-8001-000000000001','owner'),
('94000000-0000-4000-8001-000000000014','94000000-0000-4000-8001-000000000001','owner');
insert into public.space_modules(space_id,module_key,enabled) values
('94000000-0000-4000-8001-000000000011','important_dates',true),
('94000000-0000-4000-8001-000000000012','important_dates',true),
('94000000-0000-4000-8001-000000000013','important_dates',false);
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8001-000000000001',true);
select set_config('test.t2a_id',(select id::text from public.create_important_date('94000000-0000-4000-8001-000000000011','Shared','🎂','annual',2,29,2028,'America/New_York','all_day_same_day_08')),true);
select is((select reminder_kind from public.important_dates where id=current_setting('test.t2a_id')::uuid),'all_day_same_day_08','explicit same-day create');
select set_config('test.t2a_marker',(select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.t2a_id')::uuid),true);
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Rename','⭐','annual',2,29,2028,'all_day_same_day_08')$$,'non-schedule edit');
select is((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.t2a_id')::uuid),current_setting('test.t2a_marker'),'name/emoji edit preserves exact raw marker');
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Old client',null,'annual',2,29,2028)$$,'old update accepts enabled date');
select is((select reminder_kind from public.important_dates where id=current_setting('test.t2a_id')::uuid),'all_day_same_day_08','old update retains enabled preset');
select is((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.t2a_id')::uuid),current_setting('test.t2a_marker'),'old non-schedule update preserves marker');
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Old client',null,'annual',2,29,2028,'all_day_previous_day_20')$$,'explicit previous-day update');
select ok((select reminder_schedule_changed_at>current_setting('test.t2a_marker')::timestamptz from public.important_dates where id=current_setting('test.t2a_id')::uuid),'preset change advances server marker');
select is((select time_zone from public.important_dates where id=current_setting('test.t2a_id')::uuid),'America/New_York','update keeps canonical timezone');
select set_config('test.t2a_null',(select id::text from public.create_important_date('94000000-0000-4000-8001-000000000012','Old',null,'none',1,1,2030,'UTC')),true);
select lives_ok($$select public.update_important_date(current_setting('test.t2a_null')::uuid,'Old updated',null,'none',1,2,2030)$$,'old schedule update');
select ok((select reminder_kind is null from public.important_dates where id=current_setting('test.t2a_null')::uuid),'old create/update stays off');
select ok((select reminder_kind is null from public.create_important_date('94000000-0000-4000-8001-000000000012','Explicit off',null,'annual',1,1,null,'UTC',null)),'explicit null create');
select is((select reminder_kind from public.create_important_date('94000000-0000-4000-8001-000000000012','Previous',null,'annual',1,1,null,'UTC','all_day_previous_day_20')),'all_day_previous_day_20','explicit previous-day create');
select throws_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Bad',null,'annual',2,29,2028,'timed_10m')$$,'23514',null,'invalid preset rejected atomically');
select throws_ok($$select public.create_important_date('94000000-0000-4000-8001-000000000011','Bad',null,'annual',2,29,null,'UTC','timed_10m')$$,'23514',null,'invalid create preset rejected');
select throws_ok($$select public.create_important_date('94000000-0000-4000-8001-000000000011','Bad',null,'none',2,29,2029,'UTC','all_day_same_day_08')$$,'23514',null,'existing civil date constraints reused');
select throws_ok($$select public.create_important_date('94000000-0000-4000-8001-000000000013','Off',null,'annual',1,1,null,'UTC','all_day_same_day_08')$$,'P0001','Important Dates module is disabled','disabled module denies explicit create');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8001-000000000002',true);
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Shared member',null,'annual',2,29,2028,'all_day_previous_day_20')$$,'current Shared member uses one shared reminder');
select throws_ok($$select public.update_important_date(current_setting('test.t2a_null')::uuid,'Other personal',null,'none',1,2,2030,'all_day_same_day_08')$$,'P0001','Current Important Date Space membership is required','cross-Space member denied');
select set_config('request.jwt.claim.sub','94000000-0000-4000-8001-000000000003',true);
select throws_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Outsider',null,'annual',2,29,2028,null)$$,'P0001','Current Important Date Space membership is required','outsider cannot disable reminder');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'No actor',null,'annual',2,29,2028,null)$$,'P0001','Signed-in actor and Important Date are required','actor required even with RPC grant');
select throws_ok($$select * from public.list_important_date_reminder_candidates(null,100)$$,'42501',null,'authenticated cannot discover service candidates');
reset role;

-- Deterministic microsecond marker fixture; triggers remain enabled after setup.
alter table public.important_dates disable trigger important_dates_prepare_schedule;
update public.important_dates set reminder_schedule_changed_at='2026-10-01 12:34:56.123456Z' where id=current_setting('test.t2a_id')::uuid;
alter table public.important_dates enable trigger important_dates_prepare_schedule;
insert into public.important_dates(space_id,name,repeat_kind,month,day,time_zone,reminder_kind,created_by)
select id,'Hidden','annual',1,1,'UTC','all_day_same_day_08',created_by from public.spaces
where id in ('94000000-0000-4000-8001-000000000013','94000000-0000-4000-8001-000000000014');
set local role service_role;
select throws_ok($$select * from public.important_dates$$,'42501',null,'service cannot bypass narrow reader');
select is((select count(*) from public.list_important_date_reminder_candidates(null,100)),2::bigint,'only enabled modules with nonnull presets, Personal and Shared');
select is((select reminder_schedule_changed_at from public.list_important_date_reminder_candidates(null,100) where id=current_setting('test.t2a_id')::uuid),'2026-10-01 12:34:56.123456Z'::timestamptz,'candidate preserves all six fractional digits');
select throws_ok($$select * from public.list_important_date_reminder_candidates(null,0)$$,'22023',null,'zero page limit rejected');
select throws_ok($$select * from public.list_important_date_reminder_candidates(null,-1)$$,'22023',null,'negative page limit rejected');
select throws_ok($$select * from public.list_important_date_reminder_candidates(null,101)$$,'22023',null,'oversized page limit rejected rather than truncated');
select throws_ok($$select * from public.list_important_date_reminder_candidates(null,null)$$,'22023',null,'null limit rejected');
select is((select count(*) from public.list_important_date_reminder_candidates('ffffffff-ffff-ffff-ffff-ffffffffffff',100)),0::bigint,'exhausted cursor returns empty');
select is((select count(*) from public.list_important_date_reminder_candidates((select id from public.list_important_date_reminder_candidates(null,1)),100)),1::bigint,'cursor strictly excludes previous page last id');
select is((select array_agg(id order by id) from public.list_important_date_reminder_candidates(null,100)),
 (select array_agg(id order by id) from (select id from public.list_important_date_reminder_candidates(null,1) union all
 select id from public.list_important_date_reminder_candidates((select id from public.list_important_date_reminder_candidates(null,1)),1)) t),'one-row pages cover identical complete ordered result');
reset role;
select is((select array_agg(name order by ord) from pg_proc p,unnest(p.proargnames,p.proargmodes) with ordinality a(name,mode,ord)
 where p.oid='public.list_important_date_reminder_candidates(uuid,integer)'::regprocedure and mode='t'),
 array['id','space_id','name','repeat_kind','month','day','year','reminder_kind','time_zone','reminder_schedule_changed_at'],'candidate exact whitelist excludes creator/audit/emoji');
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8001-000000000001',true);
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'After raw marker','⭐','annual',2,29,2028,'all_day_previous_day_20')$$,'cosmetic edit after raw precision fixture');
select is((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.t2a_id')::uuid),'2026-10-01 12:34:56.123456+00','RPC preserves exact microsecond marker');
select lives_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Off',null,'annual',2,29,2028,null)$$,'explicit null update disables');
select ok((select reminder_kind is null from public.important_dates where id=current_setting('test.t2a_id')::uuid),'explicit null retained');
select lives_ok($$select public.set_space_module_enabled('94000000-0000-4000-8001-000000000011','important_dates',false)$$,'module disable still canonical');
select throws_ok($$select public.update_important_date(current_setting('test.t2a_id')::uuid,'Disabled',null,'annual',2,29,2028,'all_day_same_day_08')$$,'P0001','Important Dates module is disabled','disabled module denies update');
reset role;
set local role service_role;
select is((select count(*) from public.list_important_date_reminder_candidates(null,100)),1::bigint,'disabled/off source disappears on next canonical read');
reset role;
insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status)
values(current_setting('test.t2a_id')::uuid,gen_random_uuid(),gen_random_uuid(),'2028-02-29','2028-02-29 08:00Z','claimed');
set local role authenticated;
select lives_ok($$select public.set_space_module_enabled('94000000-0000-4000-8001-000000000011','important_dates',true)$$,'reenable permits canonical delete');
select lives_ok($$select public.delete_important_date(current_setting('test.t2a_id')::uuid)$$,'old delete still works');
reset role;
select is((select count(*) from public.reminder_deliveries where important_date_id=current_setting('test.t2a_id')::uuid),1::bigint,'Important Date deletion retains historical ledger');
select * from finish();
rollback;
