begin;
select no_plan();

select ok(to_regclass('public.lists') is not null,'Lists table exists');
select ok(to_regclass('public.list_sections') is not null,'Sections table exists');
select ok(to_regclass('public.list_items') is not null,'Items table exists');
select ok((select count(*)=3 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('lists','list_sections','list_items')),'three Lists tables are published');
select ok((select count(*)=3 from pg_class where oid in ('public.lists'::regclass,'public.list_sections'::regclass,'public.list_items'::regclass) and relreplident='f'),'three Lists tables have FULL replica identity');
select ok((select count(*)=3 from pg_class where oid in ('public.lists'::regclass,'public.list_sections'::regclass,'public.list_items'::regclass) and relrowsecurity),'three Lists tables use RLS');
select ok(not exists (select 1 from pg_constraint where conrelid in ('public.lists'::regclass,'public.list_sections'::regclass,'public.list_items'::regclass) and confrelid in ('auth.users'::regclass,'public.profiles'::regclass,'public.space_members'::regclass)),'creator audit has no cascading identity or membership FK');
select ok(not has_table_privilege('authenticated','public.list_items','INSERT,DELETE,TRUNCATE'),'Items have no direct structural grant');
select ok(not has_table_privilege('authenticated','public.lists','DELETE,TRUNCATE'),'Lists have no direct delete or truncate');
select ok(has_column_privilege('authenticated','public.list_items','content','UPDATE'),'content is directly editable');
select ok(not has_column_privilege('authenticated','public.list_items','completed','UPDATE'),'completion is RPC only');
select ok(not has_column_privilege('authenticated','public.list_items','section_id','UPDATE'),'Section movement is not directly editable');
select ok(not has_column_privilege('authenticated','public.list_items','sort_order','UPDATE'),'item order is not directly editable');
select ok(not has_column_privilege('authenticated','public.list_items','updated_at','UPDATE'),'Item timestamp is not directly editable');
select ok(not has_column_privilege('authenticated','public.list_sections','sort_order','UPDATE'),'Section order is not directly editable');
select ok(not has_function_privilege('authenticated','public.lock_writable_list(uuid)','EXECUTE'),'internal lock helper is private');
select ok(has_function_privilege('authenticated','public.set_list_item_completed(uuid,boolean)','EXECUTE'),'authenticated may call completion RPC');
select ok(not has_function_privilege('anon','public.set_list_item_completed(uuid,boolean)','EXECUTE'),'anon cannot call completion RPC');
select ok(not has_function_privilege('service_role','public.set_list_item_completed(uuid,boolean)','EXECUTE'),'service role cannot call completion RPC');
select ok(not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='space_modules'),'module table remains outside Realtime publication');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('95000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lists-a@example.invalid','not-used',now(),'{}','{}',now(),now()),
('95000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lists-b@example.invalid','not-used',now(),'{}','{}',now(),now()),
('95000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lists-c@example.invalid','not-used',now(),'{}','{}',now(),now());
insert into public.spaces(id,name,kind,invite_code,created_by) values
('95000000-0000-4000-8000-000000000011','Lists Personal','personal','LSTPERS1','95000000-0000-4000-8000-000000000001'),
('95000000-0000-4000-8000-000000000012','Lists Shared','shared','LSTSHAR1','95000000-0000-4000-8000-000000000001'),
('95000000-0000-4000-8000-000000000013','Lists Other','shared','LSTOTHR1','95000000-0000-4000-8000-000000000003'),
('95000000-0000-4000-8000-000000000014','Lists Delete','shared','LSTDELE1','95000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000001','owner'),
('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000001','owner'),
('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000002','member'),
('95000000-0000-4000-8000-000000000013','95000000-0000-4000-8000-000000000003','owner'),
('95000000-0000-4000-8000-000000000014','95000000-0000-4000-8000-000000000001','owner');
select ok(not exists(select 1 from public.space_modules where space_id in ('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000012') and module_key='lists'),'Lists defaults absent for Personal and Shared');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select throws_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012','Disabled')$$,'42501',null,'missing Lists module rejects creation');
select lives_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000011','lists',true)$$,'Personal owner enables Lists');
select lives_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000012','lists',true)$$,'Shared owner enables Lists');
select lives_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000014','lists',true)$$,'delete fixture enables Lists');
select throws_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000012','memo',true)$$,'P0001','Only Tasks, Review, and Lists modules may be toggled in this version','unsupported key is rejected');
select lives_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000011','Personal List')$$,'Personal member creates List');
select lives_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012','Shared List')$$,'Shared owner creates List');
select is((select created_by from public.lists where name='Shared List'),'95000000-0000-4000-8000-000000000001'::uuid,'List creator derives from actor');
select throws_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012',' Bad ')$$,'23514',null,'List name must be trimmed');
select throws_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012',E'Bad\nLine')$$,'23514',null,'List name must be single line');
select throws_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012',repeat('x',201))$$,'23514',null,'List name length is bounded');
select set_config('test.lists_shared',(select id::text from public.lists where name='Shared List'),true);
select lives_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,'Section A')$$,'append Section A');
select lives_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,'Section B')$$,'append Section B');
select throws_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,' Bad Section')$$,'23514',null,'Section name must be trimmed');
select throws_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,E'Bad\nSection')$$,'23514',null,'Section name must be single line');
select throws_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,repeat('s',201))$$,'23514',null,'Section name length is bounded');
select is((select string_agg(name||':'||sort_order,',' order by sort_order) from public.list_sections where list_id=current_setting('test.lists_shared')::uuid),'Section A:1,Section B:2','Sections append contiguously');
select set_config('test.lists_section_a',(select id::text from public.list_sections where name='Section A' and list_id=current_setting('test.lists_shared')::uuid),true);
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'A')$$,'append ungrouped A');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'X')$$,'append ungrouped X');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'B')$$,'append ungrouped B');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'Y')$$,'append ungrouped Y');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'C')$$,'append ungrouped C');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_a')::uuid,'Grouped 1')$$,'append grouped Item');
select throws_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,' Bad Item')$$,'23514',null,'Item content must be trimmed');
select throws_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,E'Bad\nItem')$$,'23514',null,'Item content must be single line');
select throws_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,repeat('i',201))$$,'23514',null,'Item content length is bounded');
select is((select string_agg(content||':'||sort_order,',' order by sort_order) from public.list_items where list_id=current_setting('test.lists_shared')::uuid and section_id is null),'A:1,X:2,B:3,Y:4,C:5','ungrouped append is contiguous');
select is((select sort_order from public.list_items where content='Grouped 1'),1::bigint,'Section Item starts at one');
select throws_ok($$update public.list_items set completed=true where content='A'$$,'42501',null,'direct completion denied');
select throws_ok($$update public.list_items set content='A edit',completed=true where content='A'$$,'42501',null,'combined text and completion denied');
select throws_ok($$update public.list_items set sort_order=99 where content='A'$$,'42501',null,'direct sort edit denied');
select throws_ok($$update public.list_items set section_id=null where content='Grouped 1'$$,'42501',null,'direct Section move denied');
select lives_ok($$update public.list_items set content='Grouped 1 edited' where content='Grouped 1'$$,'content-only edit accepted');
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='X'),true)$$,'complete X');
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='Y'),true)$$,'complete Y');
select is((select string_agg(content||':'||sort_order,',' order by sort_order) from public.list_items where content in ('A','X','B','Y','C')),'A:1,X:2,B:3,Y:4,C:5','completion preserves sort slots');
select lives_ok($$select public.reorder_list_items(current_setting('test.lists_shared')::uuid,null,false,array(select id from public.list_items where content in ('C','A','B') order by case content when 'C' then 1 when 'A' then 2 else 3 end))$$,'reorder active Items');
select is((select string_agg(content||':'||sort_order,',' order by sort_order) from public.list_items where content in ('A','X','B','Y','C')),'C:1,X:2,A:3,Y:4,B:5','hidden completed slots survive active reorder');
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='X'),false)$$,'reopen X');
select is((select string_agg(content,',' order by sort_order) from public.list_items where content in ('A','X','B','Y','C') and not completed),'C,X,A,B','reopened X returns to canonical slot');
select is((select sort_order from public.list_items where content='X'),2::bigint,'reopen does not renumber X');
select throws_ok($$select public.reorder_list_items(current_setting('test.lists_shared')::uuid,null,false,array(select id from public.list_items where content in ('C','A','B') order by sort_order))$$,'P0001','Stale List Item order; reload','stale active set rejects reopened X');
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='C'),true)$$,'complete C for completed-group reorder');
select lives_ok($$select public.reorder_list_items(current_setting('test.lists_shared')::uuid,null,true,array(select id from public.list_items where content in ('Y','C') order by case content when 'Y' then 1 else 2 end))$$,'reorder completed Items');
select is((select string_agg(content||':'||sort_order,',' order by sort_order) from public.list_items where content in ('A','X','B','Y','C')),'Y:1,X:2,A:3,C:4,B:5','completed reorder preserves active canonical slots');
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='C'),false)$$,'reopen completed-reordered C');
select is((select sort_order from public.list_items where content='C'),4::bigint,'reopened completed-group Item retains its new canonical slot');

