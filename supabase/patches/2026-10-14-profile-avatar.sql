-- Avatar v1: additive Profile metadata and private Storage policies.
-- Apply only after reviewed preflight; no Production execution authorized in this task.
begin;
do $preflight$
begin
  if to_regclass('public.profiles') is null or to_regclass('storage.objects') is null
    or to_regprocedure('public.are_users_in_same_space(uuid,uuid)') is null then
    raise exception 'Required Profile / Storage / same-space baseline is missing';
  end if;
  if not exists (select 1 from pg_class where oid='public.profiles'::regclass and relrowsecurity)
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles'
      and policyname='profiles_update_self' and cmd='UPDATE'
      and qual='(id = auth.uid())' and with_check='(id = auth.uid())') then
    raise exception 'Profile self-update RLS baseline drift';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles'
    and column_name in ('avatar_preset','avatar_path')) then
    raise exception 'Avatar columns already exist; do not replay this patch';
  end if;
end;
$preflight$;
alter table public.profiles
  add column avatar_preset text constraint profiles_avatar_preset_check check (
    avatar_preset is null or avatar_preset in ('cat','rabbit','bear','fox','dog','bird','flower','leaf','moon','star','cloud','sun')
  ),
  add column avatar_path text constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ),
  add constraint profiles_avatar_source_check check (avatar_preset is null or avatar_path is null);
-- Private avatar Storage contract. Existing Space/Profile RLS is unchanged.
do $avatar_storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage schema absent: avatar bucket provisioning skipped in this database';
    return;
  end if;
  -- Permissive policies combine with OR. Do not silently add avatar policies
  -- beside unknown policies that might expose or mutate this private bucket.
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and permissive='PERMISSIVE' and roles && array['public','anon','authenticated']::name[]) then
    raise exception 'Storage policy baseline requires review before Avatar v1';
  end if;
  if exists (select 1 from storage.buckets where id='profile-avatars') then
    raise exception 'Avatar bucket already exists; inspect rather than overwrite configuration';
  end if;
  if not exists (select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity) then
    raise exception 'Storage objects RLS must already be enabled';
  end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values ('profile-avatars','profile-avatars',false,1048576,array['image/jpeg']);
  execute $policy$create policy avatars_read on storage.objects for select to authenticated using (
    bucket_id='profile-avatars' and (
      name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
      or exists (select 1 from public.profiles p where p.avatar_path=name
        and public.are_users_in_same_space(auth.uid(),p.id))
    )
  )$policy$;
  execute $policy$create policy avatars_insert_self on storage.objects for insert to authenticated with check (
    bucket_id='profile-avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  )$policy$;
  execute $policy$create policy avatars_delete_unused_self on storage.objects for delete to authenticated using (
    bucket_id='profile-avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.avatar_path=name)
  )$policy$;
end;
$avatar_storage$;

commit;
