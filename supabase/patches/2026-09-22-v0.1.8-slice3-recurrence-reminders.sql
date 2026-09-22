-- v0.1.8 Slice 3: recurring Reminder persistence, identity, and atomic claim.
-- Additive forward patch for environments that already have the complete v0.1.8.2 baseline.

begin;

do $$
declare
  marker_definition text;
  split_definition text;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_recurring_reminder_unsupported_check'
  ) then
    raise exception 'Temporary recurring Reminder constraint is missing; inspect the database before applying Slice 3';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reminder_deliveries'
      and column_name = 'occurrence_date'
  ) then
    raise exception 'Slice 3 ledger identity already or partially exists';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reminder_deliveries'::regclass
      and conname = 'reminder_deliveries_event_subscription_due_key'
  ) then
    raise exception 'Ordinary Reminder ledger identity baseline has drifted';
  end if;

  if to_regprocedure(
    'public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)'
  ) is not null then
    raise exception 'Recurring Reminder claim already exists';
  end if;

  select pg_get_functiondef('public.prepare_event_reminder_schedule()'::regprocedure)
  into marker_definition;
  if marker_definition not like '%new.starts_at%'
    or marker_definition not like '%new.reminder_kind%'
    or marker_definition like '%new.recurrence_rule%' then
    raise exception 'Reminder schedule marker baseline has drifted';
  end if;

  select pg_get_functiondef(
    'public.split_recurring_event(uuid,date,text,text,timestamp with time zone,timestamp with time zone,boolean,jsonb,timestamp with time zone)'::regprocedure
  ) into split_definition;
  if split_definition not like '%source_event.recurrence_rule%'
    or split_definition not like '%source_event.time_zone%'
    or split_definition like '%source_event.reminder_kind%' then
    raise exception 'Recurring split Reminder baseline has drifted';
  end if;
end;
$$;

alter table public.events
  drop constraint events_recurring_reminder_unsupported_check;

alter table public.reminder_deliveries
  add column occurrence_date date,
  drop constraint reminder_deliveries_event_subscription_due_key,
  add constraint reminder_deliveries_occurrence_identity_key
    unique nulls not distinct (event_id, occurrence_date, subscription_id, due_at);

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
  elsif row(new.starts_at, new.all_day, new.reminder_kind, new.time_zone, new.recurrence_rule)
    is distinct from row(old.starts_at, old.all_day, old.reminder_kind, old.time_zone, old.recurrence_rule) then
    new.reminder_schedule_changed_at = clock_timestamp();
  else
    new.reminder_schedule_changed_at = old.reminder_schedule_changed_at;
  end if;

  return new;
end;
$$;

