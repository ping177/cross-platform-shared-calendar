-- v0.1.18 Slice 2 T2A. Apply once after Slice 1 foundation.
-- Local capability only: no Important Date claim, sender, UI or Production authorization.
begin;

do $$
begin
  if current_setting('server_version_num')::integer<150000
    or to_regclass('public.important_dates') is null
    or to_regclass('public.reminder_deliveries') is null
    or to_regprocedure('public.lock_important_date_space(uuid)') is null
    or to_regprocedure('public.lock_writable_important_date(uuid)') is null
    or to_regprocedure('public.claim_reminder_delivery(uuid,uuid,uuid,timestamptz,timestamptz)') is null
    or to_regprocedure('public.list_important_date_reminder_candidates(uuid,integer)') is not null then
    raise exception 'Unexpected v0.1.18 reminder capability precondition';
  end if;
  if exists(select 1 from pg_attribute where attrelid='public.reminder_deliveries'::regclass
      and attname='important_date_id' and not attisdropped)
    or not exists(select 1 from pg_attribute where attrelid='public.reminder_deliveries'::regclass
      and attname='event_id' and atttypid='uuid'::regtype and attnotnull)
    or not exists(select 1 from pg_constraint where conrelid='public.reminder_deliveries'::regclass
      and conname='reminder_deliveries_occurrence_identity_key'
      and pg_get_constraintdef(oid)='UNIQUE NULLS NOT DISTINCT (event_id, occurrence_date, subscription_id, due_at)')
    or has_table_privilege('service_role','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'Unexpected ledger identity or Important Date ACL baseline';
  end if;
  if (select count(*) from pg_proc where oid in (
      'public.lock_important_date_space(uuid)'::regprocedure,
      'public.lock_writable_important_date(uuid)'::regprocedure)
      and prosecdef and proconfig=array['search_path=pg_catalog, pg_temp'])<>2 then
    raise exception 'Unexpected Important Date locked mutation contract';
  end if;
end;
$$;

alter table public.reminder_deliveries
  alter column event_id drop not null,
  add column important_date_id uuid,
  add constraint reminder_deliveries_source_identity_check check (
    (event_id is null) <> (important_date_id is null)
  ),
  add constraint reminder_deliveries_important_date_occurrence_check check (
    important_date_id is null or occurrence_date is not null
  ),
  drop constraint reminder_deliveries_occurrence_identity_key,
  add constraint reminder_deliveries_occurrence_identity_key
    unique nulls not distinct (event_id, important_date_id, occurrence_date, subscription_id, due_at);

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

commit;
