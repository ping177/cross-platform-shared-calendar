-- v0.1.9 Slice 2 corrective: status transitions belong to the prior assignee.
-- Shared Tasks remain completable/reopenable by any current Space member under existing RLS.

begin;

do $$
begin
  if to_regclass('public.tasks') is null then
    raise exception 'Required public.tasks foundation is missing';
  end if;

  if to_regprocedure('public.enforce_task_status_owner()') is not null
    or exists (
      select 1 from pg_trigger
      where tgrelid = 'public.tasks'::regclass
        and tgname = 'tasks_enforce_status_owner'
        and not tgisinternal
    ) then
    raise exception 'Task status ownership correction already exists; stop and review';
  end if;
end;
$$;

create function public.enforce_task_status_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status
    and old.assigned_to_user_id is not null
    and old.assigned_to_user_id is distinct from auth.uid() then
    raise exception 'Only the current Task assignee may change status';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_status_owner
before update on public.tasks
for each row execute function public.enforce_task_status_owner();

commit;
