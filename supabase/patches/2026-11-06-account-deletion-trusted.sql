-- Trusted acceptance and restricted business cleanup. LOCAL REVIEW ONLY.
begin;
do $preflight$
begin
  if to_regclass('private.account_deletions') is null or exists(select 1 from information_schema.columns where table_schema='private' and table_name='account_deletions' and column_name='identity_verified_at') then
    raise exception 'Account barrier prerequisite missing or trusted patch already applied';
  end if;
  if (select count(*) from (values
    ('private.guard_account_deletion_state()','73d095c99de2cfc491136cdc2e6ed6ab'),
    ('private.prepare_account_deletion(uuid,uuid)','208b740a1d340a2b13ce6ebbc09352df'),
    ('private.accept_account_deletion(uuid,uuid)','99ffab5f63b5c09fd9896ed907c53b2c'),
    ('public.guard_personal_space_delete()','de1809afcf4175c949e2d369fca06d5c'),
    ('public.delete_lifecycle_event_set(uuid,uuid)','9200f39002c70c9c87788b83224a07fd')
  ) expected(signature,hash) join pg_proc p on p.oid=to_regprocedure(signature) where md5(p.prosrc)=expected.hash)<>5 then
    raise exception 'Trusted deletion baseline drift';
  end if;
end;
$preflight$;
-- ACCOUNT_DELETION_TRUSTED_BEGIN
alter table private.account_deletions
  add column verification_session_id uuid,
  add column challenge_id uuid,
  add column challenge_started_at timestamptz,
  add column verification_claim_id uuid,
  add column verification_claimed_at timestamptz,
  add column verification_attempts integer not null default 0 check(verification_attempts>=0),
  add column identity_verified_at timestamptz,
  add column permit_hash text check(permit_hash ~ '^[0-9a-f]{64}$'),
  add column permit_expires_at timestamptz,
  add column permit_used_at timestamptz,
  add column business_cleaned_at timestamptz;

create or replace function private.guard_account_deletion_state()
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
    if old.accepted_at is not null and row(new.verification_session_id,new.identity_verified_at,new.permit_hash,new.permit_used_at)
      is distinct from row(old.verification_session_id,old.identity_verified_at,old.permit_hash,old.permit_used_at) then
      raise exception 'Accepted verification is immutable';
    end if;
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

-- An accepted identity is immutable. Replays must not wait for its job row
-- while holding the exclusive account gate: cleanup may be holding that row.
create or replace function private.prepare_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id;
  if found and job.accepted_at is not null then
    if job.request_id<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
    return job.request_id;
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  insert into private.account_deletions(user_id,request_id) values(p_user_id,p_request_id) on conflict(user_id) do nothing;
  select * into job from private.account_deletions where user_id=p_user_id for update;
  if job.request_id<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
  return job.request_id;
end;
$$;
create or replace function private.accept_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Account acceptance requires READ COMMITTED' using errcode='0A000'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id;
  if not found then raise exception 'ACCOUNT_DELETION_INTENT_NOT_FOUND'; end if;
  if job.accepted_at is not null then return job.request_id; end if;
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=p_user_id and m.role='owner' and s.kind='shared') then raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION'; end if;
  update private.account_deletions set status='accepted',phase='accepted',accepted_at=clock_timestamp(),next_attempt_at=clock_timestamp() where user_id=p_user_id;
  return job.request_id;
end;
$$;

create function private.deletion_session()
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare session_id uuid;
begin
  session_id:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
  if auth.uid() is null or session_id is null or not exists(select 1 from auth.sessions s
    where s.id=session_id and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp())) then
    raise exception 'DELETION_SESSION_REQUIRED' using errcode='42501';
  end if;
  return session_id;
end;
$$;

