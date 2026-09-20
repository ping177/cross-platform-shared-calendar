-- v0.1.8.2 Slice B: Event reminder persistence and schedule marker.
-- This patch is additive. It does not add delivery state, sender behavior, or Cron.
-- Do not rerun supabase/schema.sql against an existing environment.
--
-- Review these read-only preflight results before applying:
--
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'events'
--   and (
--     column_name in ('reminder_kind', 'time_zone', 'reminder_schedule_changed_at')
--     or column_name like 'reminder%'
--   )
-- order by column_name;
--
-- select count(*) as recurring_rows,
--   count(*) filter (
--     where jsonb_typeof(recurrence_rule -> 'time_zone') is distinct from 'string'
--       or coalesce(recurrence_rule ->> 'time_zone', '') = ''
--       or not exists (
--         select 1 from pg_catalog.pg_timezone_names
--         where name = events.recurrence_rule ->> 'time_zone'
--       )
--   ) as invalid_recurring_time_zones
-- from public.events
-- where recurrence_rule is not null;
--
-- select tgname, pg_get_triggerdef(oid)
-- from pg_trigger
-- where tgrelid = 'public.events'::regclass and not tgisinternal
-- order by tgname;
--
-- select policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'events'
-- order by policyname;
--
-- select relreplident,
--   exists (
--     select 1 from pg_publication_tables
--     where pubname = 'supabase_realtime'
--       and schemaname = 'public'
--       and tablename = 'events'
--   ) as realtime_published
-- from pg_class
-- where oid = 'public.events'::regclass;
--
-- select pg_get_functiondef(
--   'public.split_recurring_event(uuid,date,text,text,timestamptz,timestamptz,boolean,jsonb,timestamptz)'::regprocedure
-- );

begin;

do $$
declare
  slice_b_column_count integer;
  split_definition text;
begin
  select count(*) into slice_b_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name in ('reminder_kind', 'time_zone', 'reminder_schedule_changed_at');

  if slice_b_column_count <> 0 then
    raise exception 'Slice B Event columns already or partially exist; stop and review before applying';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'reminder_offset_minutes'
  ) then
    raise exception 'Legacy reminder_offset_minutes exists; stop and review before applying';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name like 'reminder%'
      and column_name <> 'reminder_offset_minutes'
  ) then
    raise exception 'Unexpected legacy reminder field exists; stop and review before applying';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname in (
        'events_reminder_kind_check',
        'events_reminder_kind_matches_all_day_check',
        'events_reminder_requires_time_zone_check',
        'events_recurring_reminder_unsupported_check',
        'events_recurring_time_zone_consistency_check'
      )
  ) or to_regprocedure('public.prepare_event_reminder_schedule()') is not null
    or exists (
      select 1 from pg_trigger
      where tgrelid = 'public.events'::regclass
        and tgname = 'events_prepare_reminder_schedule'
        and not tgisinternal
    ) then
    raise exception 'Unexpected Slice B constraint, function, or trigger already exists';
  end if;

  if to_regprocedure(
    'public.split_recurring_event(uuid,date,text,text,timestamptz,timestamptz,boolean,jsonb,timestamptz)'
  ) is null then
    raise exception 'Canonical split_recurring_event signature is missing';
  end if;

  select pg_get_functiondef(
    'public.split_recurring_event(uuid,date,text,text,timestamptz,timestamptz,boolean,jsonb,timestamptz)'::regprocedure
  ) into split_definition;
  if split_definition not like '%p_new_recurrence_rule is distinct from source_event.recurrence_rule%'
    or split_definition not like '%p_new_all_day is distinct from source_event.all_day%'
    or split_definition not like '%source_event.recurrence_until%'
    or split_definition not like '%delete from public.event_occurrence_exceptions%' then
    raise exception 'Canonical split_recurring_event definition has drifted';
  end if;

  if (select count(*) from pg_trigger
      where tgrelid = 'public.events'::regclass
        and tgname in ('events_touch_updated_at', 'events_validate_owner', 'events_validate_recurrence_rule')
        and not tgisinternal) <> 3 then
    raise exception 'Required Event trigger baseline has drifted';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename = 'events'
        and policyname in ('events_select_member', 'events_insert_member', 'events_update_member', 'events_delete_member')) <> 4
    or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'events') <> 4 then
    raise exception 'Event RLS policy baseline has drifted';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) or (select relreplident from pg_class where oid = 'public.events'::regclass) <> 'f' then
    raise exception 'Event Realtime or replica identity baseline has drifted';
  end if;

  if exists (
    select 1
    from public.events
    where recurrence_rule is not null
      and (
        jsonb_typeof(recurrence_rule -> 'time_zone') is distinct from 'string'
        or coalesce(recurrence_rule ->> 'time_zone', '') = ''
        or not exists (
          select 1
          from pg_catalog.pg_timezone_names
          where name = events.recurrence_rule ->> 'time_zone'
        )
      )
  ) then
    raise exception 'Historical recurring Event has a missing or invalid recurrence timezone';
  end if;
end;
$$;

alter table public.events
  add column reminder_kind text,
  add column time_zone text,
  add column reminder_schedule_changed_at timestamptz not null default transaction_timestamp();

update public.events
set time_zone = recurrence_rule ->> 'time_zone'
where recurrence_rule is not null;

alter table public.events
  add constraint events_reminder_kind_check check (
    reminder_kind is null
    or reminder_kind in (
      'timed_at_start',
      'timed_10m_before',
      'timed_30m_before',
      'timed_1h_before',
      'timed_previous_day_same_time',
      'all_day_same_day_08',
      'all_day_previous_day_20'
    )
  ),
  add constraint events_reminder_kind_matches_all_day_check check (
    reminder_kind is null
    or (not all_day and reminder_kind like 'timed_%')
    or (all_day and reminder_kind like 'all_day_%')
  ),
  add constraint events_reminder_requires_time_zone_check check (
    reminder_kind is null or time_zone is not null
  ),
  add constraint events_recurring_reminder_unsupported_check check (
    recurrence_rule is null or reminder_kind is null
  ),
  add constraint events_recurring_time_zone_consistency_check check (
    recurrence_rule is null
    or (time_zone is not null and time_zone = recurrence_rule ->> 'time_zone')
  );

create or replace function public.prepare_event_reminder_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.time_zone is not null and not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.time_zone
  ) then
    raise exception 'Event time_zone must be a valid IANA timezone';
  end if;

  if tg_op = 'INSERT' then
    new.reminder_schedule_changed_at = clock_timestamp();
  elsif row(new.starts_at, new.all_day, new.reminder_kind, new.time_zone)
    is distinct from row(old.starts_at, old.all_day, old.reminder_kind, old.time_zone) then
    new.reminder_schedule_changed_at = clock_timestamp();
  else
    new.reminder_schedule_changed_at = old.reminder_schedule_changed_at;
  end if;

  return new;
end;
$$;

create trigger events_prepare_reminder_schedule
before insert or update on public.events
for each row execute function public.prepare_event_reminder_schedule();

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
    recurrence_rule, time_zone, series_id, parent_event_id, recurrence_until
  )
  values (
    source_event.space_id, source_event.created_by, source_event.scope, source_event.owner_user_id,
    p_new_title, p_new_description, p_new_starts_at, p_new_ends_at, source_event.all_day,
    source_event.recurrence_rule, source_event.time_zone, coalesce(source_event.series_id, source_event.id), source_event.id, source_event.recurrence_until
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

alter table public.events
  alter column reminder_schedule_changed_at drop default;

commit;
