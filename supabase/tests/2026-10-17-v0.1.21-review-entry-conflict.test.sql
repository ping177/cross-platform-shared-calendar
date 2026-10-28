begin;
select no_plan();
select ok(to_regprocedure('public.save_my_review_entry(uuid,text,text,text,text,bigint)') is not null,'checked save exists');
select ok(to_regprocedure('public.mark_my_review_filled(uuid,bigint)') is not null,'checked marker exists');
insert into auth.users(id,email) values
('d2100000-0000-4000-8000-000000000001','owner@cas.invalid'),
('d2100000-0000-4000-8000-000000000002','other@cas.invalid'),
('d2100000-0000-4000-8000-000000000003','outsider@cas.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
('d2100000-0000-4000-8000-000000000010','CAS','shared','CASFIXTURE','d2100000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('d2100000-0000-4000-8000-000000000010','d2100000-0000-4000-8000-000000000001','owner'),
('d2100000-0000-4000-8000-000000000010','d2100000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
select public.set_space_module_enabled('d2100000-0000-4000-8000-000000000010','review',true);
select set_config('test.cas_review',(public.create_review_round('d2100000-0000-4000-8000-000000000010','2030-01-01')).id::text,true);
select is((select content_revision from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),0::bigint,'new blank entry starts at zero');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,0)$$,'P0001','Blank review entry cannot be marked filled','blank cannot mark');
select lives_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',0)$$,'normal initial save');
select is((select content_revision from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),1::bigint,'content revision increments');
select set_config('test.cas_row',(select row_to_json(review_entries)::text from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),true);
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Desktop','Progress','Problem','Plan',0)$$,'P0001','REVIEW_ENTRY_CONFLICT','stale same-field save rejected');
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Old focus','Different field','Problem','Plan',0)$$,'P0001','REVIEW_ENTRY_CONFLICT','stale different-field full draft rejected');
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',0)$$,'P0001','REVIEW_ENTRY_CONFLICT','stale identical payload is still conflict');
select lives_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',1)$$,'same-version same-content no-op');
select is((select row_to_json(review_entries)::text from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),current_setting('test.cas_row'),'rejected and no-op requests leave entire row unchanged');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,0)$$,'P0001','REVIEW_ENTRY_CONFLICT','stale marker cannot acknowledge unseen content');
select lives_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,1)$$,'current marker succeeds');
select lives_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,1)$$,'current marker is idempotent');
select is((select filled_revision from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),1::bigint,'marker follows content');
select lives_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'New focus','Progress','Problem','Plan',1)$$,'save after marker with same content version allowed');
select is((select content_revision-filled_revision from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),1::bigint,'updated status retains previous filled revision');
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',null)$$,'22023','Expected content revision is required','invalid expected save rejected');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,null)$$,'22023','Expected content revision is required','invalid expected marker rejected');
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',-1)$$,'22023','Expected content revision is required','invalid expected save rejected');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,-1)$$,'22023','Expected content revision is required','invalid expected marker rejected');
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Legacy',null,null,null)$$,'P0001','应用版本已更新，请先保留未保存的输入，再刷新应用后重试。','old save cannot write');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid)$$,'P0001','应用版本已更新，请先保留未保存的输入，再刷新应用后重试。','old marker cannot write');
select set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Other participant','Progress','Problem','Plan',0)$$,'other participant uses independent zero revision');
select is((select content_revision from public.review_entries where review_id=current_setting('test.cas_review')::uuid and user_id=auth.uid()),1::bigint,'other participant revision is independent');
select set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',0)$$,'P0001','Current review participant membership is required','outsider cannot save');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,0)$$,'P0001','Current review participant membership is required','outsider cannot mark');
select set_config('request.jwt.claim.sub','d2100000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.correct_review_date(current_setting('test.cas_review')::uuid,'2030-01-02')$$,'date correction remains independent');
select lives_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'New focus','Progress','Problem','Plan',2)$$,'date correction does not change content baseline');
select public.set_space_module_enabled('d2100000-0000-4000-8000-000000000010','review',false);
select throws_ok($$select public.save_my_review_entry(current_setting('test.cas_review')::uuid,'Phone','Progress','Problem','Plan',2)$$,'P0001','Review module is disabled','disabled module save denied');
select throws_ok($$select public.mark_my_review_filled(current_setting('test.cas_review')::uuid,2)$$,'P0001','Review module is disabled','disabled module mark denied');
select throws_ok($$select public.save_my_review_entry('d2100000-0000-4000-8000-000000000099','x',null,null,null,0)$$,'P0001','Review not found','missing review is not reported as a conflict');
select throws_ok($$select public.mark_my_review_filled('d2100000-0000-4000-8000-000000000099',0)$$,'P0001','Review not found','missing review cannot be marked');
reset role;
select ok(not has_function_privilege('anon','public.save_my_review_entry(uuid,text,text,text,text,bigint)','EXECUTE'),'anon cannot execute checked save_my_review_entry');
select ok(not has_function_privilege('service_role','public.save_my_review_entry(uuid,text,text,text,text,bigint)','EXECUTE'),'service_role cannot execute checked save_my_review_entry');
select ok(has_function_privilege('authenticated','public.save_my_review_entry(uuid,text,text,text,text,bigint)','EXECUTE'),'authenticated can execute checked save_my_review_entry');
select ok(not has_function_privilege('anon','public.mark_my_review_filled(uuid,bigint)','EXECUTE'),'anon cannot execute checked mark_my_review_filled');
select ok(not has_function_privilege('service_role','public.mark_my_review_filled(uuid,bigint)','EXECUTE'),'service_role cannot execute checked mark_my_review_filled');
select ok(has_function_privilege('authenticated','public.mark_my_review_filled(uuid,bigint)','EXECUTE'),'authenticated can execute checked mark_my_review_filled');
select * from finish();
rollback;