create function public.prepare_my_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; rid uuid;
begin
  select * into job from private.account_deletions where user_id=actor;
  rid:=coalesce(job.request_id,gen_random_uuid());
  perform private.prepare_account_deletion(actor,rid);
  select * into job from private.account_deletions where user_id=actor;
  if job.accepted_at is not null then raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501'; end if;
  select * into job from private.account_deletions where user_id=actor for update;
  if job.verification_session_id is distinct from sid and job.challenge_started_at>clock_timestamp()-interval '5 minutes' then
    raise exception 'DELETION_SESSION_CONFLICT' using errcode='42501';
  end if;
  if job.challenge_started_at>clock_timestamp()-interval '60 seconds' then
    return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',false);
  end if;
  update private.account_deletions set verification_session_id=sid,challenge_id=gen_random_uuid(),
    challenge_started_at=clock_timestamp(),verification_claim_id=null,verification_claimed_at=null,
    verification_attempts=0,identity_verified_at=null,permit_hash=null,permit_expires_at=null,permit_used_at=null
    where user_id=actor returning * into job;
  return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',true);
end;
$$;

-- Service-only verification attempt lease. A successful ordinary login, client
-- boolean, or JWT AMR record cannot call either half of this contract.
create function public.claim_deletion_verification(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_challenge_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions; claim_id uuid:=gen_random_uuid();
begin
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not found or job.accepted_at is not null or job.verification_session_id is distinct from p_session_id
    or job.challenge_id is distinct from p_challenge_id or job.challenge_started_at<clock_timestamp()-interval '5 minutes'
    or job.challenge_started_at is null or job.verification_attempts>=5 or job.permit_hash is not null
    or job.verification_claimed_at>clock_timestamp()-interval '30 seconds'
    or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id) then
    raise exception 'DELETION_VERIFICATION_UNAVAILABLE' using errcode='42501';
  end if;
  update private.account_deletions set verification_claim_id=claim_id,verification_claimed_at=clock_timestamp(),
    verification_attempts=verification_attempts+1 where user_id=p_user_id;
  return claim_id;
