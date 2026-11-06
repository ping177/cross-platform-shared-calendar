-- Local UI integration only. No new deletion scope, scheduler or Auth API.
begin;
-- ACCOUNT_DELETION_FRONTEND_BEGIN
create function public.cancel_my_deletion_preparation()
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='0A000'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  select * into job from private.account_deletions where user_id=actor;
  if found and job.accepted_at is not null then return false; end if;
  if not found then return true; end if;
  select * into job from private.account_deletions where user_id=actor for update;
  if job.verification_session_id is distinct from sid then raise exception 'DELETION_SESSION_REQUIRED' using errcode='42501'; end if;
  update private.account_deletions set permit_hash=null,permit_expires_at=null,identity_verified_at=null,
    verification_claim_id=null,verification_claimed_at=null,challenge_id=null,challenge_started_at=null
    where user_id=actor and accepted_at is null;
  return true;
end;
$$;
create function public.review_deleted_participants(p_review_id uuid)
returns setof uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if not public.can_read_review_round(p_review_id) then raise exception 'Review participant permission required' using errcode='42501'; end if;
  return query select e.user_id from public.review_entries e join private.account_deletions d on d.user_id=e.user_id
    where e.review_id=p_review_id and d.status='completed' and d.completed_at is not null
      and not exists(select 1 from auth.users u where u.id=e.user_id);
end;
$$;
revoke all on function public.cancel_my_deletion_preparation(),public.review_deleted_participants(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_my_deletion_preparation(),public.review_deleted_participants(uuid) to authenticated;
-- ACCOUNT_DELETION_FRONTEND_END
commit;
