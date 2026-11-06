-- Auth and Storage are SQL fixtures, not real Auth / Storage API E2E.
begin;
select no_plan();
select has_schema('private','private lifecycle schema exists');
select has_table('private','account_deletions','durable per-account deletion intent exists');
select ok(to_regprocedure('private.accept_account_deletion(uuid,uuid)') is not null,'internal acceptance contract exists');
select ok(to_regprocedure('public.current_account_active()') is not null,'actor-scoped read predicate exists');
-- Runtime cases
select ok(not has_schema_privilege('authenticated','private','USAGE'),'clients cannot address private schema');
select ok(not has_table_privilege('authenticated','private.account_deletions','INSERT,UPDATE,DELETE,SELECT'),'clients cannot read or mutate lifecycle state');
select ok(not has_function_privilege('service_role','private.accept_account_deletion(uuid,uuid)','EXECUTE'),'service_role cannot accept before OTP integration');
select ok(not has_function_privilege('authenticated','private.accept_account_deletion(uuid,uuid)','EXECUTE'),'client cannot accept a target UUID');
insert into auth.users(id,email) values
 ('ba000000-0000-4000-8000-000000000001','active@barrier.invalid'),
 ('ba000000-0000-4000-8000-000000000002','deleting@barrier.invalid'),
 ('ba000000-0000-4000-8000-000000000003','other@barrier.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 ('ba000000-0000-4000-8000-000000000010','Shared','shared','BARRIER1','ba000000-0000-4000-8000-000000000001'),
 ('ba000000-0000-4000-8000-000000000020','Private','personal','BARRIER2','ba000000-0000-4000-8000-000000000002');
insert into public.space_members(space_id,user_id,role) values
 ('ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000001','owner'),
 ('ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000002','member'),
 ('ba000000-0000-4000-8000-000000000020','ba000000-0000-4000-8000-000000000002','owner');
insert into public.space_modules(space_id,module_key,enabled)
 select s,k,true from unnest(array['ba000000-0000-4000-8000-000000000010'::uuid,'ba000000-0000-4000-8000-000000000020'::uuid]) s
 cross join unnest(array['review','lists','important_dates']) k;
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,reminder_kind,time_zone) values
 ('ba000000-0000-4000-8000-000000000040','ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000001','shared',null,'Shared Event',now()+interval '1 hour','timed_at_start','UTC'),
 ('ba000000-0000-4000-8000-000000000041','ba000000-0000-4000-8000-000000000020','ba000000-0000-4000-8000-000000000002','personal','ba000000-0000-4000-8000-000000000002','Private Event',now()+interval '1 hour',null,null);
insert into public.tasks(id,space_id,created_by,title) values
 ('ba000000-0000-4000-8000-000000000050','ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000002','Shared Task');
insert into public.lists(id,space_id,name,created_by) values
 ('ba000000-0000-4000-8000-000000000060','ba000000-0000-4000-8000-000000000010','Shared List','ba000000-0000-4000-8000-000000000002');
insert into public.list_sections(id,list_id,name,sort_order,created_by) values
 ('ba000000-0000-4000-8000-000000000061','ba000000-0000-4000-8000-000000000060','Section',1024,'ba000000-0000-4000-8000-000000000002');
insert into public.list_items(id,list_id,space_id,content,sort_order,created_by) values
 ('ba000000-0000-4000-8000-000000000062','ba000000-0000-4000-8000-000000000060','ba000000-0000-4000-8000-000000000010','Item',1024,'ba000000-0000-4000-8000-000000000002');
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,created_by) values
 ('ba000000-0000-4000-8000-000000000070','ba000000-0000-4000-8000-000000000010','Date','annual',1,1,'UTC','ba000000-0000-4000-8000-000000000002');
insert into public.review_rounds(id,space_id,round_no,review_date,created_by) values
 ('ba000000-0000-4000-8000-000000000030','ba000000-0000-4000-8000-000000000010',1,'2030-01-01','ba000000-0000-4000-8000-000000000002'),
 ('ba000000-0000-4000-8000-000000000031','ba000000-0000-4000-8000-000000000010',2,'2030-01-02','ba000000-0000-4000-8000-000000000002');
insert into public.review_entries(review_id,user_id,focus,next_plan)
 select r,u,'Keep both bodies','Previous plan' from unnest(array['ba000000-0000-4000-8000-000000000030'::uuid,'ba000000-0000-4000-8000-000000000031'::uuid]) r
 cross join unnest(array['ba000000-0000-4000-8000-000000000001'::uuid,'ba000000-0000-4000-8000-000000000002'::uuid]) u;
insert into public.push_subscriptions(id,user_id,installation_id,endpoint,p256dh,auth) values
 ('ba000000-0000-4000-8000-000000000080','ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000082','https://fcm.googleapis.com/barrier','fake','fake');