end;
$$;
create function public.release_deletion_verification(p_request_id uuid,p_claim_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  update private.account_deletions set verification_claim_id=null,verification_claimed_at=null
    where request_id=p_request_id and verification_claim_id=p_claim_id and accepted_at is null;
end;
$$;
create function public.finish_deletion_verification(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_challenge_id uuid,p_claim_id uuid,p_permit_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_permit_hash is null or p_permit_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid verification permit'; end if;
  update private.account_deletions set identity_verified_at=clock_timestamp(),permit_hash=p_permit_hash,
    permit_expires_at=clock_timestamp()+interval '5 minutes',verification_claim_id=null,verification_claimed_at=null
    where user_id=p_user_id and request_id=p_request_id and verification_session_id=p_session_id
      and challenge_id=p_challenge_id and verification_claim_id=p_claim_id and accepted_at is null and permit_hash is null
      and verification_claimed_at>clock_timestamp()-interval '30 seconds'
      and challenge_started_at>clock_timestamp()-interval '5 minutes'
      and exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id);
  return found;
end;
$$;

-- Owner-managed admission switch. No app/service role can change rollout policy.
create table private.account_deletion_admission (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  allowed_user_ids uuid[]
);
insert into private.account_deletion_admission(singleton) values (true);
alter table private.account_deletion_admission enable row level security;
revoke all on private.account_deletion_admission from public,anon,authenticated,service_role;

create function public.accept_my_account_deletion(p_request_id uuid,p_confirmation_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; expected_hash text;
begin
  if p_confirmation_token is null or p_confirmation_token !~ '^[0-9a-f]{64}$' then raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501'; end if;
  expected_hash:=encode(sha256(convert_to(p_confirmation_token,'UTF8')),'hex');
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  select * into job from private.account_deletions where user_id=actor and request_id=p_request_id;
  if not found or job.verification_session_id is distinct from sid or job.permit_hash is distinct from expected_hash
    or job.identity_verified_at is null then raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501'; end if;
  if job.accepted_at is not null then return jsonb_build_object('request_id',job.request_id,'status',job.status); end if;
  -- Hold the policy row through commit: closing admission waits for any earlier
  -- acceptance to commit. Policy updates take no Space/account/job locks.
  perform 1 from private.account_deletion_admission
    where singleton and enabled and (allowed_user_ids is null or actor=any(allowed_user_ids)) for share;
  if not found then raise exception 'NEW_DELETION_REQUESTS_DISABLED' using errcode='42501'; end if;
  select * into job from private.account_deletions where user_id=actor and request_id=p_request_id for update;
  if job.verification_session_id is distinct from sid or job.permit_hash is distinct from expected_hash
    or job.permit_expires_at<=clock_timestamp() or job.permit_expires_at is null or job.permit_used_at is not null then
    raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501';
  end if;
  update private.account_deletions set permit_used_at=clock_timestamp() where user_id=actor;
  perform private.accept_account_deletion(actor,p_request_id);
  return jsonb_build_object('request_id',p_request_id,'status','accepted');
end;
$$;
revoke all on function public.prepare_my_account_deletion(),public.accept_my_account_deletion(uuid,text),
  public.claim_deletion_verification(uuid,uuid,uuid,uuid),public.release_deletion_verification(uuid,uuid),
  public.finish_deletion_verification(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.prepare_my_account_deletion(),public.accept_my_account_deletion(uuid,text) to authenticated;
grant execute on function public.claim_deletion_verification(uuid,uuid,uuid,uuid),public.release_deletion_verification(uuid,uuid),
  public.finish_deletion_verification(uuid,uuid,uuid,uuid,uuid,text) to service_role;

do $executor_role$
begin
  if not exists(select 1 from pg_roles where rolname='account_deletion_executor') then
    create role account_deletion_executor nologin noinherit nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='account_deletion_executor' and (rolcanlogin or rolinherit or rolbypassrls or rolsuper or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'Unexpected deletion executor privileges';
  end if;
  if exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member
    where m.roleid='account_deletion_executor'::regrole and r.rolname<>'postgres') then
    raise exception 'Unexpected executor membership';
  end if;
end;
$executor_role$;
grant usage on schema private,public to account_deletion_executor;
grant select on private.account_deletions to account_deletion_executor;
grant update(status,phase,generation,attempts,business_cleaned_at,updated_at) on private.account_deletions to account_deletion_executor;
create policy deletion_executor_job on private.account_deletions for all to account_deletion_executor
  using(request_id=nullif(current_setting('app.deletion_request',true),'')::uuid)
  with check(request_id=nullif(current_setting('app.deletion_request',true),'')::uuid);

create function private.cleanup_target()
returns uuid language sql stable set search_path=pg_catalog,pg_temp as $$
  select user_id from private.account_deletions where current_user='account_deletion_executor'
    and request_id=nullif(current_setting('app.deletion_request',true),'')::uuid
    and accepted_at is not null and identity_verified_at is not null and permit_used_at is not null
    and status in ('accepted','processing') and phase in ('accepted','storage','business');
$$;
create function private.cleanup_ids(p_kind text)
returns uuid[] language sql stable set search_path=pg_catalog,pg_temp as $$
  select case when current_user='account_deletion_executor' and private.cleanup_target() is not null then
    coalesce(nullif(current_setting(case p_kind when 'spaces' then 'app.deletion_spaces' when 'events' then 'app.deletion_events'
      when 'tasks' then 'app.deletion_tasks' when 'dates' then 'app.deletion_dates' else 'app.deletion_none' end,true),'')::uuid[],'{}'::uuid[])
    else '{}'::uuid[] end;
$$;
create function private.cleanup_personal_space(p_space_id uuid)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select exists(select 1 from public.spaces where id=p_space_id and kind='personal' and created_by=private.cleanup_target());
$$;
-- The helper remains internal. Existing owner/member RPCs already execute as
-- their definer; an invoker helper lets the restricted cleanup keep its identity.
alter function public.delete_lifecycle_event_set(uuid,uuid) security invoker;
grant execute on function public.delete_lifecycle_event_set(uuid,uuid),public.generate_invite_code(),
  public.is_space_member(uuid),public.are_users_in_same_space(uuid,uuid),public.is_space_module_enabled(uuid,text),
  public.can_manage_event(uuid,text,uuid),public.can_read_review_round(uuid) to account_deletion_executor;

create or replace function public.guard_personal_space_delete()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if old.kind='personal' then
    if current_user<>'account_deletion_executor' then raise exception 'Personal Space cannot be deleted'; end if;
    if old.created_by is distinct from private.cleanup_target() then raise exception 'Personal Space cannot be deleted'; end if;
  end if;
  return old;
end;
$$;

-- Read only the target's references and the locked Space workset. The workset
-- GUC is not authority: only the NOLOGIN definer can use these policies, and its
-- sole entry point resets and derives every value from the immutable job.
grant select,delete on public.profiles,public.space_members,public.space_modules,public.events,public.tasks,
  public.event_occurrence_exceptions,public.review_rounds,public.review_entries,public.lists,public.list_sections,
  public.list_items,public.important_dates,public.push_subscriptions,public.reminder_deliveries to account_deletion_executor;
grant select,delete on public.spaces to account_deletion_executor;
grant update(invite_code) on public.spaces to account_deletion_executor;
create policy deletion_executor_spaces_read on public.spaces for select to account_deletion_executor
  using((kind='personal' and created_by=private.cleanup_target()) or id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_spaces_delete on public.spaces for delete to account_deletion_executor
  using(kind='personal' and created_by=private.cleanup_target());
create policy deletion_executor_spaces_update on public.spaces for update to account_deletion_executor
  using(id=any(private.cleanup_ids('spaces'))) with check(id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_members_read on public.space_members for select to account_deletion_executor
  using(user_id=private.cleanup_target() or space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_members_delete on public.space_members for delete to account_deletion_executor
  using(user_id=private.cleanup_target() and role='member' and space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_profiles on public.profiles for all to account_deletion_executor using(id=private.cleanup_target());
create policy deletion_executor_push on public.push_subscriptions for all to account_deletion_executor using(user_id=private.cleanup_target());
create policy deletion_executor_events_read on public.events for select to account_deletion_executor
  using(owner_user_id=private.cleanup_target() or space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_events_delete on public.events for delete to account_deletion_executor
  using(private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=private.cleanup_target()));
create policy deletion_executor_modules on public.space_modules for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_tasks on public.tasks for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_dates on public.important_dates for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_lists on public.lists for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_sections on public.list_sections for all to account_deletion_executor
  using(exists(select 1 from public.lists l where l.id=list_id and private.cleanup_personal_space(l.space_id)));
create policy deletion_executor_items on public.list_items for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_rounds on public.review_rounds for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_entries on public.review_entries for all to account_deletion_executor
  using(exists(select 1 from public.review_rounds r where r.id=review_id and private.cleanup_personal_space(r.space_id)));
create policy deletion_executor_exceptions on public.event_occurrence_exceptions for all to account_deletion_executor
  using(exists(select 1 from public.events e where e.id=event_id and (private.cleanup_personal_space(e.space_id) or (e.scope='personal' and e.owner_user_id=private.cleanup_target()))));
create policy deletion_executor_ledger on public.reminder_deliveries for all to account_deletion_executor
  using(recipient_user_id=private.cleanup_target() or event_id=any(private.cleanup_ids('events'))
    or task_id=any(private.cleanup_ids('tasks')) or important_date_id=any(private.cleanup_ids('dates')));

create function public.cleanup_account_business(p_request_id uuid,p_generation bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions; spaces uuid[]; sid uuid; space_kind text; removed integer;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Cleanup requires READ COMMITTED'; end if;
  perform set_config('app.deletion_request',p_request_id::text,true);
  perform set_config('app.deletion_spaces','{}',true);
  perform set_config('app.deletion_events','{}',true);
  perform set_config('app.deletion_tasks','{}',true);
  perform set_config('app.deletion_dates','{}',true);
  select * into job from private.account_deletions where request_id=p_request_id for update;
  if not found or job.accepted_at is null or job.identity_verified_at is null or job.permit_used_at is null
    or job.status not in ('accepted','processing') or job.phase not in ('accepted','storage','business') then
    raise exception 'TRUSTED_ACCEPTED_JOB_REQUIRED' using errcode='42501';
  end if;
  if job.business_cleaned_at is not null then return true; end if;
  if job.generation is distinct from p_generation then raise exception 'STALE_DELETION_GENERATION' using errcode='42501'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into spaces from (
    select id from public.spaces where kind='personal' and created_by=job.user_id
    union select space_id from public.space_members where user_id=job.user_id
    union select space_id from public.events where scope='personal' and owner_user_id=job.user_id
  ) work;
  perform set_config('app.deletion_spaces',spaces::text,true);
  foreach sid in array spaces loop
    perform pg_advisory_xact_lock(hashtext(sid::text));
    perform 1 from public.spaces where id=sid for update;
  end loop;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=job.user_id and m.role='owner' and s.kind='shared') then
    raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION';
  end if;
  perform set_config('app.deletion_events',coalesce((select array_agg(id)::text from (
    select id from public.events where private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=job.user_id)
    union select coalesce(series_id,id) from public.events where private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=job.user_id)
  ) roots),'{}'),true);
  perform set_config('app.deletion_tasks',coalesce((select array_agg(id)::text from public.tasks where private.cleanup_personal_space(space_id)),'{}'),true);
  perform set_config('app.deletion_dates',coalesce((select array_agg(id)::text from public.important_dates where private.cleanup_personal_space(space_id)),'{}'),true);
  delete from public.reminder_deliveries where recipient_user_id=job.user_id or event_id=any(private.cleanup_ids('events'))
    or task_id=any(private.cleanup_ids('tasks')) or important_date_id=any(private.cleanup_ids('dates'));
  foreach sid in array spaces loop
    select s.kind into space_kind from public.spaces s where s.id=sid;
    if space_kind='personal' then
      if not private.cleanup_personal_space(sid) then raise exception 'Unexpected Personal target'; end if;
      perform public.delete_lifecycle_event_set(sid,null);
      delete from public.spaces where id=sid;
    elsif space_kind='shared' then
      perform public.delete_lifecycle_event_set(sid,job.user_id);
      delete from public.space_members where space_id=sid and user_id=job.user_id and role='member';
      get diagnostics removed=row_count;
      if removed>0 then update public.spaces set invite_code=public.generate_invite_code() where id=sid; end if;
    end if;
  end loop;
  delete from public.push_subscriptions where user_id=job.user_id;
  delete from public.profiles where id=job.user_id;
  if exists(select 1 from public.space_members where user_id=job.user_id)
    or exists(select 1 from public.events where owner_user_id=job.user_id)
    or exists(select 1 from public.spaces where kind='personal' and created_by=job.user_id) then
    raise exception 'Business cleanup postflight failed';
  end if;
  if exists(select 1 from public.spaces s where s.kind='shared' and s.id=any(spaces) and
    ((select count(*) from public.space_members m where m.space_id=s.id and m.role='owner')<>1
      or (select count(*) from public.space_members m where m.space_id=s.id)>2)) then
    raise exception 'Shared lifecycle postflight failed';
  end if;
  -- Storage/Auth are still outstanding. This independent local DB operation
  -- never advances to auth/verify/completed, even after all business rows vanish.
  update private.account_deletions set status='processing',phase=case when phase='accepted' then 'storage' else phase end,
    business_cleaned_at=clock_timestamp(),generation=generation+1,attempts=attempts+1 where request_id=p_request_id;
  return true;
end;
$$;
grant account_deletion_executor to postgres;
grant create on schema public to account_deletion_executor;
alter function public.cleanup_account_business(uuid,bigint) owner to account_deletion_executor;
revoke create on schema public from account_deletion_executor;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.cleanup_target(),private.cleanup_ids(text),private.cleanup_personal_space(uuid) to account_deletion_executor;
revoke all on function public.cleanup_account_business(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.cleanup_account_business(uuid,bigint) to service_role;
revoke account_deletion_executor from postgres;
-- ACCOUNT_DELETION_TRUSTED_END
commit;
