begin;
select no_plan();
select col_is_null('public','tasks','reminder_kind','historical reminders nullable');
select col_is_null('public','tasks','time_zone','historical zones nullable');
select col_not_null('public','tasks','reminder_schedule_changed_at','server marker required');
select is((select count(*) from pg_constraint where conrelid='public.reminder_deliveries'::regclass and contype='f'),0::bigint,'ledger independent audit');
select ok(has_table_privilege('service_role','public.reminder_deliveries','SELECT,UPDATE') and not has_table_privilege('service_role','public.reminder_deliveries','INSERT,DELETE,TRUNCATE'),'ledger ACL unchanged');
select ok(prosecdef and proconfig=array['search_path=pg_catalog, pg_temp'] and
 has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE')
 and not has_function_privilege('anon',oid,'EXECUTE'),'service-only pinned RPC '||proname)
from pg_proc where pronamespace='public'::regnamespace and proname in ('list_task_reminder_candidates','claim_task_reminder_delivery','check_task_reminder_delivery');
select ok(not has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE'),'private helper '||proname)
from pg_proc where pronamespace='public'::regnamespace and proname in ('prepare_task_reminder_schedule','task_reminder_is_eligible');
select throws_ok($$insert into public.reminder_deliveries(task_id,recipient_user_id,subscription_id,due_at,status) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),now(),'claimed')$$,'23514',null,'Task requires due identity');
select throws_ok($$insert into public.reminder_deliveries(task_id,event_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),current_date,now(),'claimed')$$,'23514',null,'Task+Event rejected');
select throws_ok($$insert into public.reminder_deliveries(task_id,important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),current_date,now(),'claimed')$$,'23514',null,'Task+Important Date rejected');

