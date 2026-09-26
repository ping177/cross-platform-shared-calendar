begin;
select no_plan();

select ok(to_regclass('public.review_rounds') is not null, 'review rounds table exists');
select ok(to_regclass('public.review_entries') is not null, 'review entries table exists');
select ok(to_regprocedure('public.create_review_round(uuid,date)') is not null, 'create RPC exists');
select ok(to_regprocedure('public.correct_review_date(uuid,date)') is not null, 'date correction RPC exists');
select ok(to_regprocedure('public.save_my_review_entry(uuid,text,text,text,text)') is not null, 'entry save RPC exists');
select ok(to_regprocedure('public.mark_my_review_filled(uuid)') is not null, 'filled marker RPC exists');
select ok(not exists (
  select 1 from pg_constraint
  where conrelid='public.review_entries'::regclass
    and confrelid='public.space_members'::regclass
), 'participant snapshot has no cascading membership FK');
select ok(not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename in ('review_rounds','review_entries')
), 'review does not join Realtime publication');

insert into auth.users (
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('92000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-a@example.invalid','not-used',now(),'{}','{}',now(),now()),
('92000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-b@example.invalid','not-used',now(),'{}','{}',now(),now()),
('92000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-c@example.invalid','not-used',now(),'{}','{}',now(),now());
insert into public.spaces(id,name,kind,invite_code,created_by) values
('92000000-0000-4000-8000-000000000011','Personal A','personal','RVPERS01','92000000-0000-4000-8000-000000000001'),
('92000000-0000-4000-8000-000000000012','Shared X','shared','RVSHARE1','92000000-0000-4000-8000-000000000001'),
('92000000-0000-4000-8000-000000000013','Shared delete','shared','RVSHARE2','92000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('92000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000001','owner'),
('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000001','owner'),
('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000002','member'),
('92000000-0000-4000-8000-000000000013','92000000-0000-4000-8000-000000000001','owner'),
('92000000-0000-4000-8000-000000000013','92000000-0000-4000-8000-000000000002','member');

select ok((select relrowsecurity from pg_class where oid='public.review_rounds'::regclass),'rounds RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.review_entries'::regclass),'entries RLS enabled');
select ok(not has_table_privilege('authenticated','public.review_rounds','INSERT,UPDATE,DELETE,TRUNCATE'),'authenticated cannot write rounds directly');
select ok(not has_table_privilege('authenticated','public.review_entries','INSERT,UPDATE,DELETE,TRUNCATE'),'authenticated cannot write entries directly');
select ok(not has_table_privilege('anon','public.review_rounds','SELECT'),'anon cannot read rounds');
select ok(not has_table_privilege('service_role','public.review_entries','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'service role has no direct entry grant');
select ok(not has_table_privilege('service_role','public.review_rounds','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'service role has no direct round grant');
select ok(has_function_privilege('authenticated','public.create_review_round(uuid,date)','EXECUTE'),'authenticated can create through RPC');
select ok(not has_function_privilege('anon','public.create_review_round(uuid,date)','EXECUTE'),'anon cannot create through RPC');
select ok(not has_function_privilege('service_role','public.create_review_round(uuid,date)','EXECUTE'),'service role cannot invoke user create RPC');
select ok(not has_function_privilege('service_role','public.can_read_review_round(uuid)','EXECUTE'),'read helper has no service role grant');
select ok(to_regprocedure('public.create_review_round(uuid,date,integer)') is null,'client has no round number argument');
select ok(not has_table_privilege('authenticated','public.space_modules','UPDATE'),'module remains RPC-owned');
select is((select count(*) from public.space_modules where space_id='92000000-0000-4000-8000-000000000012' and module_key='review'),0::bigint,'review defaults absent');
select is((select enabled from public.space_modules where space_id='92000000-0000-4000-8000-000000000012' and module_key='tasks'),true,'tasks default unchanged');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000011',date '2026-09-26')$$,'P0001','Review module is disabled','missing review row denies Personal create');
select lives_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000011','review',true)$$,'owner enables Personal review');
select lives_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000012','review',true)$$,'owner enables Shared review');
select lives_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000013','review',true)$$,'owner enables delete fixture review');
select throws_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000012','important_dates',true)$$,'P0001','Only Tasks, Review, and Lists modules may be toggled in this version','other module remains unavailable');
select lives_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000011',date '2026-09-26')$$,'Personal round created');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000011'),1::bigint,'Personal snapshot has exactly one entry');
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000011'),E' \n\t',null,null,null)$$,'whitespace-only content may be saved');
select throws_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000011'))$$,'P0001','Blank review entry cannot be marked filled','whitespace-only entry cannot be marked');
select lives_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',date '2026-09-26')$$,'Shared round created');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012'),2::bigint,'Shared snapshot has exactly two entries');
select is((select round_no from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),1,'first round number is one');
select lives_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000013',date '2026-09-26')$$,'delete fixture round created');
select set_config('test.review_p1',(select id::text from public.review_rounds where space_id='92000000-0000-4000-8000-000000000011'),true);
select set_config('test.review_x1',(select id::text from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1),true);
select set_config('test.review_d1',(select id::text from public.review_rounds where space_id='92000000-0000-4000-8000-000000000013'),true);
select throws_ok($$insert into public.review_rounds(space_id,round_no,review_date,created_by) values ('92000000-0000-4000-8000-000000000012',99,current_date,auth.uid())$$,'42501',null,'direct round insert denied');
select throws_ok($$update public.review_rounds set review_date=current_date where space_id='92000000-0000-4000-8000-000000000012'$$,'42501',null,'direct round update denied');
select throws_ok($$delete from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'$$,'42501',null,'direct round delete denied');
select throws_ok($$insert into public.review_entries(review_id,user_id) values ((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),auth.uid())$$,'42501',null,'direct entry insert denied');
select throws_ok($$update public.review_entries set focus='bypass' where user_id=auth.uid()$$,'42501',null,'direct entry update denied');
select throws_ok($$delete from public.review_entries where user_id=auth.uid()$$,'42501',null,'direct entry delete denied');
select throws_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'))$$,'P0001','Blank review entry cannot be marked filled','empty entry cannot be marked');
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),'Focus',null,null,'Plan A')$$,'actor saves own content');
select is((select content_revision from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),1::bigint,'first content save increments revision');
select set_config('test.review_updated_at',(select updated_at::text from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),true);
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),'Focus',null,null,'Plan A')$$,'same content save accepted');
select is((select content_revision from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),1::bigint,'same content does not increment revision');
select is((select updated_at::text from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),current_setting('test.review_updated_at'),'same content does not touch updated_at');
select lives_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'))$$,'actor marks own entry');
select is((select filled_revision from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),1::bigint,'filled revision matches content');
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),'Focus changed',null,null,'Plan A')$$,'content may change after filled');
select is((select content_revision-filled_revision from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id=auth.uid()),1::bigint,'changed content is newer than filled');
select lives_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'))$$,'actor marks updated entry again');
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),null,null,null,null)$$,'all content can be cleared');
select throws_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'))$$,'P0001','Blank review entry cannot be marked filled','cleared entry cannot be marked');
select lives_ok($$select public.correct_review_date((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),date '2026-09-01')$$,'participant corrects review date');
select is((select round_no from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),1,'date correction keeps number');

