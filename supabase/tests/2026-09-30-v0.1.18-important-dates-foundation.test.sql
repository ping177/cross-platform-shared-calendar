begin;
select no_plan();
select ok(to_regclass('public.important_dates') is not null, 'canonical Important Dates table exists');
select is((select string_agg(column_name,',' order by ordinal_position) from information_schema.columns
  where table_schema='public' and table_name='important_dates'),
  'id,space_id,name,emoji,repeat_kind,month,day,year,reminder_kind,time_zone,reminder_schedule_changed_at,created_by,created_at,updated_at', 'one canonical representation; no derived fields');
select is((select count(*) from pg_constraint where conrelid='public.important_dates'::regclass and contype='f'),1::bigint,'only Space FK; no creator/member cascade');
select ok((select relrowsecurity from pg_class where oid='public.important_dates'::regclass),'RLS enabled');
select is((select count(*) from pg_policy where polrelid='public.important_dates'::regclass),1::bigint,'only member SELECT policy; writes RPC-owned');
select ok(not exists(select 1 from pg_publication_tables where schemaname='public' and tablename='important_dates'),'no Realtime');
select ok(has_table_privilege('authenticated','public.important_dates','SELECT'),'authenticated SELECT granted');
select ok(not has_table_privilege('authenticated','public.important_dates','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'no direct mutation or bypass grants');
select ok(not has_table_privilege('anon','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'anon denied');
select ok(not has_table_privilege('service_role','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'service role not yet a source reader/writer');
select ok(bool_and(prosecdef and proconfig=array['search_path=pg_catalog, pg_temp']), 'RPCs hardened SECURITY DEFINER') from pg_proc
where oid in ('public.create_important_date(uuid,text,text,text,integer,integer,bigint,text)'::regprocedure,
  'public.update_important_date(uuid,text,text,text,integer,integer,bigint)'::regprocedure,'public.delete_important_date(uuid)'::regprocedure);
select ok(has_function_privilege('authenticated',oid,'EXECUTE')
  and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE'),proname||' ACL')
from pg_proc where pronamespace='public'::regnamespace and proname in ('create_important_date','update_important_date','delete_important_date');
select ok(not has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE'),proname||' is internal')
from pg_proc where pronamespace='public'::regnamespace and proname in ('lock_important_date_space','lock_writable_important_date','guard_important_date_identity','prepare_important_date_schedule');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('98000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','dates-'||n||'@example.invalid','not-used',now(),'{}','{}',now(),now()
from generate_series(1,3) n;
insert into public.spaces(id,name,kind,invite_code,created_by) values
('98000000-0000-4000-8000-000000000011','A personal','personal','IDPERS01','98000000-0000-4000-8000-000000000001'),
('98000000-0000-4000-8000-000000000012','Shared','shared','IDSHAR01','98000000-0000-4000-8000-000000000001'),
('98000000-0000-4000-8000-000000000013','B personal','personal','IDPERS02','98000000-0000-4000-8000-000000000002'),
('98000000-0000-4000-8000-000000000014','Delete','shared','IDDELE01','98000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('98000000-0000-4000-8000-000000000011','98000000-0000-4000-8000-000000000001','owner'),
('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000001','owner'),
('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000002','member'),
('98000000-0000-4000-8000-000000000013','98000000-0000-4000-8000-000000000002','owner'),
('98000000-0000-4000-8000-000000000014','98000000-0000-4000-8000-000000000001','owner'),
('98000000-0000-4000-8000-000000000014','98000000-0000-4000-8000-000000000002','member');
select is((select count(*) from public.space_modules where module_key='important_dates'),0::bigint,'not auto-enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000011','Date',null,'annual',2,29,null,'UTC')$$,'P0001','Important Dates module is disabled','absent module rejects Personal create');
select throws_ok($$select public.create_important_date(null,'Date',null,'annual',2,29,null,'UTC')$$,'P0001','Signed-in actor and Space are required','no implicit Space fallback');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000099','Date',null,'annual',2,29,null,'UTC')$$,'P0001','Space not found','missing target rejected');
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000011','important_dates',true)$$,'Personal owner enables');
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000012','important_dates',true)$$,'Shared owner enables');
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000014','important_dates',true)$$,'delete fixture enables');
select set_config('test.shared',(select id::text from public.create_important_date('98000000-0000-4000-8000-000000000012','Leap','🎂','annual',2,29,2028,'Asia/Shanghai')),true);
select set_config('test.personal',(select id::text from public.create_important_date('98000000-0000-4000-8000-000000000011','One off',null,'none',9,30,2030,'UTC')),true);
select is((select year from public.important_dates where id=current_setting('test.personal')::uuid),2030::bigint,'future anchor stored unchanged');
select ok((select reminder_kind is null and created_by=auth.uid() and reminder_schedule_changed_at is not null from public.important_dates where id=current_setting('test.shared')::uuid),'create fixed null reminder and server audit');
select throws_ok($$insert into public.important_dates(space_id,name,repeat_kind,month,day,time_zone) values ('98000000-0000-4000-8000-000000000012','Bypass','annual',1,1,'UTC')$$,'42501',null,'direct INSERT denied');
select throws_ok($$update public.important_dates set name='Bypass'$$,'42501',null,'direct UPDATE denied');
select throws_ok($$delete from public.important_dates$$,'42501',null,'direct DELETE denied');
select throws_ok($$truncate public.important_dates$$,'42501',null,'TRUNCATE bypass denied');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Bad',null,'none',1,1,null,'UTC')$$,'23514',null,'none requires year');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Bad',null,'annual',2,29,2027,'UTC')$$,'23514',null,'non-leap anchor rejected');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Bad',null,'annual',4,31,null,'UTC')$$,'23514',null,'overflow rejected');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Bad',null,'annual',1,1,null,'Invalid/Zone')$$,'P0001','Important Date time_zone must be a valid IANA timezone','invalid timezone has no fallback');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Bad',null,'annual',1,1,null,null)$$,'P0001','Important Date time_zone must be a valid IANA timezone','timezone required without reminder');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012',' Bad ',null,'annual',1,1,null,'UTC')$$,'23514',null,'trimmed name required');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012',repeat('x',201),null,'annual',1,1,null,'UTC')$$,'23514',null,'name bounded');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012',E'Bad\nName',null,'annual',1,1,null,'UTC')$$,'23514',null,'name single-line');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Emoji',repeat('🎂',33),'annual',1,1,null,'UTC')$$,'23514',null,'emoji bounded');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Emoji','','annual',1,1,null,'UTC')$$,'23514',null,'empty emoji represented by null');
select set_config('test.marker',(select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.shared')::uuid),true);
select lives_ok($$select public.update_important_date(current_setting('test.shared')::uuid,'Renamed','❤️','annual',2,29,2028)$$,'name and emoji edit');
select is((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.shared')::uuid),current_setting('test.marker'),'name/emoji do not change schedule marker');
select lives_ok($$select public.update_important_date(current_setting('test.shared')::uuid,'Renamed','❤️','annual',9,30,2030)$$,'date edit');
select isnt((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.shared')::uuid),current_setting('test.marker'),'date changes server schedule marker');
select is((select time_zone from public.important_dates where id=current_setting('test.shared')::uuid),'Asia/Shanghai','edit preserves timezone');
select throws_ok($$select public.update_important_date(current_setting('test.shared')::uuid,'Invalid',null,'none',2,29,2027)$$,'23514',null,'invalid edit atomic');
select is((select name from public.important_dates where id=current_setting('test.shared')::uuid),'Renamed','invalid edit leaves row unchanged');

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.important_dates where id=current_setting('test.personal')::uuid),0::bigint,'other Personal hidden');
select throws_ok($$select public.update_important_date(current_setting('test.personal')::uuid,'Hack',null,'none',1,1,2030)$$,'P0001','Current Important Date Space membership is required','other Personal mutation rejected');
select throws_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000012','important_dates',false)$$,'P0001','Only the Space owner may change modules','member toggle denied');
select lives_ok($$select public.update_important_date(current_setting('test.shared')::uuid,'Member edit',null,'annual',9,30,2030)$$,'Shared non-creator edits');
select set_config('test.member',(select id::text from public.create_important_date('98000000-0000-4000-8000-000000000012','Member date','👨‍👩‍👧‍👦','annual',2,29,null,'UTC')),true);
select set_config('test.delete',(select id::text from public.create_important_date('98000000-0000-4000-8000-000000000014','Delete date',null,'annual',1,1,null,'UTC')),true);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.important_dates),0::bigint,'nonmember SELECT sees no rows');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Hack',null,'annual',1,1,null,'UTC')$$,'P0001','Current Important Date Space membership is required','nonmember create denied');
select throws_ok($$select public.delete_important_date(current_setting('test.shared')::uuid)$$,'P0001','Current Important Date Space membership is required','nonmember delete denied');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.delete_important_date(current_setting('test.shared')::uuid)$$,'P0001','Signed-in actor and Important Date are required','null actor denied');

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('test.snapshot',(select row_to_json(d)::text from public.important_dates d where id=current_setting('test.shared')::uuid),true);
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000012','important_dates',false)$$,'owner disables');
select is((select row_to_json(d)::text from public.important_dates d where id=current_setting('test.shared')::uuid),current_setting('test.snapshot'),'disabled SELECT retains exact row');
select throws_ok($$select public.create_important_date('98000000-0000-4000-8000-000000000012','Disabled',null,'annual',1,1,null,'UTC')$$,'P0001','Important Dates module is disabled','disabled create denied');
select throws_ok($$select public.update_important_date(current_setting('test.shared')::uuid,'Disabled',null,'annual',1,1,null)$$,'P0001','Important Dates module is disabled','disabled edit denied');
select throws_ok($$select public.delete_important_date(current_setting('test.shared')::uuid)$$,'P0001','Important Dates module is disabled','disabled delete denied');
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000012','important_dates',true)$$,'reopen');
select is((select row_to_json(d)::text from public.important_dates d where id=current_setting('test.shared')::uuid),current_setting('test.snapshot'),'reopen restores exact canonical row');

reset role;
select throws_ok($$update public.important_dates set space_id='98000000-0000-4000-8000-000000000011' where id=current_setting('test.shared')::uuid$$,'P0001','Important Date identity is immutable','Space immutable even through privileged DML');
select throws_ok($$update public.important_dates set id=gen_random_uuid() where id=current_setting('test.shared')::uuid$$,'P0001','Important Date identity is immutable','id immutable');
select throws_ok($$update public.important_dates set created_by='98000000-0000-4000-8000-000000000002' where id=current_setting('test.shared')::uuid$$,'P0001','Important Date identity is immutable','creator immutable');
select throws_ok($$update public.important_dates set created_at=now()-interval '1 day' where id=current_setting('test.shared')::uuid$$,'P0001','Important Date identity is immutable','created_at immutable');
select set_config('test.marker',(select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.shared')::uuid),true);
update public.important_dates set reminder_schedule_changed_at='2000-01-01',updated_at='2000-01-01' where id=current_setting('test.shared')::uuid;
select is((select reminder_schedule_changed_at::text from public.important_dates where id=current_setting('test.shared')::uuid),current_setting('test.marker'),'spoofed marker overwritten');
select ok((select updated_at>=transaction_timestamp() from public.important_dates where id=current_setting('test.shared')::uuid),'updated_at server-controlled');
select throws_ok($$update public.important_dates set reminder_kind='timed_10m_before' where id=current_setting('test.shared')::uuid$$,'23514',null,'only all-day presets in prepared contract');

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.leave_shared_space('98000000-0000-4000-8000-000000000012')$$,'creator leaves');
select is((select count(*) from public.important_dates where space_id='98000000-0000-4000-8000-000000000012'),0::bigint,'leaver loses SELECT');
select throws_ok($$select public.update_important_date(current_setting('test.member')::uuid,'Left',null,'annual',2,29,null)$$,'P0001','Current Important Date Space membership is required','creator cannot edit after leaving');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.important_dates where space_id='98000000-0000-4000-8000-000000000012'),2::bigint,'leave retains all Space-owned records');
reset role;
insert into public.space_members(space_id,user_id,role) values ('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.remove_space_member('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000002')$$,'owner removes member');
select is((select count(*) from public.important_dates where space_id='98000000-0000-4000-8000-000000000012'),2::bigint,'remove retains canonical data');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.delete_important_date(current_setting('test.member')::uuid)$$,'P0001','Current Important Date Space membership is required','removed creator cannot delete');
reset role;
insert into public.space_members(space_id,user_id,role) values ('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.important_dates where space_id='98000000-0000-4000-8000-000000000012'),2::bigint,'current rejoined member sees retained records');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.transfer_space_ownership('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000002')$$,'owner transfer');
select is((select count(*) from public.important_dates where space_id='98000000-0000-4000-8000-000000000012'),2::bigint,'transfer does not change data');
select lives_ok($$select public.delete_important_date(current_setting('test.member')::uuid)$$,'non-owner non-creator hard deletes');
select is((select count(*) from public.important_dates where id=current_setting('test.member')::uuid),0::bigint,'confirmed backend hard delete');
select throws_ok($$select public.delete_important_date(current_setting('test.member')::uuid)$$,'P0001','Important Date not found','deleted target cannot fallback');
select lives_ok($$select public.set_space_module_enabled('98000000-0000-4000-8000-000000000014','important_dates',false)$$,'disable delete Space module');
select lives_ok($$select public.delete_shared_space('98000000-0000-4000-8000-000000000014')$$,'Space deletion still works while disabled');
reset role;
select is((select count(*) from public.important_dates where id=current_setting('test.delete')::uuid),0::bigint,'Space FK cascade removes dates');
select * from finish();
rollback;