insert into public.reminder_deliveries(id,event_id,recipient_user_id,subscription_id,due_at,status) values
 ('ba000000-0000-4000-8000-000000000081','ba000000-0000-4000-8000-000000000040','ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000080',clock_timestamp(),'claimed');
insert into storage.objects(bucket_id,name,owner_id) values
 ('profile-avatars','ba000000-0000-4000-8000-000000000002/ba000000-0000-4000-8000-000000000090.jpg','ba000000-0000-4000-8000-000000000002');
select private.prepare_account_deletion('ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000102');
select lives_ok($$select private.prepare_account_deletion('ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000102')$$,'same intent preparation is idempotent');
select throws_ok($$select private.prepare_account_deletion('ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000103')$$,'P0001','ACCOUNT_DELETION_INTENT_CONFLICT','competing intent cannot replace first intent');
select ok(private.account_active('ba000000-0000-4000-8000-000000000002'),'preparing does not revoke business access');
select private.accept_account_deletion('ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000102');
select lives_ok($$select private.accept_account_deletion('ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000102')$$,'same accepted request is idempotent');
select ok(not private.account_active('ba000000-0000-4000-8000-000000000002'),'accepted status fences the exact account');
select ok(private.account_active('ba000000-0000-4000-8000-000000000001'),'unrelated account remains active');
select ok(not private.account_active('ba000000-0000-4000-8000-000000000099'),'missing Auth user is never active');
select throws_ok($$update private.account_deletions set status='preparing',accepted_at=null where user_id='ba000000-0000-4000-8000-000000000002'$$,'P0001',null,'accepted intent cannot revert to normal');
select throws_ok($$update private.account_deletions set user_id='ba000000-0000-4000-8000-000000000003' where user_id='ba000000-0000-4000-8000-000000000002'$$,'P0001',null,'accepted target identity is immutable');
select throws_ok($$update private.account_deletions set status='completed',completed_at=now() where user_id='ba000000-0000-4000-8000-000000000002'$$,'P0001',null,'completion cannot be fabricated before finalizer exists');
set local role authenticated;
select set_config('request.jwt.claim.sub','ba000000-0000-4000-8000-000000000002',true);
select throws_ok($$update private.account_deletions set status='preparing'$$,'42501',null,'direct client state modification is denied');
select throws_ok($$select private.accept_account_deletion('ba000000-0000-4000-8000-000000000001','ba000000-0000-4000-8000-000000000102')$$,'42501',null,'client cannot call internal acceptance for another UUID');
select set_config('request.jwt.claim.role','service_role',true);
select is(public.current_account_active(),false,'old simulated JWT remains blocked');
select is((select count(*) from public.profiles),0::bigint,'accepted caller cannot read Profile even self branch');
select is((select count(*) from public.events),0::bigint,'old JWT cannot read private or shared Events');
select is((select count(*) from public.space_members),0::bigint,'old JWT cannot read memberships');
select is((select count(*) from public.review_entries),0::bigint,'old JWT cannot read either Review participant');
select is((select count(*) from storage.objects),0::bigint,'old JWT cannot read/sign avatar metadata');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values
 ('profile-avatars','ba000000-0000-4000-8000-000000000002/ba000000-0000-4000-8000-000000000091.jpg','ba000000-0000-4000-8000-000000000002')$$,
 '42501','ACCOUNT_ACCESS_REVOKED','old JWT cannot upload avatar metadata');
