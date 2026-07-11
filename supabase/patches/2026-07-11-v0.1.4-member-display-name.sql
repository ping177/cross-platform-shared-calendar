-- v0.1.4: Member display names.
-- This patch preserves profile rows and existing RLS policies.

begin;

-- Prevent concurrent profile inserts or updates from introducing a legacy
-- email-derived or otherwise invalid value between cleanup and the constraint.
lock table public.profiles in share row exclusive mode;

-- Normalize legacy values before adding the constraint. Empty or whitespace-only
-- names become null; valid names are trimmed; longer legacy names are safely
-- truncated to the supported 20-character maximum.
update public.profiles
set display_name = nullif(
  left(
    regexp_replace(display_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    20
  ),
  ''
)
where display_name is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_display_name_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_format_check
      check (
        display_name is null
        or (
          char_length(display_name) between 1 and 20
          and display_name = regexp_replace(display_name, '^[[:space:]]+|[[:space:]]+$', '', 'g')
        )
      );
  end if;
end;
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

commit;
