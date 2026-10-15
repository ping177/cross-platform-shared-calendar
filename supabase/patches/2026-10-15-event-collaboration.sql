-- Production execution requires a separate user authorization.
-- Baseline: 2204b30. No table data is rewritten by this patch.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.events in share row exclusive mode;
do $$
begin
  if to_regprocedure('public.save_event_edit(uuid,timestamp with time zone,text,uuid,jsonb,text,date)') is not null then
    raise exception 'Event collaboration is already installed; stop instead of replaying';
  end if;
  if not exists (select 1 from pg_class where oid='public.events'::regclass and relrowsecurity)
    or (select count(*) from pg_trigger where tgrelid='public.events'::regclass and not tgisinternal
      and tgname in ('events_validate_owner','events_lock_personal_membership','events_prepare_reminder_schedule','events_touch_updated_at')
      and tgenabled='O')<>4 then
    raise exception 'Required Event RLS/triggers missing or disabled';
  end if;
  if to_regprocedure('public.lock_personal_event_membership()') is null then
    raise exception 'Required Event membership guard missing';
  end if;
  if exists (
    select 1 from public.events c join public.events p on p.id=c.series_id or p.id=c.parent_event_id
    where c.id<>p.id and (c.space_id is distinct from p.space_id or c.scope is distinct from p.scope
      or c.owner_user_id is distinct from p.owner_user_id
      or coalesce(c.series_id,c.id) is distinct from coalesce(p.series_id,p.id))
  ) then raise exception 'Existing Event lineage is inconsistent; inspect before applying'; end if;
end;
$$;
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

notify pgrst, 'reload schema';
commit;
