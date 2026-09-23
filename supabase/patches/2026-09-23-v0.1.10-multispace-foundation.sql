-- v0.1.10 Slice 1: multi-space, Personal Space, and Tasks module permission foundation.
-- Apply only after read-only Production preflight; creates no Personal Space rows.

begin;

do $$
begin
  if to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.events') is null
    or to_regclass('public.tasks') is null then
    raise exception 'Required v0.1.9 Space, Event, or Task baseline is missing';
  end if;
  if to_regclass('public.one_space_per_user_idx') is null
    or to_regclass('public.space_modules') is not null
    or exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'spaces' and column_name = 'kind'
    ) then
    raise exception 'Unexpected multi-space baseline; stop and review before applying';
  end if;
  if to_regprocedure('public.create_space_with_invite(text)') is null
    or to_regprocedure('public.join_space_by_invite_code(text)') is null
    or to_regprocedure('public.rotate_invite_code(uuid)') is null
    or to_regprocedure('public.validate_event_owner()') is null
    or to_regprocedure('public.is_space_member(uuid)') is null then
    raise exception 'Required v0.1.9 RPC or RLS baseline is missing';
  end if;
end;
$$;

alter table public.spaces
  add column kind text not null default 'shared'
  constraint spaces_kind_check check (kind in ('personal', 'shared'));

drop index public.one_space_per_user_idx;
create unique index spaces_personal_created_by_idx
  on public.spaces (created_by) where kind = 'personal';

create table public.space_modules (
  space_id uuid not null references public.spaces(id) on delete cascade,
  module_key text not null check (module_key in ('tasks', 'lists', 'important_dates', 'review', 'memo')),
  enabled boolean not null,
  primary key (space_id, module_key)
);

create or replace function public.validate_space_identity()
returns trigger
language plpgsql
set search_path = public
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

create trigger spaces_validate_identity
before update on public.spaces
for each row execute function public.validate_space_identity();
create trigger spaces_enable_default_modules
after insert on public.spaces
for each row execute function public.enable_default_space_modules();
create trigger space_members_guard_personal
before insert or update or delete on public.space_members
for each row execute function public.guard_personal_space_member();

insert into public.space_modules (space_id, module_key, enabled)
select id, 'tasks', true from public.spaces;

alter table public.space_modules enable row level security;
create policy space_modules_select_member
on public.space_modules for select
using (public.is_space_member(space_id));
revoke all on table public.space_modules from public, anon, authenticated;
grant select on table public.space_modules to authenticated;

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
revoke all on function public.is_space_module_enabled(uuid, text) from public, anon;
grant execute on function public.is_space_module_enabled(uuid, text) to authenticated;

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
  if exists (
    select 1 from public.spaces s
    where s.id = new.space_id
      and s.kind = 'personal'
      and (new.scope <> 'personal' or new.owner_user_id is distinct from s.created_by)
  ) then
    raise exception 'Personal Space events must belong to the Space owner';
  end if;
  if new.scope = 'personal' and not exists (
    select 1 from public.space_members sm
    where sm.space_id = new.space_id and sm.user_id = new.owner_user_id
  ) then
    raise exception 'Personal event owner must be a member of the event space';
  end if;
  return new;
end;
$$;

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
revoke all on function public.ensure_personal_space() from public, anon;
grant execute on function public.ensure_personal_space() to authenticated;

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

  select * into target_space from public.spaces
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
  select count(*) into member_count
  from public.space_members where space_id = target_space.id;
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
    select 1 from public.space_members sm
    where sm.space_id = rotate_invite_code.space_id and sm.user_id = current_user_id
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
  if p_module_key is distinct from 'tasks' or p_enabled is null then
    raise exception 'Only the Tasks module may be toggled in this version';
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
revoke all on function public.set_space_module_enabled(uuid, text, boolean) from public, anon;
grant execute on function public.set_space_module_enabled(uuid, text, boolean) to authenticated;

drop policy "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member"
on public.tasks for insert
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
  and public.is_space_module_enabled(space_id, 'tasks')
);
drop policy "tasks_update_member" on public.tasks;
create policy "tasks_update_member"
on public.tasks for update
using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'))
with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'));
drop policy "tasks_delete_member" on public.tasks;
create policy "tasks_delete_member"
on public.tasks for delete
using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id, 'tasks'));

commit;
