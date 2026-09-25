begin;
set local search_path=public,extensions;
select no_plan();

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-a@example.invalid','not-used',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-b@example.invalid','not-used',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-c@example.invalid','not-used',now(),'{}','{}',now(),now());

insert into public.spaces(id,name,kind,invite_code,created_by) values
('91000000-0000-4000-8000-000000000011','Personal A','personal','LCPERS01','91000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000012','Shared leave','shared','LCSHARE1','91000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000013','Shared remove','shared','LCSHARE2','91000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000014','Shared transfer','shared','LCSHARE3','91000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000015','Shared delete','shared','LCSHARE4','91000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('91000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000001','owner'),
('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000001','owner'),
('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000002','member'),
('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','owner'),
('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000002','member'),
('91000000-0000-4000-8000-000000000014','91000000-0000-4000-8000-000000000001','owner'),
('91000000-0000-4000-8000-000000000014','91000000-0000-4000-8000-000000000002','member'),
('91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000001','owner'),
('91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000002','member');

insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,recurrence_rule,time_zone) values
('91000000-0000-4000-8000-000000000021','91000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000001','personal','91000000-0000-4000-8000-000000000001','true Personal',now()+interval '1 day',null,null),
('91000000-0000-4000-8000-000000000022','91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000001','shared',null,'shared survives',now()+interval '1 day',null,null),
('91000000-0000-4000-8000-000000000023','91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000002','personal','91000000-0000-4000-8000-000000000002','leaver root',now()+interval '1 day','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','UTC'),
('91000000-0000-4000-8000-000000000024','91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000002','personal','91000000-0000-4000-8000-000000000002','leaver child',now()+interval '2 days','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','UTC'),
('91000000-0000-4000-8000-000000000025','91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000002','personal','91000000-0000-4000-8000-000000000001','other owner',now()+interval '1 day',null,null),
('91000000-0000-4000-8000-000000000026','91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','personal','91000000-0000-4000-8000-000000000002','remove target',now()+interval '1 day',null,null),
('91000000-0000-4000-8000-000000000027','91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000001','shared',null,'delete root',now()+interval '1 day','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','UTC'),
('91000000-0000-4000-8000-000000000028','91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000001','shared',null,'delete split child',now()+interval '2 days','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','UTC'),
('91000000-0000-4000-8000-000000000029','91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000002','personal','91000000-0000-4000-8000-000000000002','delete personal',now()+interval '1 day',null,null);
update public.events set series_id=id where id='91000000-0000-4000-8000-000000000023';
update public.events set series_id='91000000-0000-4000-8000-000000000023',parent_event_id='91000000-0000-4000-8000-000000000023'
where id='91000000-0000-4000-8000-000000000024';
update public.events set series_id=id where id='91000000-0000-4000-8000-000000000027';
update public.events set series_id='91000000-0000-4000-8000-000000000027',parent_event_id='91000000-0000-4000-8000-000000000027'
where id='91000000-0000-4000-8000-000000000028';
insert into public.event_occurrence_exceptions(event_id,occurrence_date,exception_type)
values ('91000000-0000-4000-8000-000000000023',current_date+1,'deleted'),
('91000000-0000-4000-8000-000000000028',current_date+2,'deleted');
insert into public.tasks(id,space_id,created_by,assigned_to_user_id,title) values
('91000000-0000-4000-8000-000000000031','91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','keep Task'),
('91000000-0000-4000-8000-000000000032','91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','keep removed Task'),
('91000000-0000-4000-8000-000000000033','91000000-0000-4000-8000-000000000015','91000000-0000-4000-8000-000000000001',null,'delete Task');
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth)
values ('91000000-0000-4000-8000-000000000041','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000042','https://fcm.googleapis.com/lifecycle-test','key','auth');
insert into public.reminder_deliveries(event_id,recipient_user_id,subscription_id,due_at,status,result_code,provider_status)
values ('91000000-0000-4000-8000-000000000023','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000041',now(),'sent','delivered',201);

