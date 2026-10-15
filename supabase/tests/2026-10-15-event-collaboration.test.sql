begin;
select no_plan();
select ok(not has_function_privilege('anon','public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)','EXECUTE'),'anon cannot call save RPC');
select ok(not has_function_privilege('service_role','public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)','EXECUTE'),'save RPC is not a service-role mutation route');
select ok(not (select prosecdef from pg_proc where oid='public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date)'::regprocedure),'save RPC enforces caller RLS');
select ok((select tgdeferrable and tginitdeferred from pg_trigger where tgrelid='public.events'::regclass and tgname='events_lineage_audience'),'lineage audience constraint checks final transaction state');

insert into auth.users(id,email) values
 ('ea000000-0000-4000-8000-000000000001','a@collab.invalid'),
 ('ea000000-0000-4000-8000-000000000002','b@collab.invalid'),
 ('ea000000-0000-4000-8000-000000000003','outsider@collab.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 ('ea000000-0000-4000-8000-000000000010','Shared','shared','COLLAB','ea000000-0000-4000-8000-000000000001'),
 ('ea000000-0000-4000-8000-000000000011','Personal','personal','COLLABP','ea000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
 ('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','owner'),
 ('ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000002','member'),
 ('ea000000-0000-4000-8000-000000000011','ea000000-0000-4000-8000-000000000001','owner');
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,time_zone) values
 ('ea000000-0000-4000-8000-000000000020','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000001','A personal','2030-01-01 10:00Z','UTC'),
 ('ea000000-0000-4000-8000-000000000021','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','shared',null,'Shared','2030-01-01 10:00Z','UTC'),
 ('ea000000-0000-4000-8000-000000000022','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000002','B personal','2030-01-01 10:00Z','UTC'),
 ('ea000000-0000-4000-8000-000000000023','ea000000-0000-4000-8000-000000000011','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000001','Private','2030-01-01 10:00Z','UTC');
set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.events),3,'B sees all Shared events but no Personal');
with x as (update public.events set title='B edits A' where id='ea000000-0000-4000-8000-000000000020' returning id) select is((select count(*)::int from x),1,'B edits A-owned Event');
select lives_ok($$update public.events set scope='shared',owner_user_id=null where id='ea000000-0000-4000-8000-000000000020'$$,'B changes A-owned Event audience');
select lives_ok($$update public.events set scope='personal',owner_user_id='ea000000-0000-4000-8000-000000000001' where id='ea000000-0000-4000-8000-000000000020'$$,'B assigns back to A');
select throws_ok($$update public.events set owner_user_id='ea000000-0000-4000-8000-000000000003' where id='ea000000-0000-4000-8000-000000000020'$$,'P0001',null,'non-member audience denied');
select throws_ok($$update public.events set created_by='ea000000-0000-4000-8000-000000000002' where id='ea000000-0000-4000-8000-000000000020'$$,'P0001','Event created_by cannot be changed','creator immutable');
select throws_ok($$update public.events set space_id='ea000000-0000-4000-8000-000000000011' where id='ea000000-0000-4000-8000-000000000020'$$,'P0001',null,'Space immutable');
with x as (delete from public.events where id='ea000000-0000-4000-8000-000000000020' returning id) select is((select count(*)::int from x),1,'B deletes A personal');
with x as (delete from public.events where id='ea000000-0000-4000-8000-000000000021' returning id) select is((select count(*)::int from x),1,'B deletes shared');
with x as (delete from public.events where id='ea000000-0000-4000-8000-000000000022' returning id) select is((select count(*)::int from x),1,'B deletes own assignment created by A');

select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at) values
 ('ea000000-0000-4000-8000-000000000024','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000002','personal','ea000000-0000-4000-8000-000000000002','B-owned','2030-01-01');
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000024',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000024'),
 'shared',null,'{"title":"A edits B"}')$$,'A edits B-created B-owned Event and changes to shared');
select is((select title from public.events where id='ea000000-0000-4000-8000-000000000024'),'A edits B','canonical RPC content returned');
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000024',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000024'),
 'personal','ea000000-0000-4000-8000-000000000001','{"title":"B edits shared"}')$$,'B edits shared Event and assigns to A');
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000001',true);
with x as (delete from public.events where id='ea000000-0000-4000-8000-000000000024' returning id)
 select is((select count(*)::int from x),1,'A deletes B-created Event');
-- A and B exercise all three audience states through the new atomic RPC.
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000001',true);
select is((public.save_event_edit('ea000000-0000-4000-8000-000000000023',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000023'),
 'personal','ea000000-0000-4000-8000-000000000001','{"title":"Private changed"}')).title,'Private changed','Personal owner still edits own Event');
select throws_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000023',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000023'),
 'shared',null,'{}')$$,'42501',null,'Personal audience stays private');
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,time_zone,recurrence_rule,series_id) values
 ('ea000000-0000-4000-8000-000000000030','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000001','Daily','2030-01-01 10:00Z','UTC','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','ea000000-0000-4000-8000-000000000030');
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.upsert_occurrence_override('ea000000-0000-4000-8000-000000000030','2030-01-03','{"title":"B override"}',(select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'))$$,'B edits occurrence owned by A');
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'),
 'personal','ea000000-0000-4000-8000-000000000002',
 '{"title":"Child","starts_at":"2030-01-02T11:00:00Z","ends_at":null,"description":null}','this-and-future','2030-01-02')$$,'split and audience update atomic');
