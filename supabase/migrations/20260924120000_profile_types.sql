-- Tipos de perfil de usuário.
--   ADMIN         → Admin master (aprova cadastros e define perfis)
--   MIN_SAUDE     → Ministério da Saúde
--   MIN_EDUCACAO  → Ministério da Educação
--   USER          → cadastro ainda sem perfil definido (pendente ou legado)
-- Todo novo cadastro entra como USER/PENDING; o admin master escolhe o perfil
-- no momento da aprovação através da RPC set_member_access.

begin;

-- Garante que profiles.role seja texto (caso tenha sido criado como enum).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type text using role::text;
  end if;
end;
$$;

update public.profiles
   set role = upper(coalesce(nullif(trim(role), ''), 'USER'));

update public.profiles
   set role = 'USER'
 where role not in ('ADMIN', 'MIN_SAUDE', 'MIN_EDUCACAO', 'USER');

alter table public.profiles alter column role set default 'USER';
alter table public.profiles alter column role set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('ADMIN', 'MIN_SAUDE', 'MIN_EDUCACAO', 'USER'));

comment on column public.profiles.role is
  'Tipo de perfil: ADMIN (admin master), MIN_SAUDE (Ministério da Saúde), MIN_EDUCACAO (Ministério da Educação) ou USER (sem perfil definido).';

-- Perfil do usuário logado (útil para políticas específicas por ministério).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and status = 'APPROVED';
$$;

-- Aprova/recusa um cadastro e/ou define o tipo de perfil.
-- Aprovar exige um perfil de ministério (informado agora ou já atribuído).
create or replace function public.set_member_access(
  target_user_id uuid,
  new_status text default null,
  new_role text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text := nullif(upper(trim(coalesce(new_status, ''))), '');
  normalized_role text := nullif(upper(trim(coalesce(new_role, ''))), '');
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'Only the master administrator can manage access'
      using errcode = '42501';
  end if;

  if normalized_status is null and normalized_role is null then
    raise exception 'Nothing to update'
      using errcode = '22023';
  end if;

  if normalized_status is not null
     and normalized_status not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid registration status'
      using errcode = '22023';
  end if;

  if normalized_role is not null
     and normalized_role not in ('MIN_SAUDE', 'MIN_EDUCACAO') then
    raise exception 'Invalid profile type'
      using errcode = '22023';
  end if;

  select role
    into target_role
    from public.profiles
   where id = target_user_id
   for update;

  if not found or target_role = 'ADMIN' then
    raise exception 'Member profile not found or cannot be changed'
      using errcode = 'P0002';
  end if;

  if normalized_status = 'APPROVED'
     and coalesce(normalized_role, target_role) not in ('MIN_SAUDE', 'MIN_EDUCACAO') then
    raise exception 'A profile type is required to approve a registration'
      using errcode = '22023';
  end if;

  update public.profiles
     set status = coalesce(normalized_status, status),
         role = coalesce(normalized_role, role)
   where id = target_user_id;
end;
$$;

-- Compatibilidade com a RPC anterior (sem perfil).
create or replace function public.set_member_status(
  target_user_id uuid,
  new_status text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.set_member_access(target_user_id, new_status, null);
$$;

-- Novos cadastros sempre entram sem perfil e pendentes; o perfil nunca vem
-- dos metadados enviados pelo cliente.
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

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.set_member_access(uuid, text, text) from public, anon;
revoke all on function public.set_member_status(uuid, text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.set_member_access(uuid, text, text) to authenticated;
grant execute on function public.set_member_status(uuid, text) to authenticated;

commit;
