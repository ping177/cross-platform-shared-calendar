-- v0.1.18 Slice 1 Task 2. Apply once to the reviewed baseline, never replay schema.sql.
-- No backfill, module auto-enable, Reminder publication, or Production authorization.
begin;

do $$
begin
  if current_setting('server_version_num')::integer < 150000
    or to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.space_modules') is null
    or to_regclass('public.lists') is null
    or to_regclass('public.review_rounds') is null
    or to_regprocedure('public.touch_updated_at()') is null
    or to_regprocedure('public.is_space_member(uuid)') is null
    or to_regprocedure('public.set_space_module_enabled(uuid,text,boolean)') is null
    or to_regprocedure('public.leave_shared_space(uuid)') is null
    or to_regprocedure('public.remove_space_member(uuid,uuid)') is null
    or to_regprocedure('public.transfer_space_ownership(uuid,uuid)') is null
    or to_regprocedure('public.delete_shared_space(uuid)') is null
    or to_regclass('public.important_dates') is not null
    or to_regprocedure('public.lock_important_date_space(uuid)') is not null
    or to_regprocedure('public.lock_writable_important_date(uuid)') is not null then
    raise exception 'Unexpected v0.1.18 Important Dates foundation precondition';
  end if;
  if not exists (
    select 1 from pg_proc where oid='public.set_space_module_enabled(uuid,text,boolean)'::regprocedure
      and prosecdef and proconfig=array['search_path=pg_catalog, pg_temp']
      and md5(prosrc)='eb83d1e2c407868ddfd7c3f371124695'
  ) or not exists (
    select 1 from pg_constraint where conrelid='public.space_modules'::regclass
      and contype='c' and pg_get_constraintdef(oid) like '%important_dates%'
  ) or exists (select 1 from public.space_modules where module_key='important_dates') then
    raise exception 'Unexpected module contract before v0.1.18 Important Dates';
  end if;
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

-- Narrow extension: Tasks/Lists paths unchanged; Review/Important Dates share Space locks.
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
  if p_module_key in ('review', 'important_dates') then
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
revoke all on function public.set_space_module_enabled(uuid,text,boolean) from public,anon,service_role;
grant execute on function public.set_space_module_enabled(uuid,text,boolean) to authenticated;

commit;