select ok(has_function_privilege('authenticated','public.leave_shared_space(uuid)','EXECUTE'),'authenticated may leave');
select ok(not has_function_privilege('anon','public.leave_shared_space(uuid)','EXECUTE'),'anon cannot leave');
select ok(not has_function_privilege('service_role','public.leave_shared_space(uuid)','EXECUTE'),'service role cannot call user lifecycle RPC');
select ok(not has_function_privilege('authenticated','public.delete_lifecycle_event_set(uuid,uuid)','EXECUTE'),'deletion helper is internal');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000011')$$,'P0001','Shared Space not found','Personal leave rejected');
select throws_ok($$select public.remove_space_member('91000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000001')$$,'P0001','Shared Space not found','Personal remove rejected');
select throws_ok($$select public.transfer_space_ownership('91000000-0000-4000-8000-000000000011','91000000-0000-4000-8000-000000000002')$$,'P0001','Shared Space not found','Personal transfer rejected');
select throws_ok($$select public.delete_shared_space('91000000-0000-4000-8000-000000000011')$$,'P0001','Shared Space not found','Personal delete rejected');
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000012')$$,'P0001','Only an ordinary member may leave','owner must transfer before leave');
select throws_ok($$select public.remove_space_member('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000001')$$,'P0001','Target must be another ordinary member','owner cannot remove self');
select throws_ok($$select public.transfer_space_ownership('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000003')$$,'P0001','New owner must be the other current member','nonmember cannot receive ownership');
reset role;
select throws_ok($$insert into public.space_members(space_id,user_id,role) values ('91000000-0000-4000-8000-000000000012','91000000-0000-4000-8000-000000000003','member')$$,'P0001','Shared Space is already full','direct third member rejected');
set local role authenticated;

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.delete_shared_space('91000000-0000-4000-8000-000000000015')$$,'P0001','Only the current owner may delete a Shared Space','nonmember cannot delete');
select throws_ok($$select public.remove_space_member('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000002')$$,'P0001','Only the current owner may remove a member','nonmember cannot remove');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000012')$$,'ordinary member leaves');
reset role;
select is((select count(*) from public.events where id in ('91000000-0000-4000-8000-000000000023','91000000-0000-4000-8000-000000000024')),0::bigint,'recurring root and child deleted');
select is((select count(*) from public.event_occurrence_exceptions where event_id='91000000-0000-4000-8000-000000000023'),0::bigint,'exceptions cascade');
select is((select count(*) from public.events where id in ('91000000-0000-4000-8000-000000000021','91000000-0000-4000-8000-000000000022','91000000-0000-4000-8000-000000000025')),3::bigint,'Shared, other personal, and true Personal Events survive');
select is((select count(*) from public.tasks where id='91000000-0000-4000-8000-000000000031'),1::bigint,'Task survives leave');
select is((select assigned_to_user_id from public.tasks where id='91000000-0000-4000-8000-000000000031'),null::uuid,'Task assignee cleared');
select isnt((select invite_code from public.spaces where id='91000000-0000-4000-8000-000000000012'),'LCSHARE1','leave rotates invite');
select is((select count(*) from public.reminder_deliveries where event_id='91000000-0000-4000-8000-000000000023'),1::bigint,'historical ledger survives leave');
select is((select count(*) from public.push_subscriptions where user_id='91000000-0000-4000-8000-000000000002'),1::bigint,'push subscription survives leave');
set local role authenticated;
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000012')$$,'P0001','Only an ordinary member may leave','stale membership rejected');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.remove_space_member('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000002')$$,'owner removes ordinary member');
select is((select count(*) from public.events where id='91000000-0000-4000-8000-000000000026'),0::bigint,'remove targets owner_user_id, not created_by');
select is((select assigned_to_user_id from public.tasks where id='91000000-0000-4000-8000-000000000032'),null::uuid,'remove clears Task assignee');
select isnt((select invite_code from public.spaces where id='91000000-0000-4000-8000-000000000013'),'LCSHARE2','remove rotates invite');
select lives_ok($$select public.transfer_space_ownership('91000000-0000-4000-8000-000000000014','91000000-0000-4000-8000-000000000002')$$,'ownership transfers');
select is((select count(*) from public.space_members where space_id='91000000-0000-4000-8000-000000000014' and role='owner'),1::bigint,'transfer leaves one owner');
select throws_ok($$select public.delete_shared_space('91000000-0000-4000-8000-000000000014')$$,'P0001','Only the current owner may delete a Shared Space','stale owner role rejected');
select lives_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000014')$$,'former owner can leave as member');
select lives_ok($$select public.delete_shared_space('91000000-0000-4000-8000-000000000015')$$,'owner hard deletes Shared Space');
select is((select count(*) from public.spaces where id='91000000-0000-4000-8000-000000000015'),0::bigint,'Shared Space removed');
select is((select count(*) from public.events where id in ('91000000-0000-4000-8000-000000000027','91000000-0000-4000-8000-000000000028','91000000-0000-4000-8000-000000000029')),0::bigint,'Shared root, split child and personal Event removed');
select is((select count(*) from public.event_occurrence_exceptions where event_id='91000000-0000-4000-8000-000000000028'),0::bigint,'hard delete removes child exceptions');
select is((select count(*) from public.tasks where id='91000000-0000-4000-8000-000000000033'),0::bigint,'Task removed with Shared Space');
select is((select count(*) from public.space_modules where space_id='91000000-0000-4000-8000-000000000015'),0::bigint,'modules removed with Shared Space');

