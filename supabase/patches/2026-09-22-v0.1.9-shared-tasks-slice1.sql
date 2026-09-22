-- v0.1.9 Slice 1: Shared Task persistence, authorization, and Realtime foundation.
-- This patch is additive and intentionally contains no Task UI, RPC, Reminder, or Event changes.

begin;

do $$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'Shared Tasks Slice 1 requires PostgreSQL 15 or newer for column-specific ON DELETE SET NULL';
  end if;

  if to_regclass('public.tasks') is not null then
    raise exception 'public.tasks already exists; stop and review before applying';
  end if;

  if to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.profiles') is null then
    raise exception 'Required Space or profile baseline is missing';
  end if;

  if to_regprocedure('public.touch_updated_at()') is null
    or to_regprocedure('public.is_space_member(uuid)') is null then
    raise exception 'Required shared trigger or membership helper is missing';
  end if;

  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Required supabase_realtime publication is missing';
  end if;
end;
$$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  assigned_to_user_id uuid,
  title text not null,
  status text not null default 'open',
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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

create index tasks_space_status_due_created_id_idx
  on public.tasks (space_id, status, due_on, created_at, id);

alter table public.tasks replica identity full;

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

create trigger tasks_validate_identity
before update on public.tasks
for each row execute function public.validate_task_identity();

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

alter table public.tasks enable row level security;

create policy tasks_select_member
on public.tasks
for select
using (public.is_space_member(space_id));

create policy tasks_insert_member
on public.tasks
for insert
with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
);

create policy tasks_update_member
on public.tasks
for update
using (public.is_space_member(space_id))
with check (public.is_space_member(space_id));

create policy tasks_delete_member
on public.tasks
for delete
using (public.is_space_member(space_id));

grant select, insert, update, delete on table public.tasks to authenticated;

alter publication supabase_realtime add table public.tasks;

commit;