select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_a')::uuid,'Grouped 2')$$,'second Section Item appends');
select lives_ok($$select public.delete_list_section(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_a')::uuid,true)$$,'preserve-delete moves Section Items');
select is((select string_agg(content||':'||sort_order,',' order by sort_order) from public.list_items where content like 'Grouped %'),'Grouped 1 edited:6,Grouped 2:7','moved block is appended to ungrouped end in original order');
select is((select count(*) from public.list_items where content like 'Grouped %' and section_id is null),2::bigint,'moved Items are ungrouped');
select is((select string_agg(name||':'||sort_order,',' order by sort_order) from public.list_sections where list_id=current_setting('test.lists_shared')::uuid),'Section B:1','Section order compacts after preserve-delete');
select set_config('test.lists_section_b',(select id::text from public.list_sections where name='Section B' and list_id=current_setting('test.lists_shared')::uuid),true);
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_b')::uuid,'Destroyed 1')$$,'create destructive Section Item');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_b')::uuid,'Destroyed 2')$$,'create second destructive Section Item');
select lives_ok($$select public.delete_list_section(current_setting('test.lists_shared')::uuid,current_setting('test.lists_section_b')::uuid,false)$$,'destructive Section delete succeeds');
select is((select count(*) from public.list_items where content like 'Destroyed %'),0::bigint,'destructive Section delete cascades Items');
select is((select count(*) from public.list_sections where list_id=current_setting('test.lists_shared')::uuid),0::bigint,'deleted Sections are gone');
select lives_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,'One')$$,'append Section One');
select lives_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,'Two')$$,'append Section Two');
select lives_ok($$select public.create_list_section(current_setting('test.lists_shared')::uuid,'Three')$$,'append Section Three');
select lives_ok($$select public.reorder_list_sections(current_setting('test.lists_shared')::uuid,array(select id from public.list_sections where list_id=current_setting('test.lists_shared')::uuid order by case name when 'Three' then 1 when 'One' then 2 else 3 end))$$,'Section reorder succeeds');
select is((select string_agg(name||':'||sort_order,',' order by sort_order) from public.list_sections where list_id=current_setting('test.lists_shared')::uuid),'Three:1,One:2,Two:3','Sections have contiguous new order');
select throws_ok($$select public.reorder_list_sections(current_setting('test.lists_shared')::uuid,array(select id from public.list_sections where name in ('One','Two') order by name))$$,'P0001','Stale List Section order; reload','omitted Section rejects stale reorder');
select throws_ok($$select public.reorder_list_items(current_setting('test.lists_shared')::uuid,null,false,array(select id from public.list_items where content='C'))$$,'P0001','Stale List Item order; reload','omitted Item rejects stale reorder');
select lives_ok($$select public.delete_list_item(current_setting('test.lists_shared')::uuid,(select id from public.list_items where content='B'))$$,'delete single Item');
select is((select string_agg(sort_order::text,',' order by sort_order) from public.list_items where list_id=current_setting('test.lists_shared')::uuid and section_id is null),'1,2,3,4,5,6','Item deletion compacts ungrouped positions');
select throws_ok($$select public.set_list_item_completed('95000000-0000-4000-8000-000000000099',true)$$,'P0001','Item not found','missing Item completion rejected');
select throws_ok($$select public.set_list_item_completed((select id from public.list_items where content='C'),null)$$,'P0001','Item and explicit completion value are required','null completion rejected');
select throws_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,'95000000-0000-4000-8000-000000000099','Wrong Section')$$,'P0001','Section not found in List','foreign Section rejected by RPC');

