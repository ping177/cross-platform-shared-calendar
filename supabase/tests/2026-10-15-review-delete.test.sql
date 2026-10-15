begin;
select no_plan();
select ok(has_function_privilege('authenticated','public.delete_review_round(uuid)','EXECUTE'), 'authenticated may call narrow delete RPC');
select ok(not has_function_privilege('anon','public.delete_review_round(uuid)','EXECUTE'), 'anon denied');
select ok(not has_function_privilege('service_role','public.delete_review_round(uuid)','EXECUTE'), 'service role not granted user RPC');
select ok(not has_table_privilege('authenticated','public.review_rounds','DELETE'), 'no direct round deletion');
select ok(not has_table_privilege('authenticated','public.review_entries','DELETE'), 'no direct entry deletion');
insert into auth.users(id,email) values
('a1000000-0000-4000-8000-000000000001','a@review-delete.invalid'),
('a1000000-0000-4000-8000-000000000002','b@review-delete.invalid'),
('a1000000-0000-4000-8000-000000000003','c@review-delete.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
('a1000000-0000-4000-8000-000000000011','Shared','shared','RVDEL001','a1000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000012','Personal','personal','RVDEL002','a1000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000001','owner'),
('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','member'),
('a1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000001','owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select public.set_space_module_enabled('a1000000-0000-4000-8000-000000000011','review',true);
select public.set_space_module_enabled('a1000000-0000-4000-8000-000000000012','review',true);
select public.create_review_round('a1000000-0000-4000-8000-000000000011','2030-01-01');
select public.create_review_round('a1000000-0000-4000-8000-000000000011','2030-01-02');
select public.create_review_round('a1000000-0000-4000-8000-000000000011','2030-01-03');
select public.create_review_round('a1000000-0000-4000-8000-000000000012','2030-01-01');
reset role;
create temp table targets as select id,space_id,round_no,review_date from public.review_rounds where space_id in ('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000012');
grant select on targets to authenticated;
create temp table unchanged as select to_jsonb(r) as payload from public.review_rounds r where space_id='a1000000-0000-4000-8000-000000000011' and round_no<>2;
set local role authenticated;
select public.save_my_review_entry((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=1),null,null,null,'earlier');
select public.save_my_review_entry((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2),null,null,null,'deleted plan');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2))$$,'P0001','Current review participant membership is required','nonmember cannot delete');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000012'))$$,'P0001','Current review participant membership is required','other member cannot delete Personal');
select public.save_my_review_entry((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2),'B content',null,null,null);
select is(public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2)),(select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2),'B can delete A-created whole Shared review');
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=2))$$,'P0001','Review not found','repeat delete is not reported successful');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select is(public.get_my_previous_review_plan((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=3)),'earlier','previous plan skips deleted round by date');
select is((select string_agg(round_no::text,',' order by round_no) from public.review_rounds where space_id='a1000000-0000-4000-8000-000000000011'),'1,3','surviving round numbers are not renumbered');
select public.set_space_module_enabled('a1000000-0000-4000-8000-000000000011','review',false);
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=1))$$,'P0001','Review module is disabled','disabled module cannot be mutated');
select public.set_space_module_enabled('a1000000-0000-4000-8000-000000000011','review',true);
select lives_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000012'))$$,'owner can delete Personal review');
reset role;
select is((select count(*) from public.review_entries where review_id in(select id from targets where (space_id='a1000000-0000-4000-8000-000000000011' and round_no=2) or space_id='a1000000-0000-4000-8000-000000000012')),0::bigint,'all deleted reviews entries cascade');
select is((select count(*) from public.review_entries e left join public.review_rounds r on r.id=e.review_id where r.id is null),0::bigint,'no orphan entry');
select ok(not exists(select payload from unchanged except select to_jsonb(r) from public.review_rounds r),'other round rows untouched');
-- Removal and replacement-member snapshot checks reuse the actual membership rule.
delete from public.space_members where space_id='a1000000-0000-4000-8000-000000000011' and user_id='a1000000-0000-4000-8000-000000000002';
insert into public.space_members(space_id,user_id,role) values ('a1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000003','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=1))$$,'P0001','Current review participant membership is required','removed participant denied');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.delete_review_round((select id from targets where space_id='a1000000-0000-4000-8000-000000000011' and round_no=1))$$,'P0001','Current review participant membership is required','new nonparticipant denied consistently with existing Review access');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.delete_review_round((select id from targets limit 1))$$,'P0001','Actor and review are required','missing actor denied');
select * from finish();
rollback;