insert into auth.users(id,email) values
('99000000-0000-4000-8000-000000000001','a@example.invalid'),('99000000-0000-4000-8000-000000000002','b@example.invalid'),('99000000-0000-4000-8000-000000000003','outsider@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
('99000000-0000-4000-8000-000000000011','Shared','shared','TASKREM','99000000-0000-4000-8000-000000000001'),
('99000000-0000-4000-8000-000000000012','Personal','personal','TASKPER','99000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('99000000-0000-4000-8000-000000000011','99000000-0000-4000-8000-000000000001','owner'),
('99000000-0000-4000-8000-000000000011','99000000-0000-4000-8000-000000000002','member'),
('99000000-0000-4000-8000-000000000012','99000000-0000-4000-8000-000000000001','owner');
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true);
insert into public.tasks(id,space_id,title,due_on) values
('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000011','Historical',current_date);
select ok((select reminder_kind is null and time_zone is null from public.tasks where id='99000000-0000-4000-8000-000000000021'),'legacy insert remains off without zone guess');
update public.tasks set title='Legacy edited',due_on=current_date+1 where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_kind is null and time_zone is null from public.tasks where id='99000000-0000-4000-8000-000000000021'),'legacy due edit remains off');
select throws_ok($$update public.tasks set reminder_kind='all_day_same_day_08' where id='99000000-0000-4000-8000-000000000021'$$,'23514',null,'enabled reminder needs zone');
select throws_ok($$update public.tasks set reminder_kind='timed_at_start',time_zone='UTC' where id='99000000-0000-4000-8000-000000000021'$$,'23514',null,'timed preset rejected');
select throws_ok($$update public.tasks set reminder_kind='all_day_same_day_08',time_zone='bad-zone' where id='99000000-0000-4000-8000-000000000021'$$,'P0001',null,'invalid IANA rejected');
update public.tasks set reminder_kind='all_day_same_day_08',time_zone='UTC' where id='99000000-0000-4000-8000-000000000021';
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set title='Cosmetic',reminder_schedule_changed_at='2000-01-01' where id='99000000-0000-4000-8000-000000000021';
select is((select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),current_setting('test.task_marker'),'title/client marker tampering preserves exact marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set due_on=current_date+2 where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'due change advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set due_on=null where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'due removal advances marker');
select ok((select reminder_kind is null from public.tasks where id='99000000-0000-4000-8000-000000000021'),'due removal closes reminder');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set due_on=current_date where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'due restore advances marker');
select ok((select reminder_kind is null from public.tasks where id='99000000-0000-4000-8000-000000000021'),'due restore does not silently enable');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set reminder_kind='all_day_previous_day_20' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'preset advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set time_zone='Asia/Shanghai' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'timezone advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set status='completed' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'complete advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set status='open' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'reopen advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set assigned_to_user_id='99000000-0000-4000-8000-000000000001' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'assign A advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set assigned_to_user_id='99000000-0000-4000-8000-000000000002' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'assign B advances marker');
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
update public.tasks set assigned_to_user_id='99000000-0000-4000-8000-000000000001' where id='99000000-0000-4000-8000-000000000021';
select ok((select reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'assign A again advances marker');
update public.tasks set assigned_to_user_id=null,due_on=current_date,reminder_kind='all_day_same_day_08',time_zone='UTC' where id='99000000-0000-4000-8000-000000000021';
insert into public.tasks(id,space_id,title,due_on,reminder_kind,time_zone) values
('99000000-0000-4000-8000-000000000022','99000000-0000-4000-8000-000000000012','Personal',current_date,'all_day_same_day_08','UTC');
alter table public.tasks disable trigger tasks_prepare_reminder_schedule;
update public.tasks set reminder_schedule_changed_at='2000-01-01 00:00:00.123456Z';
alter table public.tasks enable trigger tasks_prepare_reminder_schedule;
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) values
('99000000-0000-4000-8000-000000000031','99000000-0000-4000-8000-000000000001',gen_random_uuid(),'https://fcm.googleapis.com/task-a','fake','fake'),
('99000000-0000-4000-8000-000000000032','99000000-0000-4000-8000-000000000002',gen_random_uuid(),'https://fcm.googleapis.com/task-b','fake','fake'),
('99000000-0000-4000-8000-000000000033','99000000-0000-4000-8000-000000000002',gen_random_uuid(),'https://fcm.googleapis.com/task-b2','fake','fake');
-- Trusted service computes due; SQL validates canonical civil identity and eligibility.
create function pg_temp.claim_task(t uuid,u uuid,s uuid,d date default current_date,k text default 'all_day_same_day_08',marker timestamptz default '2000-01-01 00:00:00.123456Z') returns uuid language sql as $$
select public.claim_task_reminder_delivery(t,d,u,s,now(),k,marker); $$;
select throws_ok($$select public.list_task_reminder_candidates(null,101)$$,'22023',null,'bounded page limit');
select is((select count(*) from public.list_task_reminder_candidates(null,100)),2::bigint,'canonical open/enabled candidates');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031',current_date+1),null::uuid,'wrong civil due rejected');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031',current_date,'all_day_previous_day_20'),null::uuid,'wrong preset rejected');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031',current_date,'all_day_same_day_08','2000-01-01'),null::uuid,'raw microsecond mismatch rejected');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000032'),null::uuid,'subscription must belong to recipient');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000022','99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000032'),null::uuid,'Personal self only');
select isnt(pg_temp.claim_task('99000000-0000-4000-8000-000000000022','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031'),null::uuid,'Personal self claim');
select set_config('test.delivery',pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031')::text,true);
select ok(public.check_task_reminder_delivery(current_setting('test.delivery')::uuid,'all_day_same_day_08','2000-01-01 00:00:00.123456Z'),'pre-send initially valid');
select is(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031'),null::uuid,'identical claim once');
select isnt(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000032'),null::uuid,'unassigned second member');
select isnt(pg_temp.claim_task('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000033'),null::uuid,'second member second device');
select is((select count(*) from public.reminder_deliveries where task_id='99000000-0000-4000-8000-000000000021'),3::bigint,'three subscription-specific deliveries');
select lives_ok($$insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,occurrence_date,due_at,status)
values('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031',current_date,now(),'claimed')$$,'Event and Task same identity remain distinct');
select lives_ok($$insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status)
values('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000031',current_date,now(),'claimed')$$,'Important Date and Task same identity remain distinct');
select throws_ok($$insert into public.reminder_deliveries(task_id,recipient_user_id,subscription_id,occurrence_date,due_at,status)
values('99000000-0000-4000-8000-000000000021','99000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000031',current_date,now(),'claimed')$$,'23505',null,'Task uniqueness does not depend on supplied recipient');
update public.tasks set status='completed' where id='99000000-0000-4000-8000-000000000021';
select ok(not public.check_task_reminder_delivery(current_setting('test.delivery')::uuid,'all_day_same_day_08','2000-01-01 00:00:00.123456Z'),'completion blocks pre-send');
update public.tasks set status='open' where id='99000000-0000-4000-8000-000000000021';
select ok(not public.check_task_reminder_delivery(current_setting('test.delivery')::uuid,'all_day_same_day_08','2000-01-01 00:00:00.123456Z'),'reopen cannot revive stale snapshot');
update public.tasks set assigned_to_user_id='99000000-0000-4000-8000-000000000002' where id='99000000-0000-4000-8000-000000000021';
select set_config('test.task_marker',(select reminder_schedule_changed_at::text from public.tasks where id='99000000-0000-4000-8000-000000000021'),true);
select public.remove_space_member('99000000-0000-4000-8000-000000000011','99000000-0000-4000-8000-000000000002');
select ok((select assigned_to_user_id is null and reminder_schedule_changed_at>current_setting('test.task_marker')::timestamptz from public.tasks where id='99000000-0000-4000-8000-000000000021'),'member removal FK set-null advances marker');
select ok(not public.check_task_reminder_delivery(current_setting('test.delivery')::uuid,'all_day_same_day_08','2000-01-01 00:00:00.123456Z'),'member removal invalidates old snapshot');
select public.set_space_module_enabled('99000000-0000-4000-8000-000000000011','tasks',false);
select is((select count(*) from public.list_task_reminder_candidates(null,100)),1::bigint,'disabled module excluded without data deletion');
set local role authenticated;
select throws_ok($$select public.claim_task_reminder_delivery(null,null,null,null,null,null,null)$$,'42501',null,'browser claim denied');
select throws_ok($$select public.check_task_reminder_delivery(null,null,null)$$,'42501',null,'browser check denied');
reset role;
select * from finish();
rollback;