reset role;
select throws_ok($$insert into public.list_items(list_id,space_id,content,sort_order,created_by) values (current_setting('test.lists_shared')::uuid,'95000000-0000-4000-8000-000000000011','Wrong Space',99,'95000000-0000-4000-8000-000000000001')$$,'23503',null,'Item Space must match parent List');
select throws_ok($$insert into public.list_items(list_id,space_id,section_id,content,sort_order,created_by) values ((select id from public.lists where name='Personal List'),'95000000-0000-4000-8000-000000000011',(select id from public.list_sections where name='One'),'Wrong List Section',1,'95000000-0000-4000-8000-000000000001')$$,'23503',null,'Item Section must belong to the same List');
select throws_ok($$update public.lists set space_id='95000000-0000-4000-8000-000000000011' where id=current_setting('test.lists_shared')::uuid$$,'P0001','List identity is immutable','List Space identity guarded');
select throws_ok($$update public.list_sections set list_id=(select id from public.lists where name='Personal List') where name='One'$$,'P0001','List Section identity is immutable','Section parent identity guarded');
select throws_ok($$update public.list_items set created_by='95000000-0000-4000-8000-000000000002' where content='C'$$,'P0001','List Item identity is immutable','Item creator identity guarded');

set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.lists where id=current_setting('test.lists_shared')::uuid),1::bigint,'second Shared member reads owner-created List');
select lives_ok($$update public.lists set name='Shared List edited' where id=current_setting('test.lists_shared')::uuid$$,'second Shared member renames owner-created List');
select lives_ok($$update public.list_sections set name='One edited' where name='One'$$,'second Shared member renames owner-created Section');
select lives_ok($$update public.list_items set content='C edited' where content='C'$$,'second Shared member edits owner-created Item');
select set_config('test.lists_member_target',(select id::text from public.list_items where content='C edited'),true);
select lives_ok($$select public.set_list_item_completed((select id from public.list_items where content='C edited'),true)$$,'second Shared member completes owner-created Item');
select is((select created_by from public.list_items where content='C edited'),'95000000-0000-4000-8000-000000000001'::uuid,'creator audit remains original actor');
select lives_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'Member Item')$$,'second Shared member creates Item');
select throws_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000012','lists',false)$$,'P0001','Only the Space owner may change modules','ordinary member cannot toggle Lists');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.lists where id=current_setting('test.lists_shared')::uuid),0::bigint,'non-member cannot read Shared List');
select is((select count(*) from public.list_items where list_id=current_setting('test.lists_shared')::uuid),0::bigint,'non-member cannot read Shared Items');
select throws_ok($$select public.set_list_item_completed(current_setting('test.lists_member_target')::uuid,false)$$,'P0001','Current List Space membership is required','non-member completion rejected');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000012','lists',false)$$,'owner disables Lists');
select is((select count(*) from public.lists where id=current_setting('test.lists_shared')::uuid),1::bigint,'historical List remains readable while disabled');
select is((select count(*) from public.list_items where list_id=current_setting('test.lists_shared')::uuid),7::bigint,'historical Items remain readable while disabled');
with blocked as (update public.list_items set content='Blocked edit' where content='C edited' returning id)
select is((select count(*) from blocked),0::bigint,'disabled module rejects direct text update');
select throws_ok($$select public.set_list_item_completed((select id from public.list_items where content='C edited'),false)$$,'P0001','Lists module is disabled','disabled module rejects completion');
select throws_ok($$select public.create_list_item(current_setting('test.lists_shared')::uuid,null,'Blocked create')$$,'P0001','Lists module is disabled','disabled module rejects RPC create');
select lives_ok($$select public.set_space_module_enabled('95000000-0000-4000-8000-000000000012','lists',true)$$,'owner re-enables Lists');
select lives_ok($$update public.list_items set content='C again' where content='C edited'$$,'historical Item writable again');

