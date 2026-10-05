-- v0.1.19 additive Task reminders. Apply once after v0.1.18; separate rollout authorization required.
begin;
do $$
begin
  if to_regprocedure('public.check_important_date_reminder_delivery(uuid,text,timestamptz)') is null
    or to_regprocedure('public.claim_task_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz)') is not null
    or exists(select 1 from pg_attribute where attrelid='public.tasks'::regclass and attname in ('reminder_kind','time_zone','reminder_schedule_changed_at') and not attisdropped)
    or exists(select 1 from pg_attribute where attrelid='public.reminder_deliveries'::regclass and attname='task_id' and not attisdropped)
    or not exists(select 1 from pg_constraint where conrelid='public.reminder_deliveries'::regclass and conname='reminder_deliveries_source_identity_check')
    or not exists(select 1 from pg_constraint where conrelid='public.reminder_deliveries'::regclass
      and conname='reminder_deliveries_occurrence_identity_key'
      and pg_get_constraintdef(oid)='UNIQUE NULLS NOT DISTINCT (event_id, important_date_id, occurrence_date, subscription_id, due_at)')
    or position('p_module_key in (''review'', ''important_dates'')' in pg_get_functiondef('public.set_space_module_enabled(uuid,text,boolean)'::regprocedure))=0 then
    raise exception 'Unexpected v0.1.18 Task reminder baseline';
  end if;
end;
$$;
alter table public.tasks add column reminder_kind text default null,
  add column time_zone text,
  add column reminder_schedule_changed_at timestamptz not null default clock_timestamp();
alter table public.tasks alter column reminder_schedule_changed_at drop default,
  add constraint tasks_reminder_kind_check check (reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')),
  add constraint tasks_reminder_requires_due_zone_check check (reminder_kind is null or (due_on is not null and isfinite(due_on) and time_zone is not null));
alter table public.reminder_deliveries add column task_id uuid,
  drop constraint reminder_deliveries_occurrence_identity_key,
  drop constraint reminder_deliveries_source_identity_check,
  add constraint reminder_deliveries_occurrence_identity_key unique nulls not distinct(event_id,important_date_id,task_id,occurrence_date,subscription_id,due_at),
  add constraint reminder_deliveries_source_identity_check check (num_nonnulls(event_id,important_date_id,task_id)=1),
  add constraint reminder_deliveries_task_occurrence_check check (task_id is null or occurrence_date is not null);
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
commit;
