-- v0.1.13 Slice 1A: bounded Space lifecycle and membership safety.
-- Apply only after a fresh read-only Production preflight and review.
begin;

do $$
begin
  if to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.events') is null
    or to_regclass('public.tasks') is null
    or to_regclass('public.reminder_deliveries') is null
    or to_regprocedure('public.claim_reminder_delivery(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)') is null
    or to_regprocedure('public.claim_recurring_reminder_delivery(uuid,uuid,date,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,timestamp with time zone,text,timestamp with time zone)') is null
    or to_regprocedure('public.leave_shared_space(uuid)') is not null then
    raise exception 'Unexpected lifecycle baseline; stop before applying';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.space_members'::regclass and conname='space_members_user_id_fkey' and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE')
    or not exists (select 1 from pg_constraint where conrelid='public.space_members'::regclass and conname='space_members_user_profile_fkey' and pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE') then
    raise exception 'Membership FK baseline differs; stop before applying';
  end if;
  if exists (
    select 1 from public.spaces s left join public.space_members m on m.space_id=s.id
    group by s.id,s.kind,s.created_by
    having (s.kind='shared' and (count(*) filter(where m.role='owner')<>1 or count(m.user_id)>2))
      or (s.kind='personal' and (count(m.user_id)<>1 or count(*) filter(where m.role='owner' and m.user_id=s.created_by)<>1))
  ) then
    raise exception 'Existing Space owner or capacity anomaly; stop before applying';
  end if;
  if exists (
    select 1 from public.events e join public.events r on r.id=e.series_id or r.id=e.parent_event_id
    where e.id<>r.id and (e.space_id is distinct from r.space_id or e.scope is distinct from r.scope or e.owner_user_id is distinct from r.owner_user_id)
  ) then
    raise exception 'Existing Event reference crosses Space, scope, or owner; stop before applying';
  end if;
end;
$$;

-- One owner at most is immediate; existence is checked at transaction end so
-- transfer may demote the old owner before promoting the new one atomically.
create unique index space_members_one_owner_idx
  on public.space_members (space_id) where role='owner';

create function public.guard_personal_space_delete()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if old.kind='personal' then
    raise exception 'Personal Space cannot be deleted';
  end if;
  return old;
end;
$$;
create trigger spaces_guard_personal_delete before delete on public.spaces
for each row execute function public.guard_personal_space_delete();

-- A parent row lock also serializes privileged writes and Auth/profile FK
-- cascades, which do not enter the lifecycle RPC advisory lock themselves.
create function public.lock_space_membership_change()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_space_id uuid;
  target_kind text;
begin
  if tg_op='UPDATE' and (new.space_id is distinct from old.space_id or new.user_id is distinct from old.user_id) then
    raise exception 'Membership identity is immutable';
  end if;
  target_space_id := case when tg_op='DELETE' then old.space_id else new.space_id end;
  select kind into target_kind from public.spaces where id=target_space_id for update;
  if target_kind='shared' and tg_op='INSERT'
    and (select count(*) from public.space_members where space_id=target_space_id)>=2 then
    raise exception 'Shared Space is already full';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger space_members_lock_change before insert or update or delete on public.space_members
for each row execute function public.lock_space_membership_change();

create function public.check_shared_space_final_state()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_space_id uuid;
  member_count bigint;
  owner_count bigint;
begin
  if tg_table_name='spaces' then
    target_space_id := new.id;
  elsif tg_op='DELETE' then
    target_space_id := old.space_id;
  else
    target_space_id := new.space_id;
  end if;
  if exists (select 1 from public.spaces where id=target_space_id and kind='shared') then
    select count(*),count(*) filter(where role='owner') into member_count,owner_count
    from public.space_members where space_id=target_space_id;
    if owner_count<>1 or member_count>2 then
      raise exception 'Live Shared Space requires exactly one owner and at most two members';
    end if;
  end if;
  return null;
end;
$$;
create constraint trigger spaces_shared_final_state after insert on public.spaces
deferrable initially deferred for each row execute function public.check_shared_space_final_state();
create constraint trigger space_members_shared_final_state after insert or update or delete on public.space_members
deferrable initially deferred for each row execute function public.check_shared_space_final_state();

-- Called only by the four owner/member lifecycle RPCs. A null owner selects
-- every Event in the Space for hard delete. Ledger rows are never selected.
create function public.delete_lifecycle_event_set(p_space_id uuid,p_owner_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  remaining_count bigint;
  deleted_count bigint;
begin
  if exists (
    with target as (
      select id from public.events
      where space_id=p_space_id and (p_owner_user_id is null or (scope='personal' and owner_user_id=p_owner_user_id))
    ), edges as (
      select child.id child_id,parent.id parent_id,
        child.space_id child_space,parent.space_id parent_space,
        child.scope child_scope,parent.scope parent_scope,
        child.owner_user_id child_owner,parent.owner_user_id parent_owner
      from public.events child join public.events parent
        on parent.id=child.series_id or parent.id=child.parent_event_id
      where child.id<>parent.id
    )
    select 1 from edges e
    where (e.child_id in (select id from target) or e.parent_id in (select id from target))
      and (e.child_id not in (select id from target) or e.parent_id not in (select id from target)
        or e.child_space is distinct from e.parent_space
        or e.child_scope is distinct from e.parent_scope
        or e.child_owner is distinct from e.parent_owner)
  ) or exists (
    select 1 from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id))
      and (e.parent_event_id=e.id or (e.series_id=e.id and e.recurrence_rule is null))
  ) then
    raise exception 'Event deletion set has an external or invalid reference';
  end if;

  loop
    select count(*) into remaining_count from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id));
    exit when remaining_count=0;

    delete from public.events e
    where e.space_id=p_space_id
      and (p_owner_user_id is null or (e.scope='personal' and e.owner_user_id=p_owner_user_id))
      and not exists (
        select 1 from public.events child
        where child.id<>e.id and (child.series_id=e.id or child.parent_event_id=e.id)
      );
    get diagnostics deleted_count=row_count;
    if deleted_count=0 then
      raise exception 'Event reference cycle prevents bounded deletion';
    end if;
  end loop;