select lives_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000012','Delete List')$$,'create List delete fixture');
select set_config('test.lists_delete',(select id::text from public.lists where name='Delete List'),true);
select lives_ok($$select public.create_list_section(current_setting('test.lists_delete')::uuid,'Delete Section')$$,'create Section delete fixture');
select lives_ok($$select public.create_list_item(current_setting('test.lists_delete')::uuid,(select id from public.list_sections where list_id=current_setting('test.lists_delete')::uuid),'Delete Item')$$,'create Item delete fixture');
select lives_ok($$select public.delete_list(current_setting('test.lists_delete')::uuid)$$,'List delete RPC succeeds');
select is((select count(*) from public.list_sections where list_id=current_setting('test.lists_delete')::uuid),0::bigint,'List delete cascades Sections');
select is((select count(*) from public.list_items where list_id=current_setting('test.lists_delete')::uuid),0::bigint,'List delete cascades Items');
select lives_ok($$select public.transfer_space_ownership('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000002')$$,'transfer Shared ownership to B');
select is((select count(*) from public.list_items where list_id=current_setting('test.lists_shared')::uuid),7::bigint,'ownership transfer preserves Items');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.transfer_space_ownership('95000000-0000-4000-8000-000000000012','95000000-0000-4000-8000-000000000001')$$,'transfer Shared ownership back to A');
select lives_ok($$select public.leave_shared_space('95000000-0000-4000-8000-000000000012')$$,'B leaves Shared Space');
select is((select count(*) from public.lists where id=current_setting('test.lists_shared')::uuid),0::bigint,'former member loses List read');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.list_items where content='Member Item' and created_by='95000000-0000-4000-8000-000000000002'),1::bigint,'departed creator Item remains');