select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000012','review',false)$$,'P0001','Only the Space owner may change modules','ordinary member cannot toggle');
select throws_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000011',current_date)$$,'P0001','Current Space membership is required','other user cannot create in Personal');
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000011'),0::bigint,'other user cannot read Personal review');
select lives_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),'B focus',null,null,'B plan')$$,'B saves own old entry');
select is((select content_revision from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id='92000000-0000-4000-8000-000000000001'),3::bigint,'B did not change A entry');
select lives_ok($$select public.correct_review_date(current_setting('test.review_x1')::uuid,date '2026-08-30')$$,'ordinary participant may correct date');
select lives_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',date '2026-09-02')$$,'B may create second Shared round');
select is((select max(round_no) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),2,'sequential number increments');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and r.round_no=2),2::bigint,'second round snapshot has two entries');
select lives_ok($$select public.leave_shared_space('92000000-0000-4000-8000-000000000012')$$,'B leaves Shared Space');
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),0::bigint,'former member cannot read rounds');
select throws_ok($$select public.correct_review_date(current_setting('test.review_x1')::uuid,current_date)$$,'P0001','Current review participant membership is required','former member cannot correct own old round');
select throws_ok($$select public.save_my_review_entry(current_setting('test.review_x1')::uuid,'former write',null,null,null)$$,'P0001','Current review participant membership is required','former member cannot save old entry');
select throws_ok($$select public.correct_review_date(current_setting('test.review_p1')::uuid,current_date)$$,'P0001','Current review participant membership is required','B cannot edit round in other Space');