set constraints events_lineage_audience immediate;
set constraints events_lineage_audience deferred;
select is((select count(*)::int from public.events where coalesce(series_id,id)='ea000000-0000-4000-8000-000000000030'),2,'split keeps two segments');
select is((select count(*)::int from public.events where coalesce(series_id,id)='ea000000-0000-4000-8000-000000000030' and owner_user_id='ea000000-0000-4000-8000-000000000002'),2,'audience changed on root and child');
select is((select count(*)::int from public.event_occurrence_exceptions e join public.events v on v.id=e.event_id where v.parent_event_id='ea000000-0000-4000-8000-000000000030'),1,'future exception migrated intact');
select throws_ok($$update public.events set parent_event_id=null where parent_event_id='ea000000-0000-4000-8000-000000000030'$$,'P0001','Event lineage cannot be changed','cannot detach a segment to evade audience integrity');
-- SET CONSTRAINTS makes the deferred invariant visible inside throws_ok's subtransaction.
create function pg_temp.partial_audience() returns void language plpgsql as $$
begin
 update public.events set scope='shared',owner_user_id=null where id='ea000000-0000-4000-8000-000000000030';
 set constraints events_lineage_audience immediate;
end;
$$;
select throws_ok($$select pg_temp.partial_audience()$$,'P0001','Linked Event segments must retain one Space and audience','direct partial-series reassignment rejected');
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'),
 'shared',null,'{"title":"This occurrence"}','only-this','2030-01-01')$$,'only-this content plus whole-series audience succeeds');
set constraints events_lineage_audience immediate;
set constraints events_lineage_audience deferred;
select is((select count(*)::int from public.events where coalesce(series_id,id)='ea000000-0000-4000-8000-000000000030' and scope='shared' and owner_user_id is null),2,'whole logical series is shared');
select is((select title from public.events where id='ea000000-0000-4000-8000-000000000030'),'Daily','only-this does not rewrite series title');
select throws_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030','2000-01-01','shared',null,'{"title":"stale"}')$$,'40001','Event was modified concurrently','stale save rejected');
select throws_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030',(select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'),'shared',null,'{"created_by":"ea000000-0000-4000-8000-000000000002"}')$$,'22023',null,'RPC cannot forge creator');
select throws_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030',(select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'),'personal','ea000000-0000-4000-8000-000000000003','{"title":"rollback"}')$$,'22023',null,'invalid audience rolls back content');
select is((select title from public.events where id='ea000000-0000-4000-8000-000000000030'),'Daily','content remains after invalid save');
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000030',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'),
 'personal','ea000000-0000-4000-8000-000000000001','{}','this-and-future','2030-01-01')$$,'audience-only save accepts future scope without splitting');
