-- v0.1.18 Slice 2 T2B, apply once after the reviewed T2A capability patch.
-- No sender/UI wiring or Production authorization.
begin;
do $$
begin
  if to_regprocedure('public.list_important_date_reminder_candidates(uuid,integer)') is null
    or to_regprocedure('public.claim_important_date_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz)') is not null
    or not exists(select 1 from pg_constraint where conrelid='public.reminder_deliveries'::regclass
      and conname='reminder_deliveries_source_identity_check')
    or not exists(select 1 from pg_constraint where conrelid='public.reminder_deliveries'::regclass
      and conname='reminder_deliveries_occurrence_identity_key'
      and pg_get_constraintdef(oid)='UNIQUE NULLS NOT DISTINCT (event_id, important_date_id, occurrence_date, subscription_id, due_at)')
    or has_table_privilege('service_role','public.important_dates','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Unexpected v0.1.18 T2A claim baseline';
  end if;
end;
$$;

-- Source-specific shared predicate, private to the two locked RPCs.
-- Validate membership of one civil occurrence, never project dates or convert UTC.
-- Canonical UTC due calculation stays with T1, as with existing Event claims.
create function public.important_date_reminder_is_eligible(
  p_source public.important_dates,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,
  p_due_at timestamptz,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz,p_now timestamptz
)
returns boolean language sql stable set search_path=pg_catalog,pg_temp as $$
  select case when p_occurrence_date is null or not isfinite(p_occurrence_date) or (p_source).id is null then false else
    (p_source).reminder_kind=p_expected_reminder_kind
    and (p_source).reminder_kind in ('all_day_same_day_08','all_day_previous_day_20')
    and (p_source).reminder_schedule_changed_at=p_expected_reminder_schedule_changed_at
    and p_due_at>=(p_source).reminder_schedule_changed_at
    and p_due_at<=p_now and p_due_at>=p_now-interval '10 minutes'
    and extract(year from p_occurrence_date)>0
    and extract(month from p_occurrence_date)=(p_source).month
    and (extract(day from p_occurrence_date)=(p_source).day or (
      (p_source).repeat_kind='annual' and (p_source).month=2 and (p_source).day=29
      and extract(day from p_occurrence_date)=28
      and not (extract(year from p_occurrence_date)%4=0 and (
        extract(year from p_occurrence_date)%100<>0 or extract(year from p_occurrence_date)%400=0))))
    and (((p_source).repeat_kind='none' and (p_source).year=extract(year from p_occurrence_date))
      or ((p_source).repeat_kind='annual' and ((p_source).year is null or (p_source).year<=extract(year from p_occurrence_date))))
    and exists(select 1 from public.spaces s
      join public.space_modules m on m.space_id=s.id and m.module_key='important_dates' and m.enabled
      join public.space_members member on member.space_id=s.id and member.user_id=p_recipient_user_id
      join public.push_subscriptions subscription on subscription.id=p_subscription_id and subscription.user_id=member.user_id
      where s.id=(p_source).space_id and (s.kind='shared' or (s.kind='personal' and s.created_by=p_recipient_user_id))
        and subscription.disabled_at is null and (subscription.expiration_time is null or subscription.expiration_time>p_now))
  end;
$$;

create function public.claim_important_date_reminder_delivery(
  p_important_date_id uuid,p_occurrence_date date,p_recipient_user_id uuid,p_subscription_id uuid,p_due_at timestamptz,
  p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare source_space_id uuid; source public.important_dates; claim_now timestamptz; delivery_id uuid;
begin
  select space_id into source_space_id from public.important_dates where id=p_important_date_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  select * into source from public.important_dates where id=p_important_date_id and space_id=source_space_id for update;
  if not found then return null; end if;
  -- Every possible lock wait has completed before evaluating grace/expiry.
  claim_now:=clock_timestamp();
  if public.important_date_reminder_is_eligible(source,p_occurrence_date,p_recipient_user_id,p_subscription_id,p_due_at,
      p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,claim_now) is not true then return null; end if;
  insert into public.reminder_deliveries(important_date_id,recipient_user_id,subscription_id,occurrence_date,due_at,status,created_at,updated_at)
  values(source.id,p_recipient_user_id,p_subscription_id,p_occurrence_date,p_due_at,'claimed',claim_now,claim_now)
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing returning id into delivery_id;
  return delivery_id;
end;
$$;

create function public.check_important_date_reminder_delivery(
  p_delivery_id uuid,p_expected_reminder_kind text,p_expected_reminder_schedule_changed_at timestamptz
)
returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare delivery public.reminder_deliveries; source_space_id uuid; source public.important_dates; check_now timestamptz;
begin
  select * into delivery from public.reminder_deliveries
  where id=p_delivery_id and status='claimed' and event_id is null and important_date_id is not null;
  if not found then return false; end if;
  select space_id into source_space_id from public.important_dates where id=delivery.important_date_id;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return false; end if;
  select * into source from public.important_dates where id=delivery.important_date_id and space_id=source_space_id for update;
  if not found then return false; end if;
  -- A concurrent finalize can finish while waiting; only a still-claimed row qualifies.
  select * into delivery from public.reminder_deliveries where id=p_delivery_id for update;
  if not found or delivery.status<>'claimed' or delivery.event_id is not null
    or delivery.important_date_id is distinct from source.id then return false; end if;
  check_now:=clock_timestamp();
  return public.important_date_reminder_is_eligible(source,delivery.occurrence_date,delivery.recipient_user_id,delivery.subscription_id,
    delivery.due_at,p_expected_reminder_kind,p_expected_reminder_schedule_changed_at,check_now) is true;
end;
$$;

revoke all on function public.important_date_reminder_is_eligible(public.important_dates,date,uuid,uuid,timestamptz,text,timestamptz,timestamptz),
  public.claim_important_date_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_important_date_reminder_delivery(uuid,text,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.claim_important_date_reminder_delivery(uuid,date,uuid,uuid,timestamptz,text,timestamptz),
  public.check_important_date_reminder_delivery(uuid,text,timestamptz) to service_role;
commit;
