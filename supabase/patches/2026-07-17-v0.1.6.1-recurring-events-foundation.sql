-- v0.1.6.1: Recurring events foundation.
-- This patch is additive: null recurrence_rule keeps every existing event one-off.
-- Do not rerun supabase/schema.sql against an existing environment.
--
-- Preflight before applying:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'events'
--   and column_name = 'recurrence_rule';

begin;

alter table public.events
  add column if not exists recurrence_rule jsonb;

create or replace function public.validate_event_recurrence_rule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rule jsonb := new.recurrence_rule;
  frequency text;
  interval_value integer;
  time_zone_value text;
  weekday_item jsonb;
  weekday_value integer;
  previous_weekday integer := 0;
  day_value integer;
  month_value integer;
begin
  if rule is null then
    return new;
  end if;

  if jsonb_typeof(rule) is distinct from 'object' then
    raise exception 'Event recurrence_rule must be a JSON object';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(rule) as keys(name)
    where name not in ('version', 'frequency', 'interval', 'time_zone', 'days_of_week', 'day_of_month', 'month', 'day')
  ) then
    raise exception 'Event recurrence_rule contains unsupported fields';
  end if;

  if jsonb_typeof(rule -> 'version') is distinct from 'number' or rule ->> 'version' is distinct from '1' then
    raise exception 'Event recurrence_rule version must be 1';
  end if;

  frequency := rule ->> 'frequency';
  if frequency is null or frequency not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'Event recurrence_rule frequency is invalid';
  end if;

  if jsonb_typeof(rule -> 'interval') is distinct from 'number' or (rule ->> 'interval') !~ '^[0-9]+$' then
    raise exception 'Event recurrence_rule interval must be an integer';
  end if;
  interval_value := (rule ->> 'interval')::integer;
  if interval_value < 1 or interval_value > 365 then
    raise exception 'Event recurrence_rule interval must be between 1 and 365';
  end if;

  if jsonb_typeof(rule -> 'time_zone') is distinct from 'string' then
    raise exception 'Event recurrence_rule time_zone must be a string';
  end if;
  time_zone_value := rule ->> 'time_zone';
  if coalesce(time_zone_value, '') = '' or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = time_zone_value
  ) then
    raise exception 'Event recurrence_rule time_zone is invalid';
  end if;

  if frequency = 'daily' then
    if rule ? 'days_of_week' or rule ? 'day_of_month' or rule ? 'month' or rule ? 'day' then
      raise exception 'Daily recurrence_rule must not include selectors';
    end if;
  elsif frequency = 'weekly' then
    if not (rule ? 'days_of_week') or rule ? 'day_of_month' or rule ? 'month' or rule ? 'day' then
      raise exception 'Weekly recurrence_rule selectors are invalid';
    end if;
    if jsonb_typeof(rule -> 'days_of_week') is distinct from 'array' or jsonb_array_length(rule -> 'days_of_week') not between 1 and 7 then
      raise exception 'Weekly recurrence_rule days_of_week is invalid';
    end if;

    for weekday_item in select value from jsonb_array_elements(rule -> 'days_of_week') loop
      if jsonb_typeof(weekday_item) is distinct from 'number' or weekday_item #>> '{}' !~ '^[1-7]$' then
        raise exception 'Weekly recurrence_rule weekday is invalid';
      end if;
      weekday_value := (weekday_item #>> '{}')::integer;
      if weekday_value <= previous_weekday then
        raise exception 'Weekly recurrence_rule weekdays must be ascending and unique';
      end if;
      previous_weekday := weekday_value;
    end loop;
  elsif frequency = 'monthly' then
    if not (rule ? 'day_of_month') or rule ? 'days_of_week' or rule ? 'month' or rule ? 'day' then
      raise exception 'Monthly recurrence_rule selectors are invalid';
    end if;
    if rule ->> 'day_of_month' is distinct from 'last_day' then
      if jsonb_typeof(rule -> 'day_of_month') is distinct from 'number' or (rule ->> 'day_of_month') !~ '^[0-9]+$' then
        raise exception 'Monthly recurrence_rule day_of_month is invalid';
      end if;
      day_value := (rule ->> 'day_of_month')::integer;
      if day_value < 1 or day_value > 31 then
        raise exception 'Monthly recurrence_rule day_of_month is invalid';
      end if;
    end if;
  else
    if not (rule ? 'month') or not (rule ? 'day') or rule ? 'days_of_week' or rule ? 'day_of_month' then
      raise exception 'Yearly recurrence_rule selectors are invalid';
    end if;
    if jsonb_typeof(rule -> 'month') is distinct from 'number' or (rule ->> 'month') !~ '^[0-9]+$'
      or jsonb_typeof(rule -> 'day') is distinct from 'number' or (rule ->> 'day') !~ '^[0-9]+$' then
      raise exception 'Yearly recurrence_rule month and day must be integers';
    end if;
    month_value := (rule ->> 'month')::integer;
    day_value := (rule ->> 'day')::integer;
    if month_value < 1 or month_value > 12 or day_value < 1 or day_value > 31
      or (month_value = 2 and day_value > 29)
      or (month_value in (4, 6, 9, 11) and day_value > 30) then
      raise exception 'Yearly recurrence_rule month and day are invalid';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_validate_recurrence_rule on public.events;
create trigger events_validate_recurrence_rule
before insert or update on public.events
for each row execute function public.validate_event_recurrence_rule();

commit;