reset role;
insert into public.space_members(space_id,user_id,role) values ('95000000-0000-4000-8000-000000000014','95000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select lives_ok($$insert into public.lists(space_id,name) values ('95000000-0000-4000-8000-000000000014','Space Delete List')$$,'create Space-delete fixture List');
select set_config('test.lists_space_delete',(select id::text from public.lists where name='Space Delete List'),true);
select lives_ok($$select public.create_list_section(current_setting('test.lists_space_delete')::uuid,'Space Delete Section')$$,'create Space-delete fixture Section');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.create_list_item(current_setting('test.lists_space_delete')::uuid,(select id from public.list_sections where list_id=current_setting('test.lists_space_delete')::uuid),'Removed Creator Item')$$,'B creates fixture Item');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.remove_space_member('95000000-0000-4000-8000-000000000014','95000000-0000-4000-8000-000000000002')$$,'owner removes B');
select is((select count(*) from public.list_items where content='Removed Creator Item' and created_by='95000000-0000-4000-8000-000000000002'),1::bigint,'removed creator Item remains');
select lives_ok($$select public.delete_shared_space('95000000-0000-4000-8000-000000000014')$$,'owner deletes Shared Space');
reset role;
select is((select count(*) from public.lists where id=current_setting('test.lists_space_delete')::uuid),0::bigint,'Space delete cascades List');
select is((select count(*) from public.list_sections where list_id=current_setting('test.lists_space_delete')::uuid),0::bigint,'Space delete cascades Sections');
select is((select count(*) from public.list_items where list_id=current_setting('test.lists_space_delete')::uuid),0::bigint,'Space delete cascades Items');

select * from finish();
rollback;
