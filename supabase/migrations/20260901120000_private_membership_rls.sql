-- Private CCE membership authorization model.
-- Approved members can manage operational records; approved admins additionally
-- approve or reject registrations through a narrow RPC.

begin;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'APPROVED'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
      and status = 'APPROVED'
  );
$$;

-- Compatibility wrappers for legacy application/database references.
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_approved_member(); $$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_approved_member(); $$;

create or replace function public.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_approved_member(); $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, phone, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', 'Usuário'),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'USER',
    'PENDING'
  )
  on conflict (id) do update
    set name = excluded.name,
        phone = excluded.phone;

  return new;
end;
$$;

create or replace function public.set_member_status(
  target_user_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only approved administrators can authorize registrations'
      using errcode = '42501';
  end if;

  if upper(new_status) not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid registration status'
      using errcode = '22023';
  end if;

  update public.profiles
     set status = upper(new_status)
   where id = target_user_id
     and role <> 'ADMIN';

  if not found then
    raise exception 'Member profile not found or cannot be changed'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.is_approved_member() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_approved() from public, anon;
revoke all on function public.is_approved_user() from public, anon;
revoke all on function public.is_authorized() from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_member_status(uuid, text) from public, anon;

grant execute on function public.is_approved_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_approved_user() to authenticated;
grant execute on function public.is_authorized() to authenticated;
grant execute on function public.set_member_status(uuid, text) to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles',
        'doctors',
        'tutores',
        'supervisores',
        'referencias_regionalizadas',
        'materiais',
        'processos_administrativos'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy profiles_self_select
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_admin_select
on public.profiles
for select
to authenticated
using (public.is_admin());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'doctors',
    'tutores',
    'supervisores',
    'referencias_regionalizadas',
    'materiais',
    'processos_administrativos'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_approved_member())',
      table_name || '_approved_members_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_approved_member())',
      table_name || '_approved_members_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_approved_member()) with check (public.is_approved_member())',
      table_name || '_approved_members_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_approved_member())',
      table_name || '_approved_members_delete',
      table_name
    );
  end loop;
end;
$$;

commit;
