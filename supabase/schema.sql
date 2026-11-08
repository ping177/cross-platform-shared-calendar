create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text constraint profiles_display_name_format_check check (
    display_name is null
    or (
      char_length(display_name) between 1 and 20
      and display_name = regexp_replace(display_name, '^[[:space:]]+|[[:space:]]+$', '', 'g')
    )
  ),
  created_at timestamptz not null default now(),
  avatar_preset text constraint profiles_avatar_preset_check check (
    avatar_preset is null or avatar_preset in ('cat','rabbit','bear','fox','dog','bird','flower','leaf','moon','star','cloud','sun')
  ),
  avatar_path text constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  ),
  constraint profiles_avatar_source_check check (avatar_preset is null or avatar_path is null)
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'shared'
    constraint spaces_kind_check check (kind in ('personal', 'shared')),
  invite_code text not null unique,
  created_by uuid not null default auth.uid(), -- Immutable historical UUID; ownership is membership-based.
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null
    constraint space_members_user_id_fkey references auth.users(id) on delete cascade
    constraint space_members_user_profile_fkey references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.space_modules (
  space_id uuid not null references public.spaces(id) on delete cascade,
  module_key text not null check (module_key in ('tasks', 'lists', 'important_dates', 'review', 'memo')),
  enabled boolean not null,
  primary key (space_id, module_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'space_members_user_profile_fkey'
      and conrelid = 'public.space_members'::regclass
  ) then
    alter table public.space_members
      add constraint space_members_user_profile_fkey
      foreign key (user_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end;
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null default auth.uid(), -- Audit snapshot survives account deletion.
  scope text not null check (scope in ('personal', 'shared')),
  owner_user_id uuid references auth.users(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  reminder_kind text,
  time_zone text,
  reminder_schedule_changed_at timestamptz not null,
  recurrence_rule jsonb,
  series_id uuid,
  parent_event_id uuid,
  recurrence_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_scope_owner_shape check (
    (scope = 'shared' and owner_user_id is null)
    or
    (scope = 'personal' and owner_user_id is not null)
  ),
  constraint event_ends_after_start check (ends_at is null or ends_at >= starts_at),
  constraint events_recurrence_until_after_start_check check (recurrence_until is null or recurrence_until >= starts_at),
  constraint events_reminder_kind_check check (
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
  constraint events_reminder_kind_matches_all_day_check check (
    reminder_kind is null
    or (not all_day and reminder_kind like 'timed_%')
    or (all_day and reminder_kind like 'all_day_%')
  ),
  constraint events_reminder_requires_time_zone_check check (
    reminder_kind is null or time_zone is not null
  ),
  constraint events_recurring_time_zone_consistency_check check (
    recurrence_rule is null
    or (time_zone is not null and time_zone = recurrence_rule ->> 'time_zone')
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null default auth.uid(), -- Never cascade Space-owned Tasks from a Profile.
  assigned_to_user_id uuid,
  title text not null,
  status text not null default 'open',
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reminder_kind text default null,
  time_zone text,
  reminder_schedule_changed_at timestamptz not null,
  constraint tasks_reminder_kind_check check (reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')),
  constraint tasks_reminder_requires_due_zone_check check (reminder_kind is null or (due_on is not null and isfinite(due_on) and time_zone is not null)),
  constraint tasks_assigned_member_fkey
    foreign key (space_id, assigned_to_user_id)
    references public.space_members(space_id, user_id)
    on delete set null (assigned_to_user_id),
  constraint tasks_title_format_check check (
    char_length(title) between 1 and 200
    and title = regexp_replace(title, '^[[:space:]]+|[[:space:]]+$', '', 'g')
  ),
  constraint tasks_status_check check (status in ('open', 'completed'))
);

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

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  recipient_user_id uuid not null,
  subscription_id uuid not null,
  occurrence_date date,
  due_at timestamptz not null,
  status text not null,
  result_code text,
  provider_status smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  important_date_id uuid,
  task_id uuid,
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
  constraint reminder_deliveries_occurrence_identity_key
    unique nulls not distinct (event_id, important_date_id, task_id, occurrence_date, subscription_id, due_at),
  constraint reminder_deliveries_source_identity_check check (
    num_nonnulls(event_id, important_date_id, task_id) = 1
  ),
  constraint reminder_deliveries_important_date_occurrence_check check (
    important_date_id is null or occurrence_date is not null
  ),
  constraint reminder_deliveries_task_occurrence_check check (task_id is null or occurrence_date is not null)
);

create unique index if not exists spaces_personal_created_by_idx
  on public.spaces (created_by) where kind = 'personal';
create index if not exists space_members_space_id_idx on public.space_members (space_id);
create index if not exists events_space_starts_idx on public.events (space_id, starts_at);
create index if not exists events_owner_idx on public.events (owner_user_id);
create index if not exists events_series_starts_idx on public.events (series_id, starts_at);
create index if not exists events_parent_event_id_idx on public.events (parent_event_id) where parent_event_id is not null;
create index if not exists events_space_recurrence_until_idx on public.events (space_id, recurrence_until) where recurrence_until is not null;
create index if not exists tasks_space_status_due_created_id_idx on public.tasks (space_id, status, due_on, created_at, id);
create index if not exists push_subscriptions_active_user_idx on public.push_subscriptions (user_id) where disabled_at is null;

alter table public.events replica identity full;
alter table public.tasks replica identity full;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create or replace function public.validate_space_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'Space kind is immutable';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Space created_by is immutable';
  end if;
  if old.kind = 'personal' and new.invite_code is distinct from old.invite_code then
    raise exception 'Personal Space invite code is immutable';
  end if;
  if new.name is distinct from old.name then
    if auth.uid() is null
      or (old.kind = 'personal' and old.created_by is distinct from auth.uid())
      or not exists (
        select 1 from public.space_members
        where space_id = old.id and user_id = auth.uid() and role = 'owner'
      ) then
      raise exception using errcode = '42501', message = 'Only the Space owner may change its name';
    end if;
    -- Exactly the ECMAScript trim() character set; char_length counts code points.
    new.name := pg_catalog.btrim(new.name,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if new.name is null or pg_catalog.char_length(new.name) not between 1 and 80 then
      raise exception using errcode = '22023', message = 'Space name must contain 1–80 Unicode characters';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_personal_space_member()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  space_kind text;
  space_creator uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select kind into space_kind from public.spaces where id = old.space_id;
    if space_kind = 'personal' then
      if tg_op = 'DELETE' then
        raise exception 'Personal Space owner membership cannot be removed';
      end if;
      raise exception 'Personal Space owner membership cannot be changed';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select kind, created_by into space_kind, space_creator
    from public.spaces where id = new.space_id;
    if space_kind = 'personal'
      and (new.user_id is distinct from space_creator or new.role <> 'owner') then
      raise exception 'Personal Space may only contain its owner';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enable_default_space_modules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.space_modules (space_id, module_key, enabled)
  values (new.id, 'tasks', true);
  return new;
end;
$$;

create or replace function public.validate_task_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id then
    raise exception 'Task space_id is immutable';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'Task created_by is immutable';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_task_status_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status
    and old.assigned_to_user_id is not null
    and old.assigned_to_user_id is distinct from auth.uid() then
    raise exception 'Only the current Task assignee may change status';
  end if;

  return new;
end;
$$;

alter table public.events
  add constraint events_series_id_fkey foreign key (series_id) references public.events(id) on delete restrict,
  add constraint events_parent_event_id_fkey foreign key (parent_event_id) references public.events(id) on delete restrict;

create table public.event_occurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  occurrence_date date not null,
  exception_type text not null check (exception_type in ('deleted', 'override')),
  override_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_occurrence_exceptions_event_occurrence_date_key unique (event_id, occurrence_date),
  constraint event_occurrence_exceptions_override_shape_check check ((exception_type = 'deleted' and override_data is null) or (exception_type = 'override' and override_data is not null and jsonb_typeof(override_data) = 'object'))
);

create index event_occurrence_exceptions_override_date_idx on public.event_occurrence_exceptions (event_id, occurrence_date) where exception_type = 'override';

create or replace function public.validate_event_occurrence_exception()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'Event occurrence exception event_id is immutable';
  end if;
  if not exists (select 1 from public.events event where event.id = new.event_id and event.recurrence_rule is not null) then
    raise exception 'Event occurrence exceptions require a recurring event';
  end if;
  return new;
end;
$$;

create trigger event_occurrence_exceptions_validate_event before insert or update on public.event_occurrence_exceptions for each row execute function public.validate_event_occurrence_exception();
create trigger event_occurrence_exceptions_touch_updated_at before update on public.event_occurrence_exceptions for each row execute function public.touch_updated_at();

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

create trigger spaces_validate_identity
before update on public.spaces
for each row execute function public.validate_space_identity();

create trigger spaces_enable_default_modules
after insert on public.spaces
for each row execute function public.enable_default_space_modules();

create trigger space_members_guard_personal
before insert or update or delete on public.space_members
for each row execute function public.guard_personal_space_member();

drop trigger if exists tasks_validate_identity on public.tasks;
create trigger tasks_validate_identity
before update on public.tasks
for each row execute function public.validate_task_identity();

drop trigger if exists tasks_enforce_status_owner on public.tasks;
create trigger tasks_enforce_status_owner
before update on public.tasks
for each row execute function public.enforce_task_status_owner();

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists reminder_deliveries_touch_updated_at on public.reminder_deliveries;
create trigger reminder_deliveries_touch_updated_at
before update on public.reminder_deliveries
for each row execute function public.touch_updated_at();

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members sm
    where sm.space_id = target_space_id
      and sm.user_id = auth.uid()
  );
$$;

create or replace function public.is_space_module_enabled(target_space_id uuid, target_module_key text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.space_modules sm
    where sm.space_id = target_space_id
      and sm.module_key = target_module_key
      and sm.enabled
  );
$$;

create or replace function public.are_users_in_same_space(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = first_user_id
      and theirs.user_id = second_user_id
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.spaces where invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.validate_event_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.space_id is distinct from old.space_id then
      raise exception 'Event space_id cannot be changed';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'Event created_by cannot be changed';
    end if;

    if new.series_id is distinct from old.series_id or new.parent_event_id is distinct from old.parent_event_id then
      raise exception 'Event lineage cannot be changed';
    end if;
    if row(new.scope,new.owner_user_id) is distinct from row(old.scope,old.owner_user_id) then
      if not exists (select 1 from public.spaces where id=old.space_id and kind='shared')
        or auth.uid() is null or not public.is_space_member(old.space_id) then
        raise exception 'Only current Shared Space members may change Event audience';
      end if;
    end if;
  end if;

  if new.scope = 'shared' and new.owner_user_id is not null then
    raise exception 'Shared events must not have an owner_user_id';
  end if;

  if new.scope = 'personal' and new.owner_user_id is null then
    raise exception 'Personal events must have an owner_user_id';
  end if;

  if exists (
    select 1 from public.spaces s
    where s.id = new.space_id
      and s.kind = 'personal'
      and (new.scope <> 'personal' or new.owner_user_id is distinct from s.created_by)
  ) then
    raise exception 'Personal Space events must belong to the Space owner';
  end if;

  if new.scope = 'personal' and not exists (
    select 1
    from public.space_members sm
    where sm.space_id = new.space_id
      and sm.user_id = new.owner_user_id
  ) then
    raise exception 'Personal event owner must be a member of the event space';
  end if;

  return new;
end;
$$;

drop trigger if exists events_validate_owner on public.events;
create trigger events_validate_owner
before insert or update on public.events
for each row execute function public.validate_event_owner();

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
  elsif row(new.starts_at, new.all_day, new.reminder_kind, new.time_zone, new.recurrence_rule, new.scope, new.owner_user_id)
    is distinct from row(old.starts_at, old.all_day, old.reminder_kind, old.time_zone, old.recurrence_rule, old.scope, old.owner_user_id) then
    new.reminder_schedule_changed_at = greatest(clock_timestamp(), old.reminder_schedule_changed_at + interval '1 microsecond');
  else
    new.reminder_schedule_changed_at = old.reminder_schedule_changed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists events_prepare_reminder_schedule on public.events;
create trigger events_prepare_reminder_schedule
before insert or update on public.events
for each row execute function public.prepare_event_reminder_schedule();

create or replace function public.can_manage_event(
  event_space_id uuid,
  event_scope text,
  event_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_space_member(event_space_id)
    and exists (
      select 1 from public.spaces s where s.id=event_space_id
      and (s.kind='shared' or (s.kind='personal' and s.created_by=auth.uid()
        and event_scope='personal' and event_owner_user_id=auth.uid()))
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, null)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_space_with_invite(space_name text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_space public.spaces;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a space';
  end if;

  if nullif(trim(space_name), '') is null then
    raise exception 'Space name is required';
  end if;

  insert into public.spaces (name, kind, invite_code, created_by)
  values (trim(space_name), 'shared', public.generate_invite_code(), current_user_id)
  returning * into new_space;

  insert into public.space_members (space_id, user_id, role)
  values (new_space.id, current_user_id, 'owner');

  return new_space;
end;
$$;

create or replace function public.ensure_personal_space()
returns public.spaces
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  personal_space public.spaces;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to ensure a personal space';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(10110, pg_catalog.hashtext(current_user_id::text));
  select * into personal_space
  from public.spaces
  where kind = 'personal' and created_by = current_user_id;
  if personal_space.id is not null then
    return personal_space;
  end if;

  insert into public.spaces (name, kind, invite_code, created_by)
  values ('个人空间', 'personal', public.generate_invite_code(), current_user_id)
  returning * into personal_space;

  insert into public.space_members (space_id, user_id, role)
  values (personal_space.id, current_user_id, 'owner');

  return personal_space;
end;
$$;

create or replace function public.join_space_by_invite_code(code text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_space public.spaces;
  member_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join a space';
  end if;

  if nullif(trim(code), '') is null then
    raise exception 'Invite code is required';
  end if;

  select *
  into target_space
  from public.spaces
  where invite_code = upper(trim(code));

  if target_space.id is null then
    raise exception 'Invite code is invalid';
  end if;

  if target_space.kind = 'personal' then
    raise exception 'Personal Spaces cannot be joined by invite code';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_space.id::text));

  if exists (
    select 1 from public.space_members
    where space_id = target_space.id and user_id = current_user_id
  ) then
    raise exception 'You are already a member of this space';
  end if;

  select count(*)
  into member_count
  from public.space_members
  where space_id = target_space.id;

  if member_count >= 2 then
    raise exception 'This space is already full';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (target_space.id, current_user_id, 'member');

  return target_space;
end;
$$;

create or replace function public.rotate_invite_code(space_id uuid)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_space public.spaces;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to rotate an invite code';
  end if;

  if not exists (
    select 1
    from public.space_members sm
    where sm.space_id = rotate_invite_code.space_id
      and sm.user_id = current_user_id
  ) then
    raise exception 'You are not a member of this space';
  end if;

  if exists (
    select 1 from public.spaces s
    where s.id = rotate_invite_code.space_id and s.kind = 'personal'
  ) then
    raise exception 'Personal Space invite codes cannot be rotated';
  end if;

  update public.spaces
  set invite_code = public.generate_invite_code()
  where id = rotate_invite_code.space_id
  returning * into updated_space;

  return updated_space;
end;
$$;

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
  if p_module_key is null or p_module_key not in ('tasks', 'review', 'lists', 'important_dates') or p_enabled is null then
    raise exception 'Only Tasks, Review, Lists, and Important Dates modules may be toggled in this version';
  end if;
  if p_module_key in ('tasks', 'review', 'important_dates') then
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
  source_space_id uuid;
begin
  select space_id into source_space_id from public.events where id=p_event_id;
  if source_space_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  -- This separate statement revalidates Event, member, subscription and markers
  -- against state committed after the Space lock was acquired.
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

comment on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) is
  'Atomically claims one ordinary Event reminder. The expected schedule marker must round-trip at full PostgreSQL timestamptz precision; formatted or truncated values are stale.';

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
  source_space_id uuid;
begin
  select space_id into source_space_id from public.events where id=p_source_event_id;
  if source_space_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  -- This separate statement revalidates Event, member, subscription and markers
  -- against state committed after the Space lock was acquired.
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

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_modules enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.event_occurrence_exceptions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;

drop policy if exists "profiles_select_same_space" on public.profiles;
create policy "profiles_select_same_space"
on public.profiles for select
using (
  id = auth.uid()
  or public.are_users_in_same_space(auth.uid(), id)
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "spaces_select_member" on public.spaces;
create policy "spaces_select_member"
on public.spaces for select
using (public.is_space_member(id));

drop policy if exists "spaces_update_member" on public.spaces;
create policy "spaces_update_member"
on public.spaces for update
using (public.is_space_member(id))
with check (public.is_space_member(id));

drop policy if exists "space_members_select_member" on public.space_members;
create policy "space_members_select_member"
on public.space_members for select
using (public.is_space_member(space_id));

create policy "space_modules_select_member"
on public.space_modules for select
using (public.is_space_member(space_id));

drop policy if exists "events_select_member" on public.events;
create policy "events_select_member"
on public.events for select
using (public.is_space_member(space_id));

drop policy if exists "events_insert_member" on public.events;
create policy "events_insert_member"
on public.events for insert
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
);

drop policy if exists "events_update_member" on public.events;
create policy "events_update_member"
on public.events for update
using (public.can_manage_event(space_id, scope, owner_user_id))
with check (public.can_manage_event(space_id, scope, owner_user_id));

drop policy if exists "events_delete_member" on public.events;
create policy "events_delete_member"
on public.events for delete
using (public.can_manage_event(space_id, scope, owner_user_id));

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member"
on public.tasks for select
using (public.is_space_member(space_id));

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member"
on public.tasks for insert
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
  and public.is_space_module_enabled(space_id, 'tasks')
);

drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member"
on public.tasks for update
using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'))
with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'));

drop policy if exists "tasks_delete_member" on public.tasks;
create policy "tasks_delete_member"
on public.tasks for delete
using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'));

create policy "event_occurrence_exceptions_select_event_member"
on public.event_occurrence_exceptions for select
using (exists (select 1 from public.events event where event.id = event_occurrence_exceptions.event_id and public.is_space_member(event.space_id)));
create policy "event_occurrence_exceptions_insert_event_manager"
on public.event_occurrence_exceptions for insert
with check (exists (select 1 from public.events event where event.id = event_occurrence_exceptions.event_id and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)));
create policy "event_occurrence_exceptions_update_event_manager"
on public.event_occurrence_exceptions for update
using (exists (select 1 from public.events event where event.id = event_occurrence_exceptions.event_id and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)))
with check (exists (select 1 from public.events event where event.id = event_occurrence_exceptions.event_id and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)));
create policy "event_occurrence_exceptions_delete_event_manager"
on public.event_occurrence_exceptions for delete
using (exists (select 1 from public.events event where event.id = event_occurrence_exceptions.event_id and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)));

