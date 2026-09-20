begin;

do $$
begin
  if to_regclass('public.reminder_deliveries') is not null then
    raise exception 'reminder_deliveries already exists; inspect the database before applying this additive patch';
  end if;

  if to_regprocedure('public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)') is not null then
    raise exception 'claim_reminder_delivery already exists; inspect the database before applying this additive patch';
  end if;

  if to_regclass('public.events') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.push_subscriptions') is null
    or to_regprocedure('public.touch_updated_at()') is null
    or (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name in (
          'id',
          'space_id',
          'scope',
          'owner_user_id',
          'recurrence_rule',
          'reminder_kind',
          'time_zone',
          'reminder_schedule_changed_at'
        )
    ) <> 8
    or (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'space_members'
        and column_name in ('space_id', 'user_id')
    ) <> 2
    or (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'push_subscriptions'
        and column_name in ('id', 'user_id', 'disabled_at', 'expiration_time')
    ) <> 4
    or not exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.events'::regclass
        and tgname = 'events_prepare_reminder_schedule'
        and not tgisinternal
    ) then
    raise exception 'v0.1.8.2 Slice B reminder persistence must exist before applying Slice C1';
  end if;
end;
$$;

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  recipient_user_id uuid not null,
  subscription_id uuid not null,
  due_at timestamptz not null,
  status text not null,
  result_code text,
  provider_status smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_deliveries_status_check check (
    status in ('claimed', 'sent', 'failed')
  ),
  constraint reminder_deliveries_provider_status_check check (
    provider_status is null or provider_status between 100 and 599
  ),
  constraint reminder_deliveries_result_shape_check check (
    (status = 'claimed' and result_code is null and provider_status is null)
    or (status = 'sent' and result_code = 'delivered' and provider_status between 200 and 299)
    or (status = 'failed' and result_code is not null)
  ),
  constraint reminder_deliveries_event_subscription_due_key unique (event_id, subscription_id, due_at)
);

create trigger reminder_deliveries_touch_updated_at
before update on public.reminder_deliveries
for each row execute function public.touch_updated_at();

create function public.claim_reminder_delivery(
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
  on conflict (event_id, subscription_id, due_at) do nothing
  returning reminder_deliveries.id into claimed_delivery_id;

  return claimed_delivery_id;
end;
$$;

comment on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) is
  'Atomically claims one ordinary Event reminder. The expected schedule marker must round-trip at full PostgreSQL timestamptz precision; formatted or truncated values are stale.';

alter table public.reminder_deliveries enable row level security;

revoke all on table public.reminder_deliveries from public, anon, authenticated;
grant select, update on table public.reminder_deliveries to service_role;

revoke all on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) to service_role;

commit;
