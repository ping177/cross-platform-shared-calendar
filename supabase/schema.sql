create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_scope_owner_shape check (
    (scope = 'shared' and owner_user_id is null)
    or
    (scope = 'personal' and owner_user_id is not null)
  ),
  constraint event_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

create unique index if not exists one_space_per_user_idx on public.space_members (user_id);
create index if not exists space_members_space_id_idx on public.space_members (space_id);
create index if not exists events_space_starts_idx on public.events (space_id, starts_at);
create index if not exists events_owner_idx on public.events (owner_user_id);

alter table public.events replica identity full;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
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

grant execute on function public.create_space_with_invite(text) to authenticated;
grant execute on function public.join_space_by_invite_code(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
