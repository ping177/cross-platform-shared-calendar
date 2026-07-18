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
  created_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null constraint space_members_user_profile_fkey references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
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
  created_by uuid not null default auth.uid() references auth.users(id),
  scope text not null check (scope in ('personal', 'shared')),
  owner_user_id uuid references auth.users(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
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
  constraint events_recurrence_until_after_start_check check (recurrence_until is null or recurrence_until >= starts_at)
);

create unique index if not exists one_space_per_user_idx on public.space_members (user_id);
create index if not exists space_members_space_id_idx on public.space_members (space_id);
create index if not exists events_space_starts_idx on public.events (space_id, starts_at);
create index if not exists events_owner_idx on public.events (owner_user_id);
create index if not exists events_series_starts_idx on public.events (series_id, starts_at);
create index if not exists events_parent_event_id_idx on public.events (parent_event_id) where parent_event_id is not null;
create index if not exists events_space_recurrence_until_idx on public.events (space_id, recurrence_until) where recurrence_until is not null;

alter table public.events replica identity full;

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

    if new.scope is distinct from old.scope then
      raise exception 'Event scope cannot be changed';
    end if;

    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Event owner_user_id cannot be changed';
    end if;
  end if;

  if new.scope = 'shared' and new.owner_user_id is not null then
    raise exception 'Shared events must not have an owner_user_id';
  end if;

  if new.scope = 'personal' and new.owner_user_id is null then
    raise exception 'Personal events must have an owner_user_id';
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
    and (
      event_scope = 'shared'
      or (
        event_scope = 'personal'
        and event_owner_user_id = auth.uid()
      )
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

  if exists (select 1 from public.space_members where user_id = current_user_id) then
    raise exception 'This account is already in a space';
  end if;

  insert into public.spaces (name, invite_code, created_by)
  values (trim(space_name), public.generate_invite_code(), current_user_id)
  returning * into new_space;

  insert into public.space_members (space_id, user_id, role)
  values (new_space.id, current_user_id, 'owner');

  return new_space;
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

  if exists (select 1 from public.space_members where user_id = current_user_id) then
    raise exception 'This account is already in a space';
  end if;

  select *
  into target_space
  from public.spaces
  where invite_code = upper(trim(code));

  if target_space.id is null then
    raise exception 'Invite code is invalid';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_space.id::text));

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

  update public.spaces
  set invite_code = public.generate_invite_code()
  where id = rotate_invite_code.space_id
  returning * into updated_space;

  return updated_space;
end;
$$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.events enable row level security;
alter table public.event_occurrence_exceptions enable row level security;

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
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.event_occurrence_exceptions to authenticated;

grant execute on function public.create_space_with_invite(text) to authenticated;
grant execute on function public.join_space_by_invite_code(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

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