select throws_ok($$select public.ensure_personal_space()$$,'42501','ACCOUNT_ACCESS_REVOKED','definer cannot return/recreate existing Personal');
select throws_ok($$select public.create_space_with_invite('Forbidden')$$,'42501','ACCOUNT_ACCESS_REVOKED','definer cannot create Shared Space');
select throws_ok($$select public.get_my_previous_review_plan('ba000000-0000-4000-8000-000000000031')$$,'42501','ACCOUNT_ACCESS_REVOKED','read-only definer cannot return previous plan');
select throws_ok($$select public.create_review_round('ba000000-0000-4000-8000-000000000010','2030-01-03')$$,'42501',null,'definer cannot create Review');
select throws_ok($$select public.save_my_review_entry('ba000000-0000-4000-8000-000000000030','Changed',null,null,null,0)$$,'P0001',null,'participant predicate rejects accepted caller before save');
select throws_ok($$select public.create_list_item('ba000000-0000-4000-8000-000000000060',null,'Forbidden')$$,'P0001',null,'member predicate rejects accepted caller before List write');
select throws_ok($$select public.create_important_date('ba000000-0000-4000-8000-000000000010','Forbidden',null,'annual',1,1,null,'UTC')$$,'42501',null,'definer cannot create Important Date');
select throws_ok($$select public.register_push_subscription('ba000000-0000-4000-8000-000000000082','https://fcm.googleapis.com/barrier','fake','fake')$$,'42501',null,'definer cannot reenable Push subscription');
select throws_ok($$select public.leave_shared_space('ba000000-0000-4000-8000-000000000010')$$,'42501',null,'old JWT cannot run leave mutation');
select throws_ok($$select public.join_space_by_invite_code('BARRIER1')$$,'42501',null,'old JWT cannot rejoin or probe invite');
select is(public.is_space_member('ba000000-0000-4000-8000-000000000010'),false,'definer membership predicate does not revive old JWT');
select set_config('request.jwt.claim.sub','ba000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.review_entries),4::bigint,'normal original participant still sees both historical bodies');
select lives_ok($$update public.tasks set title='Active edit' where id='ba000000-0000-4000-8000-000000000050'$$,'normal member still edits Shared Task');
select throws_ok($$update public.tasks set assigned_to_user_id='ba000000-0000-4000-8000-000000000002' where id='ba000000-0000-4000-8000-000000000050'$$,'42501','ACCOUNT_ACCESS_REVOKED','cannot assign new responsibility to accepted account');
select throws_ok($$select public.transfer_space_ownership('ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000002')$$,'42501','ACCOUNT_ACCESS_REVOKED','cannot transfer ownership to accepted account');
select throws_ok($$update public.events set scope='personal',owner_user_id='ba000000-0000-4000-8000-000000000002' where id='ba000000-0000-4000-8000-000000000040'$$,'42501','ACCOUNT_ACCESS_REVOKED','cannot assign personal Event to accepted account');
select throws_ok($$insert into public.tasks(space_id,title,created_by) values ('ba000000-0000-4000-8000-000000000010','Forged','ba000000-0000-4000-8000-000000000002')$$,'42501',null,'audit snapshot does not allow fake Task creator');
select throws_ok($$insert into public.events(space_id,created_by,scope,title,starts_at) values ('ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000002','shared','Forged',now())$$,'42501',null,'audit snapshot does not allow fake Event creator');
select throws_ok($$update public.tasks set created_by='ba000000-0000-4000-8000-000000000001' where id='ba000000-0000-4000-8000-000000000050'$$,'P0001',null,'historical Task creator remains immutable');
select throws_ok($$update public.spaces set created_by='ba000000-0000-4000-8000-000000000003' where id='ba000000-0000-4000-8000-000000000010'$$,'P0001',null,'Space creator remains immutable');
reset role;
select is((select count(*) from public.spaces where id in ('ba000000-0000-4000-8000-000000000010','ba000000-0000-4000-8000-000000000020')),2::bigint,'status acceptance deletes no Space');
select is((select count(*) from public.review_entries),4::bigint,'status acceptance deletes no Review content');
set local role service_role;
select throws_ok($$select private.accept_account_deletion('ba000000-0000-4000-8000-000000000001','ba000000-0000-4000-8000-000000000102')$$,'42501',null,'even service role has no unverified acceptance entry');
select is((select count(*) from public.active_notification_accounts(array['ba000000-0000-4000-8000-000000000001'::uuid,'ba000000-0000-4000-8000-000000000002'::uuid])),1::bigint,'service prefilter removes accepted recipient before sender budget');
select is(public.check_event_reminder_delivery('ba000000-0000-4000-8000-000000000081','ba000000-0000-4000-8000-000000000040',
 (select reminder_schedule_changed_at from public.events where id='ba000000-0000-4000-8000-000000000040')),false,'pre-send rejects accepted recipient despite existing claimed ledger');
select is(public.claim_reminder_delivery('ba000000-0000-4000-8000-000000000040',
 'ba000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000080',clock_timestamp(),
 (select reminder_schedule_changed_at from public.events where id='ba000000-0000-4000-8000-000000000040')),
 null::uuid,'late claim returns ineligible without creating a ledger row');
reset role;
select ok(not has_function_privilege('authenticated','public.active_notification_accounts(uuid[])','EXECUTE'),'notification batch is not a client UUID lookup API');
select ok(private.set_account_deletion_status('ba000000-0000-4000-8000-000000000102',0,'processing'),'internal accepted to processing transition');
select ok(not private.set_account_deletion_status('ba000000-0000-4000-8000-000000000102',0,'needs_attention','INVARIANT_FAILED'),'stale generation cannot overwrite processing state');
select ok(private.set_account_deletion_status('ba000000-0000-4000-8000-000000000102',1,'needs_attention','INVARIANT_FAILED'),'internal invariant failure is recorded without restoring access');
select ok(not private.account_active('ba000000-0000-4000-8000-000000000002'),'needs_attention keeps account fenced');
select is((select count(*) from private.account_deletions),1::bigint,'replays create one intent only');
select * from finish();
rollback;
