begin;
select no_plan();
select has_function('public','claim_important_date_reminder_delivery',array['uuid','date','uuid','uuid','timestamp with time zone','text','timestamp with time zone'],'source-specific claim');
select has_function('public','check_important_date_reminder_delivery',array['uuid','text','timestamp with time zone'],'claimed-ledger pre-send check');
select ok(prosecdef and proconfig=array['search_path=pg_catalog, pg_temp'] and pronargdefaults=0,'public RPC hardened, explicit parameters')
from pg_proc where proname in ('claim_important_date_reminder_delivery','check_important_date_reminder_delivery');
select ok(has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')
 and not has_function_privilege('authenticated',oid,'EXECUTE'),'public RPC service only')
from pg_proc where proname in ('claim_important_date_reminder_delivery','check_important_date_reminder_delivery');
select ok(not has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE')
 and not has_function_privilege('anon',oid,'EXECUTE'),'shared source eligibility predicate private')
from pg_proc where proname='important_date_reminder_is_eligible';
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.proname in ('claim_important_date_reminder_delivery','check_important_date_reminder_delivery','important_date_reminder_is_eligible')
 and a.grantee=0 and a.privilege_type='EXECUTE'),'no PUBLIC execution');
select ok(not has_table_privilege('service_role','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'no broad table capability');

insert into auth.users(id,email) select ('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'claim-'||n||'@example.invalid' from generate_series(1,3) n;
insert into public.spaces(id,name,kind,invite_code,created_by) values
('93000000-0000-4000-8000-000000000011','Shared claim','shared','CLAIMSHR','93000000-0000-4000-8000-000000000001'),
('93000000-0000-4000-8000-000000000012','Personal claim','personal','CLAIMPERS','93000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000001','owner'),
('93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000002','member'),
('93000000-0000-4000-8000-000000000012','93000000-0000-4000-8000-000000000001','owner');
insert into public.space_modules(space_id,module_key,enabled) values
('93000000-0000-4000-8000-000000000011','important_dates',true),('93000000-0000-4000-8000-000000000012','important_dates',true);
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,reminder_kind,created_by)
select ('93000000-0000-4000-8000-'||lpad((n+20)::text,12,'0'))::uuid,
 ('93000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,'Claim','annual',extract(month from current_date),extract(day from current_date),'UTC','all_day_same_day_08','93000000-0000-4000-8000-000000000001'
from generate_series(1,2) n;
alter table public.important_dates disable trigger important_dates_prepare_schedule;
update public.important_dates set reminder_schedule_changed_at='2000-01-01 00:00:00.123456Z' where id in ('93000000-0000-4000-8000-000000000021','93000000-0000-4000-8000-000000000022');
alter table public.important_dates enable trigger important_dates_prepare_schedule;
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
select ('93000000-0000-4000-8000-'||lpad((n+40)::text,12,'0'))::uuid,
 ('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,gen_random_uuid(),'https://fcm.googleapis.com/claim-'||n,'fake','fake' from generate_series(1,3) n;
select set_config('test.claim_due',(clock_timestamp()-interval '1 second')::text,true);

create function pg_temp.try_claim(p_user uuid default '93000000-0000-4000-8000-000000000002',
 p_sub uuid default '93000000-0000-4000-8000-000000000042',p_due timestamptz default null,p_occ date default current_date,
 p_marker timestamptz default '2000-01-01 00:00:00.123456Z',p_kind text default 'all_day_same_day_08')
returns uuid language sql as $$select public.claim_important_date_reminder_delivery('93000000-0000-4000-8000-000000000021',p_occ,p_user,p_sub,
 coalesce(p_due,current_setting('test.claim_due')::timestamptz),p_kind,p_marker);$$;
create function pg_temp.check_delivery(p_id uuid,p_kind text default 'all_day_same_day_08',p_marker timestamptz default '2000-01-01 00:00:00.123456Z')
returns boolean language sql as $$select public.check_important_date_reminder_delivery(p_id,p_kind,p_marker);$$;

set local role authenticated;
select throws_ok($$select pg_temp.try_claim()$$,'42501',null,'authenticated cannot claim');
select throws_ok($$select pg_temp.check_delivery(gen_random_uuid())$$,'42501',null,'authenticated cannot check');
reset role;
set local role anon;
select throws_ok($$select pg_temp.try_claim()$$,'42501',null,'anon cannot claim');
reset role;
set local role service_role;
select ok(pg_temp.try_claim(p_user=>'93000000-0000-4000-8000-000000000003',p_sub=>'93000000-0000-4000-8000-000000000043') is null,'outsider rejected');
select ok(pg_temp.try_claim(p_sub=>'93000000-0000-4000-8000-000000000041') is null,'subscription owner mismatch');
select ok(pg_temp.try_claim(p_marker=>'2000-01-01 00:00:00.123Z') is null,'millisecond marker is stale');
select ok(pg_temp.try_claim(p_marker=>null) is null,'null marker rejected');
select ok(pg_temp.try_claim(p_kind=>'all_day_previous_day_20') is null,'stale preset rejected');
select ok(pg_temp.try_claim(p_kind=>null) is null,'null expected preset rejected');
select ok(pg_temp.try_claim(p_occ=>current_date+1) is null,'wrong occurrence rejected');
select ok(pg_temp.try_claim(p_occ=>null) is null,'null occurrence rejected');
select ok(pg_temp.try_claim(p_occ=>'infinity') is null,'infinite occurrence rejected without exception');
select ok(pg_temp.try_claim(p_due=>clock_timestamp()+interval '1 minute') is null,'future due rejected');
select ok(pg_temp.try_claim(p_due=>clock_timestamp()-interval '11 minutes') is null,'expired grace rejected');
select ok(pg_temp.try_claim(p_due=>'1999-01-01') is null,'newly past due before marker rejected');
select ok(public.claim_important_date_reminder_delivery(null,current_date,null,null,null,null,null) is null,'missing inputs reject safely');
select ok(public.claim_important_date_reminder_delivery(gen_random_uuid(),current_date,null,null,null,null,null) is null,'deleted/missing source rejected');
select is((select count(*) from public.reminder_deliveries where important_date_id='93000000-0000-4000-8000-000000000021'),0::bigint,'all invalid claims leave ledger untouched');
select set_config('test.delivery',(select pg_temp.try_claim()::text),true);
select ok(current_setting('test.delivery')<>'','valid current Shared member claims');
select ok(pg_temp.try_claim() is null,'duplicate exact identity rejected');
select ok(pg_temp.check_delivery(current_setting('test.delivery')::uuid),'claimed ledger permits pre-send');
select ok(not pg_temp.check_delivery(current_setting('test.delivery')::uuid,p_marker=>'2000-01-01 00:00:00.123Z'),'pre-send raw marker exact');
select ok(not pg_temp.check_delivery(current_setting('test.delivery')::uuid,p_kind=>'all_day_previous_day_20'),'pre-send preset exact');
select ok(not pg_temp.check_delivery(gen_random_uuid()),'unknown ledger false');
select ok(not pg_temp.check_delivery(null),'null ledger false');
select ok(public.claim_important_date_reminder_delivery('93000000-0000-4000-8000-000000000022',current_date,'93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000042',current_setting('test.claim_due')::timestamptz,'all_day_same_day_08','2000-01-01 00:00:00.123456Z') is null,'Personal excludes other Shared member');
select ok(public.claim_important_date_reminder_delivery('93000000-0000-4000-8000-000000000022',current_date,'93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000041',current_setting('test.claim_due')::timestamptz,'all_day_same_day_08','2000-01-01 00:00:00.123456Z') is not null,'Personal sole owner claims');
reset role;
select ok((select event_id is null and important_date_id='93000000-0000-4000-8000-000000000021' and occurrence_date=current_date and status='claimed' and result_code is null from public.reminder_deliveries where id=current_setting('test.delivery')::uuid),'correct ledger namespace, occurrence and claimed shape');
select ok((select created_at=updated_at and created_at>=current_setting('test.claim_due')::timestamptz from public.reminder_deliveries where id=current_setting('test.delivery')::uuid),'post-lock claim time persisted');

-- Deterministic boundary checks through the private predicate, no injectable RPC clock.
select ok(public.important_date_reminder_is_eligible(d,current_date,'93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000042','2026-10-02 08:00Z','all_day_same_day_08',d.reminder_schedule_changed_at,'2026-10-02 08:10Z'),'inclusive ten-minute grace') from public.important_dates d where id='93000000-0000-4000-8000-000000000021';
select ok(not public.important_date_reminder_is_eligible(d,current_date,'93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000042','2026-10-02 08:00Z','all_day_same_day_08',d.reminder_schedule_changed_at,'2026-10-02 08:10:00.000001Z'),'one microsecond outside grace') from public.important_dates d where id='93000000-0000-4000-8000-000000000021';
update public.push_subscriptions set expiration_time='2026-10-02 08:00Z' where id='93000000-0000-4000-8000-000000000042';
select ok(not public.important_date_reminder_is_eligible(d,current_date,'93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000042','2026-10-02 08:00Z','all_day_same_day_08',d.reminder_schedule_changed_at,'2026-10-02 08:00Z'),'expiration equal to now rejected') from public.important_dates d where id='93000000-0000-4000-8000-000000000021';
update public.push_subscriptions set expiration_time=clock_timestamp()-interval '1 second' where id='93000000-0000-4000-8000-000000000042';
set local role service_role;
select ok(not pg_temp.check_delivery(current_setting('test.delivery')::uuid),'expired subscription rejects pre-send');
reset role;
update public.push_subscriptions set expiration_time=null where id='93000000-0000-4000-8000-000000000042';
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.update_important_date('93000000-0000-4000-8000-000000000021','Renamed','⭐','annual',extract(month from current_date)::int,extract(day from current_date)::int,null,'all_day_same_day_08')$$,'canonical cosmetic edit');
reset role;
set local role service_role;
select ok(pg_temp.check_delivery(current_setting('test.delivery')::uuid),'cosmetic edit preserves send eligibility');
select ok(pg_temp.try_claim() is null,'cosmetic edit creates no new identity');
update public.reminder_deliveries set status='failed',result_code='unexpected_task_error',provider_status=null where id=current_setting('test.delivery')::uuid and status='claimed';
select ok(not pg_temp.check_delivery(current_setting('test.delivery')::uuid),'finalized failed row cannot send');
select ok(pg_temp.try_claim() is null,'failed row cannot reclaim/retry');
reset role;
select * from finish();
rollback;
