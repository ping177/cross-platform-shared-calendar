-- v0.1.8.1: Push subscription persistence and authenticated lifecycle RPCs.
-- This patch is additive and must be applied to an existing environment instead of rerunning schema.sql.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  platform_hint text,
  disabled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id),
  constraint push_subscriptions_endpoint_length_check check (char_length(endpoint) between 1 and 2048),
  constraint push_subscriptions_key_length_check check (
    char_length(p256dh) between 1 and 512
    and char_length(auth) between 1 and 512
  ),
  constraint push_subscriptions_platform_hint_check check (
    platform_hint is null
    or (
      char_length(platform_hint) between 1 and 64
      and platform_hint = btrim(platform_hint)
    )
  ),
  constraint push_subscriptions_endpoint_host_check check (
    endpoint ~ '^https://fcm[.]googleapis[.]com/'
    or endpoint ~ '^https://([a-z0-9-]+[.])*push[.]services[.]mozilla[.]com/'
    or endpoint ~ '^https://([a-z0-9-]+[.])*push[.]apple[.]com/'
  )
);

create index if not exists push_subscriptions_active_user_idx
  on public.push_subscriptions (user_id)
  where disabled_at is null;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.register_push_subscription(
  p_installation_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_expiration_time timestamptz default null,
  p_platform_hint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  registered_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_installation_id is null then
    raise exception 'Installation id is required' using errcode = '22023';
  end if;

  if p_endpoint is null or char_length(p_endpoint) not between 1 and 2048 then
    raise exception 'Push endpoint is invalid' using errcode = '22023';
  end if;

  if p_p256dh is null or char_length(p_p256dh) not between 1 and 512
    or p_auth is null or char_length(p_auth) not between 1 and 512 then
    raise exception 'Push subscription keys are invalid' using errcode = '22023';
  end if;

  if p_platform_hint is not null and (
    char_length(p_platform_hint) not between 1 and 64
    or p_platform_hint is distinct from btrim(p_platform_hint)
  ) then
    raise exception 'Push platform hint is invalid' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    installation_id,
    endpoint,
    p256dh,
    auth,
    expiration_time,
    platform_hint,
    disabled_at,
    last_seen_at
  )
  values (
    current_user_id,
    p_installation_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_expiration_time,
    p_platform_hint,
    null,
    clock_timestamp()
  )
  on conflict (user_id, installation_id) do update
  set endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      platform_hint = excluded.platform_hint,
      disabled_at = null,
      last_seen_at = clock_timestamp()
  returning id into registered_id;

  return registered_id;
exception
  when unique_violation then
    raise exception 'Push endpoint is already registered' using errcode = '23505';
end;
$$;

create or replace function public.disable_push_subscription(p_installation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_installation_id is null then
    raise exception 'Installation id is required' using errcode = '22023';
  end if;

  update public.push_subscriptions
  set disabled_at = coalesce(disabled_at, clock_timestamp())
  where user_id = current_user_id
    and installation_id = p_installation_id;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, update on table public.push_subscriptions to service_role;

revoke all on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) from public;
revoke all on function public.disable_push_subscription(uuid) from public;
revoke all on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) from anon;
revoke all on function public.disable_push_subscription(uuid) from anon;
grant execute on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.disable_push_subscription(uuid) to authenticated;

commit;