end;
$$;
revoke all on function public.delete_lifecycle_event_set(uuid,uuid) from public,anon,authenticated,service_role;

create function public.leave_shared_space(p_space_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
  actor_role text;
begin
  if actor is null or p_space_id is null then raise exception 'Signed-in actor and Space are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  select role into actor_role from public.space_members where space_id=p_space_id and user_id=actor;
  if actor_role is distinct from 'member' then raise exception 'Only an ordinary member may leave'; end if;
  perform public.delete_lifecycle_event_set(p_space_id,actor);
  delete from public.space_members where space_id=p_space_id and user_id=actor;
  update public.spaces set invite_code=public.generate_invite_code() where id=p_space_id;
end;
$$;

create function public.remove_space_member(p_space_id uuid,p_member_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null or p_member_user_id is null then raise exception 'Actor, Space, and member are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may remove a member';
  end if;
  if p_member_user_id=actor or not exists (select 1 from public.space_members where space_id=p_space_id and user_id=p_member_user_id and role='member') then
    raise exception 'Target must be another ordinary member';
  end if;
  perform public.delete_lifecycle_event_set(p_space_id,p_member_user_id);
  delete from public.space_members where space_id=p_space_id and user_id=p_member_user_id;
  update public.spaces set invite_code=public.generate_invite_code() where id=p_space_id;
end;
$$;

create function public.transfer_space_ownership(p_space_id uuid,p_new_owner_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null or p_new_owner_user_id is null then raise exception 'Actor, Space, and new owner are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may transfer ownership';
  end if;
  if p_new_owner_user_id=actor or not exists (select 1 from public.space_members where space_id=p_space_id and user_id=p_new_owner_user_id and role='member') then
    raise exception 'New owner must be the other current member';
  end if;
  update public.space_members set role='member' where space_id=p_space_id and user_id=actor;
  update public.space_members set role='owner' where space_id=p_space_id and user_id=p_new_owner_user_id;
end;
$$;

create function public.delete_shared_space(p_space_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  actor uuid := auth.uid();
  space_kind text;
begin
  if actor is null or p_space_id is null then raise exception 'Signed-in actor and Space are required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_space_id::text));
  select kind into space_kind from public.spaces where id=p_space_id for update;
  if space_kind is distinct from 'shared' then raise exception 'Shared Space not found'; end if;
  if not exists (select 1 from public.space_members where space_id=p_space_id and user_id=actor and role='owner') then
    raise exception 'Only the current owner may delete a Shared Space';
  end if;
  perform public.delete_lifecycle_event_set(p_space_id,null);
  delete from public.spaces where id=p_space_id;
end;
$$;

revoke all on function public.leave_shared_space(uuid) from public,anon,service_role;
revoke all on function public.remove_space_member(uuid,uuid) from public,anon,service_role;
revoke all on function public.transfer_space_ownership(uuid,uuid) from public,anon,service_role;
revoke all on function public.delete_shared_space(uuid) from public,anon,service_role;
grant execute on function public.leave_shared_space(uuid) to authenticated;
grant execute on function public.remove_space_member(uuid,uuid) to authenticated;
grant execute on function public.transfer_space_ownership(uuid,uuid) to authenticated;
grant execute on function public.delete_shared_space(uuid) to authenticated;

-- Every personal Event write locks the same Space before the existing owner
-- validator runs. This closes the insert/update versus member-exit gap.
create function public.lock_personal_event_membership()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare
  target_kind text;
  target_creator uuid;
begin
  if new.scope='personal' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.space_id::text));
    select kind,created_by into target_kind,target_creator
    from public.spaces where id=new.space_id for update;
    if not found then
      raise exception 'Personal Event owner must remain a Space member';
    end if;
    if target_kind='personal' and new.owner_user_id is distinct from target_creator then
      raise exception 'Personal Space events must belong to the Space owner';
    end if;
    if not exists (
      select 1 from public.space_members
      where space_id=new.space_id and user_id=new.owner_user_id
    ) then
      raise exception 'Personal Event owner must remain a Space member';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_lock_personal_membership before insert or update on public.events
for each row execute function public.lock_personal_event_membership();

-- Keep existing claim predicates and recipient semantics unchanged.
create or replace function public.claim_reminder_delivery(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_subscription_id uuid,
  p_due_at timestamptz,
  p_expected_reminder_schedule_changed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  claim_now timestamptz := pg_catalog.clock_timestamp();
  claimed_delivery_id uuid;
  source_space_id uuid;
begin
  select space_id into source_space_id from public.events where id=p_event_id;
  if source_space_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  -- This separate statement revalidates Event, member, subscription and markers
  -- against state committed after the Space lock was acquired.
  insert into public.reminder_deliveries (
    event_id,
    recipient_user_id,
    subscription_id,
    due_at,
    status,
    result_code,
    provider_status,
    created_at,
    updated_at
  )
  select
    event.id,
    p_recipient_user_id,
    subscription.id,
    p_due_at,
    'claimed',
    null,
    null,
    claim_now,
    claim_now
  from public.events event
  join public.space_members recipient_membership
    on recipient_membership.space_id = event.space_id
   and recipient_membership.user_id = p_recipient_user_id
  join public.push_subscriptions subscription
    on subscription.id = p_subscription_id
   and subscription.user_id = p_recipient_user_id
  where event.id = p_event_id
    and event.recurrence_rule is null
    and event.reminder_kind is not null
    and event.time_zone is not null
    and event.reminder_schedule_changed_at = p_expected_reminder_schedule_changed_at
    and p_due_at >= event.reminder_schedule_changed_at
    and p_due_at <= claim_now
    and p_due_at >= claim_now - interval '10 minutes'
    and (
      event.scope = 'shared'
      or (
        event.scope = 'personal'
        and event.owner_user_id = p_recipient_user_id
      )
    )
    and subscription.disabled_at is null
    and (
      subscription.expiration_time is null
      or subscription.expiration_time > claim_now
    )
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing
  returning reminder_deliveries.id into claimed_delivery_id;

  return claimed_delivery_id;
end;
$$;

create or replace function public.claim_recurring_reminder_delivery(
  p_source_event_id uuid,
  p_logical_series_id uuid,
  p_occurrence_date date,
  p_recipient_user_id uuid,
  p_subscription_id uuid,
  p_due_at timestamptz,
  p_expected_source_updated_at timestamptz,
  p_expected_reminder_schedule_changed_at timestamptz,
  p_expected_exception_id uuid,
  p_expected_exception_updated_at timestamptz,
  p_expected_exception_type text,
  p_effective_schedule_changed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  claim_now timestamptz := pg_catalog.clock_timestamp();
  claimed_delivery_id uuid;
  source_space_id uuid;
begin
  select space_id into source_space_id from public.events where id=p_source_event_id;
  if source_space_id is null then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(source_space_id::text));
  perform 1 from public.spaces where id=source_space_id for update;
  if not found then return null; end if;
  -- This separate statement revalidates Event, member, subscription and markers
  -- against state committed after the Space lock was acquired.
  insert into public.reminder_deliveries (
    event_id,
    recipient_user_id,
    subscription_id,
    occurrence_date,
    due_at,
    status,
    result_code,
    provider_status,
    created_at,
    updated_at
  )
  select
    p_logical_series_id,
    p_recipient_user_id,
    subscription.id,
    p_occurrence_date,
    p_due_at,
    'claimed',
    null,
    null,
    claim_now,
    claim_now
  from public.events event
  join public.space_members recipient_membership
    on recipient_membership.space_id = event.space_id
   and recipient_membership.user_id = p_recipient_user_id
  join public.push_subscriptions subscription
    on subscription.id = p_subscription_id
   and subscription.user_id = p_recipient_user_id
  where event.id = p_source_event_id
    and event.recurrence_rule is not null
    and event.reminder_kind is not null
    and event.time_zone is not null
    and event.time_zone = event.recurrence_rule ->> 'time_zone'
    and coalesce(event.series_id, event.id) = p_logical_series_id
    and event.updated_at = p_expected_source_updated_at
    and event.reminder_schedule_changed_at = p_expected_reminder_schedule_changed_at
    and p_effective_schedule_changed_at >= event.reminder_schedule_changed_at
    and p_due_at >= p_effective_schedule_changed_at
    and p_due_at <= claim_now
    and p_due_at >= claim_now - interval '10 minutes'
    and (
      (
        p_expected_exception_id is null
        and p_expected_exception_updated_at is null
        and p_expected_exception_type is null
        and not exists (
          select 1
          from public.event_occurrence_exceptions exception
          where exception.event_id = event.id
            and exception.occurrence_date = p_occurrence_date
        )
      )
      or (
        p_expected_exception_id is not null
        and p_expected_exception_updated_at is not null
        and p_expected_exception_type = 'override'
        and exists (
          select 1
          from public.event_occurrence_exceptions exception
          where exception.id = p_expected_exception_id
            and exception.event_id = event.id
            and exception.occurrence_date = p_occurrence_date
            and exception.updated_at = p_expected_exception_updated_at
            and exception.exception_type = p_expected_exception_type
        )
      )
    )
    and (
      event.scope = 'shared'
      or (
        event.scope = 'personal'
        and event.owner_user_id = p_recipient_user_id
      )
    )
    and subscription.disabled_at is null
    and (
      subscription.expiration_time is null
      or subscription.expiration_time > claim_now
    )
  on conflict on constraint reminder_deliveries_occurrence_identity_key do nothing
  returning reminder_deliveries.id into claimed_delivery_id;

  return claimed_delivery_id;
end;
$$;

-- Existing public-table default ACLs include TRUNCATE. These six tables form
-- the Space/member and retained Event/Task/exception lifecycle boundary.
-- Leave all other table privileges and unrelated tables unchanged.
revoke truncate on table
  public.profiles,
  public.spaces,
  public.space_members,
  public.events,
  public.event_occurrence_exceptions,
  public.tasks
from anon,authenticated,service_role;

do $$
begin
  if exists (
    select 1 from (values
      ('public.profiles'),('public.spaces'),('public.space_members'),
      ('public.events'),('public.event_occurrence_exceptions'),('public.tasks')
    ) as protected(table_name)
    cross join (values ('anon'),('authenticated'),('service_role')) as app(role_name)
    where has_table_privilege(app.role_name,protected.table_name,'TRUNCATE')
  ) then
    raise exception 'Application role retains lifecycle TRUNCATE privilege';
  end if;
end;
$$;

commit;
