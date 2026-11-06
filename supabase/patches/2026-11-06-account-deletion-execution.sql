-- Local review only. Requires trusted acceptance; no scheduling or credentials.
begin;
do $$ begin
 if to_regprocedure('public.cleanup_account_business(uuid,bigint)') is null or exists(select 1 from information_schema.columns where table_schema='private' and table_name='account_deletions' and column_name='lease_token') then raise exception 'Trusted prerequisite missing or execution patch already applied'; end if;
 if (select count(*) from (values ('private.guard_account_deletion_state()','114805e5d0cbd070e528992981630af4'),('public.cleanup_account_business(uuid,bigint)','e0cf2283983dd32789ea9aee1f2a2eb6')) expected(signature,hash) join pg_proc p on p.oid=to_regprocedure(signature) where md5(p.prosrc)=expected.hash)<>2 then raise exception 'Execution prerequisite drift'; end if;
end; $$;
-- ACCOUNT_DELETION_EXECUTION_BEGIN
alter table private.account_deletions
  add column lease_token uuid,
  add column storage_cleaned_at timestamptz,
  add column auth_missing_at timestamptz,
  add column receipt_hash text check(receipt_hash ~ '^[0-9a-f]{64}$'),
  add column receipt_expires_at timestamptz;

-- Keeps the previously reviewed cleanup body/role unchanged. Only a leased
-- wrapper may now invoke it; service_role cannot bypass the execution protocol.
grant account_deletion_executor to postgres;
set role account_deletion_executor;
grant execute on function public.cleanup_account_business(uuid,bigint) to postgres;
revoke execute on function public.cleanup_account_business(uuid,bigint) from service_role;
reset role;
revoke account_deletion_executor from postgres;
do $$begin
  if has_function_privilege('service_role','public.cleanup_account_business(uuid,bigint)','EXECUTE')
    or not has_function_privilege('postgres','public.cleanup_account_business(uuid,bigint)','EXECUTE') then
    raise exception 'Cleanup lease boundary ACL could not be installed';
  end if;
end;$$;

