begin;
select no_plan();

select ok(exists (
  select 1 from pg_constraint
  where conrelid='public.review_rounds'::regclass
    and conname='review_rounds_space_review_date_key'
    and contype='u'
), 'Space and review date have a database unique constraint');
select ok(to_regprocedure('public.get_my_previous_review_plan(uuid)') is not null, 'previous-plan RPC exists');
select ok((select prosecdef from pg_proc where oid=to_regprocedure('public.get_my_previous_review_plan(uuid)')), 'previous-plan RPC is security definer');
select is((select proconfig from pg_proc where oid=to_regprocedure('public.get_my_previous_review_plan(uuid)')),array['search_path=pg_catalog, pg_temp']::text[],'previous-plan RPC fixes search_path');
select ok(has_function_privilege('authenticated','public.get_my_previous_review_plan(uuid)','EXECUTE'),'authenticated may execute previous-plan RPC');
select ok(not has_function_privilege('anon','public.get_my_previous_review_plan(uuid)','EXECUTE'),'anon cannot execute previous-plan RPC');

insert into auth.users (
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('93000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-date-a@example.invalid','not-used',now(),'{}','{}',now(),now()),
('93000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','review-date-b@example.invalid','not-used',now(),'{}','{}',now(),now()),
('93000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','review-date-c@example.invalid','not-used',now(),'{}','{}',now(),now());

insert into public.spaces(id,name,kind,invite_code,created_by) values
('93000000-0000-4000-8000-000000000011','Date Personal','personal','RVDATEP1','93000000-0000-4000-8000-000000000001'),
('93000000-0000-4000-8000-000000000012','Date Shared X','shared','RVDATES1','93000000-0000-4000-8000-000000000001'),
('93000000-0000-4000-8000-000000000013','Date Shared Y','shared','RVDATES2','93000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000001','owner'),
('93000000-0000-4000-8000-000000000012','93000000-0000-4000-8000-000000000001','owner'),
('93000000-0000-4000-8000-000000000012','93000000-0000-4000-8000-000000000002','member'),
('93000000-0000-4000-8000-000000000013','93000000-0000-4000-8000-000000000001','owner'),
('93000000-0000-4000-8000-000000000013','93000000-0000-4000-8000-000000000002','member');
insert into public.space_modules(space_id,module_key,enabled) values
('93000000-0000-4000-8000-000000000011','review',true),
('93000000-0000-4000-8000-000000000012','review',true),
('93000000-0000-4000-8000-000000000013','review',true);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);

select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000011',date '2026-09-26')$$,'Personal creates its first date');
select throws_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000011',date '2026-09-26')$$,'P0001','这一天已经有一篇回顾','Personal duplicate date is rejected');
select is((select count(*) from public.review_rounds where space_id='93000000-0000-4000-8000-000000000011'),1::bigint,'Personal duplicate leaves one round');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='93000000-0000-4000-8000-000000000011'),1::bigint,'Personal duplicate creates no entry');