-- Table privileges let authenticated requests reach the RLS policies above.
-- RLS remains the final row-level access control boundary.
grant select, update on table public.profiles to authenticated;
grant select, update on table public.spaces to authenticated;
grant select on table public.space_members to authenticated;
revoke all on table public.space_modules from public, anon, authenticated;
grant select on table public.space_modules to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.event_occurrence_exceptions to authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, update on table public.push_subscriptions to service_role;
-- Include the already-deployed ledger ACL correction in fresh bootstraps.
revoke all on table public.reminder_deliveries from public, anon, authenticated, service_role;
grant select, update on table public.reminder_deliveries to service_role;

grant execute on function public.create_space_with_invite(text) to authenticated;
grant execute on function public.join_space_by_invite_code(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
revoke all on function public.ensure_personal_space() from public, anon;
grant execute on function public.ensure_personal_space() to authenticated;
revoke all on function public.set_space_module_enabled(uuid, text, boolean) from public, anon;
grant execute on function public.set_space_module_enabled(uuid, text, boolean) to authenticated;
revoke all on function public.is_space_module_enabled(uuid, text) from public, anon;
grant execute on function public.is_space_module_enabled(uuid, text) to authenticated;
revoke all on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) from public;
revoke all on function public.disable_push_subscription(uuid) from public;
revoke all on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) from anon;
revoke all on function public.disable_push_subscription(uuid) from anon;
grant execute on function public.register_push_subscription(uuid, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.disable_push_subscription(uuid) to authenticated;
revoke all on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.claim_reminder_delivery(uuid, uuid, uuid, timestamptz, timestamptz) to service_role;
revoke all on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) from public;
revoke all on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) from anon, authenticated;
grant execute on function public.claim_recurring_reminder_delivery(uuid, uuid, date, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, timestamptz, text, timestamptz) to service_role;

-- v0.1.7.3.3.1 final recurrence RPC bootstrap definitions.
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
  lock_space_id uuid;
  source_event public.events;
begin
  select space_id into lock_space_id from public.events where id=p_event_id;
  if lock_space_id is null then raise exception 'Recurring event not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(lock_space_id::text));
  perform 1 from public.spaces where id=lock_space_id for update;
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
    recurrence_rule, reminder_kind, time_zone, series_id, parent_event_id, recurrence_until
  )
  values (
    source_event.space_id, source_event.created_by, source_event.scope, source_event.owner_user_id,
    p_new_title, p_new_description, p_new_starts_at, p_new_ends_at, source_event.all_day,
    source_event.recurrence_rule, source_event.reminder_kind, source_event.time_zone, coalesce(source_event.series_id, source_event.id), source_event.id, source_event.recurrence_until
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
  lock_space_id uuid;
  selected_event public.events;
  root_event_id uuid;
  lineage_event public.events;
begin
  select space_id into lock_space_id from public.events where id=p_event_id;
  if lock_space_id is null then raise exception 'Recurring event not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(lock_space_id::text));
  perform 1 from public.spaces where id=lock_space_id for update;
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

revoke all on function public.recurring_occurrence_instant(public.events, date) from public;
revoke all on function public.assert_manage_recurring_event(uuid, timestamptz) from public;
revoke all on function public.upsert_occurrence_override(uuid, date, jsonb, timestamptz) from public;
revoke all on function public.delete_occurrence(uuid, date, timestamptz) from public;
revoke all on function public.split_recurring_event(uuid, date, text, text, timestamptz, timestamptz, boolean, jsonb, timestamptz) from public;
revoke all on function public.delete_logical_series(uuid, timestamptz) from public;
revoke all on function public.delete_occurrence_and_future(uuid, date, timestamptz) from public;
revoke all on function public.upsert_occurrence_override(uuid, date, jsonb, timestamptz) from anon;
revoke all on function public.delete_occurrence(uuid, date, timestamptz) from anon;
revoke all on function public.split_recurring_event(uuid, date, text, text, timestamptz, timestamptz, boolean, jsonb, timestamptz) from anon;
revoke all on function public.delete_logical_series(uuid, timestamptz) from anon;
revoke all on function public.delete_occurrence_and_future(uuid, date, timestamptz) from anon;
grant execute on function public.upsert_occurrence_override(uuid, date, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_occurrence(uuid, date, timestamptz) to authenticated;
grant execute on function public.split_recurring_event(uuid, date, text, text, timestamptz, timestamptz, boolean, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_logical_series(uuid, timestamptz) to authenticated;
grant execute on function public.delete_occurrence_and_future(uuid, date, timestamptz) to authenticated;

-- v0.1.13 Slice 1A canonical lifecycle definitions.
-- One owner at most is immediate; existence is checked at transaction end so
-- transfer may demote the old owner before promoting the new one atomically.
create unique index space_members_one_owner_idx
  on public.space_members (space_id) where role='owner';

create function public.guard_personal_space_delete()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if old.kind='personal' then
    raise exception 'Personal Space cannot be deleted';
  end if;
  return old;
end;
$$;
create trigger spaces_guard_personal_delete before delete on public.spaces
for each row execute function public.guard_personal_space_delete();

-- A parent row lock also serializes privileged writes and Auth/profile FK
-- cascades, which do not enter the lifecycle RPC advisory lock themselves.
create function public.lock_space_membership_change()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_space_id uuid;
  target_kind text;
begin
  if tg_op='UPDATE' and (new.space_id is distinct from old.space_id or new.user_id is distinct from old.user_id) then
    raise exception 'Membership identity is immutable';
  end if;
  target_space_id := case when tg_op='DELETE' then old.space_id else new.space_id end;
  select kind into target_kind from public.spaces where id=target_space_id for update;
  if target_kind='shared' and tg_op='INSERT'
    and (select count(*) from public.space_members where space_id=target_space_id)>=2 then
    raise exception 'Shared Space is already full';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger space_members_lock_change before insert or update or delete on public.space_members
for each row execute function public.lock_space_membership_change();

create function public.check_shared_space_final_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_space_id uuid;
  member_count bigint;
  owner_count bigint;
begin
  if tg_table_name='spaces' then
    target_space_id := new.id;
  elsif tg_op='DELETE' then
    target_space_id := old.space_id;
  else
    target_space_id := new.space_id;
  end if;
  if exists (select 1 from public.spaces where id=target_space_id and kind='shared') then
    select count(*),count(*) filter(where role='owner') into member_count,owner_count
    from public.space_members where space_id=target_space_id;
    if owner_count<>1 or member_count>2 then
      raise exception 'Live Shared Space requires exactly one owner and at most two members';
    end if;
  end if;
  return null;
end;
$$;
create constraint trigger spaces_shared_final_state after insert on public.spaces
deferrable initially deferred for each row execute function public.check_shared_space_final_state();
create constraint trigger space_members_shared_final_state after insert or update or delete on public.space_members
deferrable initially deferred for each row execute function public.check_shared_space_final_state();

-- Called only by the four owner/member lifecycle RPCs. A null owner selects
-- every Event in the Space for hard delete. Ledger rows are never selected.
create function public.delete_lifecycle_event_set(p_space_id uuid,p_owner_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  remaining_count bigint;
  deleted_count bigint;
begin
  if exists (
    with target as (
      select id from public.events
      where space_id=p_space_id and (p_owner_user_id is null or (scope='personal' and owner_user_id=p_owner_user_id))
    ), edges as (
      select child.id child_id,parent.id parent_id,
        child.space_id child_space,parent.space_id parent_space,
        child.scope child_scope,parent.scope parent_scope,
        child.owner_user_id child_owner,parent.owner_user_id parent_owner
      from public.events child join public.events parent
        on parent.id=child.series_id or parent.id=child.parent_event_id
      where child.id<>parent.id
    )
    select 1 from edges e
    where (e.child_id in (select id from target) or e.parent_id in (select id from target))
      and (e.child_id not in (select id from target) or e.parent_id not in (select id from target)
        or e.child_space is distinct from e.parent_space
        or e.child_scope is distinct from e.parent_scope
        or e.child_owner is distinct from e.parent_owner)
  ) or exists (
    select 1 from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id))
      and (e.parent_event_id=e.id or (e.series_id=e.id and e.recurrence_rule is null))
  ) then
    raise exception 'Event deletion set has an external or invalid reference';
  end if;

  loop
    select count(*) into remaining_count from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id));
    exit when remaining_count=0;

    delete from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id))
      and not exists (
        select 1 from public.events child
        where child.id<>e.id and (child.series_id=e.id or child.parent_event_id=e.id)
      );
    get diagnostics deleted_count=row_count;
    if deleted_count=0 then
      raise exception 'Event reference cycle prevents bounded deletion';
    end if;
  end loop;
end;
$$;
revoke all on function public.delete_lifecycle_event_set(uuid,uuid) from public,anon,authenticated,service_role;

