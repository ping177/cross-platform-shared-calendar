begin;
set local search_path=public,extensions;
select no_plan();

insert into auth.users(id,email) values
('98000000-0000-4000-8000-000000000001','rename-owner@example.invalid'),
('98000000-0000-4000-8000-000000000002','rename-member@example.invalid'),
('98000000-0000-4000-8000-000000000003','rename-outsider@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
('98000000-0000-4000-8000-000000000011','旧共享名称','shared','RENAMES1','98000000-0000-4000-8000-000000000001'),
('98000000-0000-4000-8000-000000000012','旧个人名称','personal','RENAMEP1','98000000-0000-4000-8000-000000000001'),
('98000000-0000-4000-8000-000000000013',repeat('旧',90),'shared','RENAMEL1','98000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('98000000-0000-4000-8000-000000000011','98000000-0000-4000-8000-000000000001','owner'),
('98000000-0000-4000-8000-000000000011','98000000-0000-4000-8000-000000000002','member'),
('98000000-0000-4000-8000-000000000012','98000000-0000-4000-8000-000000000001','owner'),
('98000000-0000-4000-8000-000000000013','98000000-0000-4000-8000-000000000001','owner');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select public.set_space_module_enabled('98000000-0000-4000-8000-000000000011','lists',true);
select public.set_space_module_enabled('98000000-0000-4000-8000-000000000011','review',true);
select public.set_space_module_enabled('98000000-0000-4000-8000-000000000011','important_dates',true);
insert into public.events(space_id,scope,title,starts_at) values ('98000000-0000-4000-8000-000000000011','shared','保留事件',now()+interval '1 day');
insert into public.tasks(space_id,title) values ('98000000-0000-4000-8000-000000000011','保留任务');
insert into public.lists(space_id,name) values ('98000000-0000-4000-8000-000000000011','保留清单');
select public.create_review_round('98000000-0000-4000-8000-000000000011',current_date);
select public.create_important_date('98000000-0000-4000-8000-000000000011','保留重要日',null,'annual',10,14,null,'UTC');

create function pg_temp.related_rows() returns jsonb language sql as $$
select jsonb_build_object(
  'spaces',(select jsonb_agg(to_jsonb(s)-'name' order by id) from public.spaces s),
  'members',(select jsonb_agg(to_jsonb(m) order by space_id,user_id) from public.space_members m),
  'modules',(select jsonb_agg(to_jsonb(m) order by space_id,module_key) from public.space_modules m),
  'events',(select jsonb_agg(to_jsonb(e) order by id) from public.events e),
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.tasks t),
  'lists',(select jsonb_agg(to_jsonb(l) order by id) from public.lists l),
  'reviews',(select jsonb_agg(to_jsonb(r) order by id) from public.review_rounds r),
  'dates',(select jsonb_agg(to_jsonb(d) order by id) from public.important_dates d));
$$;
create temp table before_rename as select pg_temp.related_rows() as rows;
grant select on before_rename to authenticated;

set local role authenticated;
select lives_ok($$update public.spaces set name=U&'\0009\00A0新共享名称\FEFF\3000' where id='98000000-0000-4000-8000-000000000011'$$,'Shared owner can rename directly');
select is((select name from public.spaces where id='98000000-0000-4000-8000-000000000011'),'新共享名称','ECMAScript whitespace trimmed server-side');
select lives_ok($$update public.spaces set name='新个人名称' where id='98000000-0000-4000-8000-000000000012'$$,'Personal owner can rename');
select lives_ok($$update public.spaces set name=repeat('🌿',80) where id='98000000-0000-4000-8000-000000000012'$$,'80 Unicode code points allowed');
select throws_ok($$update public.spaces set name=repeat('🌿',81) where id='98000000-0000-4000-8000-000000000012'$$,'22023','Space name must contain 1–80 Unicode characters','81 code points rejected');
select throws_ok($$update public.spaces set name='' where id='98000000-0000-4000-8000-000000000011'$$,'22023','Space name must contain 1–80 Unicode characters','empty rejected');
select throws_ok($$update public.spaces set name=U&'\0009\00A0\FEFF\3000' where id='98000000-0000-4000-8000-000000000011'$$,'22023','Space name must contain 1–80 Unicode characters','Unicode whitespace-only rejected');
select throws_ok($$update public.spaces set name=null where id='98000000-0000-4000-8000-000000000011'$$,'22023','Space name must contain 1–80 Unicode characters','null rejected');
select is((select name from public.spaces where id='98000000-0000-4000-8000-000000000011'),'新共享名称','failed validation preserves canonical name');
select lives_ok($$update public.spaces set invite_code=invite_code where id='98000000-0000-4000-8000-000000000013'$$,'non-name update of long legacy name remains valid');
select is((select char_length(name) from public.spaces where id='98000000-0000-4000-8000-000000000013'),90,'historical long name not normalized');
select throws_ok($$update public.spaces set invite_code='NEWPRIVATE' where id='98000000-0000-4000-8000-000000000012'$$,'P0001','Personal Space invite code is immutable','Personal invite guard retained');
select throws_ok($$update public.spaces set kind='personal' where id='98000000-0000-4000-8000-000000000011'$$,'P0001','Space kind is immutable','kind guard retained');

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select throws_ok($$update public.spaces set name='越权名称' where id='98000000-0000-4000-8000-000000000011'$$,'42501','Only the Space owner may change its name','Shared member cannot bypass UI with direct UPDATE');
select lives_ok($$update public.spaces set name=name where id='98000000-0000-4000-8000-000000000011'$$,'identical name skips new validation');
select lives_ok($$update public.spaces set name='其他人的个人空间' where id='98000000-0000-4000-8000-000000000012'$$,'non-owner Personal UPDATE affects no visible row');
select is((select count(*) from public.spaces where id='98000000-0000-4000-8000-000000000012'),0::bigint,'non-owner Personal Space hidden by existing RLS');

reset role;
select is(pg_temp.related_rows(),(select rows from before_rename),'renames preserve IDs, membership, invite codes, ownership and business objects');
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.transfer_space_ownership('98000000-0000-4000-8000-000000000011','98000000-0000-4000-8000-000000000002')$$,'existing Owner Transfer unchanged');
select throws_ok($$update public.spaces set name='旧Owner越权' where id='98000000-0000-4000-8000-000000000011'$$,'42501','Only the Space owner may change its name','former owner loses rename right');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select lives_ok($$update public.spaces set name='新Owner名称' where id='98000000-0000-4000-8000-000000000011'$$,'new owner can rename despite different created_by');
select is((select created_by::text from public.spaces where id='98000000-0000-4000-8000-000000000011'),'98000000-0000-4000-8000-000000000001','creator unchanged after transfer and rename');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.rotate_invite_code('98000000-0000-4000-8000-000000000011')$$,'ordinary member invite rotation remains permitted');
select lives_ok($$update public.spaces set invite_code='MEMBEROK' where id='98000000-0000-4000-8000-000000000011'$$,'existing non-name member UPDATE permission retained');
select set_config('request.jwt.claim.sub','',true);
reset role;
select throws_ok($$update public.spaces set name='无用户名称' where id='98000000-0000-4000-8000-000000000011'$$,'42501','Only the Space owner may change its name','missing actor rejected even outside RLS');
select is((select name from public.spaces where id='98000000-0000-4000-8000-000000000011'),'新Owner名称','canonical reread persists confirmed name');
select * from finish();
rollback;
