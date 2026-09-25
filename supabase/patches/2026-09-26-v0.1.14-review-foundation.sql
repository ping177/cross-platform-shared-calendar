-- v0.1.14 Slice 1: Space-owned review rounds and participant snapshots.
-- Apply once after a fresh read-only Production preflight. Never replay schema.sql.
begin;

do $$
begin
  if to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.space_modules') is null
    or to_regprocedure('public.set_space_module_enabled(uuid,text,boolean)') is null
    or to_regprocedure('public.leave_shared_space(uuid)') is null
    or to_regclass('public.review_rounds') is not null
    or to_regclass('public.review_entries') is not null then
    raise exception 'Unexpected v0.1.14 review foundation precondition';
  end if;
end;
$$;

create table public.review_rounds (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  review_date date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (space_id, round_no)
);

create index review_rounds_space_date_idx
  on public.review_rounds (space_id, review_date desc, round_no desc, id);

create table public.review_entries (
  review_id uuid not null references public.review_rounds(id) on delete cascade,
  user_id uuid not null,
  focus text,
  progress text,
  problems text,
  next_plan text,
  content_revision bigint not null default 0 check (content_revision >= 0),
  filled_revision bigint check (filled_revision is null or (filled_revision > 0 and filled_revision <= content_revision)),
  updated_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- Participant identity is a snapshot, so it cannot reference the cascading
-- space_members row. RPC creation derives user_id from canonical membership.
create function public.guard_review_round_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.space_id is distinct from old.space_id
    or new.round_no is distinct from old.round_no
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Review round identity is immutable';
  end if;
  return new;
end;
$$;
create trigger review_rounds_guard_identity before update on public.review_rounds
for each row execute function public.guard_review_round_identity();

create function public.guard_review_entry_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.review_id is distinct from old.review_id
    or new.user_id is distinct from old.user_id then
    raise exception 'Review participant identity is immutable';
  end if;
  return new;
end;
$$;
create trigger review_entries_guard_identity before update on public.review_entries
for each row execute function public.guard_review_entry_identity();
create trigger review_entries_touch_updated_at before update on public.review_entries
for each row execute function public.touch_updated_at();

create function public.can_read_review_round(p_review_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp as $$
  select exists (
    select 1
    from public.review_rounds r
    join public.space_members m on m.space_id=r.space_id and m.user_id=auth.uid()
    join public.review_entries own_entry on own_entry.review_id=r.id and own_entry.user_id=auth.uid()
    where r.id=p_review_id
  );
$$;

alter table public.review_rounds enable row level security;
alter table public.review_entries enable row level security;
create policy review_rounds_select_participant on public.review_rounds
  for select using (public.can_read_review_round(id));
create policy review_entries_select_participant on public.review_entries
  for select using (public.can_read_review_round(review_id));

-- Both tables are RPC-owned for writes. Explicit revokes override public-schema
-- default ACLs, including a possible service_role TRUNCATE grant.
revoke all on table public.review_rounds,public.review_entries
  from public,anon,authenticated,service_role;
grant select on table public.review_rounds,public.review_entries to authenticated;

create function public.create_review_round(p_space_id uuid,p_review_date date)
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

create function public.correct_review_date(p_review_id uuid,p_review_date date)
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
  update public.review_rounds set review_date=p_review_date
  where id=p_review_id returning * into changed_round;
  return changed_round;
end;
$$;

create function public.save_my_review_entry(
  p_review_id uuid,p_focus text,p_progress text,p_problems text,p_next_plan text
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
  update public.review_entries
  set focus=p_focus,progress=p_progress,problems=p_problems,next_plan=p_next_plan,
      content_revision=content_revision+1
  where review_id=p_review_id and user_id=actor
    and (focus,progress,problems,next_plan)
      is distinct from (p_focus,p_progress,p_problems,p_next_plan)
  returning * into saved_entry;
  if not found then
    select * into saved_entry from public.review_entries
    where review_id=p_review_id and user_id=actor;
  end if;
  return saved_entry;
end;
$$;

create function public.mark_my_review_filled(p_review_id uuid)
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
  select * into marked_entry from public.review_entries
  where review_id=p_review_id and user_id=actor;
  if not (
    coalesce(marked_entry.focus,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.progress,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.problems,'') ~ '[^[:space:]]'
    or coalesce(marked_entry.next_plan,'') ~ '[^[:space:]]'
  ) then raise exception 'Blank review entry cannot be marked filled'; end if;
  if marked_entry.filled_revision is distinct from marked_entry.content_revision then
    update public.review_entries set filled_revision=content_revision
    where review_id=p_review_id and user_id=actor returning * into marked_entry;
  end if;
  return marked_entry;
end;
$$;

-- Preserve the existing Tasks path; Review toggles join the Space lock order
-- used by membership lifecycle and all Review writes.
create or replace function public.set_space_module_enabled(
  p_space_id uuid,
  p_module_key text,
  p_enabled boolean
)
returns public.space_modules
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  updated_module public.space_modules;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to change modules';
  end if;
  if p_module_key is null or p_module_key not in ('tasks', 'review') or p_enabled is null then
    raise exception 'Only Tasks and Review modules may be toggled in this version';
  end if;
  if p_module_key = 'review' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
    perform 1 from public.spaces where id = p_space_id for update;
    if not found then
      raise exception 'Space not found';
    end if;
  end if;
  if not exists (
    select 1 from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
  ) then
    raise exception 'Only the Space owner may change modules';
  end if;

  insert into public.space_modules (space_id, module_key, enabled)
  values (p_space_id, p_module_key, p_enabled)
  on conflict (space_id, module_key) do update set enabled = excluded.enabled
  returning * into updated_module;
  return updated_module;
end;
$$;

revoke all on function public.can_read_review_round(uuid) from public,anon,service_role;
grant execute on function public.can_read_review_round(uuid) to authenticated;
revoke all on function public.create_review_round(uuid,date) from public,anon,service_role;
revoke all on function public.correct_review_date(uuid,date) from public,anon,service_role;
revoke all on function public.save_my_review_entry(uuid,text,text,text,text) from public,anon,service_role;
revoke all on function public.mark_my_review_filled(uuid) from public,anon,service_role;
grant execute on function public.create_review_round(uuid,date) to authenticated;
grant execute on function public.correct_review_date(uuid,date) to authenticated;
grant execute on function public.save_my_review_entry(uuid,text,text,text,text) to authenticated;
grant execute on function public.mark_my_review_filled(uuid) to authenticated;

commit;
