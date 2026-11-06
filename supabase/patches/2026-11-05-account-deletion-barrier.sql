-- Slice 2 local contract. No application role may prepare/accept/advance a job.
-- OTP-backed acceptance and a verified finalizer must be integrated separately.
begin;
do $preflight$
begin
  if to_regnamespace('private') is not null then
    raise exception 'Private namespace already exists; inspect before applying';
  end if;
  if exists (select 1 from pg_constraint where contype='f'
    and conname in ('spaces_created_by_fkey','events_created_by_fkey',
      'tasks_created_by_fkey','review_rounds_created_by_fkey')) then
    raise exception 'Audit snapshot migration must precede account barrier';
  end if;
  -- Replaced function bodies must match the reviewed pre-barrier baseline.
  if (select count(*) from (values
    ('public.is_space_member(uuid)','fe14b15cfd531007bcfeff98359c53cb'),
    ('public.are_users_in_same_space(uuid,uuid)','72659b5f92b3f0db42f83ebfb38845e2'),
    ('public.can_read_review_round(uuid)','b84d89a43a7f3b41b98d408a3ba00c95'),
    ('public.ensure_personal_space()','5a0443ce56e48fc97286beeec613ce05'),
    ('public.join_space_by_invite_code(text)','3760c175a4ff5c1972b858e722272280'),
    ('public.get_my_previous_review_plan(uuid)','21af3a28d35c58df5a5a7a854180313d'),
    ('public.important_date_reminder_is_eligible(public.important_dates,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz)','6f71ff73d961945a33f14fc194afca28'),
    ('public.task_reminder_is_eligible(public.tasks,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz)','7f9b56b47a6a4661ff33142fa78e6d85'),
    ('public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)','970c56d90893135a18f54e1b2792a836')
  ) expected(signature,source_hash) join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where md5(p.prosrc)=expected.source_hash
      -- Exact reviewed v0.1.10 bodies: formatting-only canonical differences.
      -- Keep one expected row per signature and reject every other body.
      or (expected.signature='public.ensure_personal_space()'
        and md5(p.prosrc)='8a0d5b46299e724c5cfa25756504ec11')
      or (expected.signature='public.join_space_by_invite_code(text)'
        and md5(p.prosrc)='a3ef55f1c186a61ab9781a4a7446b4f6'))<>9 then
    raise exception 'Account barrier RPC baseline drift; inspect before replacing';
  end if;
  if (select count(*) from pg_class t join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relrowsecurity and t.relname in
      ('profiles','spaces','space_members','space_modules','events','tasks','event_occurrence_exceptions',
       'review_rounds','review_entries','lists','list_sections','list_items','important_dates','push_subscriptions','reminder_deliveries'))<>15 then
    raise exception 'Account barrier RLS baseline differs';
  end if;
end;
$preflight$;

-- ACCOUNT_DELETION_BARRIER_BEGIN
create schema private;
revoke all on schema private from public,anon,authenticated,service_role;

create table private.account_deletions (
  user_id uuid primary key,
  request_id uuid not null unique,
  status text not null default 'preparing' check (status in
    ('preparing','accepted','processing','completed','needs_attention')),
  phase text not null default 'pending' check (phase in
    ('pending','accepted','storage','business','auth','verify')),
  accepted_at timestamptz,
  completed_at timestamptz,
  generation bigint not null default 0 check (generation>=0),
  attempts integer not null default 0 check (attempts>=0),
  next_attempt_at timestamptz,
  lease_until timestamptz,
  error_code text check (error_code in ('RETRY_LATER','INVARIANT_FAILED','DEPENDENCY_UNAVAILABLE')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((status='preparing')=(accepted_at is null)),
  check ((status='completed')=(completed_at is not null))
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated,service_role;

create function private.guard_account_deletion_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.accepted_at is not null then raise exception 'Accepted deletion cannot be removed'; end if;
    return old;
  end if;
  if tg_op='INSERT' and new.status<>'preparing' then
    raise exception 'Deletion must start unaccepted';
  end if;
  if tg_op='UPDATE' then
    if row(new.user_id,new.request_id,new.created_at) is distinct from row(old.user_id,old.request_id,old.created_at)
      or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at)
      or new.generation<old.generation then
      raise exception 'Deletion identity and acceptance are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='preparing' and new.status='accepted')
      or (old.status='accepted' and new.status in ('processing','needs_attention'))
      or (old.status='processing' and new.status='needs_attention')
      or (old.status='needs_attention' and new.status='processing')) then
      raise exception 'Deletion transition is not available in this slice';
    end if;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;
