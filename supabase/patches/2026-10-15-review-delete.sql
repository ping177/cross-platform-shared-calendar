-- Additive Review deletion endpoint. No existing rows or policies are changed.
-- Apply once after review foundation/date chronology; no direct table DELETE grant.
begin;

create function public.delete_review_round(p_review_id uuid)
returns uuid language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  deleted_id uuid;
begin
  if actor is null or p_review_id is null then
    raise exception 'Actor and review are required';
  end if;
  select space_id into target_space_id from public.review_rounds where id=p_review_id;
  if not found then raise exception 'Review not found'; end if;
  -- Review writes share advisory then Space-row locks; membership changes also lock the Space row.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_space_id::text));
  perform 1 from public.spaces where id=target_space_id for update;
  if not found then raise exception 'Space not found'; end if;
  if not public.can_read_review_round(p_review_id) then
    raise exception 'Current review participant membership is required';
  end if;
  if not exists (
    select 1 from public.space_modules
    where space_id=target_space_id and module_key='review' and enabled
  ) then raise exception 'Review module is disabled'; end if;
  delete from public.review_rounds where id=p_review_id and space_id=target_space_id
  returning id into deleted_id;
  if deleted_id is null then raise exception 'Review not found'; end if;
  return deleted_id;
end;
$$;
revoke all on function public.delete_review_round(uuid) from public,anon,service_role;
grant execute on function public.delete_review_round(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
