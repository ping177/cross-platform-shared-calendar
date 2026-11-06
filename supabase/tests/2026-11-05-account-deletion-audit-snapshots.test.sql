-- SQL-level audit contract only. No Auth Admin or Personal cleanup capability.
begin;
select no_plan();

select ok(not exists (
  select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
  where c.contype='f' and a.attname='created_by'
    and c.conrelid in ('public.spaces'::regclass,'public.events'::regclass,
      'public.tasks'::regclass,'public.review_rounds'::regclass)
    and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass)
), 'creator UUID snapshots have no Auth/Profile FK');

insert into auth.users(id,email) values
 ('ad000000-0000-4000-8000-000000000001','owner@audit.invalid'),
 ('ad000000-0000-4000-8000-000000000002','former-creator@audit.invalid'),
 ('ad000000-0000-4000-8000-000000000003','new-member@audit.invalid'),
 ('ad000000-0000-4000-8000-000000000004','empty-personal@audit.invalid'),
 ('ad000000-0000-4000-8000-000000000005','populated-personal@audit.invalid'),
 ('ad000000-0000-4000-8000-000000000006','live-event-owner@audit.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 -- B created this Space; its present Owner A is authoritative.
 ('ad000000-0000-4000-8000-000000000010','Shared','shared','AUDIT001','ad000000-0000-4000-8000-000000000002'),
 ('ad000000-0000-4000-8000-000000000040','Empty Personal','personal','AUDIT004','ad000000-0000-4000-8000-000000000004'),
 ('ad000000-0000-4000-8000-000000000050','Populated Personal','personal','AUDIT005','ad000000-0000-4000-8000-000000000005'),
 ('ad000000-0000-4000-8000-000000000060','Other Shared','shared','AUDIT006','ad000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
 ('ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000001','owner'),
 ('ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000002','member'),
 ('ad000000-0000-4000-8000-000000000040','ad000000-0000-4000-8000-000000000004','owner'),
 ('ad000000-0000-4000-8000-000000000050','ad000000-0000-4000-8000-000000000005','owner'),
 ('ad000000-0000-4000-8000-000000000060','ad000000-0000-4000-8000-000000000001','owner'),
 ('ad000000-0000-4000-8000-000000000060','ad000000-0000-4000-8000-000000000006','member');

-- Synthetic history is seeded as the fixture administrator. Runtime permission
-- assertions below always use authenticated/anon/service_role as appropriate.
insert into public.space_modules(space_id,module_key,enabled)
 values ('ad000000-0000-4000-8000-000000000010','review',true);
insert into public.review_rounds(id,space_id,round_no,review_date,created_by) values
 ('ad000000-0000-4000-8000-000000000030','ad000000-0000-4000-8000-000000000010',1,'2030-01-01','ad000000-0000-4000-8000-000000000002'),
 ('ad000000-0000-4000-8000-000000000053','ad000000-0000-4000-8000-000000000050',1,'2030-01-01','ad000000-0000-4000-8000-000000000005');
insert into public.review_entries(review_id,user_id,focus,progress,problems,next_plan,content_revision,filled_revision) values
 ('ad000000-0000-4000-8000-000000000030','ad000000-0000-4000-8000-000000000001','A focus','A progress','A problems','A plan',1,1),
 ('ad000000-0000-4000-8000-000000000030','ad000000-0000-4000-8000-000000000002','B focus','B progress','B problems','B plan',1,1),
 ('ad000000-0000-4000-8000-000000000053','ad000000-0000-4000-8000-000000000005','Private focus',null,null,null,1,null);
insert into public.lists(id,space_id,name,created_by) values
 ('ad000000-0000-4000-8000-000000000031','ad000000-0000-4000-8000-000000000010','Shared list','ad000000-0000-4000-8000-000000000002'),
 ('ad000000-0000-4000-8000-000000000054','ad000000-0000-4000-8000-000000000050','Private list','ad000000-0000-4000-8000-000000000005');
insert into public.list_sections(id,list_id,name,sort_order,created_by) values
 ('ad000000-0000-4000-8000-000000000032','ad000000-0000-4000-8000-000000000031','Section',1024,'ad000000-0000-4000-8000-000000000002');
insert into public.list_items(id,list_id,space_id,section_id,content,sort_order,created_by) values
 ('ad000000-0000-4000-8000-000000000033','ad000000-0000-4000-8000-000000000031','ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000032','Shared content',1024,'ad000000-0000-4000-8000-000000000002');
insert into public.important_dates(id,space_id,name,repeat_kind,month,day,time_zone,created_by) values
 ('ad000000-0000-4000-8000-000000000034','ad000000-0000-4000-8000-000000000010','Shared date','annual',2,3,'UTC','ad000000-0000-4000-8000-000000000002'),
 ('ad000000-0000-4000-8000-000000000055','ad000000-0000-4000-8000-000000000050','Private date','annual',3,4,'UTC','ad000000-0000-4000-8000-000000000005');
insert into public.events(id,space_id,created_by,scope,owner_user_id,title,starts_at,time_zone,recurrence_rule,series_id,parent_event_id) values
 ('ad000000-0000-4000-8000-000000000021','ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000002','shared',null,'Shared recurring','2030-01-01 10:00Z','UTC','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','ad000000-0000-4000-8000-000000000021',null),
 ('ad000000-0000-4000-8000-000000000022','ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000002','personal','ad000000-0000-4000-8000-000000000001','Other member personal','2030-01-01',null,null,null,null),
 ('ad000000-0000-4000-8000-000000000023','ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000001','personal','ad000000-0000-4000-8000-000000000002','Leaving owner root','2030-01-01 10:00Z','UTC','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','ad000000-0000-4000-8000-000000000023',null),
 ('ad000000-0000-4000-8000-000000000024','ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000002','personal','ad000000-0000-4000-8000-000000000002','Leaving owner child','2030-01-02 10:00Z','UTC','{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}','ad000000-0000-4000-8000-000000000023','ad000000-0000-4000-8000-000000000023'),
 ('ad000000-0000-4000-8000-000000000051','ad000000-0000-4000-8000-000000000050','ad000000-0000-4000-8000-000000000005','personal','ad000000-0000-4000-8000-000000000005','Private Event','2030-01-01',null,null,null,null),
 ('ad000000-0000-4000-8000-000000000061','ad000000-0000-4000-8000-000000000060','ad000000-0000-4000-8000-000000000001','personal','ad000000-0000-4000-8000-000000000006','Live owner FK','2030-01-01',null,null,null,null);
insert into public.event_occurrence_exceptions(event_id,occurrence_date,exception_type) values
 ('ad000000-0000-4000-8000-000000000023','2030-01-03','deleted'),
 ('ad000000-0000-4000-8000-000000000024','2030-01-04','deleted');
insert into public.tasks(id,space_id,title,created_by,assigned_to_user_id) values
 ('ad000000-0000-4000-8000-000000000025','ad000000-0000-4000-8000-000000000010','Assigned to leaver','ad000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000002'),
 ('ad000000-0000-4000-8000-000000000052','ad000000-0000-4000-8000-000000000050','Private Task','ad000000-0000-4000-8000-000000000005','ad000000-0000-4000-8000-000000000005');

set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
insert into public.tasks(id,space_id,title,created_by,assigned_to_user_id) values
 ('ad000000-0000-4000-8000-000000000020','ad000000-0000-4000-8000-000000000010',
  'Other member still uses this Task','ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.tasks(space_id,title,created_by) values
 ('ad000000-0000-4000-8000-000000000010','Forged creator','ad000000-0000-4000-8000-000000000001')$$,
 '42501',null,'dropping creator FK does not allow impersonation on INSERT');
select throws_ok($$update public.tasks set created_by='ad000000-0000-4000-8000-000000000001'
 where id='ad000000-0000-4000-8000-000000000020'$$,'P0001','Task created_by is immutable','creator UPDATE remains immutable');
reset role;

create temp table expected_history as
 select 'space' label,(to_jsonb(s)-'invite_code') payload from public.spaces s where id='ad000000-0000-4000-8000-000000000010'
 union all select 'events',jsonb_agg(to_jsonb(e) order by id) from public.events e where id in ('ad000000-0000-4000-8000-000000000021','ad000000-0000-4000-8000-000000000022')
 union all select 'rounds',jsonb_agg(to_jsonb(r) order by id) from public.review_rounds r where space_id='ad000000-0000-4000-8000-000000000010'
 union all select 'entries',jsonb_agg(to_jsonb(e) order by user_id) from public.review_entries e where review_id='ad000000-0000-4000-8000-000000000030'
 union all select 'lists',jsonb_agg(to_jsonb(l) order by id) from public.lists l where space_id='ad000000-0000-4000-8000-000000000010'
 union all select 'sections',jsonb_agg(to_jsonb(s) order by id) from public.list_sections s
 union all select 'items',jsonb_agg(to_jsonb(i) order by id) from public.list_items i
 union all select 'dates',jsonb_agg(to_jsonb(d) order by id) from public.important_dates d where space_id='ad000000-0000-4000-8000-000000000010';
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
select public.leave_shared_space('ad000000-0000-4000-8000-000000000010');
select is((select count(*) from public.review_entries where review_id='ad000000-0000-4000-8000-000000000030'),0::bigint,'departed original participant loses history access');
reset role;
create temp table expected_task as select to_jsonb(t) payload from public.tasks t where id='ad000000-0000-4000-8000-000000000020';
-- Admin fixture deletion of a synthetic, already-departed Profile tests the FK;
-- it is not an account deletion implementation or a client authorization proof.
delete from public.profiles where id='ad000000-0000-4000-8000-000000000002';
select is((select to_jsonb(t)::text from public.tasks t where id='ad000000-0000-4000-8000-000000000020'),
 (select payload::text from expected_task), 'former creator Profile deletion preserves complete shared Task row');

select lives_ok($$delete from auth.users where id='ad000000-0000-4000-8000-000000000002'$$,
 'synthetic departed creator Auth row can be deleted despite shared historical references');
select is((select count(*) from auth.users where id='ad000000-0000-4000-8000-000000000002'),0::bigint,'synthetic creator Auth identity is absent');
select is((select count(*) from public.events where id in ('ad000000-0000-4000-8000-000000000023','ad000000-0000-4000-8000-000000000024')),0::bigint,'leave removes personal series by owner, including split child');
select is((select count(*) from public.event_occurrence_exceptions),0::bigint,'deleted personal series exceptions cascade');
select is((select assigned_to_user_id from public.tasks where id='ad000000-0000-4000-8000-000000000025'),null::uuid,'assigned Task becomes shared');
select is((select title from public.tasks where id='ad000000-0000-4000-8000-000000000025'),'Assigned to leaver','assignment cleanup preserves Task content and ID');
select is((select to_jsonb(t)::text from public.tasks t where id='ad000000-0000-4000-8000-000000000020'),(select payload::text from expected_task),'Auth cascade preserves complete shared Task row');
select is((select (to_jsonb(s)-'invite_code')::text from public.spaces s where id='ad000000-0000-4000-8000-000000000010'),(select payload::text from expected_history where label='space'),'Space creator UUID and identity survive; only lifecycle invite may rotate');
select is((select jsonb_agg(to_jsonb(e) order by id)::text from public.events e where id in ('ad000000-0000-4000-8000-000000000021','ad000000-0000-4000-8000-000000000022')),(select payload::text from expected_history where label='events'),'complete shared/other-owned Event rows survive, regardless of creator');
select is((select jsonb_agg(to_jsonb(r) order by id)::text from public.review_rounds r where space_id='ad000000-0000-4000-8000-000000000010'),(select payload::text from expected_history where label='rounds'),'complete historical round identity survives');
select is((select jsonb_agg(to_jsonb(e) order by user_id)::text from public.review_entries e where review_id='ad000000-0000-4000-8000-000000000030'),(select payload::text from expected_history where label='entries'),'both participants and all text/revision fields survive');
select is((select jsonb_agg(to_jsonb(l) order by id)::text from public.lists l where space_id='ad000000-0000-4000-8000-000000000010'),(select payload::text from expected_history where label='lists'),'complete shared List survives');
select is((select jsonb_agg(to_jsonb(s) order by id)::text from public.list_sections s),(select payload::text from expected_history where label='sections'),'complete Sections survive');
select is((select jsonb_agg(to_jsonb(i) order by id)::text from public.list_items i),(select payload::text from expected_history where label='items'),'complete Items and parent/sort associations survive');
select is((select jsonb_agg(to_jsonb(d) order by id)::text from public.important_dates d where space_id='ad000000-0000-4000-8000-000000000010'),(select payload::text from expected_history where label='dates'),'complete shared Important Date survives');

select set_config('audit.invite',(select invite_code from public.spaces where id='ad000000-0000-4000-8000-000000000010'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
select public.join_space_by_invite_code(current_setting('audit.invite'));
select is((select count(*) from public.review_rounds),0::bigint,'new current member cannot read unparticipated history');
select is((select count(*) from public.review_entries),0::bigint,'new current member cannot read either historical body');
select throws_ok($$select public.save_my_review_entry('ad000000-0000-4000-8000-000000000030','Forged',null,null,null,1)$$,'P0001',null,'new member cannot edit historical entry');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select public.transfer_space_ownership('ad000000-0000-4000-8000-000000000010','ad000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.review_rounds),0::bigint,'new Owner does not acquire original participant permissions');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.review_entries where review_id='ad000000-0000-4000-8000-000000000030'),2::bigint,'remaining original participant still reads both bodies after ownership transfer');
select lives_ok($$select public.save_my_review_entry('ad000000-0000-4000-8000-000000000030','A updated','A progress','A problems','A plan',1)$$,'remaining participant still edits own history');
select lives_ok($$update public.tasks set title='Still usable' where id='ad000000-0000-4000-8000-000000000020'$$,'surviving member can still edit departed creator Task');
select lives_ok($$select public.split_recurring_event('ad000000-0000-4000-8000-000000000021','2030-01-02','Future',null,
 '2030-01-02 10:00Z',null,false,'{"version":1,"frequency":"daily","interval":1,"time_zone":"UTC"}',
 (select updated_at from public.events where id='ad000000-0000-4000-8000-000000000021'))$$,'derived series preserves historical creator after Auth deletion');
select is((select created_by from public.events where parent_event_id='ad000000-0000-4000-8000-000000000021'),'ad000000-0000-4000-8000-000000000002'::uuid,'split child keeps original creator UUID');
select throws_ok($$select public.delete_lifecycle_event_set('ad000000-0000-4000-8000-000000000050',null)$$,'42501',null,'client cannot invoke internal cleanup helper');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000004',true);
with removed as (delete from public.spaces where id='ad000000-0000-4000-8000-000000000040' returning id)
 select is((select count(*) from removed),0::bigint,'ordinary own Personal DELETE has no RLS-authorized rows');
select throws_ok($$select public.delete_shared_space('ad000000-0000-4000-8000-000000000040')$$,'P0001','Shared Space not found','ordinary Space RPC cannot delete Personal');
reset role;
select throws_ok($$delete from public.spaces where id='ad000000-0000-4000-8000-000000000040'$$,'P0001','Personal Space cannot be deleted','empty Personal protected even from direct privileged deletion');
select throws_ok($$delete from public.spaces where id='ad000000-0000-4000-8000-000000000050'$$,'P0001','Personal Space cannot be deleted','populated Personal protected');
select throws_ok($$delete from auth.users where id='ad000000-0000-4000-8000-000000000004'$$,'P0001',null,'empty Personal prevents unsafe raw Auth cascade');
select throws_ok($$delete from public.profiles where id='ad000000-0000-4000-8000-000000000005'$$,'P0001',null,'populated Personal prevents unsafe raw Profile cascade');
select is((select title from public.events where id='ad000000-0000-4000-8000-000000000051'),'Private Event','failed destructive attempt leaves private Event intact');
select is((select title from public.tasks where id='ad000000-0000-4000-8000-000000000052'),'Private Task','failed destructive attempt leaves private Task intact');
select is((select focus from public.review_entries where review_id='ad000000-0000-4000-8000-000000000053'),'Private focus','private Review remains intact');
select throws_ok($$delete from auth.users where id='ad000000-0000-4000-8000-000000000006'$$,'23503',null,'live Event owner Auth FK still blocks deletion');
select ok(exists(select 1 from public.space_members where user_id='ad000000-0000-4000-8000-000000000006'),'failed Auth deletion rolls membership cascade back');
select is((select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where c.contype='f' and n.nspname='public' and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass)),5::bigint,'five live identity FKs remain, not blindly removed');
set local role service_role;
select throws_ok($$delete from public.spaces where id='ad000000-0000-4000-8000-000000000050'$$,'P0001','Personal Space cannot be deleted','service_role cannot bypass Personal guard');
reset role;
set local role anon;
select is((select count(*) from public.tasks),0::bigint,'anon still cannot see preserved shared Tasks');
reset role;

select * from finish();
rollback;