create trigger account_deletions_guard before insert or update or delete on private.account_deletions
for each row execute function private.guard_account_deletion_state();

create function private.account_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select current_setting('transaction_isolation')='read committed'
    and p_user_id is not null and exists(select 1 from auth.users where id=p_user_id)
    and not exists(select 1 from private.account_deletions where user_id=p_user_id and accepted_at is not null);
$$;

create function private.lock_active_account(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_user_id is null then return false; end if;
  -- A stale REPEATABLE READ snapshot must never revive pre-acceptance state.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Account writes require READ COMMITTED' using errcode='0A000';
  end if;
  perform pg_advisory_xact_lock_shared(20261105,hashtext(p_user_id::text));
  -- Separate post-lock statement: fresh READ COMMITTED snapshot after waiting.
  return private.account_active(p_user_id);
end;
$$;

create function private.assert_active_account(p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if not private.lock_active_account(p_user_id) then
    raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501';
  end if;
end;
$$;

create function private.prepare_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare existing_request uuid;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  insert into private.account_deletions(user_id,request_id) values(p_user_id,p_request_id)
    on conflict(user_id) do nothing;
  select request_id into existing_request from private.account_deletions where user_id=p_user_id for update;
  if existing_request<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
  return existing_request;
end;
$$;

create function private.accept_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Account acceptance requires READ COMMITTED' using errcode='0A000';
  end if;
  -- Acceptance never waits on Space/business rows while holding this lock.
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not found then raise exception 'ACCOUNT_DELETION_INTENT_NOT_FOUND'; end if;
  if job.accepted_at is not null then return job.request_id; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=p_user_id and m.role='owner' and s.kind='shared') then
    raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION';
  end if;
  update private.account_deletions set status='accepted',phase='accepted',accepted_at=clock_timestamp(),
    next_attempt_at=clock_timestamp() where user_id=p_user_id;
  return job.request_id;
end;
$$;

create function private.set_account_deletion_status(p_request_id uuid,p_generation bigint,p_status text,p_error_code text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  select * into job from private.account_deletions where request_id=p_request_id for update;
  if not found or job.accepted_at is null then raise exception 'Accepted deletion is required'; end if;
  if job.generation is distinct from p_generation then return false; end if;
  if job.status=p_status then return true; end if;
  if p_status not in ('processing','needs_attention') then raise exception 'Finalizer is not available'; end if;
  update private.account_deletions set status=p_status,generation=generation+1,
    phase=case when phase='accepted' and p_status='processing' then 'storage' else phase end,
    attempts=attempts+case when p_status='processing' then 1 else 0 end,error_code=p_error_code
    where user_id=job.user_id;
  return true;
end;
$$;

revoke all on all functions in schema private from public,anon,authenticated,service_role;

create function public.current_account_active()
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select private.account_active(auth.uid());
$$;
revoke all on function public.current_account_active() from public,anon,authenticated,service_role;
grant execute on function public.current_account_active() to authenticated;

-- Service-only bounded prefilter: revoked recipients cannot consume the sender
-- candidate budget on every tick. This is not a client identity lookup API.
create function public.active_notification_accounts(p_user_ids uuid[])
returns setof uuid language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_user_ids is null or cardinality(p_user_ids)>100 then
    raise exception 'Invalid notification account batch' using errcode='22023';
  end if;
  return query select distinct u from unnest(p_user_ids) u where private.account_active(u) order by u;
end;
$$;
revoke all on function public.active_notification_accounts(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.active_notification_accounts(uuid[]) to service_role;

do $policies$
declare name text;
begin
  foreach name in array array['profiles','spaces','space_members','space_modules','events','tasks',
    'event_occurrence_exceptions','review_rounds','review_entries','lists','list_sections','list_items',
    'important_dates','push_subscriptions','reminder_deliveries'] loop
    execute format('create policy account_active_only on public.%I as restrictive for all to authenticated
      using (public.current_account_active()) with check (public.current_account_active())',name);
  end loop;
end;
$policies$;

create function private.guard_account_business_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); subject uuid;
begin
  -- SET ROLE is the database request role, unchanged by SECURITY DEFINER.
  -- Auth server bootstrap / privileged fixture SQL is not a user JWT request.
  if current_setting('role',true) in ('authenticated','anon') then
    perform private.assert_active_account(actor);
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_table_name='space_members' then
    if tg_op='INSERT' or row(new.user_id,new.role) is distinct from row(old.user_id,old.role) then
      subject:=new.user_id;
    end if;
  elsif tg_table_name='profiles' then
    if tg_op='INSERT' then subject:=new.id; end if;
  elsif tg_table_name='spaces' then
    if tg_op='INSERT' and new.kind='personal' then subject:=new.created_by; end if;
  elsif tg_table_name='events' then
    if new.scope='personal' and (tg_op='INSERT'
      or row(new.scope,new.owner_user_id) is distinct from row(old.scope,old.owner_user_id)) then
      subject:=new.owner_user_id;
    end if;
  elsif tg_table_name='tasks' then
    if new.assigned_to_user_id is not null and (tg_op='INSERT'
      or new.assigned_to_user_id is distinct from old.assigned_to_user_id) then
      subject:=new.assigned_to_user_id;
    end if;
  elsif tg_table_name='review_entries' then
    if tg_op='INSERT' then subject:=new.user_id; end if;
  elsif tg_table_name='push_subscriptions' then
    if tg_op='INSERT' or new.user_id is distinct from old.user_id then subject:=new.user_id; end if;
  elsif tg_table_name='reminder_deliveries' and tg_op='INSERT' then
    -- Existing claim RPCs represent ineligibility as null, not a sender failure.
    if not private.lock_active_account(new.recipient_user_id) then return null; end if;
  end if;
  if subject is not null then perform private.assert_active_account(subject); end if;
  return new;
end;
$$;
revoke all on function private.guard_account_business_write() from public,anon,authenticated,service_role;

do $guards$
declare name text;
begin
  foreach name in array array['profiles','spaces','space_members','space_modules','events','tasks',
    'event_occurrence_exceptions','review_rounds','review_entries','lists','list_sections','list_items',
    'important_dates','push_subscriptions','reminder_deliveries'] loop
    execute format('create trigger account_access_guard before insert or update or delete on public.%I
      for each row execute function private.guard_account_business_write()',name);
  end loop;
end;
$guards$;

create function private.guard_account_avatar_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.bucket_id='profile-avatars' and current_setting('role',true) in ('authenticated','anon') then
      perform private.assert_active_account(auth.uid());
    end if;
    return old;
  end if;
  if new.bucket_id='profile-avatars' then
    if current_setting('role',true) in ('authenticated','anon') then
      perform private.assert_active_account(auth.uid());
    end if;
    if new.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
      perform private.assert_active_account(split_part(new.name,'/',1)::uuid);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_account_avatar_write() from public,anon,authenticated,service_role;

do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Storage schema absent: avatar account barrier not installed';
    return;
  end if;
  if not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
    or (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('avatars_read','avatars_insert_self','avatars_delete_unused_self'))<>3
    or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and permissive='PERMISSIVE' and roles && array['public','anon','authenticated']::name[]
      and policyname not in ('avatars_read','avatars_insert_self','avatars_delete_unused_self')) then
    raise exception 'Avatar policy baseline requires review';
  end if;
  execute $policy$create policy avatars_account_active on storage.objects as restrictive for all to authenticated
    using (bucket_id<>'profile-avatars' or public.current_account_active())
    with check (bucket_id<>'profile-avatars' or public.current_account_active())$policy$;
  execute 'create trigger account_avatar_guard before insert or update or delete on storage.objects
    for each row execute function private.guard_account_avatar_write()';
end;
$storage$;
-- ACCOUNT_DELETION_READ_OVERRIDES
create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and exists (
    select 1
    from public.space_members sm
    where sm.space_id = target_space_id
      and sm.user_id = auth.uid()
  );
$$;

create or replace function public.are_users_in_same_space(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and private.account_active(first_user_id)
    and private.account_active(second_user_id) and exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = first_user_id
      and theirs.user_id = second_user_id
  );
$$;

create or replace function public.can_read_review_round(p_review_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp as $$
  select public.current_account_active() and exists (
    select 1
    from public.review_rounds r
    join public.space_members m on m.space_id=r.space_id and m.user_id=auth.uid()
    join public.review_entries own_entry on own_entry.review_id=r.id and own_entry.user_id=auth.uid()
    where r.id=p_review_id
  );
$$;

create or replace function public.ensure_personal_space()
returns public.spaces
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  personal_space public.spaces;
begin
  perform private.assert_active_account(auth.uid());
  if current_user_id is null then
    raise exception 'You must be signed in to ensure a personal space';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(10110, pg_catalog.hashtext(current_user_id::text));
  select * into personal_space
  from public.spaces
  where kind = 'personal' and created_by = current_user_id;
  if personal_space.id is not null then
    return personal_space;
  end if;

  insert into public.spaces (name, kind, invite_code, created_by)
  values ('个人空间', 'personal', public.generate_invite_code(), current_user_id)
  returning * into personal_space;

  insert into public.space_members (space_id, user_id, role)
  values (personal_space.id, current_user_id, 'owner');

  return personal_space;
end;
$$;

create or replace function public.join_space_by_invite_code(code text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_space public.spaces;
  member_count integer;
begin
  perform private.assert_active_account(auth.uid());
  if current_user_id is null then
    raise exception 'You must be signed in to join a space';
  end if;

  if nullif(trim(code), '') is null then
    raise exception 'Invite code is required';
  end if;

  select *
  into target_space
  from public.spaces
  where invite_code = upper(trim(code));

  if target_space.id is null then
    raise exception 'Invite code is invalid';
  end if;

  if target_space.kind = 'personal' then
    raise exception 'Personal Spaces cannot be joined by invite code';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_space.id::text));

  if exists (
    select 1 from public.space_members
    where space_id = target_space.id and user_id = current_user_id
  ) then
    raise exception 'You are already a member of this space';
  end if;

  select count(*)
  into member_count
  from public.space_members
  where space_id = target_space.id;

  if member_count >= 2 then
    raise exception 'This space is already full';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (target_space.id, current_user_id, 'member');

  return target_space;
end;
$$;

create or replace function public.get_my_previous_review_plan(p_review_id uuid)
returns text language plpgsql stable security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  current_review_date date;
  previous_round_id uuid;
  previous_plan text;
begin
  if not public.current_account_active() then
    raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501';
  end if;
  if actor is null or p_review_id is null then
    raise exception 'Actor and review are required';
  end if;
  select r.space_id,r.review_date into target_space_id,current_review_date
  from public.review_rounds r
  join public.space_members m on m.space_id=r.space_id and m.user_id=actor
  join public.review_entries own_entry on own_entry.review_id=r.id and own_entry.user_id=actor
  where r.id=p_review_id;
  if not found then
    raise exception 'Current review participant membership is required';
  end if;
  select id into previous_round_id
  from public.review_rounds
  where space_id=target_space_id and review_date<current_review_date
  order by review_date desc
  limit 1;
  if not found then return null; end if;
  select next_plan into previous_plan
  from public.review_entries
  where review_id=previous_round_id and user_id=actor;
  if not found or coalesce(previous_plan,'') !~ '[^[:space:]]' then
    return null;
  end if;
  return previous_plan;
end;
$$;

create or replace function public.important_date_reminder_is_eligible(
  p_source public.important_dates,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select private.account_active(p_recipient_user_id) and (
case when p_occurrence_date is null or not isfinite(p_occurrence_date) or (p_source).id is null then false else
    (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and extract(year from p_occurrence_date)>0
    and extract(month from p_occurrence_date)=(p_source).month
    and (extract(day from p_occurrence_date)=(p_source).day or (
      (p_source).repeat_kind='annual' and (p_source).month=2 and (p_source).day=29
      and extract(day from p_occurrence_date)=28
      and not (extract(year from p_occurrence_date)%4=0 and (
        extract(year from p_occurrence_date)%100<>0 or extract(year from p_occurrence_date)%400=0))))
    and (((p_source).repeat_kind='none' and (p_source).year=extract(year from p_occurrence_date))
      or ((p_source).repeat_kind='annual' and ((p_source).year is null or (p_source).year<=extract(year from p_occurrence_date))))
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='important_dates' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id and (s.kind='shared' or (s.kind='personal' and s.created_by=p_recipient_user_id))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  end
  );
$$;

create or replace function public.task_reminder_is_eligible(
  p_source public.tasks,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select private.account_active(p_recipient_user_id) and (
(p_source).id is not null and (p_source).status='open'
    and p_occurrence_date=(p_source).due_on and isfinite(p_occurrence_date)
    and (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).time_zone is not null
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='tasks' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id
        and ((s.kind='personal' and s.created_by=p_recipient_user_id)
          or (s.kind='shared' and ((p_source).assigned_to_user_id is null or (p_source).assigned_to_user_id=p_recipient_user_id)))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  );
$$;

create or replace function public.check_event_reminder_delivery(
  p_delivery_id uuid,p_event_id uuid,p_expected_marker timestamptz,
  p_expected_source_updated_at timestamptz default null,
  p_occurrence_date date default null,p_expected_exception_id uuid default null,
  p_expected_exception_updated_at timestamptz default null,p_expected_exception_type text default null
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source public.events; delivery public.reminder_deliveries; source_space uuid; check_now timestamptz;
begin
  select space_id into source_space from public.events where id=p_event_id;
  if source_space is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space::text));
  perform 1 from public.spaces where id=source_space for update;
  select * into source from public.events where id=p_event_id and space_id=source_space for update;
  if not found then return false; end if;
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.important_date_id is not null or delivery.task_id is not null
    or delivery.event_id is distinct from (case when source.recurrence_rule is null then source.id else coalesce(source.series_id,source.id) end)
    or source.reminder_kind is null or source.time_zone is null
    or source.reminder_schedule_changed_at is distinct from p_expected_marker
    or (source.recurrence_rule is not null and (p_expected_source_updated_at is null
      or source.updated_at is distinct from p_expected_source_updated_at)) then return false; end if;
  if source.recurrence_rule is not null and (
    delivery.occurrence_date is distinct from p_occurrence_date
    or (p_expected_exception_id is null and exists (select 1 from public.event_occurrence_exceptions
      where event_id=source.id and occurrence_date=p_occurrence_date))
    or (p_expected_exception_id is not null and not exists (select 1 from public.event_occurrence_exceptions
      where id=p_expected_exception_id and event_id=source.id and occurrence_date=p_occurrence_date
      and updated_at=p_expected_exception_updated_at and exception_type=p_expected_exception_type
      and exception_type='override'))
  ) then return false; end if;
  if not private.account_active(delivery.recipient_user_id) then return false; end if;
  check_now:=clock_timestamp();
  return delivery.due_at>=source.reminder_schedule_changed_at
    and delivery.due_at<=check_now and delivery.due_at>=check_now-interval '10 minutes'
    and exists (select 1 from public.space_members where space_id=source_space and user_id=delivery.recipient_user_id)
    and (source.scope='shared' or source.owner_user_id=delivery.recipient_user_id)
    and exists (select 1 from public.push_subscriptions where id=delivery.subscription_id
      and user_id=delivery.recipient_user_id and disabled_at is null
      and (expiration_time is null or expiration_time>check_now));
end;
$$;
-- ACCOUNT_DELETION_BARRIER_END
commit;
