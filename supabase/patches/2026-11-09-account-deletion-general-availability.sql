-- Align preparation with final acceptance. NULL permits eligible users only while admission is enabled.
begin;
do $$
begin
  if not exists(select 1 from pg_proc
    where oid=to_regprocedure('public.prepare_my_account_deletion()')
      and md5(prosrc) in ('2758132aa880f443bcb8cec3d3f38096','a88c998442071e5cd87a0191c3d8a233')
      and prosecdef and prorettype='jsonb'::regtype
      and pg_get_userbyid(proowner)='postgres'
      and proconfig=array['search_path=pg_catalog, pg_temp'])
    or to_regclass('private.account_deletion_admission') is null then
    raise exception 'Account deletion GA preparation baseline drift';
  end if;
  perform 1 from private.account_deletion_admission where singleton and not enabled for share;
  if not found then
    raise exception 'Close new account deletion admission before applying GA preparation';
  end if;
end;
$$;
-- ACCOUNT_DELETION_GA_BEGIN
create or replace function public.prepare_my_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; rid uuid;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'READ COMMITTED required' using errcode='0A000';
  end if;
  -- Same lock order as acceptance: account, admission policy, then request.
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  perform 1 from private.account_deletion_admission
    where singleton and enabled and (allowed_user_ids is null or actor=any(allowed_user_ids)) for share;
  if not found then
    raise exception 'NEW_DELETION_REQUESTS_DISABLED' using errcode='42501';
  end if;
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
-- ACCOUNT_DELETION_GA_END
commit;