create function private.deletion_business_clear(p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select not exists(select 1 from public.profiles where id=p_user)
    and not exists(select 1 from public.spaces where kind='personal' and created_by=p_user)
    and not exists(select 1 from public.space_members where user_id=p_user)
    and not exists(select 1 from public.events where owner_user_id=p_user)
    and not exists(select 1 from public.tasks where assigned_to_user_id=p_user)
    and not exists(select 1 from public.push_subscriptions where user_id=p_user)
    and not exists(select 1 from public.reminder_deliveries where recipient_user_id=p_user);
$$;
create function private.deletion_storage_clear(p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select not exists(select 1 from storage.objects where
    (bucket_id='profile-avatars' and split_part(name,'/',1)=p_user::text)
    or owner_id=p_user::text or owner=p_user);
$$;

create function private.lock_deletion_lease(p_request uuid,p_generation bigint,p_lease uuid)
returns private.account_deletions language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required'; end if;
  select * into job from private.account_deletions where request_id=p_request for update;
  if not found or job.accepted_at is null or job.identity_verified_at is null or job.permit_used_at is null
    or job.status<>'processing' or job.generation is distinct from p_generation
    or job.lease_token is distinct from p_lease or p_lease is null or job.lease_until is null or job.lease_until<=clock_timestamp() then
    raise exception 'DELETION_LEASE_REQUIRED' using errcode='42501';
  end if;
  return job;
end;
$$;
create function public.claim_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  update private.account_deletions set receipt_hash=null,receipt_expires_at=null where receipt_expires_at<=clock_timestamp();
  select * into job from private.account_deletions
    where accepted_at is not null and identity_verified_at is not null and permit_used_at is not null
      and status in ('accepted','processing') and coalesce(next_attempt_at,'-infinity')<=clock_timestamp()
      and coalesce(lease_until,'-infinity')<=clock_timestamp()
    order by next_attempt_at nulls first,accepted_at for update skip locked limit 1;
  if not found then return null; end if;
  update private.account_deletions set status='processing',phase=case when phase='accepted' then 'storage' else phase end,
    generation=generation+1,attempts=attempts+1,error_code=null,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
    where user_id=job.user_id returning * into job;
  return jsonb_build_object('request_id',job.request_id,'user_id',job.user_id,'generation',job.generation,'lease_token',job.lease_token,'phase',job.phase);
end;
$$;
create function public.check_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  if job.phase in ('auth','verify') and (job.business_cleaned_at is null or job.storage_cleaned_at is null
    or not private.deletion_business_clear(job.user_id) or not private.deletion_storage_clear(job.user_id)) then
    raise exception 'DELETION_POSTFLIGHT_FAILED';
  end if;
  if exists(select 1 from storage.objects where (owner_id=job.user_id::text or owner=job.user_id)
    and (bucket_id<>'profile-avatars' or split_part(name,'/',1)<>job.user_id::text)) then
    raise exception 'UNKNOWN_STORAGE_OWNERSHIP';
  end if;
  if exists(select 1 from storage.objects where bucket_id='profile-avatars' and split_part(name,'/',1)=job.user_id::text
    and coalesce(owner_id,owner::text,job.user_id::text)<>job.user_id::text) then raise exception 'UNKNOWN_STORAGE_OWNERSHIP'; end if;
  return jsonb_build_object('user_id',job.user_id,'phase',job.phase);
end;
$$;
create function public.advance_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid,p_stage text)
returns boolean language plpgsql security definer set lock_timeout='5s' set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  if p_stage='storage' and job.phase='storage' then
    if not private.deletion_storage_clear(job.user_id) then raise exception 'STORAGE_POSTFLIGHT_FAILED'; end if;
    update private.account_deletions set storage_cleaned_at=clock_timestamp(),phase='business' where user_id=job.user_id;
  elsif p_stage='business' and job.phase='business' then
    if job.storage_cleaned_at is null or not private.deletion_storage_clear(job.user_id) then raise exception 'STORAGE_POSTFLIGHT_FAILED'; end if;
    perform public.cleanup_account_business(p_request_id,p_generation);
    if not private.deletion_business_clear(job.user_id) then raise exception 'BUSINESS_POSTFLIGHT_FAILED'; end if;
    update private.account_deletions set phase='auth' where user_id=job.user_id;
  elsif p_stage='auth' and job.phase='auth' then
    if job.business_cleaned_at is null or job.storage_cleaned_at is null or not private.deletion_business_clear(job.user_id)
      or not private.deletion_storage_clear(job.user_id) or exists(select 1 from auth.users where id=job.user_id) then
      raise exception 'AUTH_POSTFLIGHT_FAILED';
    end if;
    update private.account_deletions set auth_missing_at=clock_timestamp(),phase='verify' where user_id=job.user_id;
  elsif p_stage='complete' and job.phase='verify' then
    if job.business_cleaned_at is null or job.storage_cleaned_at is null or job.auth_missing_at is null
      or not private.deletion_business_clear(job.user_id) or not private.deletion_storage_clear(job.user_id)
      or exists(select 1 from auth.users where id=job.user_id) or job.error_code is not null then
      raise exception 'FINAL_POSTFLIGHT_FAILED';
    end if;
    perform set_config('app.deletion_finalize',p_request_id::text,true);
    update private.account_deletions set status='completed',completed_at=clock_timestamp(),
      verification_session_id=null,challenge_id=null,challenge_started_at=null,verification_claim_id=null,verification_claimed_at=null,
      permit_hash=null,permit_expires_at=null,permit_used_at=null,
      receipt_expires_at=case when receipt_hash is not null then clock_timestamp()+interval '7 days' end
      where user_id=job.user_id;
  else raise exception 'INVALID_DELETION_STAGE'; end if;
  if job.lease_until<=clock_timestamp() then raise exception 'DELETION_LEASE_EXPIRED' using errcode='42501'; end if;
  update private.account_deletions set lease_token=null,lease_until=null,next_attempt_at=clock_timestamp(),error_code=null
    where user_id=job.user_id;
  return true;
end;
$$;
create function public.release_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid,p_attention boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  update private.account_deletions set status=case when p_attention then 'needs_attention' else 'processing' end,
    error_code=case when p_attention then 'INVARIANT_FAILED' else 'RETRY_LATER' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,5*power(2,least(job.attempts,6)))::integer),
    lease_token=null,lease_until=null where user_id=job.user_id;
  return true;
