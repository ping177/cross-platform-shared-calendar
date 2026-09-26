-- v0.1.14 acceptance fix: date-driven Review chronology and one round per Space date.
-- Apply once only after a read-only duplicate-date preflight. This patch never cleans data.
begin;

do $$
begin
  if to_regclass('public.review_rounds') is null
    or to_regclass('public.review_entries') is null
    or to_regprocedure('public.create_review_round(uuid,date)') is null
    or to_regprocedure('public.correct_review_date(uuid,date)') is null
    or to_regprocedure('public.get_my_previous_review_plan(uuid)') is not null
    or exists (
      select 1 from pg_constraint
      where conrelid='public.review_rounds'::regclass
        and conname='review_rounds_space_review_date_key'
    ) then
    raise exception 'Unexpected v0.1.14 review date chronology precondition';
  end if;
  if exists (
    select 1 from public.review_rounds
    group by space_id,review_date having count(*)>1
  ) then
    raise exception 'Duplicate review dates must be resolved before applying this patch';
  end if;
end;
$$;

alter table public.review_rounds
  add constraint review_rounds_space_review_date_key unique (space_id,review_date);

create or replace function public.create_review_round(p_space_id uuid,p_review_date date)
returns public.review_rounds language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
  participant_count integer;
  next_round_no integer;
  created_round public.review_rounds;
begin
  if actor is null or p_space_id is null or p_review_date is null then
    raise exception 'Actor, Space, and review date are required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if not found then raise exception 'Space not found'; end if;
  if not exists (
    select 1 from public.space_members where space_id=p_space_id and user_id=actor
  ) then raise exception 'Current Space membership is required'; end if;
  if not exists (
    select 1 from public.space_modules
    where space_id=p_space_id and module_key='review' and enabled
  ) then raise exception 'Review module is disabled'; end if;
  select count(*) into participant_count from public.space_members where space_id=p_space_id;
  if (space_kind='personal' and participant_count<>1)
    or (space_kind='shared' and participant_count<>2) then
    raise exception 'Review participant count is incomplete';
  end if;
  if exists (
    select 1 from public.review_rounds
    where space_id=p_space_id and review_date=p_review_date
  ) then raise exception '这一天已经有一篇回顾'; end if;
  select coalesce(max(round_no),0)+1 into next_round_no
  from public.review_rounds where space_id=p_space_id;
  insert into public.review_rounds(space_id,round_no,review_date,created_by)
  values (p_space_id,next_round_no,p_review_date,actor)
  returning * into created_round;
  insert into public.review_entries(review_id,user_id)
  select created_round.id,user_id from public.space_members where space_id=p_space_id;
  return created_round;
end;
$$;

create or replace function public.correct_review_date(p_review_id uuid,p_review_date date)
returns public.review_rounds language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  changed_round public.review_rounds;
begin
  if actor is null or p_review_id is null or p_review_date is null then
    raise exception 'Actor, review, and review date are required';
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
  if exists (
    select 1 from public.review_rounds
    where space_id=target_space_id and review_date=p_review_date and id<>p_review_id
  ) then raise exception '这一天已经有一篇回顾'; end if;
  update public.review_rounds set review_date=p_review_date
  where id=p_review_id returning * into changed_round;
  return changed_round;
end;
$$;

create function public.get_my_previous_review_plan(p_review_id uuid)
returns text language plpgsql stable security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  current_review_date date;
  previous_round_id uuid;
  previous_plan text;
begin
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

revoke all on function public.get_my_previous_review_plan(uuid) from public,anon,service_role;
grant execute on function public.get_my_previous_review_plan(uuid) to authenticated;

commit;