create or replace function public.claim_reminder_delivery(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_subscription_id uuid,
  p_due_at timestamptz,
  p_expected_reminder_schedule_changed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  claim_now timestamptz := pg_catalog.clock_timestamp();
  claimed_delivery_id uuid;
begin
  insert into public.reminder_deliveries (
    event_id,
    recipient_user_id,
    subscription_id,
    due_at,
    status,
    result_code,
    provider_status,
    created_at,
    updated_at
  )
  select
    event.id,
    p_recipient_user_id,
    subscription.id,
    p_due_at,
    'claimed',
    null,
    null,
    claim_now,
    claim_now
  from public.events event
  join public.space_members recipient_membership
    on recipient_membership.space_id = event.space_id
   and recipient_membership.user_id = p_recipient_user_id
  join public.push_subscriptions subscription
    on subscription.id = p_subscription_id
   and subscription.user_id = p_recipient_user_id
  where event.id = p_event_id
    and event.recurrence_rule is null
    and event.reminder_kind is not null
    and event.time_zone is not null
    and event.reminder_schedule_changed_at = p_expected_reminder_schedule_changed_at
    and p_due_at >= event.reminder_schedule_changed_at
    and p_due_at <= claim_now
    and p_due_at >= claim_now - interval '10 minutes'
    and (
      event.scope = 'shared'
      or (
        event.scope = 'personal'
        and event.owner_user_id = p_recipient_user_id
      )
    )
    and subscription.disabled_at is null
    and (
      subscription.expiration_time is null
      or subscription.expiration_time > claim_now
    )
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing
  returning reminder_deliveries.id into claimed_delivery_id;

  return claimed_delivery_id;
end;
$$;

create or replace function public.claim_recurring_reminder_delivery(
  p_source_event_id uuid,
  p_logical_series_id uuid,
  p_occurrence_date date,
  p_recipient_user_id uuid,
  p_subscription_id uuid,
  p_due_at timestamptz,
  p_expected_source_updated_at timestamptz,
  p_expected_reminder_schedule_changed_at timestamptz,
  p_expected_exception_id uuid,
  p_expected_exception_updated_at timestamptz,
  p_expected_exception_type text,
  p_effective_schedule_changed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  claim_now timestamptz := pg_catalog.clock_timestamp();
  claimed_delivery_id uuid;
begin
  insert into public.reminder_deliveries (
    event_id,
    recipient_user_id,
    subscription_id,
    occurrence_date,
    due_at,
    status,
    result_code,
    provider_status,
    created_at,
    updated_at
  )
  select
    p_logical_series_id,
    p_recipient_user_id,
    subscription.id,
    p_occurrence_date,
    p_due_at,
    'claimed',
    null,
    null,
    claim_now,
    claim_now
  from public.events event
  join public.space_members recipient_membership
    on recipient_membership.space_id = event.space_id
   and recipient_membership.user_id = p_recipient_user_id
  join public.push_subscriptions subscription
    on subscription.id = p_subscription_id
   and subscription.user_id = p_recipient_user_id
  where event.id = p_source_event_id
    and event.recurrence_rule is not null
    and event.reminder_kind is not null
    and event.time_zone is not null
    and event.time_zone = event.recurrence_rule ->> 'time_zone'
    and coalesce(event.series_id, event.id) = p_logical_series_id
    and event.updated_at = p_expected_source_updated_at
    and event.reminder_schedule_changed_at = p_expected_reminder_schedule_changed_at
    and p_effective_schedule_changed_at >= event.reminder_schedule_changed_at
    and p_due_at >= p_effective_schedule_changed_at
    and p_due_at <= claim_now
    and p_due_at >= claim_now - interval '10 minutes'
    and (
      (
        p_expected_exception_id is null
        and p_expected_exception_updated_at is null
        and p_expected_exception_type is null
        and not exists (
          select 1
          from public.event_occurrence_exceptions exception
          where exception.event_id = event.id
            and exception.occurrence_date = p_occurrence_date
        )
      )
      or (
        p_expected_exception_id is not null
        and p_expected_exception_updated_at is not null
        and p_expected_exception_type = 'override'
        and exists (
          select 1
          from public.event_occurrence_exceptions exception
          where exception.id = p_expected_exception_id
            and exception.event_id = event.id
            and exception.occurrence_date = p_occurrence_date
            and exception.updated_at = p_expected_exception_updated_at
            and exception.exception_type = p_expected_exception_type
        )
      )
    )
    and (
      event.scope = 'shared'
      or (
        event.scope = 'personal'
        and event.owner_user_id = p_recipient_user_id
      )
    )
    and subscription.disabled_at is null
    and (
      subscription.expiration_time is null
      or subscription.expiration_time > claim_now
    )
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing
  returning reminder_deliveries.id into claimed_delivery_id;

  return claimed_delivery_id;
end;
$$;

comment on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) is
  'Atomically claims one projected recurring occurrence after exact source and exception snapshot revalidation. Recurrence expansion remains outside SQL.';

revoke all on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) from public;
revoke all on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) from anon, authenticated;
grant execute on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) to service_role;

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
    recurrence_rule, reminder_kind, time_zone, series_id, parent_event_id, recurrence_until
  )
  values (
    source_event.space_id, source_event.created_by, source_event.scope, source_event.owner_user_id,
    p_new_title, p_new_description, p_new_starts_at, p_new_ends_at, source_event.all_day,
    source_event.recurrence_rule, source_event.reminder_kind, source_event.time_zone,
    coalesce(source_event.series_id, source_event.id), source_event.id, source_event.recurrence_until
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

commit;