end;
$$;
-- Owner-only recovery after the underlying incident is resolved. It cannot
-- change the target, waive OTP, restore normal access or skip postflight.
create function private.resume_account_deletion(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  update private.account_deletions set status='processing',phase='storage',generation=generation+1,
    storage_cleaned_at=null,auth_missing_at=null,error_code=null,next_attempt_at=clock_timestamp(),lease_token=null,lease_until=null
    where request_id=p_request_id and status='needs_attention' and accepted_at is not null;
  if not found then raise exception 'ATTENTION_JOB_REQUIRED'; end if;
end;
$$;

create function public.bind_my_deletion_receipt(p_request_id uuid,p_confirmation_token text,p_receipt_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare sid uuid:=private.deletion_session();
begin
  if p_receipt_hash is null or p_receipt_hash!~'^[0-9a-f]{64}$' then raise exception 'INVALID_RECEIPT'; end if;
  update private.account_deletions set receipt_hash=p_receipt_hash,receipt_expires_at=clock_timestamp()+interval '7 days'
    where user_id=auth.uid() and request_id=p_request_id and verification_session_id=sid and accepted_at is null
      and permit_hash=encode(sha256(convert_to(p_confirmation_token,'UTF8')),'hex')
      and permit_expires_at>clock_timestamp() and permit_used_at is null and identity_verified_at is not null;
  return found;
end;
$$;
create function public.read_deletion_receipt(p_receipt_hash text)
returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select jsonb_build_object('status',status) from private.account_deletions where receipt_hash=p_receipt_hash
    and receipt_expires_at>clock_timestamp();
$$;
create unique index account_deletion_receipt_hash_key on private.account_deletions(receipt_hash) where receipt_hash is not null;

-- Normal transition rules remain, with one tightly scoped completion branch.
create or replace function private.guard_account_deletion_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare finalizing boolean:=false;
begin
  if tg_op='DELETE' then
    if old.accepted_at is not null then raise exception 'Accepted deletion cannot be removed'; end if; return old;
  end if;
  if tg_op='INSERT' and new.status<>'preparing' then raise exception 'Deletion must start unaccepted'; end if;
  if tg_op='UPDATE' then
    if old.status='processing' and new.status='completed' and current_user='postgres' then
    finalizing:=current_setting('app.deletion_finalize',true)=old.request_id::text and old.phase='verify'
      and old.business_cleaned_at is not null and old.storage_cleaned_at is not null and old.auth_missing_at is not null
      and old.error_code is null and not exists(select 1 from auth.users where id=old.user_id)
      and private.deletion_business_clear(old.user_id) and private.deletion_storage_clear(old.user_id);
    end if;
    if old.accepted_at is not null and not coalesce(finalizing,false) and
      row(new.verification_session_id,new.identity_verified_at,new.permit_hash,new.permit_used_at)
      is distinct from row(old.verification_session_id,old.identity_verified_at,old.permit_hash,old.permit_used_at) then
      raise exception 'Accepted verification is immutable';
    end if;
    if row(new.user_id,new.request_id,new.created_at) is distinct from row(old.user_id,old.request_id,old.created_at)
      or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at) or new.generation<old.generation
      or (old.status='completed' and row(new.status,new.phase,new.completed_at) is distinct from row(old.status,old.phase,old.completed_at)) then
      raise exception 'Deletion identity and acceptance are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='preparing' and new.status='accepted') or (old.status='accepted' and new.status in ('processing','needs_attention'))
      or (old.status='processing' and new.status='needs_attention') or (old.status='needs_attention' and new.status='processing')
      or coalesce(finalizing,false)) then raise exception 'Deletion transition is not available in this slice'; end if;
  end if;
  new.updated_at:=clock_timestamp();return new;
end;
$$;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
revoke all on function public.claim_account_deletion(),public.check_deletion_execution(uuid,bigint,uuid),
  public.advance_deletion_execution(uuid,bigint,uuid,text),public.release_deletion_execution(uuid,bigint,uuid,boolean),
  public.read_deletion_receipt(text),public.bind_my_deletion_receipt(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_account_deletion(),public.check_deletion_execution(uuid,bigint,uuid),
  public.advance_deletion_execution(uuid,bigint,uuid,text),public.release_deletion_execution(uuid,bigint,uuid,boolean),
  public.read_deletion_receipt(text) to service_role;
grant execute on function public.bind_my_deletion_receipt(uuid,text,text) to authenticated;
-- ACCOUNT_DELETION_EXECUTION_END
commit;
