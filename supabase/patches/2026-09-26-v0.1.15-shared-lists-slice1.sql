-- v0.1.15 Slice 1: Shared Lists DB foundation. Apply once after read-only preflight.
-- Existing installations must apply this patch, never replay schema.sql.
begin;

do $$
begin
  if current_setting('server_version_num')::integer < 150000
    or to_regclass('public.spaces') is null
    or to_regclass('public.space_members') is null
    or to_regclass('public.space_modules') is null
    or to_regprocedure('public.touch_updated_at()') is null
    or to_regprocedure('public.is_space_member(uuid)') is null
    or to_regprocedure('public.is_space_module_enabled(uuid,text)') is null
    or to_regprocedure('public.set_space_module_enabled(uuid,text,boolean)') is null
    or to_regclass('public.lists') is not null
    or to_regclass('public.list_sections') is not null
    or to_regclass('public.list_items') is not null
    or to_regprocedure('public.lock_writable_list(uuid)') is not null
    or not exists (select 1 from pg_publication where pubname='supabase_realtime')
    or not exists (
      select 1 from pg_constraint
      where conrelid='public.space_modules'::regclass
        and contype='c' and pg_get_constraintdef(oid) like '%lists%'
    )
    or exists (select 1 from public.space_modules where module_key='lists') then
    raise exception 'Unexpected v0.1.15 Shared Lists foundation precondition';
  end if;
end;
$$;

-- v0.1.15 Shared Lists canonical foundation.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_id_space_key unique (id,space_id),
  constraint lists_name_format_check check (
    char_length(name) between 1 and 200
    and name = regexp_replace(name,'^[[:space:]]+|[[:space:]]+$','','g')
    and name !~ '[[:cntrl:]]'
    and position(chr(133) in name)=0
    and position(chr(8232) in name)=0
    and position(chr(8233) in name)=0
  )
);

