-- v0.1.7.3.1: Recurrence series-editing RPC foundation.
-- Apply only after the v0.1.7.1 exception foundation. Do not rerun schema.sql.

begin;

create or replace function public.recurring_occurrence_instant(
  p_event public.events,
  p_occurrence_date date
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  rule jsonb := p_event.recurrence_rule;
  frequency text;
  interval_value integer;
  time_zone_value text;
  anchor_local timestamp;
  candidate_local timestamp;
  candidate_instant timestamptz;
  anchor_date date;
  month_difference integer;
  year_difference integer;
  expected_day integer;
begin
  if rule is null then
    return null;
  end if;

  frequency := rule ->> 'frequency';
  interval_value := (rule ->> 'interval')::integer;
  time_zone_value := rule ->> 'time_zone';
  anchor_local := p_event.starts_at at time zone time_zone_value;
  anchor_date := anchor_local::date;

  if p_occurrence_date < anchor_date then
    return null;
  end if;

  candidate_local := p_occurrence_date::timestamp + anchor_local::time;
  candidate_instant := candidate_local at time zone time_zone_value;

  if p_event.recurrence_until is not null and candidate_instant >= p_event.recurrence_until then
    return null;
  end if;

  if p_occurrence_date = anchor_date then
    return candidate_instant;
  end if;

  if frequency = 'daily' then
    if mod(p_occurrence_date - anchor_date, interval_value) = 0 then
      return candidate_instant;
    end if;
    return null;
  end if;

  if frequency = 'weekly' then
    if extract(isodow from p_occurrence_date)::integer = any (
      array(select jsonb_array_elements_text(rule -> 'days_of_week')::integer)
    )
      and mod(((date_trunc('week', p_occurrence_date)::date - date_trunc('week', anchor_date)::date) / 7), interval_value) = 0 then
      return candidate_instant;
    end if;
    return null;
  end if;

  if frequency = 'monthly' then
    month_difference := (extract(year from p_occurrence_date)::integer - extract(year from anchor_date)::integer) * 12
      + extract(month from p_occurrence_date)::integer - extract(month from anchor_date)::integer;
    expected_day := case
      when rule ->> 'day_of_month' = 'last_day' then extract(day from (date_trunc('month', p_occurrence_date) + interval '1 month - 1 day'))::integer
      else (rule ->> 'day_of_month')::integer
    end;
    if mod(month_difference, interval_value) = 0 and extract(day from p_occurrence_date)::integer = expected_day then
      return candidate_instant;
    end if;
    return null;
  end if;

  year_difference := extract(year from p_occurrence_date)::integer - extract(year from anchor_date)::integer;
  if mod(year_difference, interval_value) = 0
    and extract(month from p_occurrence_date)::integer = (rule ->> 'month')::integer
    and extract(day from p_occurrence_date)::integer = (rule ->> 'day')::integer then
    return candidate_instant;
  end if;
  return null;
end;
$$;

create or replace function public.assert_manage_recurring_event(
  p_event_id uuid,
  p_expected_updated_at timestamptz default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events;
begin
  select * into source_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Recurring event not found' using errcode = 'P0001';
  end if;
  if auth.uid() is null or not public.can_manage_event(source_event.space_id, source_event.scope, source_event.owner_user_id) then
    raise exception 'Not permitted to manage this event' using errcode = 'P0001';
  end if;
  if source_event.recurrence_rule is null then
    raise exception 'Event is not recurring' using errcode = 'P0001';
  end if;
  if p_expected_updated_at is not null and source_event.updated_at is distinct from p_expected_updated_at then
    raise exception 'Event was modified concurrently' using errcode = 'P0001';
  end if;
  return source_event;
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
  source_time_zone := source_event.recurrence_rule ->> 'time_zone';
  if jsonb_typeof(p_new_recurrence_rule) is distinct from 'object'
    or p_new_recurrence_rule ->> 'time_zone' is distinct from source_time_zone then
    raise exception 'Split child must keep the source recurrence timezone' using errcode = 'P0001';
  end if;
  if (p_new_starts_at at time zone source_time_zone)::date is distinct from p_split_occurrence_date then
    raise exception 'Split child must start on the selected occurrence date' using errcode = 'P0001';
  end if;
  if p_new_title is null or btrim(p_new_title) = '' or (p_new_ends_at is not null and p_new_ends_at < p_new_starts_at) then
    raise exception 'Split child event data is invalid' using errcode = 'P0001';
  end if;

  update public.events
  set recurrence_until = split_instant
  where id = source_event.id;

  insert into public.events (
    space_id, created_by, scope, owner_user_id, title, description, starts_at, ends_at, all_day,
    recurrence_rule, series_id, parent_event_id, recurrence_until
  )
  values (
    source_event.space_id, source_event.created_by, source_event.scope, source_event.owner_user_id,
    p_new_title, p_new_description, p_new_starts_at, p_new_ends_at, p_new_all_day,
    p_new_recurrence_rule, coalesce(source_event.series_id, source_event.id), source_event.id, null
  )
  returning * into child_event;
  return child_event;
end;
$$;

create or replace function public.delete_logical_series(
  p_event_id uuid,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_event public.events;
  root_event_id uuid;
  lineage_event public.events;
begin
  select * into selected_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Recurring event not found' using errcode = 'P0001';
  end if;
  if auth.uid() is null or not public.can_manage_event(selected_event.space_id, selected_event.scope, selected_event.owner_user_id) then
    raise exception 'Not permitted to manage this event' using errcode = 'P0001';
  end if;
  if selected_event.recurrence_rule is null then
    raise exception 'Event is not recurring' using errcode = 'P0001';
  end if;
  if p_expected_updated_at is not null and selected_event.updated_at is distinct from p_expected_updated_at then
    raise exception 'Event was modified concurrently' using errcode = 'P0001';
  end if;
  root_event_id := coalesce(selected_event.series_id, selected_event.id);

  for lineage_event in
    select * from public.events where coalesce(series_id, id) = root_event_id for update
  loop
    if not public.can_manage_event(lineage_event.space_id, lineage_event.scope, lineage_event.owner_user_id) then
      raise exception 'Not permitted to manage every event in this logical series' using errcode = 'P0001';
    end if;
  end loop;

  delete from public.event_occurrence_exceptions exception
  using public.events event
  where exception.event_id = event.id and coalesce(event.series_id, event.id) = root_event_id;

  loop
    delete from public.events event
    where coalesce(event.series_id, event.id) = root_event_id
      and not exists (select 1 from public.events child where child.parent_event_id = event.id)
    returning event.id into lineage_event.id;
    exit when not found;
  end loop;
end;
$$;

revoke all on function public.recurring_occurrence_instant(public.events, date) from public;
revoke all on function public.assert_manage_recurring_event(uuid, timestamptz) from public;
revoke all on function public.upsert_occurrence_override(uuid, date, jsonb, timestamptz) from public;
revoke all on function public.delete_occurrence(uuid, date, timestamptz) from public;
revoke all on function public.split_recurring_event(uuid, date, text, text, timestamptz, timestamptz, boolean, jsonb, timestamptz) from public;
revoke all on function public.delete_logical_series(uuid, timestamptz) from public;

grant execute on function public.upsert_occurrence_override(uuid, date, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_occurrence(uuid, date, timestamptz) to authenticated;
grant execute on function public.split_recurring_event(uuid, date, text, text, timestamptz, timestamptz, boolean, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_logical_series(uuid, timestamptz) to authenticated;

commit;