create function public.leave_shared_space(p_space_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
  actor_role text;
begin
  if actor is null or p_space_id is null then raise exception 'Signed-in actor and Space are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  select role into actor_role from public.space_members where space_id=p_space_id and user_id=actor;
  if actor_role is distinct from 'member' then raise exception 'Only an ordinary member may leave'; end if;
  perform public.delete_lifecycle_event_set(p_space_id,actor);
  delete from public.space_members where space_id=p_space_id and user_id=actor;
  update public.spaces set invite_code=public.generate_invite_code() where id=p_space_id;
end;
$$;

create function public.remove_space_member(p_space_id uuid,p_member_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null or p_member_user_id is null then raise exception 'Actor, Space, and member are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may remove a member';
  end if;
  if p_member_user_id=actor or not exists (select 1 from public.space_members where space_id=p_space_id and user_id=p_member_user_id and role='member') then
    raise exception 'Target must be another ordinary member';
  end if;
  perform public.delete_lifecycle_event_set(p_space_id,p_member_user_id);
  delete from public.space_members where space_id=p_space_id and user_id=p_member_user_id;
  update public.spaces set invite_code=public.generate_invite_code() where id=p_space_id;
end;
$$;

create function public.transfer_space_ownership(p_space_id uuid,p_new_owner_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null or p_new_owner_user_id is null then raise exception 'Actor, Space, and new owner are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may transfer ownership';
  end if;
  if p_new_owner_user_id=actor or not exists (select 1 from public.space_members where space_id=p_space_id and user_id=p_new_owner_user_id and role='member') then
    raise exception 'New owner must be the other current member';
  end if;
  update public.space_members set role='member' where space_id=p_space_id and user_id=actor;
  update public.space_members set role='owner' where space_id=p_space_id and user_id=p_new_owner_user_id;
end;
$$;

create function public.delete_shared_space(p_space_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null then raise exception 'Signed-in actor and Space are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may delete a Shared Space';
  end if;
  perform public.delete_lifecycle_event_set(p_space_id,null);
  delete from public.spaces where id=p_space_id;
end;
$$;

revoke all on function public.leave_shared_space(uuid) from public,anon,service_role;
revoke all on function public.remove_space_member(uuid,uuid) from public,anon,service_role;
revoke all on function public.transfer_space_ownership(uuid,uuid) from public,anon,service_role;
revoke all on function public.delete_shared_space(uuid) from public,anon,service_role;
grant execute on function public.leave_shared_space(uuid) to authenticated;
grant execute on function public.remove_space_member(uuid,uuid) to authenticated;
grant execute on function public.transfer_space_ownership(uuid,uuid) to authenticated;
grant execute on function public.delete_shared_space(uuid) to authenticated;

-- Every personal Event write locks the same Space before the existing owner
-- validator runs. This closes the insert/update versus member-exit gap.
create function public.lock_personal_event_membership()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_kind text;
  target_creator uuid;
begin
  if new.scope='personal' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.space_id::text));
    select kind,created_by into target_kind,target_creator
    from public.spaces where id=new.space_id for update;
    if not found then
      raise exception 'Personal Event owner must remain a Space member';
    end if;
    if target_kind='personal' and new.owner_user_id is distinct from target_creator then
      raise exception 'Personal Space events must belong to the Space owner';
    end if;
    if not exists (
      select 1 from public.space_members
      where space_id=new.space_id and user_id=new.owner_user_id
    ) then
      raise exception 'Personal Event owner must remain a Space member';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_lock_personal_membership before insert or update on public.events
for each row execute function public.lock_personal_event_membership();

-- Keep application roles from bypassing Space, Event and Task lifecycle guards
-- through the broad legacy/default table ACL. Owner/migration roles are outside
-- the runtime invariant boundary.
revoke truncate on table
  public.profiles,
  public.spaces,
  public.space_members,
  public.events,
  public.event_occurrence_exceptions,
  public.tasks
from anon,authenticated,service_role;

-- v0.1.14 Review backend foundation.
create table public.review_rounds (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  review_date date not null,
  created_by uuid not null, -- Audit snapshot; participant access remains independently protected.
  created_at timestamptz not null default now(),
  unique (space_id, round_no),
  constraint review_rounds_space_review_date_key unique (space_id, review_date)
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

revoke all on function public.can_read_review_round(uuid) from public,anon,service_role;
grant execute on function public.can_read_review_round(uuid) to authenticated;
revoke all on function public.create_review_round(uuid,date) from public,anon,service_role;
revoke all on function public.correct_review_date(uuid,date) from public,anon,service_role;
revoke all on function public.save_my_review_entry(uuid,text,text,text,text) from public,anon,service_role;
revoke all on function public.mark_my_review_filled(uuid) from public,anon,service_role;
revoke all on function public.get_my_previous_review_plan(uuid) from public,anon,service_role;
grant execute on function public.create_review_round(uuid,date) to authenticated;
grant execute on function public.correct_review_date(uuid,date) to authenticated;
grant execute on function public.save_my_review_entry(uuid,text,text,text,text) to authenticated;
grant execute on function public.mark_my_review_filled(uuid) to authenticated;
grant execute on function public.get_my_previous_review_plan(uuid) to authenticated;

create function public.delete_review_round(p_review_id uuid)
returns uuid language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  deleted_id uuid;
begin
  if actor is null or p_review_id is null then
    raise exception 'Actor and review are required';
  end if;
  select space_id into target_space_id from public.review_rounds where id=p_review_id;
  if not found then raise exception 'Review not found'; end if;
  -- Review writes share advisory then Space-row locks; membership changes also lock the Space row.
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
  delete from public.review_rounds where id=p_review_id and space_id=target_space_id
  returning id into deleted_id;
  if deleted_id is null then raise exception 'Review not found'; end if;
  return deleted_id;
end;
$$;
revoke all on function public.delete_review_round(uuid) from public,anon,service_role;
grant execute on function public.delete_review_round(uuid) to authenticated;

-- v0.1.15 Shared Lists canonical foundation.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_id_space_key unique (id,space_id),
  constraint lists_name_format_check check (
    char_length(name) between 1 and 200
    and name = regexp_replace(name,'^[[:space:]]+|[[:space:]]+$','','g')
    and name !~ '[[:cntrl:]]'
    and position(chr(133) in name)=0
    and position(chr(8232) in name)=0
    and position(chr(8233) in name)=0
  )
);

create table public.list_sections (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null,
  sort_order bigint not null check (sort_order > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_sections_id_list_key unique (id,list_id),
  constraint list_sections_list_sort_key unique (list_id,sort_order) deferrable initially immediate,
  constraint list_sections_name_format_check check (
    char_length(name) between 1 and 200
    and name = regexp_replace(name,'^[[:space:]]+|[[:space:]]+$','','g')
    and name !~ '[[:cntrl:]]'
    and position(chr(133) in name)=0
    and position(chr(8232) in name)=0
    and position(chr(8233) in name)=0
  )
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  space_id uuid not null,
  section_id uuid,
  content text not null,
  completed boolean not null default false,
  sort_order bigint not null check (sort_order > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_items_list_space_fkey foreign key (list_id,space_id)
    references public.lists(id,space_id) on delete cascade,
  constraint list_items_section_list_fkey foreign key (section_id,list_id)
    references public.list_sections(id,list_id) on delete cascade,
  constraint list_items_region_sort_key unique nulls not distinct
    (list_id,section_id,sort_order) deferrable initially immediate,
  constraint list_items_content_format_check check (
    char_length(content) between 1 and 200
    and content = regexp_replace(content,'^[[:space:]]+|[[:space:]]+$','','g')
    and content !~ '[[:cntrl:]]'
    and position(chr(133) in content)=0
    and position(chr(8232) in content)=0
    and position(chr(8233) in content)=0
  )
);

create index lists_space_created_id_idx on public.lists (space_id,created_at desc,id desc);
create index list_items_space_list_completed_idx on public.list_items (space_id,list_id,completed);
alter table public.lists replica identity full;
alter table public.list_sections replica identity full;
alter table public.list_items replica identity full;

create function public.guard_list_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.space_id is distinct from old.space_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List identity is immutable';
  end if;
  return new;
end;
$$;
create trigger lists_guard_identity before update on public.lists
for each row execute function public.guard_list_identity();
create trigger lists_touch_updated_at before update on public.lists
for each row execute function public.touch_updated_at();

create function public.guard_list_section_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.list_id is distinct from old.list_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List Section identity is immutable';
  end if;
  return new;
end;
$$;
create trigger list_sections_guard_identity before update on public.list_sections
for each row execute function public.guard_list_section_identity();
create trigger list_sections_touch_updated_at before update on public.list_sections
for each row execute function public.touch_updated_at();

create function public.guard_list_item_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.list_id is distinct from old.list_id
    or new.space_id is distinct from old.space_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List Item identity is immutable';
  end if;
  return new;
end;
$$;
create trigger list_items_guard_identity before update on public.list_items
for each row execute function public.guard_list_item_identity();
create trigger list_items_touch_updated_at before update on public.list_items
for each row execute function public.touch_updated_at();

alter table public.lists enable row level security;
alter table public.list_sections enable row level security;
alter table public.list_items enable row level security;
create policy lists_select_member on public.lists for select
  using (public.is_space_member(space_id));
create policy lists_insert_enabled_member on public.lists for insert
  with check (public.is_space_member(space_id)
    and public.is_space_module_enabled(space_id,'lists')
    and created_by=auth.uid());
create policy lists_update_enabled_member on public.lists for update
  using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'))
  with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'));
create policy list_sections_select_member on public.list_sections for select
  using (exists (select 1 from public.lists l where l.id=list_id and public.is_space_member(l.space_id)));
create policy list_sections_update_enabled_member on public.list_sections for update
  using (exists (select 1 from public.lists l where l.id=list_id
    and public.is_space_member(l.space_id) and public.is_space_module_enabled(l.space_id,'lists')))
  with check (exists (select 1 from public.lists l where l.id=list_id
    and public.is_space_member(l.space_id) and public.is_space_module_enabled(l.space_id,'lists')));
create policy list_items_select_member on public.list_items for select
  using (public.is_space_member(space_id));
create policy list_items_update_enabled_member on public.list_items for update
  using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'))
  with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'));

revoke all on table public.lists,public.list_sections,public.list_items
  from public,anon,authenticated,service_role;
grant select on table public.lists,public.list_sections,public.list_items to authenticated;
grant insert (space_id,name) on public.lists to authenticated;
grant update (name) on public.lists to authenticated;
grant update (name) on public.list_sections to authenticated;
grant update (content) on public.list_items to authenticated;

-- Internal authorization and List row lock shared by narrow mutation RPCs.
create function public.lock_writable_list(p_list_id uuid)
returns public.lists language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list public.lists;
begin
  if auth.uid() is null or p_list_id is null then
    raise exception 'Signed-in actor and List are required';
  end if;
  select * into target_list from public.lists where id=p_list_id for update;
  if not found then raise exception 'List not found'; end if;
  if not public.is_space_member(target_list.space_id) then
    raise exception 'Current List Space membership is required';
  end if;
  if not public.is_space_module_enabled(target_list.space_id,'lists') then
    raise exception 'Lists module is disabled';
  end if;
  return target_list;
end;
$$;
revoke all on function public.lock_writable_list(uuid)
  from public,anon,authenticated,service_role;

create function public.create_list_section(p_list_id uuid,p_name text)
returns public.list_sections language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare created_section public.list_sections;
begin
  perform public.lock_writable_list(p_list_id);
  insert into public.list_sections(list_id,name,sort_order)
  values (p_list_id,p_name,coalesce((select max(sort_order)+1
    from public.list_sections where list_id=p_list_id),1))
  returning * into created_section;
  return created_section;
end;
$$;

create function public.create_list_item(p_list_id uuid,p_section_id uuid,p_content text)
returns public.list_items language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list public.lists;
  created_item public.list_items;
begin
  target_list := public.lock_writable_list(p_list_id);
  if p_section_id is not null and not exists (
    select 1 from public.list_sections where id=p_section_id and list_id=p_list_id
  ) then raise exception 'Section not found in List'; end if;
  insert into public.list_items(list_id,space_id,section_id,content,sort_order)
  values (p_list_id,target_list.space_id,p_section_id,p_content,
    coalesce((select max(sort_order)+1 from public.list_items
      where list_id=p_list_id and section_id is not distinct from p_section_id),1))
  returning * into created_item;
  return created_item;
end;
$$;

create function public.delete_list(p_list_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
  perform public.lock_writable_list(p_list_id);
  delete from public.lists where id=p_list_id;
end;
$$;

create function public.delete_list_section(p_list_id uuid,p_section_id uuid,p_preserve_items boolean)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare ungrouped_end bigint;
begin
  if p_preserve_items is null then raise exception 'Section delete choice is required'; end if;
  perform public.lock_writable_list(p_list_id);
  perform 1 from public.list_sections where id=p_section_id and list_id=p_list_id for update;
  if not found then raise exception 'Section not found in List'; end if;
  if p_preserve_items then
    select coalesce(max(sort_order),0) into ungrouped_end from public.list_items
    where list_id=p_list_id and section_id is null;
    set constraints public.list_items_region_sort_key deferred;
    with moved as (
      select id,row_number() over(order by sort_order,id) as position
      from public.list_items where list_id=p_list_id and section_id=p_section_id
    )
    update public.list_items i set section_id=null,sort_order=ungrouped_end+m.position
    from moved m where i.id=m.id;
  end if;
  delete from public.list_sections where id=p_section_id and list_id=p_list_id;
  set constraints public.list_sections_list_sort_key deferred;
  with positions as (
    select id,row_number() over(order by sort_order,id) as position
    from public.list_sections where list_id=p_list_id
  )
  update public.list_sections s set sort_order=p.position
  from positions p where s.id=p.id;
end;
$$;

create function public.delete_list_item(p_list_id uuid,p_item_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare target_section_id uuid;
begin
  perform public.lock_writable_list(p_list_id);
  select section_id into target_section_id from public.list_items
  where id=p_item_id and list_id=p_list_id for update;
  if not found then raise exception 'Item not found in List'; end if;
  delete from public.list_items where id=p_item_id;
  set constraints public.list_items_region_sort_key deferred;
  with positions as (
    select id,row_number() over(order by sort_order,id) as position
    from public.list_items
    where list_id=p_list_id and section_id is not distinct from target_section_id
  )
  update public.list_items i set sort_order=p.position
  from positions p where i.id=p.id;
end;
$$;

create function public.reorder_list_sections(p_list_id uuid,p_ordered_ids uuid[])
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  current_ids uuid[];
  submitted_ids uuid[];
begin
  perform public.lock_writable_list(p_list_id);
  if p_ordered_ids is null then raise exception 'Section order is required'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into current_ids
  from public.list_sections where list_id=p_list_id;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into submitted_ids
  from unnest(p_ordered_ids) as requested(id);
  if current_ids is distinct from submitted_ids then
    raise exception 'Stale List Section order; reload';
  end if;
  set constraints public.list_sections_list_sort_key deferred;
  with positions as (
    select id,ordinality::bigint as position
    from unnest(p_ordered_ids) with ordinality as requested(id,ordinality)
  )
  update public.list_sections s set sort_order=p.position
  from positions p where s.id=p.id and s.list_id=p_list_id;
end;
$$;

create function public.reorder_list_items(
  p_list_id uuid,p_section_id uuid,p_completed boolean,p_ordered_ids uuid[]
)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  current_ids uuid[];
  submitted_ids uuid[];
begin
  perform public.lock_writable_list(p_list_id);
  if p_completed is null or p_ordered_ids is null then
    raise exception 'Item completion group and order are required';
  end if;
  if p_section_id is not null and not exists (
    select 1 from public.list_sections where id=p_section_id and list_id=p_list_id
  ) then raise exception 'Section not found in List'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into current_ids
  from public.list_items where list_id=p_list_id
    and section_id is not distinct from p_section_id and completed=p_completed;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into submitted_ids
  from unnest(p_ordered_ids) as requested(id);
  if current_ids is distinct from submitted_ids then
    raise exception 'Stale List Item order; reload';
  end if;
  set constraints public.list_items_region_sort_key deferred;
  with slots as (
    select sort_order,row_number() over(order by sort_order,id) as position
    from public.list_items where list_id=p_list_id
      and section_id is not distinct from p_section_id and completed=p_completed
  ), positions as (
    select requested.id,slots.sort_order
    from unnest(p_ordered_ids) with ordinality as requested(id,position)
    join slots on slots.position=requested.position
  )
  update public.list_items i set sort_order=p.sort_order
  from positions p where i.id=p.id and i.list_id=p_list_id;
end;
$$;

create function public.set_list_item_completed(p_item_id uuid,p_completed boolean)
returns public.list_items language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list_id uuid;
  target_item public.list_items;
begin
  if p_item_id is null or p_completed is null then
    raise exception 'Item and explicit completion value are required';
  end if;
  select list_id into target_list_id from public.list_items where id=p_item_id;
  if not found then raise exception 'Item not found'; end if;
  perform public.lock_writable_list(target_list_id);
  select * into target_item from public.list_items
  where id=p_item_id and list_id=target_list_id for update;
  if not found then raise exception 'Item not found in List'; end if;
  update public.list_items set completed=p_completed
  where id=p_item_id returning * into target_item;
  return target_item;
end;
$$;

revoke all on function public.create_list_section(uuid,text) from public,anon,service_role;
revoke all on function public.create_list_item(uuid,uuid,text) from public,anon,service_role;
revoke all on function public.delete_list(uuid) from public,anon,service_role;
revoke all on function public.delete_list_section(uuid,uuid,boolean) from public,anon,service_role;
revoke all on function public.delete_list_item(uuid,uuid) from public,anon,service_role;
revoke all on function public.reorder_list_sections(uuid,uuid[]) from public,anon,service_role;
revoke all on function public.reorder_list_items(uuid,uuid,boolean,uuid[]) from public,anon,service_role;
revoke all on function public.set_list_item_completed(uuid,boolean) from public,anon,service_role;
grant execute on function public.create_list_section(uuid,text) to authenticated;
grant execute on function public.create_list_item(uuid,uuid,text) to authenticated;
grant execute on function public.delete_list(uuid) to authenticated;
grant execute on function public.delete_list_section(uuid,uuid,boolean) to authenticated;
grant execute on function public.delete_list_item(uuid,uuid) to authenticated;
grant execute on function public.reorder_list_sections(uuid,uuid[]) to authenticated;
grant execute on function public.reorder_list_items(uuid,uuid,boolean,uuid[]) to authenticated;
grant execute on function public.set_list_item_completed(uuid,boolean) to authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array['lists','list_sections','list_items'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=target_table) then
      execute format('alter publication supabase_realtime add table public.%I',target_table);
    end if;
  end loop;
end;
$$;

-- v0.1.18 Important Dates canonical foundation.
create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  emoji text,
  repeat_kind text not null check (repeat_kind in ('annual','none')),
  month integer not null check (month between 1 and 12),
  day integer not null,
  year bigint,
  reminder_kind text default null check (reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')),
  time_zone text not null,
  reminder_schedule_changed_at timestamptz not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint important_dates_name_format_check check (
    char_length(name) between 1 and 200
    and name=regexp_replace(name,'^[[:space:]]+|[[:space:]]+$','','g')
    and name !~ '[[:cntrl:]]'
    and position(chr(133) in name)=0 and position(chr(8232) in name)=0 and position(chr(8233) in name)=0
  ),
  constraint important_dates_emoji_format_check check (emoji is null or (
    char_length(emoji) between 1 and 32
    and emoji=regexp_replace(emoji,'^[[:space:]]+|[[:space:]]+$','','g')
    and emoji !~ '[[:cntrl:]]'
    and position(chr(133) in emoji)=0 and position(chr(8232) in emoji)=0 and position(chr(8233) in emoji)=0
  )),
  -- Same positive, safe-ordinal year domain as the shared pure-date helper.
  constraint important_dates_year_check check (year is null or (year>0 and year<9007199254740991::bigint/366)),
  constraint important_dates_non_repeat_year_check check (repeat_kind<>'none' or year is not null),
  constraint important_dates_real_date_check check (day between 1 and case
    when month=2 then case when coalesce(year,2000)%4=0
      and (coalesce(year,2000)%100<>0 or coalesce(year,2000)%400=0) then 29 else 28 end
    when month in (4,6,9,11) then 30 else 31 end)
);
create index important_dates_space_id_idx on public.important_dates(space_id,id);

create function public.guard_important_date_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id or new.space_id is distinct from old.space_id
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Important Date identity is immutable';
  end if;
  return new;
end;
$$;

create function public.prepare_important_date_schedule()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.time_zone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name=new.time_zone
  ) then raise exception 'Important Date time_zone must be a valid IANA timezone'; end if;
  if tg_op='INSERT' then
    new.reminder_schedule_changed_at=clock_timestamp();
  elsif row(new.repeat_kind,new.year,new.month,new.day,new.reminder_kind,new.time_zone)
    is distinct from row(old.repeat_kind,old.year,old.month,old.day,old.reminder_kind,old.time_zone) then
    new.reminder_schedule_changed_at=clock_timestamp();
  else
    new.reminder_schedule_changed_at=old.reminder_schedule_changed_at;
  end if;
  return new;
end;
$$;
create trigger important_dates_guard_identity before update on public.important_dates
for each row execute function public.guard_important_date_identity();
create trigger important_dates_prepare_schedule before insert or update on public.important_dates
for each row execute function public.prepare_important_date_schedule();
create trigger important_dates_touch_updated_at before update on public.important_dates
for each row execute function public.touch_updated_at();

alter table public.important_dates enable row level security;
create policy important_dates_select_member on public.important_dates for select
using (public.is_space_member(space_id));
-- All runtime mutations are RPC-owned; no INSERT/UPDATE/DELETE policy or broad ACL.
revoke all on table public.important_dates from public,anon,authenticated,service_role;
grant select on table public.important_dates to authenticated;

create function public.lock_important_date_space(p_space_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or p_space_id is null then raise exception 'Signed-in actor and Space are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  perform 1 from public.spaces where id=p_space_id for update;
  if not found then raise exception 'Space not found'; end if;
  -- Separate post-lock statements see the committed membership/module state after waiting.
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor) then
    raise exception 'Current Important Date Space membership is required';
  end if;
  if not exists (select 1 from public.space_modules where space_id=p_space_id and module_key='important_dates' and enabled) then
    raise exception 'Important Dates module is disabled';
  end if;
end;
$$;

create function public.lock_writable_important_date(p_important_date_id uuid)
returns public.important_dates language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target_space_id uuid; target_date public.important_dates;
begin
  if auth.uid() is null or p_important_date_id is null then raise exception 'Signed-in actor and Important Date are required'; end if;
  -- Discover the immutable Space without taking an object lock before the Space locks.
  select space_id into target_space_id from public.important_dates where id=p_important_date_id;
  if not found then raise exception 'Important Date not found'; end if;
  perform public.lock_important_date_space(target_space_id);
  select * into target_date from public.important_dates
  where id=p_important_date_id and space_id=target_space_id for update;
  if not found then raise exception 'Important Date not found'; end if;
  return target_date;
end;
$$;

create function public.create_important_date(
  p_space_id uuid,p_name text,p_emoji text,p_repeat_kind text,p_month integer,p_day integer,p_year bigint,p_time_zone text
)
returns public.important_dates language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare created_date public.important_dates;
begin
  perform public.lock_important_date_space(p_space_id);
  insert into public.important_dates(space_id,name,emoji,repeat_kind,month,day,year,time_zone,reminder_kind,created_by)
  values(p_space_id,p_name,p_emoji,p_repeat_kind,p_month,p_day,p_year,p_time_zone,null,auth.uid())
  returning * into created_date;
  return created_date;
end;
$$;

create function public.update_important_date(
  p_important_date_id uuid,p_name text,p_emoji text,p_repeat_kind text,p_month integer,p_day integer,p_year bigint
)
returns public.important_dates language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target_date public.important_dates; changed_date public.important_dates;
begin
  target_date:=public.lock_writable_important_date(p_important_date_id);
  update public.important_dates set name=p_name,emoji=p_emoji,repeat_kind=p_repeat_kind,month=p_month,day=p_day,year=p_year
  where id=target_date.id and space_id=target_date.space_id returning * into changed_date;
  return changed_date;
end;
$$;

create function public.delete_important_date(p_important_date_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target_date public.important_dates;
begin
  target_date:=public.lock_writable_important_date(p_important_date_id);
  delete from public.important_dates where id=target_date.id and space_id=target_date.space_id;
end;
$$;

revoke all on function public.guard_important_date_identity(),public.prepare_important_date_schedule(),
  public.lock_important_date_space(uuid),public.lock_writable_important_date(uuid),
  public.create_important_date(uuid,text,text,text,integer,integer,bigint,text),
  public.update_important_date(uuid,text,text,text,integer,integer,bigint),public.delete_important_date(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.create_important_date(uuid,text,text,text,integer,integer,bigint,text),
  public.update_important_date(uuid,text,text,text,integer,integer,bigint),public.delete_important_date(uuid)
to authenticated;

revoke all on function public.set_space_module_enabled(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.set_space_module_enabled(uuid,text,boolean) to authenticated;

-- T2A Important Date reminder capability; Slice 1 lock/marker helpers stay canonical.
create function public.list_important_date_reminder_candidates(p_after_id uuid,p_limit integer)
returns table(id uuid,space_id uuid,name text,repeat_kind text,month integer,day integer,year bigint,
  reminder_kind text,time_zone text,reminder_schedule_changed_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception using errcode='22023',message='Candidate page limit must be between 1 and 100';
  end if;
  return query
  select d.id,d.space_id,d.name,d.repeat_kind,d.month,d.day,d.year,
    d.reminder_kind,d.time_zone,d.reminder_schedule_changed_at
  from public.important_dates d
  join public.space_modules m on m.space_id=d.space_id and m.module_key='important_dates' and m.enabled
  where d.reminder_kind is not null and (p_after_id is null or d.id>p_after_id)
  order by d.id limit p_limit;
end;
$$;

-- Required extra argument avoids PostgREST ambiguity and never enables old callers.
create function public.create_important_date(
  p_space_id uuid,p_name text,p_emoji text,p_repeat_kind text,p_month integer,p_day integer,p_year bigint,
  p_time_zone text,p_reminder_kind text
)
returns public.important_dates language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare created_date public.important_dates;
begin
  perform public.lock_important_date_space(p_space_id);
  insert into public.important_dates(space_id,name,emoji,repeat_kind,month,day,year,time_zone,reminder_kind,created_by)
  values(p_space_id,p_name,p_emoji,p_repeat_kind,p_month,p_day,p_year,p_time_zone,p_reminder_kind,auth.uid())
  returning * into created_date;
  return created_date;
end;
$$;

create function public.update_important_date(
  p_important_date_id uuid,p_name text,p_emoji text,p_repeat_kind text,p_month integer,p_day integer,p_year bigint,
  p_reminder_kind text
)
returns public.important_dates language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target_date public.important_dates; changed_date public.important_dates;
begin
  target_date:=public.lock_writable_important_date(p_important_date_id);
  update public.important_dates set name=p_name,emoji=p_emoji,repeat_kind=p_repeat_kind,month=p_month,day=p_day,
    year=p_year,reminder_kind=p_reminder_kind
  where id=target_date.id and space_id=target_date.space_id returning * into changed_date;
  return changed_date;
end;
$$;

revoke all on function public.list_important_date_reminder_candidates(uuid,integer),
  public.create_important_date(uuid,text,text,text,integer,integer,bigint,text,text),
  public.update_important_date(uuid,text,text,text,integer,integer,bigint,text)
from public,anon,authenticated,service_role;
grant execute on function public.list_important_date_reminder_candidates(uuid,integer) to service_role;
grant execute on function public.create_important_date(uuid,text,text,text,integer,integer,bigint,text,text),
  public.update_important_date(uuid,text,text,text,integer,integer,bigint,text) to authenticated;

-- Source-specific shared predicate, private to the two locked RPCs.
-- Validate membership of one civil occurrence, never project dates or convert UTC.
-- Canonical UTC due calculation stays with T1, as with existing Event claims.
create function public.important_date_reminder_is_eligible(
  p_source public.important_dates,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select case when p_occurrence_date is null or not isfinite(p_occurrence_date) or (p_source).id is null then false else
    (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and extract(year from p_occurrence_date)>0
    and extract(month from p_occurrence_date)=(p_source).month
    and (extract(day from p_occurrence_date)=(p_source).day or (
      (p_source).repeat_kind='annual' and (p_source).month=2 and (p_source).day=29
      and extract(day from p_occurrence_date)=28
      and not (extract(year from p_occurrence_date)%4=0 and (
        extract(year from p_occurrence_date)%100<>0 or extract(year from p_occurrence_date)%400=0))))
    and (((p_source).repeat_kind='none' and (p_source).year=extract(year from p_occurrence_date))
      or ((p_source).repeat_kind='annual' and ((p_source).year is null or (p_source).year<=extract(year from p_occurrence_date))))
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='important_dates' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id and (s.kind='shared' or (s.kind='personal' and s.created_by=p_recipient_user_id))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  end;
$$;

create function public.claim_important_date_reminder_delivery(
  p_important_date_id uuid,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,p_due_at timestamptz,
  p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source_space_id uuid; source public.important_dates; claim_now timestamptz; delivery_id uuid;
begin
  select space_id into source_space_id from public.important_dates where id=p_important_date_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  select * into source from public.important_dates where id=p_important_date_id and space_id=source_space_id for update;
  if not found then return null; end if;
  -- Every possible lock wait has completed before evaluating grace/expiry.
  claim_now:=clock_timestamp();
  if public.important_date_reminder_is_eligible(source,p_occurrence_date,p_recipient_user_id,p_subscription_id,p_due_at,
      p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,claim_now) is not true then return null; end if;
  insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status,created_at,updated_at)
  values(source.id,p_recipient_user_id,p_subscription_id,p_occurrence_date,p_due_at,'claimed',claim_now,claim_now)
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing returning id into delivery_id;
  return delivery_id;
end;
$$;

create function public.check_important_date_reminder_delivery(
  p_delivery_id uuid,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare delivery public.reminder_deliveries; source_space_id uuid; source public.important_dates; check_now timestamptz;
begin
  select * into delivery from public.reminder_deliveries
  where id=p_delivery_id and status='claimed' and event_id is null and important_date_id is not null;
  if not found then return false; end if;
  select space_id into source_space_id from public.important_dates where id=delivery.important_date_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return false; end if;
  select * into source from public.important_dates where id=delivery.important_date_id and space_id=source_space_id for update;
  if not found then return false; end if;
  -- A concurrent finalize can finish while waiting; only a still-claimed row qualifies.
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.event_id is not null
    or delivery.important_date_id is distinct from source.id then return false; end if;
  check_now:=clock_timestamp();
  return public.important_date_reminder_is_eligible(source,delivery.occurrence_date,delivery.recipient_user_id,delivery.subscription_id,
    delivery.due_at,p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,check_now) is true;
end;
$$;

revoke all on function public.important_date_reminder_is_eligible(public.important_dates,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz),
  public.claim_important_date_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_important_date_reminder_delivery(uuid,text,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.claim_important_date_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_important_date_reminder_delivery(uuid,text,timestamptz) to service_role;

-- v0.1.19 Task due-date reminder extension.
create function public.prepare_task_reminder_schedule()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  -- Old clients can clear due_on without knowing about reminders.
  if new.due_on is null then new.reminder_kind:=null; end if;
  if new.time_zone is not null and not exists (
    select 1 from pg_catalog.pg_timezone_names where name=new.time_zone
  ) then raise exception 'Task time_zone must be a valid IANA timezone'; end if;
  if tg_op='INSERT' then
    new.reminder_schedule_changed_at:=clock_timestamp();
  elsif row(new.due_on,new.reminder_kind,new.time_zone,new.status,new.assigned_to_user_id)
    is distinct from row(old.due_on,old.reminder_kind,old.time_zone,old.status,old.assigned_to_user_id) then
    new.reminder_schedule_changed_at:=greatest(clock_timestamp(),old.reminder_schedule_changed_at+interval '1 microsecond');
  else
    new.reminder_schedule_changed_at:=old.reminder_schedule_changed_at;
  end if;
  return new;
end;
$$;
create trigger tasks_prepare_reminder_schedule before insert or update on public.tasks
for each row execute function public.prepare_task_reminder_schedule();

create function public.list_task_reminder_candidates(p_after_id uuid,p_limit integer)
returns table(id uuid,space_id uuid,space_kind text,personal_owner_id uuid,title text,
  assigned_to_user_id uuid,due_on date,status text,reminder_kind text,time_zone text,reminder_schedule_changed_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception using errcode='22023',message='Candidate page limit must be between 1 and 100';
  end if;
  return query select t.id,t.space_id,s.kind,s.created_by,t.title,t.assigned_to_user_id,
    t.due_on,t.status,t.reminder_kind,t.time_zone,t.reminder_schedule_changed_at
  from public.tasks t join public.spaces s on s.id=t.space_id
  join public.space_modules m on m.space_id=t.space_id and m.module_key='tasks' and m.enabled
  where t.status='open' and t.due_on is not null and t.reminder_kind is not null
    and (p_after_id is null or t.id>p_after_id)
  order by t.id limit p_limit;
end;
$$;

-- UTC due calculation stays in the existing trusted service-side civil-date helper.
create function public.task_reminder_is_eligible(
  p_source public.tasks,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select (p_source).id is not null and (p_source).status='open'
    and p_occurrence_date=(p_source).due_on and isfinite(p_occurrence_date)
    and (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).time_zone is not null
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='tasks' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id
        and ((s.kind='personal' and s.created_by=p_recipient_user_id)
          or (s.kind='shared' and ((p_source).assigned_to_user_id is null or (p_source).assigned_to_user_id=p_recipient_user_id)))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now));
$$;

create function public.claim_task_reminder_delivery(
  p_task_id uuid,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,p_due_at timestamptz,
  p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source_space_id uuid; source public.tasks; claim_now timestamptz; delivery_id uuid;
begin
  select space_id into source_space_id from public.tasks where id=p_task_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  select * into source from public.tasks where id=p_task_id and space_id=source_space_id for update;
  if not found then return null; end if;
  claim_now:=clock_timestamp();
  if public.task_reminder_is_eligible(source,p_occurrence_date,p_recipient_user_id,p_subscription_id,p_due_at,
    p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,claim_now) is not true then return null; end if;
  insert into public.reminder_deliveries(task_id,recipient_user_id,subscription_id,occurrence_date,due_at,status,created_at,updated_at)
  values(source.id,p_recipient_user_id,p_subscription_id,p_occurrence_date,p_due_at,'claimed',claim_now,claim_now)
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing returning id into delivery_id;
  return delivery_id;
end;
$$;

create function public.check_task_reminder_delivery(
  p_delivery_id uuid,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare delivery public.reminder_deliveries; source_space_id uuid; source public.tasks; check_now timestamptz;
begin
  select * into delivery from public.reminder_deliveries where id=p_delivery_id and status='claimed' and task_id is not null;
  if not found then return false; end if;
  select space_id into source_space_id from public.tasks where id=delivery.task_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return false; end if;
  select * into source from public.tasks where id=delivery.task_id and space_id=source_space_id for update;
  if not found then return false; end if;
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.task_id is distinct from source.id then return false; end if;
  check_now:=clock_timestamp();
  return public.task_reminder_is_eligible(source,delivery.occurrence_date,delivery.recipient_user_id,delivery.subscription_id,
    delivery.due_at,p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,check_now) is true;
end;
$$;

revoke all on function public.prepare_task_reminder_schedule(),
  public.task_reminder_is_eligible(public.tasks,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz),
  public.list_task_reminder_candidates(uuid,integer),
  public.claim_task_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_task_reminder_delivery(uuid,text,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.list_task_reminder_candidates(uuid,integer),
  public.claim_task_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_task_reminder_delivery(uuid,text,timestamptz) to service_role;

-- Private avatar Storage contract. Existing Space/Profile RLS is unchanged.
do $avatar_storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage schema absent: avatar bucket provisioning skipped in this database';
    return;
  end if;
  -- Permissive policies combine with OR. Do not silently add avatar policies
  -- beside unknown policies that might expose or mutate this private bucket.
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and permissive='PERMISSIVE' and roles && array['public','anon','authenticated']::name[]) then
    raise exception 'Storage policy baseline requires review before Avatar v1';
  end if;
  if exists (select 1 from storage.buckets where id='profile-avatars') then
    raise exception 'Avatar bucket already exists; inspect rather than overwrite configuration';
  end if;
  if not exists (select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity) then
    raise exception 'Storage objects RLS must already be enabled';
  end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values ('profile-avatars','profile-avatars',false,1048576,array['image/jpeg']);
  execute $policy$create policy avatars_read on storage.objects for select to authenticated using (
    bucket_id='profile-avatars' and (
      name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
      or exists (select 1 from public.profiles p where p.avatar_path=name
        and public.are_users_in_same_space(auth.uid(),p.id))
    )
  )$policy$;
  execute $policy$create policy avatars_insert_self on storage.objects for insert to authenticated with check (
    bucket_id='profile-avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  )$policy$;
  execute $policy$create policy avatars_delete_unused_self on storage.objects for delete to authenticated using (
    bucket_id='profile-avatars'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.avatar_path=name)
  )$policy$;
end;
$avatar_storage$;

-- Shared Space Event collaboration (2026-10-15).

-- Deferred: changing audience must leave every linked segment coherent at commit.
-- Direct partial updates cannot bypass the whole-series RPC.
create function public.validate_event_lineage_audience()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if exists (
    select 1 from public.events child join public.events parent
      on parent.id=child.series_id or parent.id=child.parent_event_id
    where child.id<>parent.id and (child.id=new.id or parent.id=new.id)
      and (child.space_id is distinct from parent.space_id
        or child.scope is distinct from parent.scope
        or child.owner_user_id is distinct from parent.owner_user_id
        or coalesce(child.series_id,child.id) is distinct from coalesce(parent.series_id,parent.id))
  ) then raise exception 'Linked Event segments must retain one Space and audience'; end if;
  return null;
end;
$$;
create constraint trigger events_lineage_audience
after insert or update on public.events deferrable initially deferred
for each row execute function public.validate_event_lineage_audience();

-- Content scope keeps the existing occurrence semantics. Audience always applies
-- to the complete logical lineage, in the SAME transaction as the content edit.
create function public.save_event_edit(
  p_event_id uuid, p_expected_updated_at timestamptz,
  p_scope text, p_owner_user_id uuid, p_content jsonb,
  p_edit_mode text default 'event', p_occurrence_date date default null
)
returns public.events language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare
  source public.events; changes public.events; result public.events;
  source_space uuid; root_id uuid; segment public.events;
begin
  select space_id into source_space from public.events where id=p_event_id;
  if source_space is null then raise exception 'Event not found or membership changed'; end if;
  perform pg_advisory_xact_lock(hashtext(source_space::text));
  perform 1 from public.spaces where id=source_space for update;
  select * into source from public.events where id=p_event_id and space_id=source_space for update;
  if not found or auth.uid() is null
    or not public.can_manage_event(source.space_id,source.scope,source.owner_user_id) then
    raise exception 'Not permitted to manage this event' using errcode='42501';
  end if;
  if p_expected_updated_at is null or source.updated_at is distinct from p_expected_updated_at then
    raise exception 'Event was modified concurrently' using errcode='40001';
  end if;
  if p_scope is null or p_scope not in ('personal','shared')
    or (p_scope='shared' and p_owner_user_id is not null)
    or (p_scope='personal' and (p_owner_user_id is null or not exists
      (select 1 from public.space_members where space_id=source_space and user_id=p_owner_user_id))) then
    raise exception 'Invalid Event audience' using errcode='22023';
  end if;
  if exists (select 1 from public.spaces where id=source_space and kind='personal')
    and (p_scope<>'personal' or p_owner_user_id is distinct from auth.uid()) then
    raise exception 'Personal Space audience cannot change' using errcode='42501';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(p_content) k where k not in
      ('title','description','starts_at','ends_at','all_day','recurrence_rule','reminder_kind','time_zone')) then
    raise exception 'Unsupported Event content fields' using errcode='22023';
  end if;
  root_id:=coalesce(source.series_id,source.id);
  -- Space lock serializes membership/lifecycle and this entire multi-row edit.
  for segment in select * from public.events where coalesce(series_id,id)=root_id order by id for update loop
    if segment.space_id<>source_space
      or not public.can_manage_event(segment.space_id,segment.scope,segment.owner_user_id)
      or segment.scope is distinct from source.scope
      or segment.owner_user_id is distinct from source.owner_user_id then
      raise exception 'Invalid or inaccessible Event lineage';
    end if;
  end loop;
  changes:=jsonb_populate_record(source,p_content);
  if p_edit_mode='event' and p_occurrence_date is null then
    if p_content<>'{}'::jsonb then
      update public.events set title=changes.title,description=changes.description,
        starts_at=changes.starts_at,ends_at=changes.ends_at,all_day=changes.all_day,
        recurrence_rule=changes.recurrence_rule,reminder_kind=changes.reminder_kind,time_zone=changes.time_zone
      where id=source.id returning * into result;
    else result:=source; end if;
  elsif p_edit_mode in ('only-this','this-and-future') and p_occurrence_date is not null then
    if exists (select 1 from jsonb_object_keys(p_content) k where k not in ('title','description','starts_at','ends_at')) then
      raise exception 'Occurrence content fields are restricted' using errcode='22023';
    end if;
    if p_content='{}'::jsonb then
      perform public.assert_manage_recurring_event(source.id,p_expected_updated_at);
      if public.recurring_occurrence_instant(source,p_occurrence_date) is null then
        raise exception 'Occurrence date is not scheduled by the source event';
      end if;
      result:=source;
    elsif p_edit_mode='only-this' then
      perform public.upsert_occurrence_override(source.id,p_occurrence_date,p_content,p_expected_updated_at);
      select * into result from public.events where id=source.id;
    else
      result:=public.split_recurring_event(source.id,p_occurrence_date,changes.title,changes.description,
        changes.starts_at,changes.ends_at,source.all_day,source.recurrence_rule,p_expected_updated_at);
    end if;
  else raise exception 'Invalid Event edit scope' using errcode='22023'; end if;
  if row(p_scope,p_owner_user_id) is distinct from row(source.scope,source.owner_user_id) then
    update public.events set scope=p_scope,owner_user_id=p_owner_user_id
      where coalesce(series_id,id)=root_id;
  end if;
  select * into result from public.events where id=result.id;
  return result;
end;
$$;

-- Fail closed between claim and external send. The external network operation
-- cannot be made atomic with a DB transaction; already in-flight Push is final.
create function public.check_event_reminder_delivery(
  p_delivery_id uuid,p_event_id uuid,p_expected_marker timestamptz,
  p_expected_source_updated_at timestamptz default null,
  p_occurrence_date date default null,p_expected_exception_id uuid default null,
  p_expected_exception_updated_at timestamptz default null,p_expected_exception_type text default null
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source public.events; delivery public.reminder_deliveries; source_space uuid; check_now timestamptz;
begin
  select space_id into source_space from public.events where id=p_event_id;
  if source_space is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space::text));
  perform 1 from public.spaces where id=source_space for update;
  select * into source from public.events where id=p_event_id and space_id=source_space for update;
  if not found then return false; end if;
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.important_date_id is not null or delivery.task_id is not null
    or delivery.event_id is distinct from (case when source.recurrence_rule is null then source.id else coalesce(source.series_id,source.id) end)
    or source.reminder_kind is null or source.time_zone is null
    or source.reminder_schedule_changed_at is distinct from p_expected_marker
    or (source.recurrence_rule is not null and (p_expected_source_updated_at is null
      or source.updated_at is distinct from p_expected_source_updated_at)) then return false; end if;
  if source.recurrence_rule is not null and (
    delivery.occurrence_date is distinct from p_occurrence_date
    or (p_expected_exception_id is null and exists (select 1 from public.event_occurrence_exceptions
      where event_id=source.id and occurrence_date=p_occurrence_date))
    or (p_expected_exception_id is not null and not exists (select 1 from public.event_occurrence_exceptions
      where id=p_expected_exception_id and event_id=source.id and occurrence_date=p_occurrence_date
      and updated_at=p_expected_exception_updated_at and exception_type=p_expected_exception_type
      and exception_type='override'))
  ) then return false; end if;
  check_now:=clock_timestamp();
  return delivery.due_at>=source.reminder_schedule_changed_at
    and delivery.due_at<=check_now and delivery.due_at>=check_now-interval '10 minutes'
    and exists (select 1 from public.space_members where space_id=source_space and user_id=delivery.recipient_user_id)
    and (source.scope='shared' or source.owner_user_id=delivery.recipient_user_id)
    and exists (select 1 from public.push_subscriptions where id=delivery.subscription_id
      and user_id=delivery.recipient_user_id and disabled_at is null
      and (expiration_time is null or expiration_time>check_now));
end;
$$;
revoke all on function public.validate_event_lineage_audience(),
  public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date),
  public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text)
from public,anon,authenticated,service_role;
grant execute on function public.save_event_edit(uuid,timestamptz,text,uuid,jsonb,text,date) to authenticated;
grant execute on function public.check_event_reminder_delivery(uuid,uuid,timestamptz,timestamptz,date,uuid,timestamptz,text) to service_role;

-- ACCOUNT_DELETION_BARRIER_BEGIN
create schema private;
revoke all on schema private from public,anon,authenticated,service_role;

create table private.account_deletions (
  user_id uuid primary key,
  request_id uuid not null unique,
  status text not null default 'preparing' check (status in
    ('preparing','accepted','processing','completed','needs_attention')),
  phase text not null default 'pending' check (phase in
    ('pending','accepted','storage','business','auth','verify')),
  accepted_at timestamptz,
  completed_at timestamptz,
  generation bigint not null default 0 check (generation>=0),
  attempts integer not null default 0 check (attempts>=0),
  next_attempt_at timestamptz,
  lease_until timestamptz,
  error_code text check (error_code in ('RETRY_LATER','INVARIANT_FAILED','DEPENDENCY_UNAVAILABLE')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((status='preparing')=(accepted_at is null)),
  check ((status='completed')=(completed_at is not null))
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated,service_role;

create function private.guard_account_deletion_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.accepted_at is not null then raise exception 'Accepted deletion cannot be removed'; end if;
    return old;
  end if;
  if tg_op='INSERT' and new.status<>'preparing' then
    raise exception 'Deletion must start unaccepted';
  end if;
  if tg_op='UPDATE' then
    if row(new.user_id,new.request_id,new.created_at) is distinct from row(old.user_id,old.request_id,old.created_at)
      or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at)
      or new.generation<old.generation then
      raise exception 'Deletion identity and acceptance are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='preparing' and new.status='accepted')
      or (old.status='accepted' and new.status in ('processing','needs_attention'))
      or (old.status='processing' and new.status='needs_attention')
      or (old.status='needs_attention' and new.status='processing')) then
      raise exception 'Deletion transition is not available in this slice';
    end if;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;
create trigger account_deletions_guard before insert or update or delete on private.account_deletions
for each row execute function private.guard_account_deletion_state();

create function private.account_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select current_setting('transaction_isolation')='read committed'
    and p_user_id is not null and exists(select 1 from auth.users where id=p_user_id)
    and not exists(select 1 from private.account_deletions where user_id=p_user_id and accepted_at is not null);
$$;

create function private.lock_active_account(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_user_id is null then return false; end if;
  -- A stale REPEATABLE READ snapshot must never revive pre-acceptance state.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Account writes require READ COMMITTED' using errcode='0A000';
  end if;
  perform pg_advisory_xact_lock_shared(20261105,hashtext(p_user_id::text));
  -- Separate post-lock statement: fresh READ COMMITTED snapshot after waiting.
  return private.account_active(p_user_id);
end;
$$;

create function private.assert_active_account(p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if not private.lock_active_account(p_user_id) then
    raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501';
  end if;
end;
$$;

create function private.prepare_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare existing_request uuid;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  insert into private.account_deletions(user_id,request_id) values(p_user_id,p_request_id)
    on conflict(user_id) do nothing;
  select request_id into existing_request from private.account_deletions where user_id=p_user_id for update;
  if existing_request<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
  return existing_request;
end;
$$;

create function private.accept_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Account acceptance requires READ COMMITTED' using errcode='0A000';
  end if;
  -- Acceptance never waits on Space/business rows while holding this lock.
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not found then raise exception 'ACCOUNT_DELETION_INTENT_NOT_FOUND'; end if;
  if job.accepted_at is not null then return job.request_id; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=p_user_id and m.role='owner' and s.kind='shared') then
    raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION';
  end if;
  update private.account_deletions set status='accepted',phase='accepted',accepted_at=clock_timestamp(),
    next_attempt_at=clock_timestamp() where user_id=p_user_id;
  return job.request_id;
end;
$$;

create function private.set_account_deletion_status(p_request_id uuid,p_generation bigint,p_status text,p_error_code text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  select * into job from private.account_deletions where request_id=p_request_id for update;
  if not found or job.accepted_at is null then raise exception 'Accepted deletion is required'; end if;
  if job.generation is distinct from p_generation then return false; end if;
  if job.status=p_status then return true; end if;
  if p_status not in ('processing','needs_attention') then raise exception 'Finalizer is not available'; end if;
  update private.account_deletions set status=p_status,generation=generation+1,
    phase=case when phase='accepted' and p_status='processing' then 'storage' else phase end,
    attempts=attempts+case when p_status='processing' then 1 else 0 end,error_code=p_error_code
    where user_id=job.user_id;
  return true;
end;
$$;

revoke all on all functions in schema private from public,anon,authenticated,service_role;

create function public.current_account_active()
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select private.account_active(auth.uid());
$$;
revoke all on function public.current_account_active() from public,anon,authenticated,service_role;
grant execute on function public.current_account_active() to authenticated;

-- Service-only bounded prefilter: revoked recipients cannot consume the sender
-- candidate budget on every tick. This is not a client identity lookup API.
create function public.active_notification_accounts(p_user_ids uuid[])
returns setof uuid language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_user_ids is null or cardinality(p_user_ids)>100 then
    raise exception 'Invalid notification account batch' using errcode='22023';
  end if;
  return query select distinct u from unnest(p_user_ids) u where private.account_active(u) order by u;
end;
$$;
revoke all on function public.active_notification_accounts(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.active_notification_accounts(uuid[]) to service_role;

do $policies$
declare name text;
begin
  foreach name in array array['profiles','spaces','space_members','space_modules','events','tasks',
    'event_occurrence_exceptions','review_rounds','review_entries','lists','list_sections','list_items',
    'important_dates','push_subscriptions','reminder_deliveries'] loop
    execute format('create policy account_active_only on public.%I as restrictive for all to authenticated
      using (public.current_account_active()) with check (public.current_account_active())',name);
  end loop;
end;
$policies$;

create function private.guard_account_business_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); subject uuid;
begin
  -- SET ROLE is the database request role, unchanged by SECURITY DEFINER.
  -- Auth server bootstrap / privileged fixture SQL is not a user JWT request.
  if current_setting('role',true) in ('authenticated','anon') then
    perform private.assert_active_account(actor);
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_table_name='space_members' then
    if tg_op='INSERT' or row(new.user_id,new.role) is distinct from row(old.user_id,old.role) then
      subject:=new.user_id;
    end if;
  elsif tg_table_name='profiles' then
    if tg_op='INSERT' then subject:=new.id; end if;
  elsif tg_table_name='spaces' then
    if tg_op='INSERT' and new.kind='personal' then subject:=new.created_by; end if;
  elsif tg_table_name='events' then
    if new.scope='personal' and (tg_op='INSERT'
      or row(new.scope,new.owner_user_id) is distinct from row(old.scope,old.owner_user_id)) then
      subject:=new.owner_user_id;
    end if;
  elsif tg_table_name='tasks' then
    if new.assigned_to_user_id is not null and (tg_op='INSERT'
      or new.assigned_to_user_id is distinct from old.assigned_to_user_id) then
      subject:=new.assigned_to_user_id;
    end if;
  elsif tg_table_name='review_entries' then
    if tg_op='INSERT' then subject:=new.user_id; end if;
  elsif tg_table_name='push_subscriptions' then
    if tg_op='INSERT' or new.user_id is distinct from old.user_id then subject:=new.user_id; end if;
  elsif tg_table_name='reminder_deliveries' and tg_op='INSERT' then
    -- Existing claim RPCs represent ineligibility as null, not a sender failure.
    if not private.lock_active_account(new.recipient_user_id) then return null; end if;
  end if;
  if subject is not null then perform private.assert_active_account(subject); end if;
  return new;
end;
$$;
revoke all on function private.guard_account_business_write() from public,anon,authenticated,service_role;

do $guards$
declare name text;
begin
  foreach name in array array['profiles','spaces','space_members','space_modules','events','tasks',
    'event_occurrence_exceptions','review_rounds','review_entries','lists','list_sections','list_items',
    'important_dates','push_subscriptions','reminder_deliveries'] loop
    execute format('create trigger account_access_guard before insert or update or delete on public.%I
      for each row execute function private.guard_account_business_write()',name);
  end loop;
end;
$guards$;

create function private.guard_account_avatar_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.bucket_id='profile-avatars' and current_setting('role',true) in ('authenticated','anon') then
      perform private.assert_active_account(auth.uid());
    end if;
    return old;
  end if;
  if new.bucket_id='profile-avatars' then
    if current_setting('role',true) in ('authenticated','anon') then
      perform private.assert_active_account(auth.uid());
    end if;
    if new.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
      perform private.assert_active_account(split_part(new.name,'/',1)::uuid);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_account_avatar_write() from public,anon,authenticated,service_role;

do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Storage schema absent: avatar account barrier not installed';
    return;
  end if;
  if not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
    or (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('avatars_read','avatars_insert_self','avatars_delete_unused_self'))<>3
    or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and permissive='PERMISSIVE' and roles && array['public','anon','authenticated']::name[]
      and policyname not in ('avatars_read','avatars_insert_self','avatars_delete_unused_self')) then
    raise exception 'Avatar policy baseline requires review';
  end if;
  execute $policy$create policy avatars_account_active on storage.objects as restrictive for all to authenticated
    using (bucket_id<>'profile-avatars' or public.current_account_active())
    with check (bucket_id<>'profile-avatars' or public.current_account_active())$policy$;
  execute 'create trigger account_avatar_guard before insert or update or delete on storage.objects
    for each row execute function private.guard_account_avatar_write()';
end;
$storage$;
-- ACCOUNT_DELETION_READ_OVERRIDES
create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and exists (
    select 1
    from public.space_members sm
    where sm.space_id = target_space_id
      and sm.user_id = auth.uid()
  );
$$;

create or replace function public.are_users_in_same_space(first_user_id uuid, second_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_active() and private.account_active(first_user_id)
    and private.account_active(second_user_id) and exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = first_user_id
      and theirs.user_id = second_user_id
  );
$$;

create or replace function public.can_read_review_round(p_review_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp as $$
  select public.current_account_active() and exists (
    select 1
    from public.review_rounds r
    join public.space_members m on m.space_id=r.space_id and m.user_id=auth.uid()
    join public.review_entries own_entry on own_entry.review_id=r.id and own_entry.user_id=auth.uid()
    where r.id=p_review_id
  );
$$;

create or replace function public.ensure_personal_space()
returns public.spaces
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  personal_space public.spaces;
begin
  perform private.assert_active_account(auth.uid());
  if current_user_id is null then
    raise exception 'You must be signed in to ensure a personal space';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(10110, pg_catalog.hashtext(current_user_id::text));
  select * into personal_space
  from public.spaces
  where kind = 'personal' and created_by = current_user_id;
  if personal_space.id is not null then
    return personal_space;
  end if;

  insert into public.spaces (name, kind, invite_code, created_by)
  values ('个人空间', 'personal', public.generate_invite_code(), current_user_id)
  returning * into personal_space;

  insert into public.space_members (space_id, user_id, role)
  values (personal_space.id, current_user_id, 'owner');

  return personal_space;
end;
$$;

create or replace function public.join_space_by_invite_code(code text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_space public.spaces;
  member_count integer;
begin
  perform private.assert_active_account(auth.uid());
  if current_user_id is null then
    raise exception 'You must be signed in to join a space';
  end if;

  if nullif(trim(code), '') is null then
    raise exception 'Invite code is required';
  end if;

  select *
  into target_space
  from public.spaces
  where invite_code = upper(trim(code));

  if target_space.id is null then
    raise exception 'Invite code is invalid';
  end if;

  if target_space.kind = 'personal' then
    raise exception 'Personal Spaces cannot be joined by invite code';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_space.id::text));

  if exists (
    select 1 from public.space_members
    where space_id = target_space.id and user_id = current_user_id
  ) then
    raise exception 'You are already a member of this space';
  end if;

  select count(*)
  into member_count
  from public.space_members
  where space_id = target_space.id;

  if member_count >= 2 then
    raise exception 'This space is already full';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (target_space.id, current_user_id, 'member');

  return target_space;
end;
$$;

create or replace function public.get_my_previous_review_plan(p_review_id uuid)
returns text language plpgsql stable security definer
set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  target_space_id uuid;
  current_review_date date;
  previous_round_id uuid;
  previous_plan text;
begin
  if not public.current_account_active() then
    raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501';
  end if;
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

create or replace function public.important_date_reminder_is_eligible(
  p_source public.important_dates,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select private.account_active(p_recipient_user_id) and (
case when p_occurrence_date is null or not isfinite(p_occurrence_date) or (p_source).id is null then false else
    (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and extract(year from p_occurrence_date)>0
    and extract(month from p_occurrence_date)=(p_source).month
    and (extract(day from p_occurrence_date)=(p_source).day or (
      (p_source).repeat_kind='annual' and (p_source).month=2 and (p_source).day=29
      and extract(day from p_occurrence_date)=28
      and not (extract(year from p_occurrence_date)%4=0 and (
        extract(year from p_occurrence_date)%100<>0 or extract(year from p_occurrence_date)%400=0))))
    and (((p_source).repeat_kind='none' and (p_source).year=extract(year from p_occurrence_date))
      or ((p_source).repeat_kind='annual' and ((p_source).year is null or (p_source).year<=extract(year from p_occurrence_date))))
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='important_dates' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id and (s.kind='shared' or (s.kind='personal' and s.created_by=p_recipient_user_id))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  end
  );
$$;

create or replace function public.task_reminder_is_eligible(
  p_source public.tasks,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select private.account_active(p_recipient_user_id) and (
(p_source).id is not null and (p_source).status='open'
    and p_occurrence_date=(p_source).due_on and isfinite(p_occurrence_date)
    and (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).time_zone is not null
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='tasks' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id
        and ((s.kind='personal' and s.created_by=p_recipient_user_id)
          or (s.kind='shared' and ((p_source).assigned_to_user_id is null or (p_source).assigned_to_user_id=p_recipient_user_id)))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  );
$$;

create or replace function public.check_event_reminder_delivery(
  p_delivery_id uuid,p_event_id uuid,p_expected_marker timestamptz,
  p_expected_source_updated_at timestamptz default null,
  p_occurrence_date date default null,p_expected_exception_id uuid default null,
  p_expected_exception_updated_at timestamptz default null,p_expected_exception_type text default null
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source public.events; delivery public.reminder_deliveries; source_space uuid; check_now timestamptz;
begin
  select space_id into source_space from public.events where id=p_event_id;
  if source_space is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space::text));
  perform 1 from public.spaces where id=source_space for update;
  select * into source from public.events where id=p_event_id and space_id=source_space for update;
  if not found then return false; end if;
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.important_date_id is not null or delivery.task_id is not null
    or delivery.event_id is distinct from (case when source.recurrence_rule is null then source.id else coalesce(source.series_id,source.id) end)
    or source.reminder_kind is null or source.time_zone is null
    or source.reminder_schedule_changed_at is distinct from p_expected_marker
    or (source.recurrence_rule is not null and (p_expected_source_updated_at is null
      or source.updated_at is distinct from p_expected_source_updated_at)) then return false; end if;
  if source.recurrence_rule is not null and (
    delivery.occurrence_date is distinct from p_occurrence_date
    or (p_expected_exception_id is null and exists (select 1 from public.event_occurrence_exceptions
      where event_id=source.id and occurrence_date=p_occurrence_date))
    or (p_expected_exception_id is not null and not exists (select 1 from public.event_occurrence_exceptions
      where id=p_expected_exception_id and event_id=source.id and occurrence_date=p_occurrence_date
      and updated_at=p_expected_exception_updated_at and exception_type=p_expected_exception_type
      and exception_type='override'))
  ) then return false; end if;
  if not private.account_active(delivery.recipient_user_id) then return false; end if;
  check_now:=clock_timestamp();
  return delivery.due_at>=source.reminder_schedule_changed_at
    and delivery.due_at<=check_now and delivery.due_at>=check_now-interval '10 minutes'
    and exists (select 1 from public.space_members where space_id=source_space and user_id=delivery.recipient_user_id)
    and (source.scope='shared' or source.owner_user_id=delivery.recipient_user_id)
    and exists (select 1 from public.push_subscriptions where id=delivery.subscription_id
      and user_id=delivery.recipient_user_id and disabled_at is null
      and (expiration_time is null or expiration_time>check_now));
end;
$$;
-- ACCOUNT_DELETION_BARRIER_END

-- ACCOUNT_DELETION_TRUSTED_BEGIN
alter table private.account_deletions
  add column verification_session_id uuid,
  add column challenge_id uuid,
  add column challenge_started_at timestamptz,
  add column verification_claim_id uuid,
  add column verification_claimed_at timestamptz,
  add column verification_attempts integer not null default 0 check(verification_attempts>=0),
  add column identity_verified_at timestamptz,
  add column permit_hash text check(permit_hash ~ '^[0-9a-f]{64}$'),
  add column permit_expires_at timestamptz,
  add column permit_used_at timestamptz,
  add column business_cleaned_at timestamptz;

create or replace function private.guard_account_deletion_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then
    if old.accepted_at is not null then raise exception 'Accepted deletion cannot be removed'; end if;
    return old;
  end if;
  if tg_op='INSERT' and new.status<>'preparing' then
    raise exception 'Deletion must start unaccepted';
  end if;
  if tg_op='UPDATE' then
    if old.accepted_at is not null and row(new.verification_session_id,new.identity_verified_at,new.permit_hash,new.permit_used_at)
      is distinct from row(old.verification_session_id,old.identity_verified_at,old.permit_hash,old.permit_used_at) then
      raise exception 'Accepted verification is immutable';
    end if;
    if row(new.user_id,new.request_id,new.created_at) is distinct from row(old.user_id,old.request_id,old.created_at)
      or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at)
      or new.generation<old.generation then
      raise exception 'Deletion identity and acceptance are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='preparing' and new.status='accepted')
      or (old.status='accepted' and new.status in ('processing','needs_attention'))
      or (old.status='processing' and new.status='needs_attention')
      or (old.status='needs_attention' and new.status='processing')) then
      raise exception 'Deletion transition is not available in this slice';
    end if;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;

-- An accepted identity is immutable. Replays must not wait for its job row
-- while holding the exclusive account gate: cleanup may be holding that row.
create or replace function private.prepare_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id;
  if found and job.accepted_at is not null then
    if job.request_id<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
    return job.request_id;
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  insert into private.account_deletions(user_id,request_id) values(p_user_id,p_request_id) on conflict(user_id) do nothing;
  select * into job from private.account_deletions where user_id=p_user_id for update;
  if job.request_id<>p_request_id then raise exception 'ACCOUNT_DELETION_INTENT_CONFLICT'; end if;
  return job.request_id;
end;
$$;
create or replace function private.accept_account_deletion(p_user_id uuid,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Account and request are required'; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Account acceptance requires READ COMMITTED' using errcode='0A000'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(p_user_id::text));
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id;
  if not found then raise exception 'ACCOUNT_DELETION_INTENT_NOT_FOUND'; end if;
  if job.accepted_at is not null then return job.request_id; end if;
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=p_user_id and m.role='owner' and s.kind='shared') then raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION'; end if;
  update private.account_deletions set status='accepted',phase='accepted',accepted_at=clock_timestamp(),next_attempt_at=clock_timestamp() where user_id=p_user_id;
  return job.request_id;
end;
$$;

create function private.deletion_session()
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare session_id uuid;
begin
  session_id:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
  if auth.uid() is null or session_id is null or not exists(select 1 from auth.sessions s
    where s.id=session_id and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp())) then
    raise exception 'DELETION_SESSION_REQUIRED' using errcode='42501';
  end if;
  return session_id;
end;
$$;

create function public.prepare_my_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; rid uuid;
begin
  select * into job from private.account_deletions where user_id=actor;
  rid:=coalesce(job.request_id,gen_random_uuid());
  perform private.prepare_account_deletion(actor,rid);
  select * into job from private.account_deletions where user_id=actor;
  if job.accepted_at is not null then raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501'; end if;
  select * into job from private.account_deletions where user_id=actor for update;
  if job.verification_session_id is distinct from sid and job.challenge_started_at>clock_timestamp()-interval '5 minutes' then
    raise exception 'DELETION_SESSION_CONFLICT' using errcode='42501';
  end if;
  if job.challenge_started_at>clock_timestamp()-interval '60 seconds' then
    return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',false);
  end if;
  update private.account_deletions set verification_session_id=sid,challenge_id=gen_random_uuid(),
    challenge_started_at=clock_timestamp(),verification_claim_id=null,verification_claimed_at=null,
    verification_attempts=0,identity_verified_at=null,permit_hash=null,permit_expires_at=null,permit_used_at=null
    where user_id=actor returning * into job;
  return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',true);
end;
$$;

-- Service-only verification attempt lease. A successful ordinary login, client
-- boolean, or JWT AMR record cannot call either half of this contract.
create function public.claim_deletion_verification(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_challenge_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions; claim_id uuid:=gen_random_uuid();
begin
  select * into job from private.account_deletions where user_id=p_user_id and request_id=p_request_id for update;
  if not found or job.accepted_at is not null or job.verification_session_id is distinct from p_session_id
    or job.challenge_id is distinct from p_challenge_id or job.challenge_started_at<clock_timestamp()-interval '5 minutes'
    or job.challenge_started_at is null or job.verification_attempts>=5 or job.permit_hash is not null
    or job.verification_claimed_at>clock_timestamp()-interval '30 seconds'
    or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id) then
    raise exception 'DELETION_VERIFICATION_UNAVAILABLE' using errcode='42501';
  end if;
  update private.account_deletions set verification_claim_id=claim_id,verification_claimed_at=clock_timestamp(),
    verification_attempts=verification_attempts+1 where user_id=p_user_id;
  return claim_id;
end;
$$;
create function public.release_deletion_verification(p_request_id uuid,p_claim_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  update private.account_deletions set verification_claim_id=null,verification_claimed_at=null
    where request_id=p_request_id and verification_claim_id=p_claim_id and accepted_at is null;
end;
$$;
create function public.finish_deletion_verification(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_challenge_id uuid,p_claim_id uuid,p_permit_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if p_permit_hash is null or p_permit_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid verification permit'; end if;
  update private.account_deletions set identity_verified_at=clock_timestamp(),permit_hash=p_permit_hash,
    permit_expires_at=clock_timestamp()+interval '5 minutes',verification_claim_id=null,verification_claimed_at=null
    where user_id=p_user_id and request_id=p_request_id and verification_session_id=p_session_id
      and challenge_id=p_challenge_id and verification_claim_id=p_claim_id and accepted_at is null and permit_hash is null
      and verification_claimed_at>clock_timestamp()-interval '30 seconds'
      and challenge_started_at>clock_timestamp()-interval '5 minutes'
      and exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id);
  return found;
end;
$$;

-- Owner-managed admission switch. No app/service role can change rollout policy.
create table private.account_deletion_admission (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  allowed_user_ids uuid[]
);
insert into private.account_deletion_admission(singleton) values (true);
alter table private.account_deletion_admission enable row level security;
revoke all on private.account_deletion_admission from public,anon,authenticated,service_role;

create function public.accept_my_account_deletion(p_request_id uuid,p_confirmation_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; expected_hash text;
begin
  if p_confirmation_token is null or p_confirmation_token !~ '^[0-9a-f]{64}$' then raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501'; end if;
  expected_hash:=encode(sha256(convert_to(p_confirmation_token,'UTF8')),'hex');
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  select * into job from private.account_deletions where user_id=actor and request_id=p_request_id;
  if not found or job.verification_session_id is distinct from sid or job.permit_hash is distinct from expected_hash
    or job.identity_verified_at is null then raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501'; end if;
  if job.accepted_at is not null then return jsonb_build_object('request_id',job.request_id,'status',job.status); end if;
  -- Hold the policy row through commit: closing admission waits for any earlier
  -- acceptance to commit. Policy updates take no Space/account/job locks.
  perform 1 from private.account_deletion_admission
    where singleton and enabled and (allowed_user_ids is null or actor=any(allowed_user_ids)) for share;
  if not found then raise exception 'NEW_DELETION_REQUESTS_DISABLED' using errcode='42501'; end if;
  select * into job from private.account_deletions where user_id=actor and request_id=p_request_id for update;
  if job.verification_session_id is distinct from sid or job.permit_hash is distinct from expected_hash
    or job.permit_expires_at<=clock_timestamp() or job.permit_expires_at is null or job.permit_used_at is not null then
    raise exception 'DELETION_PERMIT_REQUIRED' using errcode='42501';
  end if;
  update private.account_deletions set permit_used_at=clock_timestamp() where user_id=actor;
  perform private.accept_account_deletion(actor,p_request_id);
  return jsonb_build_object('request_id',p_request_id,'status','accepted');
end;
$$;
revoke all on function public.prepare_my_account_deletion(),public.accept_my_account_deletion(uuid,text),
  public.claim_deletion_verification(uuid,uuid,uuid,uuid),public.release_deletion_verification(uuid,uuid),
  public.finish_deletion_verification(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.prepare_my_account_deletion(),public.accept_my_account_deletion(uuid,text) to authenticated;
grant execute on function public.claim_deletion_verification(uuid,uuid,uuid,uuid),public.release_deletion_verification(uuid,uuid),
  public.finish_deletion_verification(uuid,uuid,uuid,uuid,uuid,text) to service_role;

do $executor_role$
begin
  if not exists(select 1 from pg_roles where rolname='account_deletion_executor') then
    create role account_deletion_executor nologin noinherit nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='account_deletion_executor' and (rolcanlogin or rolinherit or rolbypassrls or rolsuper or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'Unexpected deletion executor privileges';
  end if;
  if exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member
    where m.roleid='account_deletion_executor'::regrole and r.rolname<>'postgres') then
    raise exception 'Unexpected executor membership';
  end if;
end;
$executor_role$;
grant usage on schema private,public to account_deletion_executor;
grant select on private.account_deletions to account_deletion_executor;
grant update(status,phase,generation,attempts,business_cleaned_at,updated_at) on private.account_deletions to account_deletion_executor;
create policy deletion_executor_job on private.account_deletions for all to account_deletion_executor
  using(request_id=nullif(current_setting('app.deletion_request',true),'')::uuid)
  with check(request_id=nullif(current_setting('app.deletion_request',true),'')::uuid);

create function private.cleanup_target()
returns uuid language sql stable set search_path=pg_catalog,pg_temp as $$
  select user_id from private.account_deletions where current_user='account_deletion_executor'
    and request_id=nullif(current_setting('app.deletion_request',true),'')::uuid
    and accepted_at is not null and identity_verified_at is not null and permit_used_at is not null
    and status in ('accepted','processing') and phase in ('accepted','storage','business');
$$;
create function private.cleanup_ids(p_kind text)
returns uuid[] language sql stable set search_path=pg_catalog,pg_temp as $$
  select case when current_user='account_deletion_executor' and private.cleanup_target() is not null then
    coalesce(nullif(current_setting(case p_kind when 'spaces' then 'app.deletion_spaces' when 'events' then 'app.deletion_events'
      when 'tasks' then 'app.deletion_tasks' when 'dates' then 'app.deletion_dates' else 'app.deletion_none' end,true),'')::uuid[],'{}'::uuid[])
    else '{}'::uuid[] end;
$$;
create function private.cleanup_personal_space(p_space_id uuid)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select exists(select 1 from public.spaces where id=p_space_id and kind='personal' and created_by=private.cleanup_target());
$$;
-- The helper remains internal. Existing owner/member RPCs already execute as
-- their definer; an invoker helper lets the restricted cleanup keep its identity.
alter function public.delete_lifecycle_event_set(uuid,uuid) security invoker;
grant execute on function public.delete_lifecycle_event_set(uuid,uuid),public.generate_invite_code(),
  public.is_space_member(uuid),public.are_users_in_same_space(uuid,uuid),public.is_space_module_enabled(uuid,text),
  public.can_manage_event(uuid,text,uuid),public.can_read_review_round(uuid) to account_deletion_executor;

create or replace function public.guard_personal_space_delete()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if old.kind='personal' then
    if current_user<>'account_deletion_executor' then raise exception 'Personal Space cannot be deleted'; end if;
    if old.created_by is distinct from private.cleanup_target() then raise exception 'Personal Space cannot be deleted'; end if;
  end if;
  return old;
end;
$$;

-- Read only the target's references and the locked Space workset. The workset
-- GUC is not authority: only the NOLOGIN definer can use these policies, and its
-- sole entry point resets and derives every value from the immutable job.
grant select,delete on public.profiles,public.space_members,public.space_modules,public.events,public.tasks,
  public.event_occurrence_exceptions,public.review_rounds,public.review_entries,public.lists,public.list_sections,
  public.list_items,public.important_dates,public.push_subscriptions,public.reminder_deliveries to account_deletion_executor;
grant select,delete on public.spaces to account_deletion_executor;
grant update(invite_code) on public.spaces to account_deletion_executor;
create policy deletion_executor_spaces_read on public.spaces for select to account_deletion_executor
  using((kind='personal' and created_by=private.cleanup_target()) or id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_spaces_delete on public.spaces for delete to account_deletion_executor
  using(kind='personal' and created_by=private.cleanup_target());
create policy deletion_executor_spaces_update on public.spaces for update to account_deletion_executor
  using(id=any(private.cleanup_ids('spaces'))) with check(id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_members_read on public.space_members for select to account_deletion_executor
  using(user_id=private.cleanup_target() or space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_members_delete on public.space_members for delete to account_deletion_executor
  using(user_id=private.cleanup_target() and role='member' and space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_profiles on public.profiles for all to account_deletion_executor using(id=private.cleanup_target());
create policy deletion_executor_push on public.push_subscriptions for all to account_deletion_executor using(user_id=private.cleanup_target());
create policy deletion_executor_events_read on public.events for select to account_deletion_executor
  using(owner_user_id=private.cleanup_target() or space_id=any(private.cleanup_ids('spaces')));
create policy deletion_executor_events_delete on public.events for delete to account_deletion_executor
  using(private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=private.cleanup_target()));
create policy deletion_executor_modules on public.space_modules for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_tasks on public.tasks for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_dates on public.important_dates for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_lists on public.lists for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_sections on public.list_sections for all to account_deletion_executor
  using(exists(select 1 from public.lists l where l.id=list_id and private.cleanup_personal_space(l.space_id)));
create policy deletion_executor_items on public.list_items for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_rounds on public.review_rounds for all to account_deletion_executor using(private.cleanup_personal_space(space_id));
create policy deletion_executor_entries on public.review_entries for all to account_deletion_executor
  using(exists(select 1 from public.review_rounds r where r.id=review_id and private.cleanup_personal_space(r.space_id)));
create policy deletion_executor_exceptions on public.event_occurrence_exceptions for all to account_deletion_executor
  using(exists(select 1 from public.events e where e.id=event_id and (private.cleanup_personal_space(e.space_id) or (e.scope='personal' and e.owner_user_id=private.cleanup_target()))));
create policy deletion_executor_ledger on public.reminder_deliveries for all to account_deletion_executor
  using(recipient_user_id=private.cleanup_target() or event_id=any(private.cleanup_ids('events'))
    or task_id=any(private.cleanup_ids('tasks')) or important_date_id=any(private.cleanup_ids('dates')));

create function public.cleanup_account_business(p_request_id uuid,p_generation bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions; spaces uuid[]; sid uuid; space_kind text; removed integer;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Cleanup requires READ COMMITTED'; end if;
  perform set_config('app.deletion_request',p_request_id::text,true);
  perform set_config('app.deletion_spaces','{}',true);
  perform set_config('app.deletion_events','{}',true);
  perform set_config('app.deletion_tasks','{}',true);
  perform set_config('app.deletion_dates','{}',true);
  select * into job from private.account_deletions where request_id=p_request_id for update;
  if not found or job.accepted_at is null or job.identity_verified_at is null or job.permit_used_at is null
    or job.status not in ('accepted','processing') or job.phase not in ('accepted','storage','business') then
    raise exception 'TRUSTED_ACCEPTED_JOB_REQUIRED' using errcode='42501';
  end if;
  if job.business_cleaned_at is not null then return true; end if;
  if job.generation is distinct from p_generation then raise exception 'STALE_DELETION_GENERATION' using errcode='42501'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into spaces from (
    select id from public.spaces where kind='personal' and created_by=job.user_id
    union select space_id from public.space_members where user_id=job.user_id
    union select space_id from public.events where scope='personal' and owner_user_id=job.user_id
  ) work;
  perform set_config('app.deletion_spaces',spaces::text,true);
  foreach sid in array spaces loop
    perform pg_advisory_xact_lock(hashtext(sid::text));
    perform 1 from public.spaces where id=sid for update;
  end loop;
  if exists(select 1 from public.space_members m join public.spaces s on s.id=m.space_id
    where m.user_id=job.user_id and m.role='owner' and s.kind='shared') then
    raise exception 'SHARED_OWNERSHIP_REQUIRES_ACTION';
  end if;
  perform set_config('app.deletion_events',coalesce((select array_agg(id)::text from (
    select id from public.events where private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=job.user_id)
    union select coalesce(series_id,id) from public.events where private.cleanup_personal_space(space_id) or (scope='personal' and owner_user_id=job.user_id)
  ) roots),'{}'),true);
  perform set_config('app.deletion_tasks',coalesce((select array_agg(id)::text from public.tasks where private.cleanup_personal_space(space_id)),'{}'),true);
  perform set_config('app.deletion_dates',coalesce((select array_agg(id)::text from public.important_dates where private.cleanup_personal_space(space_id)),'{}'),true);
  delete from public.reminder_deliveries where recipient_user_id=job.user_id or event_id=any(private.cleanup_ids('events'))
    or task_id=any(private.cleanup_ids('tasks')) or important_date_id=any(private.cleanup_ids('dates'));
  foreach sid in array spaces loop
    select s.kind into space_kind from public.spaces s where s.id=sid;
    if space_kind='personal' then
      if not private.cleanup_personal_space(sid) then raise exception 'Unexpected Personal target'; end if;
      perform public.delete_lifecycle_event_set(sid,null);
      delete from public.spaces where id=sid;
    elsif space_kind='shared' then
      perform public.delete_lifecycle_event_set(sid,job.user_id);
      delete from public.space_members where space_id=sid and user_id=job.user_id and role='member';
      get diagnostics removed=row_count;
      if removed>0 then update public.spaces set invite_code=public.generate_invite_code() where id=sid; end if;
    end if;
  end loop;
  delete from public.push_subscriptions where user_id=job.user_id;
  delete from public.profiles where id=job.user_id;
  if exists(select 1 from public.space_members where user_id=job.user_id)
    or exists(select 1 from public.events where owner_user_id=job.user_id)
    or exists(select 1 from public.spaces where kind='personal' and created_by=job.user_id) then
    raise exception 'Business cleanup postflight failed';
  end if;
  if exists(select 1 from public.spaces s where s.kind='shared' and s.id=any(spaces) and
    ((select count(*) from public.space_members m where m.space_id=s.id and m.role='owner')<>1
      or (select count(*) from public.space_members m where m.space_id=s.id)>2)) then
    raise exception 'Shared lifecycle postflight failed';
  end if;
  -- Storage/Auth are still outstanding. This independent local DB operation
  -- never advances to auth/verify/completed, even after all business rows vanish.
  update private.account_deletions set status='processing',phase=case when phase='accepted' then 'storage' else phase end,
    business_cleaned_at=clock_timestamp(),generation=generation+1,attempts=attempts+1 where request_id=p_request_id;
  return true;
end;
$$;
grant account_deletion_executor to postgres;
grant create on schema public to account_deletion_executor;
alter function public.cleanup_account_business(uuid,bigint) owner to account_deletion_executor;
revoke create on schema public from account_deletion_executor;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant execute on function private.cleanup_target(),private.cleanup_ids(text),private.cleanup_personal_space(uuid) to account_deletion_executor;
revoke all on function public.cleanup_account_business(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.cleanup_account_business(uuid,bigint) to service_role;
revoke account_deletion_executor from postgres;
-- ACCOUNT_DELETION_TRUSTED_END

-- ACCOUNT_DELETION_EXECUTION_BEGIN
alter table private.account_deletions
  add column lease_token uuid,
  add column storage_cleaned_at timestamptz,
  add column auth_missing_at timestamptz,
  add column receipt_hash text check(receipt_hash ~ '^[0-9a-f]{64}$'),
  add column receipt_expires_at timestamptz;

-- Keeps the previously reviewed cleanup body/role unchanged. Only a leased
-- wrapper may now invoke it; service_role cannot bypass the execution protocol.
grant account_deletion_executor to postgres;
set role account_deletion_executor;
grant execute on function public.cleanup_account_business(uuid,bigint) to postgres;
revoke execute on function public.cleanup_account_business(uuid,bigint) from service_role;
reset role;
revoke account_deletion_executor from postgres;
do $$begin
  if has_function_privilege('service_role','public.cleanup_account_business(uuid,bigint)','EXECUTE')
    or not has_function_privilege('postgres','public.cleanup_account_business(uuid,bigint)','EXECUTE') then
    raise exception 'Cleanup lease boundary ACL could not be installed';
  end if;
end;$$;

create function private.deletion_business_clear(p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select not exists(select 1 from public.profiles where id=p_user)
    and not exists(select 1 from public.spaces where kind='personal' and created_by=p_user)
    and not exists(select 1 from public.space_members where user_id=p_user)
    and not exists(select 1 from public.events where owner_user_id=p_user)
    and not exists(select 1 from public.tasks where assigned_to_user_id=p_user)
    and not exists(select 1 from public.push_subscriptions where user_id=p_user)
    and not exists(select 1 from public.reminder_deliveries where recipient_user_id=p_user);
$$;
create function private.deletion_storage_clear(p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select not exists(select 1 from storage.objects where
    (bucket_id='profile-avatars' and split_part(name,'/',1)=p_user::text)
    or owner_id=p_user::text or owner=p_user);
$$;

create function private.lock_deletion_lease(p_request uuid,p_generation bigint,p_lease uuid)
returns private.account_deletions language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required'; end if;
  select * into job from private.account_deletions where request_id=p_request for update;
  if not found or job.accepted_at is null or job.identity_verified_at is null or job.permit_used_at is null
    or job.status<>'processing' or job.generation is distinct from p_generation
    or job.lease_token is distinct from p_lease or p_lease is null or job.lease_until is null or job.lease_until<=clock_timestamp() then
    raise exception 'DELETION_LEASE_REQUIRED' using errcode='42501';
  end if;
  return job;
end;
$$;
create function public.claim_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  update private.account_deletions set receipt_hash=null,receipt_expires_at=null where receipt_expires_at<=clock_timestamp();
  select * into job from private.account_deletions
    where accepted_at is not null and identity_verified_at is not null and permit_used_at is not null
      and status in ('accepted','processing') and coalesce(next_attempt_at,'-infinity')<=clock_timestamp()
      and coalesce(lease_until,'-infinity')<=clock_timestamp()
    order by next_attempt_at nulls first,accepted_at for update skip locked limit 1;
  if not found then return null; end if;
  update private.account_deletions set status='processing',phase=case when phase='accepted' then 'storage' else phase end,
    generation=generation+1,attempts=attempts+1,error_code=null,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
    where user_id=job.user_id returning * into job;
  return jsonb_build_object('request_id',job.request_id,'user_id',job.user_id,'generation',job.generation,'lease_token',job.lease_token,'phase',job.phase);
end;
$$;
create function public.check_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  if job.phase in ('auth','verify') and (job.business_cleaned_at is null or job.storage_cleaned_at is null
    or not private.deletion_business_clear(job.user_id) or not private.deletion_storage_clear(job.user_id)) then
    raise exception 'DELETION_POSTFLIGHT_FAILED';
  end if;
  if exists(select 1 from storage.objects where (owner_id=job.user_id::text or owner=job.user_id)
    and (bucket_id<>'profile-avatars' or split_part(name,'/',1)<>job.user_id::text)) then
    raise exception 'UNKNOWN_STORAGE_OWNERSHIP';
  end if;
  if exists(select 1 from storage.objects where bucket_id='profile-avatars' and split_part(name,'/',1)=job.user_id::text
    and coalesce(owner_id,owner::text,job.user_id::text)<>job.user_id::text) then raise exception 'UNKNOWN_STORAGE_OWNERSHIP'; end if;
  return jsonb_build_object('user_id',job.user_id,'phase',job.phase);
end;
$$;
create function public.advance_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid,p_stage text)
returns boolean language plpgsql security definer set lock_timeout='5s' set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  if p_stage='storage' and job.phase='storage' then
    if not private.deletion_storage_clear(job.user_id) then raise exception 'STORAGE_POSTFLIGHT_FAILED'; end if;
    update private.account_deletions set storage_cleaned_at=clock_timestamp(),phase='business' where user_id=job.user_id;
  elsif p_stage='business' and job.phase='business' then
    if job.storage_cleaned_at is null or not private.deletion_storage_clear(job.user_id) then raise exception 'STORAGE_POSTFLIGHT_FAILED'; end if;
    perform public.cleanup_account_business(p_request_id,p_generation);
    if not private.deletion_business_clear(job.user_id) then raise exception 'BUSINESS_POSTFLIGHT_FAILED'; end if;
    update private.account_deletions set phase='auth' where user_id=job.user_id;
  elsif p_stage='auth' and job.phase='auth' then
    if job.business_cleaned_at is null or job.storage_cleaned_at is null or not private.deletion_business_clear(job.user_id)
      or not private.deletion_storage_clear(job.user_id) or exists(select 1 from auth.users where id=job.user_id) then
      raise exception 'AUTH_POSTFLIGHT_FAILED';
    end if;
    update private.account_deletions set auth_missing_at=clock_timestamp(),phase='verify' where user_id=job.user_id;
  elsif p_stage='complete' and job.phase='verify' then
    if job.business_cleaned_at is null or job.storage_cleaned_at is null or job.auth_missing_at is null
      or not private.deletion_business_clear(job.user_id) or not private.deletion_storage_clear(job.user_id)
      or exists(select 1 from auth.users where id=job.user_id) or job.error_code is not null then
      raise exception 'FINAL_POSTFLIGHT_FAILED';
    end if;
    perform set_config('app.deletion_finalize',p_request_id::text,true);
    update private.account_deletions set status='completed',completed_at=clock_timestamp(),
      verification_session_id=null,challenge_id=null,challenge_started_at=null,verification_claim_id=null,verification_claimed_at=null,
      permit_hash=null,permit_expires_at=null,permit_used_at=null,
      receipt_expires_at=case when receipt_hash is not null then clock_timestamp()+interval '7 days' end
      where user_id=job.user_id;
  else raise exception 'INVALID_DELETION_STAGE'; end if;
  if job.lease_until<=clock_timestamp() then raise exception 'DELETION_LEASE_EXPIRED' using errcode='42501'; end if;
  update private.account_deletions set lease_token=null,lease_until=null,next_attempt_at=clock_timestamp(),error_code=null
    where user_id=job.user_id;
  return true;
end;
$$;
create function public.release_deletion_execution(p_request_id uuid,p_generation bigint,p_lease_token uuid,p_attention boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare job private.account_deletions;
begin
  job:=private.lock_deletion_lease(p_request_id,p_generation,p_lease_token);
  update private.account_deletions set status=case when p_attention then 'needs_attention' else 'processing' end,
    error_code=case when p_attention then 'INVARIANT_FAILED' else 'RETRY_LATER' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,5*power(2,least(job.attempts,6)))::integer),
    lease_token=null,lease_until=null where user_id=job.user_id;
  return true;
end;
$$;
-- Owner-only recovery after the underlying incident is resolved. It cannot
-- change the target, waive OTP, restore normal access or skip postflight.
create function private.resume_account_deletion(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  update private.account_deletions set status='processing',phase='storage',generation=generation+1,
    storage_cleaned_at=null,auth_missing_at=null,error_code=null,next_attempt_at=clock_timestamp(),lease_token=null,lease_until=null
    where request_id=p_request_id and status='needs_attention' and accepted_at is not null;
  if not found then raise exception 'ATTENTION_JOB_REQUIRED'; end if;
end;
$$;

create function public.bind_my_deletion_receipt(p_request_id uuid,p_confirmation_token text,p_receipt_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare sid uuid:=private.deletion_session();
begin
  if p_receipt_hash is null or p_receipt_hash!~'^[0-9a-f]{64}$' then raise exception 'INVALID_RECEIPT'; end if;
  update private.account_deletions set receipt_hash=p_receipt_hash,receipt_expires_at=clock_timestamp()+interval '7 days'
    where user_id=auth.uid() and request_id=p_request_id and verification_session_id=sid and accepted_at is null
      and permit_hash=encode(sha256(convert_to(p_confirmation_token,'UTF8')),'hex')
      and permit_expires_at>clock_timestamp() and permit_used_at is null and identity_verified_at is not null;
  return found;
end;
$$;
create function public.read_deletion_receipt(p_receipt_hash text)
returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select jsonb_build_object('status',status) from private.account_deletions where receipt_hash=p_receipt_hash
    and receipt_expires_at>clock_timestamp();
$$;
create unique index account_deletion_receipt_hash_key on private.account_deletions(receipt_hash) where receipt_hash is not null;

-- Normal transition rules remain, with one tightly scoped completion branch.
create or replace function private.guard_account_deletion_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare finalizing boolean:=false;
begin
  if tg_op='DELETE' then
    if old.accepted_at is not null then raise exception 'Accepted deletion cannot be removed'; end if; return old;
  end if;
  if tg_op='INSERT' and new.status<>'preparing' then raise exception 'Deletion must start unaccepted'; end if;
  if tg_op='UPDATE' then
    if old.status='processing' and new.status='completed' and current_user='postgres' then
    finalizing:=current_setting('app.deletion_finalize',true)=old.request_id::text and old.phase='verify'
      and old.business_cleaned_at is not null and old.storage_cleaned_at is not null and old.auth_missing_at is not null
      and old.error_code is null and not exists(select 1 from auth.users where id=old.user_id)
      and private.deletion_business_clear(old.user_id) and private.deletion_storage_clear(old.user_id);
    end if;
    if old.accepted_at is not null and not coalesce(finalizing,false) and
      row(new.verification_session_id,new.identity_verified_at,new.permit_hash,new.permit_used_at)
      is distinct from row(old.verification_session_id,old.identity_verified_at,old.permit_hash,old.permit_used_at) then
      raise exception 'Accepted verification is immutable';
    end if;
    if row(new.user_id,new.request_id,new.created_at) is distinct from row(old.user_id,old.request_id,old.created_at)
      or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at) or new.generation<old.generation
      or (old.status='completed' and row(new.status,new.phase,new.completed_at) is distinct from row(old.status,old.phase,old.completed_at)) then
      raise exception 'Deletion identity and acceptance are immutable';
    end if;
    if new.status is distinct from old.status and not (
      (old.status='preparing' and new.status='accepted') or (old.status='accepted' and new.status in ('processing','needs_attention'))
      or (old.status='processing' and new.status='needs_attention') or (old.status='needs_attention' and new.status='processing')
      or coalesce(finalizing,false)) then raise exception 'Deletion transition is not available in this slice'; end if;
  end if;
  new.updated_at:=clock_timestamp();return new;
end;
$$;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
revoke all on function public.claim_account_deletion(),public.check_deletion_execution(uuid,bigint,uuid),
  public.advance_deletion_execution(uuid,bigint,uuid,text),public.release_deletion_execution(uuid,bigint,uuid,boolean),
  public.read_deletion_receipt(text),public.bind_my_deletion_receipt(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_account_deletion(),public.check_deletion_execution(uuid,bigint,uuid),
  public.advance_deletion_execution(uuid,bigint,uuid,text),public.release_deletion_execution(uuid,bigint,uuid,boolean),
  public.read_deletion_receipt(text) to service_role;
grant execute on function public.bind_my_deletion_receipt(uuid,text,text) to authenticated;
-- ACCOUNT_DELETION_EXECUTION_END

-- ACCOUNT_DELETION_FRONTEND_BEGIN
create function public.cancel_my_deletion_preparation()
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='0A000'; end if;
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  select * into job from private.account_deletions where user_id=actor;
  if found and job.accepted_at is not null then return false; end if;
  if not found then return true; end if;
  select * into job from private.account_deletions where user_id=actor for update;
  if job.verification_session_id is distinct from sid then raise exception 'DELETION_SESSION_REQUIRED' using errcode='42501'; end if;
  update private.account_deletions set permit_hash=null,permit_expires_at=null,identity_verified_at=null,
    verification_claim_id=null,verification_claimed_at=null,challenge_id=null,challenge_started_at=null
    where user_id=actor and accepted_at is null;
  return true;
end;
$$;
create function public.review_deleted_participants(p_review_id uuid)
returns setof uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if not public.can_read_review_round(p_review_id) then raise exception 'Review participant permission required' using errcode='42501'; end if;
  return query select e.user_id from public.review_entries e join private.account_deletions d on d.user_id=e.user_id
    where e.review_id=p_review_id and d.status='completed' and d.completed_at is not null
      and not exists(select 1 from auth.users u where u.id=e.user_id);
end;
$$;
revoke all on function public.cancel_my_deletion_preparation(),public.review_deleted_participants(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_my_deletion_preparation(),public.review_deleted_participants(uuid) to authenticated;
-- ACCOUNT_DELETION_FRONTEND_END

-- ACCOUNT_DELETION_PILOT_BEGIN
create or replace function public.prepare_my_account_deletion()
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid(); sid uuid:=private.deletion_session(); job private.account_deletions; rid uuid;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'READ COMMITTED required' using errcode='0A000';
  end if;
  -- Same lock order as acceptance: account, admission policy, then request.
  perform pg_advisory_xact_lock(20261105,hashtext(actor::text));
  perform 1 from private.account_deletion_admission
    where singleton and enabled and actor=any(allowed_user_ids) for share;
  if not found then
    raise exception 'NEW_DELETION_REQUESTS_DISABLED' using errcode='42501';
  end if;
  select * into job from private.account_deletions where user_id=actor;
  rid:=coalesce(job.request_id,gen_random_uuid());
  perform private.prepare_account_deletion(actor,rid);
  select * into job from private.account_deletions where user_id=actor;
  if job.accepted_at is not null then raise exception 'ACCOUNT_ACCESS_REVOKED' using errcode='42501'; end if;
  select * into job from private.account_deletions where user_id=actor for update;
  if job.verification_session_id is distinct from sid and job.challenge_started_at>clock_timestamp()-interval '5 minutes' then
    raise exception 'DELETION_SESSION_CONFLICT' using errcode='42501';
  end if;
  if job.challenge_started_at>clock_timestamp()-interval '60 seconds' then
    return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',false);
  end if;
  update private.account_deletions set verification_session_id=sid,challenge_id=gen_random_uuid(),
    challenge_started_at=clock_timestamp(),verification_claim_id=null,verification_claimed_at=null,
    verification_attempts=0,identity_verified_at=null,permit_hash=null,permit_expires_at=null,permit_used_at=null
    where user_id=actor returning * into job;
  return jsonb_build_object('request_id',rid,'challenge_id',job.challenge_id,'send_needed',true);
end;
$$;
-- ACCOUNT_DELETION_PILOT_END