reset role;
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012'),4::bigint,'leave preserves all historical entries');
select set_config('test.review_invite',(select invite_code from public.spaces where id='92000000-0000-4000-8000-000000000012'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and r.round_no=1),2::bigint,'remaining participant reads both historical entries');
select throws_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',current_date)$$,'P0001','Review participant count is incomplete','Shared single member cannot create');

select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',current_date)$$,'P0001','Current Space membership is required','nonmember cannot create in Shared Space');
select lives_ok($$select public.join_space_by_invite_code(current_setting('test.review_invite'))$$,'C joins after B leaves');
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),0::bigint,'new member cannot read old rounds');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012'),0::bigint,'new member cannot read old entries');
select throws_ok($$select public.correct_review_date(current_setting('test.review_x1')::uuid,current_date)$$,'P0001','Current review participant membership is required','C cannot correct old round');
select throws_ok($$select public.save_my_review_entry(current_setting('test.review_x1')::uuid,'bypass',null,null,null)$$,'P0001','Current review participant membership is required','C cannot save old round');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.review_x1')::uuid)$$,'P0001','Current review participant membership is required','C cannot mark old round');
reset role;
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and e.user_id='92000000-0000-4000-8000-000000000003'),0::bigint,'joining does not add old entry');

set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',date '2026-09-03')$$,'A creates new A/C round');
select is((select max(round_no) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),3,'new membership advances round number');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),1::bigint,'C sees only participated round');
select lives_ok($$select public.leave_shared_space('92000000-0000-4000-8000-000000000012')$$,'C leaves');
reset role;
select set_config('test.review_invite',(select invite_code from public.spaces where id='92000000-0000-4000-8000-000000000012'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.join_space_by_invite_code(current_setting('test.review_invite'))$$,'B rejoins');
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),2::bigint,'B regains own two old rounds, not A/C round');
select is((select next_plan from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012' and r.round_no=1 and e.user_id=auth.uid()),'B plan','B historical content retained');
select lives_ok($$select public.save_my_review_entry(current_setting('test.review_x1')::uuid,'B after rejoin',null,null,'B plan')$$,'rejoined historical participant can edit own old entry');

select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.remove_space_member('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000002')$$,'owner removes B');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012'),6::bigint,'remove preserves all historical entries');
select lives_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000012','review',false)$$,'owner disables review');
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012'),3::bigint,'disabled module leaves participant RLS read intact');
select throws_ok($$select public.correct_review_date((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1),current_date)$$,'P0001','Review module is disabled','disabled review denies date mutation');
select throws_ok($$select public.save_my_review_entry((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1),'x',null,null,null)$$,'P0001','Review module is disabled','disabled review denies content save');
select throws_ok($$select public.mark_my_review_filled((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1))$$,'P0001','Review module is disabled','disabled review denies marker');
select throws_ok($$select public.create_review_round('92000000-0000-4000-8000-000000000012',current_date)$$,'P0001','Review module is disabled','disabled review denies create');
select lives_ok($$select public.set_space_module_enabled('92000000-0000-4000-8000-000000000012','review',true)$$,'review re-enabled');
select lives_ok($$select public.correct_review_date((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1),date '2026-08-31')$$,'date correction resumes after re-enable');
select lives_ok($$select public.transfer_space_ownership('92000000-0000-4000-8000-000000000013','92000000-0000-4000-8000-000000000002')$$,'ownership transfer remains compatible');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000013'),2::bigint,'transfer does not rewrite participants');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.delete_shared_space('92000000-0000-4000-8000-000000000013')$$,'new owner deletes Shared Space');
reset role;
select is((select count(*) from public.review_rounds where space_id='92000000-0000-4000-8000-000000000013'),0::bigint,'Space delete cascades rounds');
select is((select count(*) from public.review_entries where review_id=current_setting('test.review_d1')::uuid),0::bigint,'Space delete cascades entries');
select throws_ok($$update public.review_rounds set round_no=99 where space_id='92000000-0000-4000-8000-000000000012' and round_no=1$$,'P0001','Review round identity is immutable','round number immutable even for privileged update');
select throws_ok($$update public.review_rounds set space_id='92000000-0000-4000-8000-000000000011' where id=current_setting('test.review_x1')::uuid$$,'P0001','Review round identity is immutable','round Space identity immutable');
select throws_ok($$update public.review_rounds set created_by='92000000-0000-4000-8000-000000000002' where id=current_setting('test.review_x1')::uuid$$,'P0001','Review round identity is immutable','round creator immutable');
select throws_ok($$update public.review_entries set user_id='92000000-0000-4000-8000-000000000003' where user_id='92000000-0000-4000-8000-000000000002'$$,'P0001','Review participant identity is immutable','participant immutable even for privileged update');
select throws_ok($$update public.review_entries set review_id=current_setting('test.review_d1')::uuid where review_id=current_setting('test.review_x1')::uuid$$,'P0001','Review participant identity is immutable','entry round identity immutable');
select throws_ok($$insert into public.review_rounds(space_id,round_no,review_date,created_by) values ('92000000-0000-4000-8000-000000000012',1,current_date,'92000000-0000-4000-8000-000000000001')$$,'23505',null,'Space round number unique');
select throws_ok($$insert into public.review_entries(review_id,user_id) values ((select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1),'92000000-0000-4000-8000-000000000001')$$,'23505',null,'participant entry unique');
select throws_ok($$insert into public.review_entries(review_id,user_id) values ('92000000-0000-4000-8000-000000000099','92000000-0000-4000-8000-000000000001')$$,'23503',null,'entry requires parent round');
select throws_ok($$insert into public.review_rounds(space_id,round_no,review_date,created_by) values ('92000000-0000-4000-8000-000000000099',10,current_date,'92000000-0000-4000-8000-000000000001')$$,'23503',null,'round requires parent Space');
select throws_ok($$insert into public.review_rounds(space_id,round_no,review_date,created_by) values ('92000000-0000-4000-8000-000000000012',0,current_date,'92000000-0000-4000-8000-000000000001')$$,'23514',null,'round number positive');
select throws_ok($$update public.review_entries set filled_revision=content_revision+1 where review_id=(select id from public.review_rounds where space_id='92000000-0000-4000-8000-000000000012' and round_no=1) and user_id='92000000-0000-4000-8000-000000000001'$$,'23514',null,'filled revision cannot exceed content');
select is((select count(*) from public.review_entries e join public.review_rounds r on r.id=e.review_id where r.space_id='92000000-0000-4000-8000-000000000012'),6::bigint,'all historical snapshots remain after membership changes');

select * from finish();
rollback;
