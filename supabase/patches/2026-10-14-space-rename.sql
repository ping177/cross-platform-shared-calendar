-- Space Rename: name-only Owner validation. No RLS, ACL, lifecycle or data rewrite.
-- Apply only after the separately authorized Production preflight.
begin;

do $$
begin
  if to_regprocedure('public.validate_space_identity()') is null
    or not exists (
      select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid = t.tgfoid
      where t.tgrelid = 'public.spaces'::regclass and t.tgname = 'spaces_validate_identity'
        and not t.tgisinternal and t.tgenabled = 'O'
        and t.tgtype = 19 and t.tgfoid = 'public.validate_space_identity()'::regprocedure
        and not p.prosecdef and p.proconfig = array['search_path=public']
    ) then
    raise exception 'Unexpected Space identity trigger baseline; stop and review';
  end if;
end;
$$;

create or replace function public.validate_space_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'Space kind is immutable';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Space created_by is immutable';
  end if;
  if old.kind = 'personal' and new.invite_code is distinct from old.invite_code then
    raise exception 'Personal Space invite code is immutable';
  end if;
  if new.name is distinct from old.name then
    if auth.uid() is null
      or (old.kind = 'personal' and old.created_by is distinct from auth.uid())
      or not exists (
        select 1 from public.space_members
        where space_id = old.id and user_id = auth.uid() and role = 'owner'
      ) then
      raise exception using errcode = '42501', message = 'Only the Space owner may change its name';
    end if;
    -- Exactly the ECMAScript trim() character set; char_length counts code points.
    new.name := pg_catalog.btrim(new.name,
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if new.name is null or pg_catalog.char_length(new.name) not between 1 and 80 then
      raise exception using errcode = '22023', message = 'Space name must contain 1–80 Unicode characters';
    end if;
  end if;
  return new;
end;
$$;

commit;