select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000012',date '2026-09-26')$$,'Shared creates 9/26 first');
select throws_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000012',date '2026-09-26')$$,'P0001','这一天已经有一篇回顾','Shared duplicate date is rejected');
select is((select count(*) from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012'),1::bigint,'Shared duplicate leaves one round');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='93000000-0000-4000-8000-000000000012'),2::bigint,'Shared duplicate creates no entries');
select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000013',date '2026-09-26')$$,'another Space may use the same date');
select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000012',date '2026-09-25')$$,'Shared backfills 9/25 second');
select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000012',date '2026-09-27')$$,'Shared creates 9/27 third');
select is((select string_agg(round_no::text||':'||review_date::text,',' order by round_no) from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012'),'1:2026-09-26,2:2026-09-25,3:2026-09-27','round number remains creation order only');

select set_config('test.date_x25',(select id::text from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012' and review_date=date '2026-09-25'),true);
select set_config('test.date_x26',(select id::text from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012' and review_date=date '2026-09-26'),true);
select set_config('test.date_x27',(select id::text from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012' and review_date=date '2026-09-27'),true);
select lives_ok($$select public.save_my_review_entry(current_setting('test.date_x25')::uuid,null,null,null,'Plan 9/25')$$,'save 9/25 plan');
select lives_ok($$select public.save_my_review_entry(current_setting('test.date_x26')::uuid,null,null,null,'Plan 9/26')$$,'save 9/26 plan');
select lives_ok($$select public.save_my_review_entry(current_setting('test.date_x27')::uuid,null,null,null,'Plan 9/27')$$,'save 9/27 plan');
select is(public.get_my_previous_review_plan(current_setting('test.date_x25')::uuid),null,'9/25 has no previous plan');
select is(public.get_my_previous_review_plan(current_setting('test.date_x26')::uuid),'Plan 9/25','9/26 reads 9/25 despite later creation');
select is(public.get_my_previous_review_plan(current_setting('test.date_x27')::uuid),'Plan 9/26','9/27 reads 9/26 by date');

select throws_ok($$select public.correct_review_date(current_setting('test.date_x27')::uuid,date '2026-09-26')$$,'P0001','这一天已经有一篇回顾','date correction rejects an occupied date');
select is((select review_date from public.review_rounds where id=current_setting('test.date_x27')::uuid),date '2026-09-27','failed correction preserves original date');
select is((select count(*) from public.review_rounds where space_id='93000000-0000-4000-8000-000000000012'),3::bigint,'failed correction preserves round count');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='93000000-0000-4000-8000-000000000012'),6::bigint,'failed correction preserves entries');
select lives_ok($$select public.correct_review_date(current_setting('test.date_x27')::uuid,date '2026-09-24')$$,'date correction accepts an unused date');
select is(public.get_my_previous_review_plan(current_setting('test.date_x25')::uuid),'Plan 9/27','date correction dynamically changes previous relation');
select is(public.get_my_previous_review_plan(current_setting('test.date_x26')::uuid),'Plan 9/25','later relation remains date-driven');

select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='93000000-0000-4000-8000-000000000011' and review_date=date '2026-09-26'),null,null,null,'Personal 9/26')$$,'save Personal plan');
select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000011',date '2026-09-27')$$,'Personal creates another date');
select is(public.get_my_previous_review_plan((select id from public.review_rounds where space_id='93000000-0000-4000-8000-000000000011' and review_date=date '2026-09-27')),'Personal 9/26','Personal previous plan is date-driven and Space-scoped');
select lives_ok($$select public.create_review_round('93000000-0000-4000-8000-000000000011',date '2026-09-28')$$,'Personal creates after an empty-plan review');
select is(public.get_my_previous_review_plan((select id from public.review_rounds where space_id='93000000-0000-4000-8000-000000000011' and review_date=date '2026-09-28')),null,'empty immediate previous plan does not fallback to an older populated plan');

reset role;
select throws_ok($$insert into public.review_rounds(space_id,round_no,review_date,created_by) values ('93000000-0000-4000-8000-000000000013',99,date '2026-09-26','93000000-0000-4000-8000-000000000001')$$,'23505',null,'direct insert cannot bypass date uniqueness');

insert into public.review_rounds(id,space_id,round_no,review_date,created_by) values
('93000000-0000-4000-8000-000000000101','93000000-0000-4000-8000-000000000013',2,date '2026-09-27','93000000-0000-4000-8000-000000000001'),
('93000000-0000-4000-8000-000000000102','93000000-0000-4000-8000-000000000013',3,date '2026-09-28','93000000-0000-4000-8000-000000000001');
insert into public.review_entries(review_id,user_id,next_plan,content_revision) values
('93000000-0000-4000-8000-000000000101','93000000-0000-4000-8000-000000000001','A hidden immediate',1),
('93000000-0000-4000-8000-000000000102','93000000-0000-4000-8000-000000000001',null,0),
('93000000-0000-4000-8000-000000000102','93000000-0000-4000-8000-000000000002',null,0);

set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select is(public.get_my_previous_review_plan('93000000-0000-4000-8000-000000000102'),null,'missing own entry on immediate previous date does not fallback');
reset role;
delete from public.space_members where space_id='93000000-0000-4000-8000-000000000013' and user_id='93000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.get_my_previous_review_plan('93000000-0000-4000-8000-000000000102')$$,'P0001','Current review participant membership is required','former member cannot use previous-plan RPC');
reset role;
insert into public.space_members(space_id,user_id,role) values ('93000000-0000-4000-8000-000000000013','93000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select is(public.get_my_previous_review_plan('93000000-0000-4000-8000-000000000102'),null,'rejoined participant still does not fallback past hidden immediate previous');
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.get_my_previous_review_plan('93000000-0000-4000-8000-000000000102')$$,'P0001','Current review participant membership is required','nonparticipant cannot read previous-plan context');

select * from finish();
rollback;