create table public.list_sections (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  name text not null,
  sort_order bigint not null check (sort_order > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_sections_id_list_key unique (id,list_id),
  constraint list_sections_list_sort_key unique (list_id,sort_order) deferrable initially immediate,
  constraint list_sections_name_format_check check (
    char_length(name) between 1 and 200
    and name = regexp_replace(name,'^[[:space:]]+|[[:space:]]+$','','g')
    and name !~ '[[:cntrl:]]'
    and position(chr(133) in name)=0
    and position(chr(8232) in name)=0
    and position(chr(8233) in name)=0
  )
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  space_id uuid not null,
  section_id uuid,
  content text not null,
  completed boolean not null default false,
  sort_order bigint not null check (sort_order > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint list_items_list_space_fkey foreign key (list_id,space_id)
    references public.lists(id,space_id) on delete cascade,
  constraint list_items_section_list_fkey foreign key (section_id,list_id)
    references public.list_sections(id,list_id) on delete cascade,
  constraint list_items_region_sort_key unique nulls not distinct
    (list_id,section_id,sort_order) deferrable initially immediate,
  constraint list_items_content_format_check check (
    char_length(content) between 1 and 200
    and content = regexp_replace(content,'^[[:space:]]+|[[:space:]]+$','','g')
    and content !~ '[[:cntrl:]]'
    and position(chr(133) in content)=0
    and position(chr(8232) in content)=0
    and position(chr(8233) in content)=0
  )
);

create index lists_space_created_id_idx on public.lists (space_id,created_at desc,id desc);
create index list_items_space_list_completed_idx on public.list_items (space_id,list_id,completed);
alter table public.lists replica identity full;
alter table public.list_sections replica identity full;
alter table public.list_items replica identity full;

create function public.guard_list_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.space_id is distinct from old.space_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List identity is immutable';
  end if;
  return new;
end;
$$;
create trigger lists_guard_identity before update on public.lists
for each row execute function public.guard_list_identity();
create trigger lists_touch_updated_at before update on public.lists
for each row execute function public.touch_updated_at();

create function public.guard_list_section_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.list_id is distinct from old.list_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List Section identity is immutable';
  end if;
  return new;
end;
$$;
create trigger list_sections_guard_identity before update on public.list_sections
for each row execute function public.guard_list_section_identity();
create trigger list_sections_touch_updated_at before update on public.list_sections
for each row execute function public.touch_updated_at();

create function public.guard_list_item_identity()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if new.id is distinct from old.id
    or new.list_id is distinct from old.list_id
    or new.space_id is distinct from old.space_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'List Item identity is immutable';
  end if;
  return new;
end;
$$;
create trigger list_items_guard_identity before update on public.list_items
for each row execute function public.guard_list_item_identity();
create trigger list_items_touch_updated_at before update on public.list_items
for each row execute function public.touch_updated_at();

alter table public.lists enable row level security;
alter table public.list_sections enable row level security;
alter table public.list_items enable row level security;
create policy lists_select_member on public.lists for select
  using (public.is_space_member(space_id));
create policy lists_insert_enabled_member on public.lists for insert
  with check (public.is_space_member(space_id)
    and public.is_space_module_enabled(space_id,'lists')
    and created_by=auth.uid());
create policy lists_update_enabled_member on public.lists for update
  using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'))
  with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'));
create policy list_sections_select_member on public.list_sections for select
  using (exists (select 1 from public.lists l where l.id=list_id and public.is_space_member(l.space_id)));
create policy list_sections_update_enabled_member on public.list_sections for update
  using (exists (select 1 from public.lists l where l.id=list_id
    and public.is_space_member(l.space_id) and public.is_space_module_enabled(l.space_id,'lists')))
  with check (exists (select 1 from public.lists l where l.id=list_id
    and public.is_space_member(l.space_id) and public.is_space_module_enabled(l.space_id,'lists')));
create policy list_items_select_member on public.list_items for select
  using (public.is_space_member(space_id));
create policy list_items_update_enabled_member on public.list_items for update
  using (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'))
  with check (public.is_space_member(space_id) and public.is_space_module_enabled(space_id,'lists'));

revoke all on table public.lists,public.list_sections,public.list_items
  from public,anon,authenticated,service_role;
grant select on table public.lists,public.list_sections,public.list_items to authenticated;
grant insert (space_id,name) on public.lists to authenticated;
grant update (name) on public.lists to authenticated;
grant update (name) on public.list_sections to authenticated;
grant update (content) on public.list_items to authenticated;

-- Internal authorization and List row lock shared by narrow mutation RPCs.
create function public.lock_writable_list(p_list_id uuid)
returns public.lists language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list public.lists;
begin
  if auth.uid() is null or p_list_id is null then
    raise exception 'Signed-in actor and List are required';
  end if;
  select * into target_list from public.lists where id=p_list_id for update;
  if not found then raise exception 'List not found'; end if;
  if not public.is_space_member(target_list.space_id) then
    raise exception 'Current List Space membership is required';
  end if;
  if not public.is_space_module_enabled(target_list.space_id,'lists') then
    raise exception 'Lists module is disabled';
  end if;
  return target_list;
end;
$$;
revoke all on function public.lock_writable_list(uuid)
  from public,anon,authenticated,service_role;

create function public.create_list_section(p_list_id uuid,p_name text)
returns public.list_sections language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare created_section public.list_sections;
begin
  perform public.lock_writable_list(p_list_id);
  insert into public.list_sections(list_id,name,sort_order)
  values (p_list_id,p_name,coalesce((select max(sort_order)+1
    from public.list_sections where list_id=p_list_id),1))
  returning * into created_section;
  return created_section;
end;
$$;

create function public.create_list_item(p_list_id uuid,p_section_id uuid,p_content text)
returns public.list_items language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list public.lists;
  created_item public.list_items;
begin
  target_list := public.lock_writable_list(p_list_id);
  if p_section_id is not null and not exists (
    select 1 from public.list_sections where id=p_section_id and list_id=p_list_id
  ) then raise exception 'Section not found in List'; end if;
  insert into public.list_items(list_id,space_id,section_id,content,sort_order)
  values (p_list_id,target_list.space_id,p_section_id,p_content,
    coalesce((select max(sort_order)+1 from public.list_items
      where list_id=p_list_id and section_id is not distinct from p_section_id),1))
  returning * into created_item;
  return created_item;
end;
$$;

create function public.delete_list(p_list_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
  perform public.lock_writable_list(p_list_id);
  delete from public.lists where id=p_list_id;
end;
$$;

create function public.delete_list_section(p_list_id uuid,p_section_id uuid,p_preserve_items boolean)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare ungrouped_end bigint;
begin
  if p_preserve_items is null then raise exception 'Section delete choice is required'; end if;
  perform public.lock_writable_list(p_list_id);
  perform 1 from public.list_sections where id=p_section_id and list_id=p_list_id for update;
  if not found then raise exception 'Section not found in List'; end if;
  if p_preserve_items then
    select coalesce(max(sort_order),0) into ungrouped_end from public.list_items
    where list_id=p_list_id and section_id is null;
    set constraints public.list_items_region_sort_key deferred;
    with moved as (
      select id,row_number() over(order by sort_order,id) as position
      from public.list_items where list_id=p_list_id and section_id=p_section_id
    )
    update public.list_items i set section_id=null,sort_order=ungrouped_end+m.position
    from moved m where i.id=m.id;
  end if;
  delete from public.list_sections where id=p_section_id and list_id=p_list_id;
  set constraints public.list_sections_list_sort_key deferred;
  with positions as (
    select id,row_number() over(order by sort_order,id) as position
    from public.list_sections where list_id=p_list_id
  )
  update public.list_sections s set sort_order=p.position
  from positions p where s.id=p.id;
end;
$$;

create function public.delete_list_item(p_list_id uuid,p_item_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare target_section_id uuid;
begin
  perform public.lock_writable_list(p_list_id);
  select section_id into target_section_id from public.list_items
  where id=p_item_id and list_id=p_list_id for update;
  if not found then raise exception 'Item not found in List'; end if;
  delete from public.list_items where id=p_item_id;
  set constraints public.list_items_region_sort_key deferred;
  with positions as (
    select id,row_number() over(order by sort_order,id) as position
    from public.list_items
    where list_id=p_list_id and section_id is not distinct from target_section_id
  )
  update public.list_items i set sort_order=p.position
  from positions p where i.id=p.id;
end;
$$;

create function public.reorder_list_sections(p_list_id uuid,p_ordered_ids uuid[])
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  current_ids uuid[];
  submitted_ids uuid[];
begin
  perform public.lock_writable_list(p_list_id);
  if p_ordered_ids is null then raise exception 'Section order is required'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into current_ids
  from public.list_sections where list_id=p_list_id;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into submitted_ids
  from unnest(p_ordered_ids) as requested(id);
  if current_ids is distinct from submitted_ids then
    raise exception 'Stale List Section order; reload';
  end if;
  set constraints public.list_sections_list_sort_key deferred;
  with positions as (
    select id,ordinality::bigint as position
    from unnest(p_ordered_ids) with ordinality as requested(id,ordinality)
  )
  update public.list_sections s set sort_order=p.position
  from positions p where s.id=p.id and s.list_id=p_list_id;
end;
$$;

create function public.reorder_list_items(
  p_list_id uuid,p_section_id uuid,p_completed boolean,p_ordered_ids uuid[]
)
returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  current_ids uuid[];
  submitted_ids uuid[];
begin
  perform public.lock_writable_list(p_list_id);
  if p_completed is null or p_ordered_ids is null then
    raise exception 'Item completion group and order are required';
  end if;
  if p_section_id is not null and not exists (
    select 1 from public.list_sections where id=p_section_id and list_id=p_list_id
  ) then raise exception 'Section not found in List'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into current_ids
  from public.list_items where list_id=p_list_id
    and section_id is not distinct from p_section_id and completed=p_completed;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into submitted_ids
  from unnest(p_ordered_ids) as requested(id);
  if current_ids is distinct from submitted_ids then
    raise exception 'Stale List Item order; reload';
  end if;
  set constraints public.list_items_region_sort_key deferred;
  with slots as (
    select sort_order,row_number() over(order by sort_order,id) as position
    from public.list_items where list_id=p_list_id
      and section_id is not distinct from p_section_id and completed=p_completed
  ), positions as (
    select requested.id,slots.sort_order
    from unnest(p_ordered_ids) with ordinality as requested(id,position)
    join slots on slots.position=requested.position
  )
  update public.list_items i set sort_order=p.sort_order
  from positions p where i.id=p.id and i.list_id=p_list_id;
end;
$$;

create function public.set_list_item_completed(p_item_id uuid,p_completed boolean)
returns public.list_items language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
declare
  target_list_id uuid;
  target_item public.list_items;
begin
  if p_item_id is null or p_completed is null then
    raise exception 'Item and explicit completion value are required';
  end if;
  select list_id into target_list_id from public.list_items where id=p_item_id;
  if not found then raise exception 'Item not found'; end if;
  perform public.lock_writable_list(target_list_id);
  select * into target_item from public.list_items
  where id=p_item_id and list_id=target_list_id for update;
  if not found then raise exception 'Item not found in List'; end if;
  update public.list_items set completed=p_completed
  where id=p_item_id returning * into target_item;
  return target_item;
end;
$$;

revoke all on function public.create_list_section(uuid,text) from public,anon,service_role;
revoke all on function public.create_list_item(uuid,uuid,text) from public,anon,service_role;
revoke all on function public.delete_list(uuid) from public,anon,service_role;
revoke all on function public.delete_list_section(uuid,uuid,boolean) from public,anon,service_role;
revoke all on function public.delete_list_item(uuid,uuid) from public,anon,service_role;
revoke all on function public.reorder_list_sections(uuid,uuid[]) from public,anon,service_role;
revoke all on function public.reorder_list_items(uuid,uuid,boolean,uuid[]) from public,anon,service_role;
revoke all on function public.set_list_item_completed(uuid,boolean) from public,anon,service_role;
grant execute on function public.create_list_section(uuid,text) to authenticated;
grant execute on function public.create_list_item(uuid,uuid,text) to authenticated;
grant execute on function public.delete_list(uuid) to authenticated;
grant execute on function public.delete_list_section(uuid,uuid,boolean) to authenticated;
grant execute on function public.delete_list_item(uuid,uuid) to authenticated;
grant execute on function public.reorder_list_sections(uuid,uuid[]) to authenticated;
grant execute on function public.reorder_list_items(uuid,uuid,boolean,uuid[]) to authenticated;
grant execute on function public.set_list_item_completed(uuid,boolean) to authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array['lists','list_sections','list_items'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=target_table) then
      execute format('alter publication supabase_realtime add table public.%I',target_table);
    end if;
  end loop;
end;
$$;

-- Preserve the Tasks/Review owner-only toggle, and admit Lists without defaults.
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
  if p_module_key is null or p_module_key not in ('tasks', 'review', 'lists') or p_enabled is null then
    raise exception 'Only Tasks, Review, and Lists modules may be toggled in this version';
  end if;
  if p_module_key = 'review' then
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

commit;
