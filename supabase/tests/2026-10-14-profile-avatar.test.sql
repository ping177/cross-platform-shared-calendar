begin;
select plan(27);
select set_config('storage.allow_delete_query','true',true);
insert into auth.users(id,email) values
 ('aa000000-0000-4000-8000-000000000001','avatar-a@example.invalid'),
 ('aa000000-0000-4000-8000-000000000002','avatar-b@example.invalid'),
 ('aa000000-0000-4000-8000-000000000003','avatar-c@example.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values
 ('aa000000-0000-4000-8000-000000000011','Avatar test','shared','AVATARTEST','aa000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values
 ('aa000000-0000-4000-8000-000000000011','aa000000-0000-4000-8000-000000000001','owner'),
 ('aa000000-0000-4000-8000-000000000011','aa000000-0000-4000-8000-000000000002','member');
select is((select public from storage.buckets where id='profile-avatars'),false,'avatar bucket is private');
select is((select file_size_limit from storage.buckets where id='profile-avatars'),1048576::bigint,'bucket output cap is 1 MiB');
select is((select allowed_mime_types from storage.buckets where id='profile-avatars'),array['image/jpeg'],'bucket allows only re-encoded JPEG');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars_%'),3::bigint,'only three scoped policies');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd='UPDATE'),0::bigint,'immutable photos have no update policy');
set local role authenticated;
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select is((select avatar_path from public.profiles where id=auth.uid()),null,'legacy default has no photo');
select lives_ok($$update public.profiles set avatar_preset='cat' where id=auth.uid()$$,'owner chooses preset');
select throws_ok($$update public.profiles set avatar_preset='emoji' where id=auth.uid()$$,'23514',null,'unknown preset rejected');
select throws_ok($$update public.profiles set avatar_path='../x.jpg' where id=auth.uid()$$,'23514',null,'traversal rejected');
select throws_ok($$update public.profiles set avatar_path='aa000000-0000-4000-8000-000000000002/bb000000-0000-4000-8000-000000000001.jpg' where id=auth.uid()$$,'23514',null,'foreign photo path rejected');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('profile-avatars','aa000000-0000-4000-8000-000000000001/bb000000-0000-4000-8000-000000000001.jpg'),('profile-avatars','aa000000-0000-4000-8000-000000000001/bb000000-0000-4000-8000-000000000002.jpg')$$,'owner uploads immutable paths');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('profile-avatars','aa000000-0000-4000-8000-000000000002/bb000000-0000-4000-8000-000000000001.jpg')$$,'42501',null,'cannot upload to another user');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('profile-avatars','aa000000-0000-4000-8000-000000000001/photo.svg')$$,'42501',null,'noncanonical file path rejected');
select throws_ok($$update public.profiles set avatar_path='aa000000-0000-4000-8000-000000000001/bb000000-0000-4000-8000-000000000001.jpg' where id=auth.uid()$$,'23514',null,'preset and photo cannot coexist');
select lives_ok($$update public.profiles set avatar_preset=null,avatar_path='aa000000-0000-4000-8000-000000000001/bb000000-0000-4000-8000-000000000001.jpg' where id=auth.uid()$$,'owner publishes photo');
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),2::bigint,'owner reads active and unreferenced own photos');
with removed as (delete from storage.objects where bucket_id='profile-avatars' returning id) select is((select count(*) from removed),1::bigint,'cleanup removes only unreferenced photo');
with changed as (update storage.objects set metadata='{}' where bucket_id='profile-avatars' returning id) select is((select count(*) from changed),0::bigint,'photo cannot be overwritten');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),1::bigint,'current same-space member reads active photo');
with changed as (update public.profiles set avatar_preset='dog',avatar_path=null where id='aa000000-0000-4000-8000-000000000001' returning id) select is((select count(*) from changed),0::bigint,'member cannot edit another profile');
with removed as (delete from storage.objects where bucket_id='profile-avatars' returning id) select is((select count(*) from removed),0::bigint,'member cannot delete another photo');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000003',true);
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),0::bigint,'outsider cannot read photo');
reset role;
delete from public.space_members where user_id='aa000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),0::bigint,'removed member cannot read or sign new URLs');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),0::bigint,'anon cannot read photo');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select lives_ok($$update public.profiles set avatar_path=null,avatar_preset=null where id=auth.uid()$$,'owner restores default');
with removed as (delete from storage.objects where bucket_id='profile-avatars' returning id) select is((select count(*) from removed),1::bigint,'restored default allows old photo cleanup');
select is((select count(*) from storage.objects where bucket_id='profile-avatars'),0::bigint,'no photo remains after cleanup');
select * from finish();
rollback;
