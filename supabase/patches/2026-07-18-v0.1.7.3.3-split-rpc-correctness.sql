-- v0.1.7.3.3.1: split correctness, exception migration, and future deletion.
-- Apply only after the v0.1.7.1 and v0.1.7.3.1 ordered patches.

begin;

-- A first-occurrence split leaves an intentionally empty historical segment.
alter table public.events drop constraint if exists events_recurrence_until_after_start_check;
alter table public.events
  add constraint events_recurrence_until_after_start_check
  check (recurrence_until is null or recurrence_until >= starts_at);

-- Mutations made within one transaction still need distinct optimistic revisions.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.upsert_occurrence_override(
  p_event_id uuid,
  p_occurrence_date date,
  p_override_data jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.event_occurrence_exceptions
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events;
  scheduled_instant timestamptz;
  override_start timestamptz;
  override_end timestamptz;
  result public.event_occurrence_exceptions;
begin
  source_event := public.assert_manage_recurring_event(p_event_id, p_expected_updated_at);
  scheduled_instant := public.recurring_occurrence_instant(source_event, p_occurrence_date);
  if scheduled_instant is null then
    raise exception 'Occurrence date is not scheduled by the source event' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_override_data) is distinct from 'object' or p_override_data = '{}'::jsonb
    or exists (select 1 from jsonb_object_keys(p_override_data) as key(name) where name not in ('starts_at', 'ends_at', 'title', 'description')) then
    raise exception 'Override data contains unsupported fields' using errcode = 'P0001';
  end if;
  if p_override_data ? 'title' and jsonb_typeof(p_override_data -> 'title') is distinct from 'string' then
    raise exception 'Override title is invalid' using errcode = 'P0001';
  end if;
  if p_override_data ? 'description' and jsonb_typeof(p_override_data -> 'description') not in ('string', 'null') then
    raise exception 'Override description is invalid' using errcode = 'P0001';
  end if;
  begin
    override_start := case when p_override_data ? 'starts_at' then (p_override_data ->> 'starts_at')::timestamptz else scheduled_instant end;
    override_end := case when p_override_data ? 'ends_at' and p_override_data -> 'ends_at' <> 'null'::jsonb then (p_override_data ->> 'ends_at')::timestamptz else null end;
  exception when others then
    raise exception 'Override time is invalid' using errcode = 'P0001';
  end;
  if p_override_data ? 'ends_at' and jsonb_typeof(p_override_data -> 'ends_at') not in ('string', 'null') then
    raise exception 'Override end time is invalid' using errcode = 'P0001';
  end if;
  if override_end is not null and override_end < override_start then
    raise exception 'Override end time precedes start time' using errcode = 'P0001';
  end if;

  insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type, override_data)
  values (source_event.id, p_occurrence_date, 'override', p_override_data)
  on conflict (event_id, occurrence_date) do update
    set exception_type = excluded.exception_type,
        override_data = excluded.override_data
  returning * into result;

  update public.events set updated_at = clock_timestamp() where id = source_event.id;
  return result;
end;
$$;

create or replace function public.delete_occurrence(
  p_event_id uuid,
  p_occurrence_date date,
  p_expected_updated_at timestamptz default null
)
returns public.event_occurrence_exceptions
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events;
  result public.event_occurrence_exceptions;
begin
  source_event := public.assert_manage_recurring_event(p_event_id, p_expected_updated_at);
  if public.recurring_occurrence_instant(source_event, p_occurrence_date) is null then
    raise exception 'Occurrence date is not scheduled by the source event' using errcode = 'P0001';
  end if;
  insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type, override_data)
  values (source_event.id, p_occurrence_date, 'deleted', null)
  on conflict (event_id, occurrence_date) do update
    set exception_type = excluded.exception_type,
        override_data = null
  returning * into result;

  update public.events set updated_at = clock_timestamp() where id = source_event.id;
  return result;
end;
$$;

