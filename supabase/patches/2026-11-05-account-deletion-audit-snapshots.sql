-- Account Deletion Slice 1: immutable creator UUIDs are historical snapshots.
-- Local only until separately reviewed/authorized. No deletion capability added.
-- Personal/member/Owner guards and all runtime policies/functions remain intact.
begin;

do $preflight$
declare
  matched integer;
  total integer;
begin
  -- Inspect every public FK to Auth/Profile, not only creator references.
  -- Unknown dependencies, replay, changed delete actions or partial state stop.
  with expected(table_name,column_name,target,delete_action,constraint_name) as (values
    ('profiles','id','auth.users','c','profiles_id_fkey'),
    ('spaces','created_by','auth.users','a','spaces_created_by_fkey'),
    ('space_members','user_id','auth.users','c','space_members_user_id_fkey'),
    ('space_members','user_id','public.profiles','c','space_members_user_profile_fkey'),
    ('events','created_by','auth.users','a','events_created_by_fkey'),
    ('events','owner_user_id','auth.users','a','events_owner_user_id_fkey'),
    ('tasks','created_by','public.profiles','c','tasks_created_by_fkey'),
    ('push_subscriptions','user_id','auth.users','c','push_subscriptions_user_id_fkey'),
    ('review_rounds','created_by','auth.users','a','review_rounds_created_by_fkey')
  )
  select count(*) into matched from expected e
  join pg_catalog.pg_constraint c on c.conname=e.constraint_name
    and c.conrelid=to_regclass('public.'||e.table_name) and c.contype='f'
    and c.confrelid=to_regclass(e.target) and c.confdeltype::text=e.delete_action
    and c.confupdtype='a' and c.convalidated and not c.condeferrable
  join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attname=e.column_name
    and c.conkey=array[a.attnum]
  join pg_catalog.pg_attribute referenced on referenced.attrelid=c.confrelid
    and referenced.attname='id' and c.confkey=array[referenced.attnum];

  select count(*) into total from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid=c.conrelid
  join pg_catalog.pg_namespace n on n.oid=t.relnamespace
  where c.contype='f' and n.nspname='public'
    and c.confrelid in (to_regclass('auth.users'),to_regclass('public.profiles'));
  if matched<>9 or total<>9 then
    raise exception 'Audit snapshot FK baseline differs or patch already applied; inspect before proceeding';
  end if;
  if exists (select 1 from pg_catalog.pg_class
    where oid in ('public.spaces'::regclass,'public.events'::regclass,
      'public.tasks'::regclass,'public.review_rounds'::regclass) and not relrowsecurity)
    or (select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgenabled='O'
      and (tgrelid,tgname) in (('public.spaces'::regclass,'spaces_guard_personal_delete'),
        ('public.space_members'::regclass,'space_members_guard_personal'),
        ('public.tasks'::regclass,'tasks_validate_identity'),
        ('public.events'::regclass,'events_validate_owner'),
        ('public.review_rounds'::regclass,'review_rounds_guard_identity')))<>5 then
    raise exception 'Required RLS or lifecycle/identity guard baseline differs';
  end if;
end;
$preflight$;

alter table public.spaces drop constraint spaces_created_by_fkey;
alter table public.events drop constraint events_created_by_fkey;
alter table public.tasks drop constraint tasks_created_by_fkey;
alter table public.review_rounds drop constraint review_rounds_created_by_fkey;

-- Keep owner_user_id and the Auth/Profile/member/subscription FKs. Their live
-- identities must be handled by the later authorized account lifecycle, not by
-- weakening FK actions here. No row values, grants, RPCs or triggers are changed.
commit;