reset role;
select throws_ok($$delete from public.spaces where id='91000000-0000-4000-8000-000000000011'$$,'P0001','Personal Space cannot be deleted','privileged direct Personal delete rejected');
insert into public.space_members(space_id,user_id,role) values ('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000003','member');
select throws_ok($$update public.space_members set role='owner' where space_id='91000000-0000-4000-8000-000000000013' and user_id='91000000-0000-4000-8000-000000000003'$$,'23505',null,'second owner blocked by unique index');
select lives_ok($test$do $body$
begin
  begin
    delete from public.space_members where space_id='91000000-0000-4000-8000-000000000014' and role='owner';
    set constraints space_members_shared_final_state immediate;
    raise exception 'owner guard did not fire';
  exception when raise_exception then
    if sqlerrm<>'Live Shared Space requires exactly one owner and at most two members' then raise; end if;
  end;
end $body$;$test$,'direct owner deletion fails at deferred final-state guard');
select is((select count(*) from public.space_members where space_id='91000000-0000-4000-8000-000000000014' and role='owner'),1::bigint,'failed owner deletion rolled back');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.transfer_space_ownership('91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000003')$$,'transfer to member without Auth NO ACTION references');
reset role;
select lives_ok($test$do $body$
begin
  begin
    delete from auth.users where id='91000000-0000-4000-8000-000000000003';
    set constraints space_members_shared_final_state immediate;
    raise exception 'Auth cascade guard did not fire';
  exception when raise_exception then
    if sqlerrm<>'Live Shared Space requires exactly one owner and at most two members' then raise; end if;
  end;
end $body$;$test$,'Auth cascade cannot leave a live Shared Space ownerless');
select is((select count(*) from auth.users where id='91000000-0000-4000-8000-000000000003'),1::bigint,'failed Auth deletion rolled back');

insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at) values
('91000000-0000-4000-8000-000000000050','91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','personal','91000000-0000-4000-8000-000000000001','graph target',now()+interval '1 day'),
('91000000-0000-4000-8000-000000000051','91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','shared',null,'cross scope reference',now()+interval '1 day'),
('91000000-0000-4000-8000-000000000052','91000000-0000-4000-8000-000000000013','91000000-0000-4000-8000-000000000001','personal','91000000-0000-4000-8000-000000000001','cycle peer',now()+interval '1 day');
update public.events set parent_event_id='91000000-0000-4000-8000-000000000050' where id='91000000-0000-4000-8000-000000000051';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000013')$$,'P0001','Event deletion set has an external or invalid reference','cross-scope reference stops leave');
reset role;
select is((select count(*) from public.events where id='91000000-0000-4000-8000-000000000050'),1::bigint,'failed leave keeps target Event');
select is((select count(*) from public.space_members where space_id='91000000-0000-4000-8000-000000000013' and user_id='91000000-0000-4000-8000-000000000001'),1::bigint,'failed leave keeps membership');
update public.events set parent_event_id=null where id='91000000-0000-4000-8000-000000000051';
update public.events set parent_event_id='91000000-0000-4000-8000-000000000050' where id='91000000-0000-4000-8000-000000000021';
set local role authenticated;
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000013')$$,'P0001','Event deletion set has an external or invalid reference','cross-Space reference stops leave');
reset role;
update public.events set parent_event_id=null where id='91000000-0000-4000-8000-000000000021';
update public.events set parent_event_id='91000000-0000-4000-8000-000000000052' where id='91000000-0000-4000-8000-000000000050';
update public.events set parent_event_id='91000000-0000-4000-8000-000000000050' where id='91000000-0000-4000-8000-000000000052';
set local role authenticated;
select throws_ok($$select public.leave_shared_space('91000000-0000-4000-8000-000000000013')$$,'P0001','Event reference cycle prevents bounded deletion','cycle stops leave and rolls back');
reset role;
select is((select count(*) from public.events where id in ('91000000-0000-4000-8000-000000000050','91000000-0000-4000-8000-000000000052')),2::bigint,'cycle rejection keeps target Events');

select is((
  select count(*) from (values
    ('public.profiles'),('public.spaces'),('public.space_members'),
    ('public.events'),('public.event_occurrence_exceptions'),('public.tasks')
  ) as protected(table_name)
  cross join (values ('anon'),('authenticated'),('service_role')) as app(role_name)
  where has_table_privilege(app.role_name,protected.table_name,'TRUNCATE')
),0::bigint,'all 18 lifecycle TRUNCATE grants are absent');
set local role anon;
select throws_ok($$truncate public.profiles cascade$$,'42501',null,'anon cannot cascade from profiles into membership');
reset role;
set local role authenticated;
select throws_ok($$truncate public.space_members cascade$$,'42501',null,'authenticated cannot truncate membership and Tasks');
select throws_ok($$truncate public.events cascade$$,'42501',null,'authenticated cannot truncate retained Events');
select throws_ok($$truncate public.tasks$$,'42501',null,'authenticated cannot truncate retained Tasks');
select throws_ok($$truncate public.event_occurrence_exceptions$$,'42501',null,'authenticated cannot truncate retained exceptions');
reset role;
set local role service_role;
select throws_ok($$truncate public.spaces cascade$$,'42501',null,'service role cannot cascade from Spaces');
reset role;
select * from finish();
rollback;