select is((select count(*)::int from public.events where coalesce(series_id,id)='ea000000-0000-4000-8000-000000000030'),2,'audience-only save creates no extra segment');
select is((select count(*)::int from public.event_occurrence_exceptions x join public.events e on e.id=x.event_id where coalesce(e.series_id,e.id)='ea000000-0000-4000-8000-000000000030'),2,'audience-only save retains existing exceptions');
select lives_ok($$select public.delete_occurrence('ea000000-0000-4000-8000-000000000030','2030-01-01',(select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'))$$,'B deletes one occurrence');
select lives_ok($$select public.delete_logical_series('ea000000-0000-4000-8000-000000000030',(select updated_at from public.events where id='ea000000-0000-4000-8000-000000000030'))$$,'B deletes full linked series');
select is((select count(*)::int from public.events where coalesce(series_id,id)='ea000000-0000-4000-8000-000000000030'),0,'series and linked segments removed');
select throws_ok($$select public.check_event_reminder_delivery(gen_random_uuid(),gen_random_uuid(),now())$$,'42501',null,'authenticated cannot invoke delivery check');

reset role;
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,reminder_kind,time_zone) values
 ('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000001','Reminder',now()+interval '1 day','timed_at_start','UTC');
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) values
 ('ea000000-0000-4000-8000-000000000041','ea000000-0000-4000-8000-000000000001',gen_random_uuid(),'https://fcm.googleapis.com/collab-a','fake','fake'),
 ('ea000000-0000-4000-8000-000000000042','ea000000-0000-4000-8000-000000000002',gen_random_uuid(),'https://fcm.googleapis.com/collab-b','fake','fake');
create temp table reminder_fixture(marker timestamptz,delivery uuid,due timestamptz);
insert into reminder_fixture select reminder_schedule_changed_at,null,clock_timestamp() from public.events where id='ea000000-0000-4000-8000-000000000040';
grant all on reminder_fixture to authenticated,service_role;
set local role service_role;
update reminder_fixture set delivery=public.claim_reminder_delivery('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000041',due,marker);
select ok((select delivery is not null from reminder_fixture),'old owner claim succeeds');
select ok((select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000040',marker) from reminder_fixture),'unchanged claim sendable');
select is((select public.claim_reminder_delivery('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000041',due,marker) from reminder_fixture),null::uuid,'duplicate claim dedupes');
select is((select public.claim_reminder_delivery('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000042',due,marker) from reminder_fixture),null::uuid,'personal audience excludes B');
set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
update public.events set owner_user_id='ea000000-0000-4000-8000-000000000002' where id='ea000000-0000-4000-8000-000000000040';
select ok((select reminder_schedule_changed_at>(select marker from reminder_fixture) from public.events where id='ea000000-0000-4000-8000-000000000040'),'audience change advances marker');
set local role service_role;
select ok(not (select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000040',marker) from reminder_fixture),'claimed old audience rejected before send');
select is((select public.claim_reminder_delivery('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000041',clock_timestamp(),marker) from reminder_fixture),null::uuid,'stale candidate cannot claim');
select ok(public.claim_reminder_delivery('ea000000-0000-4000-8000-000000000040','ea000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000042',clock_timestamp(),(select reminder_schedule_changed_at from public.events where id='ea000000-0000-4000-8000-000000000040')) is not null,'new owner can receive new eligible claim');
set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000001',true);
update public.events set owner_user_id='ea000000-0000-4000-8000-000000000001' where id='ea000000-0000-4000-8000-000000000040';
set local role service_role;
select ok(not (select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000040',marker) from reminder_fixture),'ABA audience change cannot revive old claim');
select is((select count(*)::int from public.reminder_deliveries where event_id='ea000000-0000-4000-8000-000000000040'),2,'ledger is retained across audience changes');
set local role authenticated;

reset role;
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,reminder_kind,time_zone,recurrence_rule,series_id) values
 ('ea000000-0000-4000-8000-000000000045','ea000000-0000-4000-8000-000000000010','ea000000-0000-4000-8000-000000000001','personal','ea000000-0000-4000-8000-000000000001','Recurring check','2030-01-01 10:00Z','timed_at_start','UTC','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','ea000000-0000-4000-8000-000000000045');
create temp table recurring_check_fixture as
 select reminder_schedule_changed_at marker,updated_at version,null::uuid delivery,clock_timestamp() due
 from public.events where id='ea000000-0000-4000-8000-000000000045';
grant all on recurring_check_fixture to authenticated,service_role;
set local role service_role;
-- Candidate due/snapshot are service-trusted inputs, matching the existing claim contract.
update recurring_check_fixture set delivery=public.claim_recurring_reminder_delivery(
 'ea000000-0000-4000-8000-000000000045','ea000000-0000-4000-8000-000000000045','2030-01-01',
 'ea000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000041',
 due,version,marker,null,null,null,marker);
select ok((select delivery is not null from recurring_check_fixture),'recurring claim succeeds for current snapshot');
select ok((select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000045',marker,version,'2030-01-01') from recurring_check_fixture),'recurring send check accepts current source without exception');
select ok(not (select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000045',marker,version,'2030-01-02') from recurring_check_fixture),'recurring send check rejects different occurrence');
reset role;
insert into public.event_occurrence_exceptions(event_id,occurrence_date,exception_type,override_data)
 values ('ea000000-0000-4000-8000-000000000045','2030-01-01','override','{"title":"Changed after claim"}');
set local role service_role;
select ok(not (select public.check_event_reminder_delivery(delivery,'ea000000-0000-4000-8000-000000000045',marker,version,'2030-01-01') from recurring_check_fixture),'new exception after claim blocks stale send');
select ok((select public.check_event_reminder_delivery(f.delivery,'ea000000-0000-4000-8000-000000000045',f.marker,f.version,'2030-01-01',x.id,x.updated_at,x.exception_type)
 from recurring_check_fixture f cross join public.event_occurrence_exceptions x where x.event_id='ea000000-0000-4000-8000-000000000045'),'matching recurring exception snapshot is accepted');
set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000045',
 (select updated_at from public.events where id='ea000000-0000-4000-8000-000000000045'),
 'shared',null,'{}','only-this','2030-01-01')$$,'B reassigns recurring audience without touching override');
set local role service_role;
select ok(not (select public.check_event_reminder_delivery(f.delivery,'ea000000-0000-4000-8000-000000000045',f.marker,f.version,'2030-01-01',x.id,x.updated_at,x.exception_type)
 from recurring_check_fixture f cross join public.event_occurrence_exceptions x where x.event_id='ea000000-0000-4000-8000-000000000045'),'recurring audience change invalidates even a matching old exception');
set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.events),0,'outsider reads none');
select throws_ok($$select public.save_event_edit('ea000000-0000-4000-8000-000000000023',now(),'personal','ea000000-0000-4000-8000-000000000003','{"title":"bad"}')$$,'P0001','Event not found or membership changed','outsider cannot call RPC against private Event');

with x as (update public.events set title='bad' returning id) select is((select count(*)::int from x),0,'outsider edits none');
with x as (delete from public.events returning id) select is((select count(*)::int from x),0,'outsider deletes none');
reset role;
select * from finish();
rollback;
