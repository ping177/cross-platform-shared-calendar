-- v0.1.7.1: Recurrence exceptions database foundation.
-- This patch is additive. It does not project occurrences, split series, or change Realtime.
-- Do not rerun supabase/schema.sql against an existing environment.

begin;

alter table public.events
  add column if not exists series_id uuid,
  add column if not exists parent_event_id uuid,
  add column if not exists recurrence_until timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_series_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_series_id_fkey
      foreign key (series_id) references public.events(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_parent_event_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_parent_event_id_fkey
      foreign key (parent_event_id) references public.events(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_recurrence_until_after_start_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_recurrence_until_after_start_check
      check (recurrence_until is null or recurrence_until > starts_at);
  end if;
end;
$$;

-- Existing recurring sources become root segments. One-off events remain untouched.
update public.events
set series_id = id
where recurrence_rule is not null
  and series_id is null;

create index if not exists events_series_starts_idx
  on public.events (series_id, starts_at);

create index if not exists events_parent_event_id_idx
  on public.events (parent_event_id)
  where parent_event_id is not null;

create index if not exists events_space_recurrence_until_idx
  on public.events (space_id, recurrence_until)
  where recurrence_until is not null;

create table if not exists public.event_occurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  occurrence_date date not null,
  exception_type text not null check (exception_type in ('deleted', 'override')),
  override_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_occurrence_exceptions_event_occurrence_date_key unique (event_id, occurrence_date),
  constraint event_occurrence_exceptions_override_shape_check check (
    (exception_type = 'deleted' and override_data is null)
    or
    (exception_type = 'override' and override_data is not null and jsonb_typeof(override_data) = 'object')
  )
);

create index if not exists event_occurrence_exceptions_override_date_idx
  on public.event_occurrence_exceptions (event_id, occurrence_date)
  where exception_type = 'override';

create or replace function public.validate_event_occurrence_exception()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'Event occurrence exception event_id is immutable';
  end if;

  if not exists (
    select 1
    from public.events event
    where event.id = new.event_id
      and event.recurrence_rule is not null
  ) then
    raise exception 'Event occurrence exceptions require a recurring event';
  end if;

  return new;
end;
$$;

drop trigger if exists event_occurrence_exceptions_validate_event on public.event_occurrence_exceptions;
create trigger event_occurrence_exceptions_validate_event
before insert or update on public.event_occurrence_exceptions
for each row execute function public.validate_event_occurrence_exception();

drop trigger if exists event_occurrence_exceptions_touch_updated_at on public.event_occurrence_exceptions;
create trigger event_occurrence_exceptions_touch_updated_at
before update on public.event_occurrence_exceptions
for each row execute function public.touch_updated_at();

alter table public.event_occurrence_exceptions enable row level security;

drop policy if exists "event_occurrence_exceptions_select_event_member" on public.event_occurrence_exceptions;
create policy "event_occurrence_exceptions_select_event_member"
on public.event_occurrence_exceptions for select
using (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrence_exceptions.event_id
      and public.is_space_member(event.space_id)
  )
);

drop policy if exists "event_occurrence_exceptions_insert_event_manager" on public.event_occurrence_exceptions;
create policy "event_occurrence_exceptions_insert_event_manager"
on public.event_occurrence_exceptions for insert
with check (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrence_exceptions.event_id
      and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)
  )
);

drop policy if exists "event_occurrence_exceptions_update_event_manager" on public.event_occurrence_exceptions;
create policy "event_occurrence_exceptions_update_event_manager"
on public.event_occurrence_exceptions for update
using (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrence_exceptions.event_id
      and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)
  )
)
with check (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrence_exceptions.event_id
      and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)
  )
);

drop policy if exists "event_occurrence_exceptions_delete_event_manager" on public.event_occurrence_exceptions;
create policy "event_occurrence_exceptions_delete_event_manager"
on public.event_occurrence_exceptions for delete
using (
  exists (
    select 1
    from public.events event
    where event.id = event_occurrence_exceptions.event_id
      and public.can_manage_event(event.space_id, event.scope, event.owner_user_id)
  )
);

grant select, insert, update, delete on public.event_occurrence_exceptions to authenticated;

commit;
