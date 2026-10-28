-- v0.1.21 Slice 2: content-revision conditional writes. Local until separately authorized.
-- No row, table, membership, date, or status migration. Old PWA writes fail closed.
begin;
do $$
begin
  if to_regprocedure('public.save_my_review_entry(uuid,text,text,text,text)') is null
    or to_regprocedure('public.mark_my_review_filled(uuid)') is null
    or to_regclass('public.review_entries') is null then
    raise exception 'Review foundation is required';
  end if;
  if to_regprocedure('public.save_my_review_entry(uuid,text,text,text,text,bigint)') is not null
    or to_regprocedure('public.mark_my_review_filled(uuid,bigint)') is not null then
    raise exception 'Review conditional writes already exist; inspect before reapplying';
  end if;
end;
$$;
-- Old clients must refresh; never leave an unconditional write overload.
create or replace function public.save_my_review_entry(
  p_review_id uuid,p_focus text,p_progress text,p_problems text,p_next_plan text
)
returns public.review_entries language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
  raise exception '应用版本已更新，请先保留未保存的输入，再刷新应用后重试。' using detail='REVIEW_CLIENT_UPDATE_REQUIRED';
end;
$$;
create or replace function public.mark_my_review_filled(p_review_id uuid)
returns public.review_entries language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
  raise exception '应用版本已更新，请先保留未保存的输入，再刷新应用后重试。' using detail='REVIEW_CLIENT_UPDATE_REQUIRED';
end;
$$;

create function public.save_my_review_entry(
  p_review_id uuid,p_focus text,p_progress text,p_problems text,p_next_plan text,
  p_expected_content_revision bigint
)
returns public.review_entries language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  saved_entry public.review_entries;
begin
  if actor is null or p_review_id is null then
    raise exception 'Actor and review are required';
  end if;
  select space_id into target_space_id from public.review_rounds where id=p_review_id;
  if not found then raise exception 'Review not found'; end if;
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
  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    raise exception using errcode='22023',message='Expected content revision is required';
  end if;
  update public.review_entries
  set focus=p_focus,progress=p_progress,problems=p_problems,next_plan=p_next_plan,
      content_revision=content_revision+1
  where review_id=p_review_id and user_id=actor
    and content_revision=p_expected_content_revision
    and (focus,progress,problems,next_plan)
      is distinct from (p_focus,p_progress,p_problems,p_next_plan)
  returning * into saved_entry;
  if not found then
    select * into saved_entry from public.review_entries
    where review_id=p_review_id and user_id=actor;
    if not found then raise exception 'Review entry not found'; end if;
    if saved_entry.content_revision is distinct from p_expected_content_revision then
      raise exception 'REVIEW_ENTRY_CONFLICT';
    end if;
  end if;
  return saved_entry;
end;
$$;

create function public.mark_my_review_filled(p_review_id uuid,p_expected_content_revision bigint)
returns public.review_entries language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  marked_entry public.review_entries;
begin
  if actor is null or p_review_id is null then
    raise exception 'Actor and review are required';
  end if;
  select space_id into target_space_id from public.review_rounds where id=p_review_id;
  if not found then raise exception 'Review not found'; end if;
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
  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    raise exception using errcode='22023',message='Expected content revision is required';
  end if;
  select * into marked_entry from public.review_entries
  where review_id=p_review_id and user_id=actor;
  if not found then raise exception 'Review entry not found'; end if;
  if marked_entry.content_revision is distinct from p_expected_content_revision then
    raise exception 'REVIEW_ENTRY_CONFLICT';
  end if;
  if not (
    coalesce(marked_entry.focus,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.progress,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.problems,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.next_plan,'') ~ '[^[:space:]]'
  ) then raise exception 'Blank review entry cannot be marked filled'; end if;
  if marked_entry.filled_revision is distinct from marked_entry.content_revision then
    update public.review_entries set filled_revision=content_revision
    where review_id=p_review_id and user_id=actor
      and content_revision=p_expected_content_revision returning * into marked_entry;
    if not found then raise exception 'REVIEW_ENTRY_CONFLICT'; end if;
  end if;
  return marked_entry;
end;
$$;

revoke all on function public.save_my_review_entry(uuid,text,text,text,text,bigint),
  public.mark_my_review_filled(uuid,bigint),
  public.save_my_review_entry(uuid,text,text,text,text),public.mark_my_review_filled(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.save_my_review_entry(uuid,text,text,text,text,bigint),
  public.mark_my_review_filled(uuid,bigint),
  public.save_my_review_entry(uuid,text,text,text,text),public.mark_my_review_filled(uuid)
to authenticated;

notify pgrst, 'reload schema';
commit;