create or replace function public.split_recurring_event(
  p_source_event_id uuid,
  p_split_occurrence_date date,
  p_new_title text,
  p_new_description text,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz,
  p_new_all_day boolean,
  p_new_recurrence_rule jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events;
  split_instant timestamptz;
  source_time_zone text;
  child_event public.events;
begin
  source_event := public.assert_manage_recurring_event(p_source_event_id, p_expected_updated_at);
  split_instant := public.recurring_occurrence_instant(source_event, p_split_occurrence_date);
  if split_instant is null then
    raise exception 'Occurrence date is not scheduled by the source event' using errcode = 'P0001';
  end if;
  if p_new_recurrence_rule is distinct from source_event.recurrence_rule then
    raise exception 'Split child must keep the source recurrence rule' using errcode = 'P0001';
  end if;
  if p_new_all_day is distinct from source_event.all_day then
    raise exception 'Split child must keep the source all-day value' using errcode = 'P0001';
  end if;
  source_time_zone := source_event.recurrence_rule ->> 'time_zone';
  if (p_new_starts_at at time zone source_time_zone)::date is distinct from p_split_occurrence_date then
    raise exception 'Split child must start on the selected occurrence date' using errcode = 'P0001';
  end if;
  if p_new_title is null or btrim(p_new_title) = '' or (p_new_ends_at is not null and p_new_ends_at < p_new_starts_at) then
    raise exception 'Split child event data is invalid' using errcode = 'P0001';
  end if;

  perform 1 from public.event_occurrence_exceptions
  where event_id = source_event.id and occurrence_date >= p_split_occurrence_date
  for update;
  if exists (
    select 1 from public.event_occurrence_exceptions
    where event_id = source_event.id
      and occurrence_date = p_split_occurrence_date
      and exception_type = 'deleted'
  ) then
    raise exception 'Cannot split a deleted occurrence' using errcode = 'P0001';
  end if;

  update public.events
  set recurrence_until = split_instant,
      updated_at = clock_timestamp()
  where id = source_event.id;

  insert into public.events (
    space_id, created_by, scope, owner_user_id, title, description, starts_at, ends_at, all_day,
    recurrence_rule, series_id, parent_event_id, recurrence_until
  )
  values (
    source_event.space_id, source_event.created_by, source_event.scope, source_event.owner_user_id,
    p_new_title, p_new_description, p_new_starts_at, p_new_ends_at, source_event.all_day,
    source_event.recurrence_rule, coalesce(source_event.series_id, source_event.id), source_event.id, source_event.recurrence_until
  )
  returning * into child_event;

  insert into public.event_occurrence_exceptions (event_id, occurrence_date, exception_type, override_data)
  select child_event.id, occurrence_date, exception_type, override_data
  from public.event_occurrence_exceptions
  where event_id = source_event.id and occurrence_date > p_split_occurrence_date;

  delete from public.event_occurrence_exceptions
  where event_id = source_event.id and occurrence_date >= p_split_occurrence_date;
  return child_event;
end;
$$;

create or replace function public.delete_occurrence_and_future(
  p_event_id uuid,
  p_occurrence_date date,
  p_expected_updated_at timestamptz default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events;
  split_instant timestamptz;
  result public.events;
begin
  source_event := public.assert_manage_recurring_event(p_event_id, p_expected_updated_at);
  split_instant := public.recurring_occurrence_instant(source_event, p_occurrence_date);
  if split_instant is null then
    raise exception 'Occurrence date is not scheduled by the source event' using errcode = 'P0001';
  end if;

  perform 1 from public.event_occurrence_exceptions
  where event_id = source_event.id and occurrence_date >= p_occurrence_date
  for update;
  delete from public.event_occurrence_exceptions
  where event_id = source_event.id and occurrence_date >= p_occurrence_date;
  update public.events
  set recurrence_until = split_instant,
      updated_at = clock_timestamp()
  where id = source_event.id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.delete_occurrence_and_future(uuid, date, timestamptz) from public;
grant execute on function public.delete_occurrence_and_future(uuid, date, timestamptz) to authenticated;

commit;
