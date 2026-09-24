-- Acesso a processos administrativos por tipo de perfil.
--   ADMIN e MIN_SAUDE → acesso completo aos processos
--   MIN_EDUCACAO e contas sem perfil definido → sem acesso

begin;

create or replace function public.can_access_processos()
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
      and role in ('ADMIN', 'MIN_SAUDE')
  );
$$;

revoke all on function public.can_access_processos() from public, anon;
grant execute on function public.can_access_processos() to authenticated;

drop policy if exists processos_administrativos_approved_members_select on public.processos_administrativos;
drop policy if exists processos_administrativos_approved_members_insert on public.processos_administrativos;
drop policy if exists processos_administrativos_approved_members_update on public.processos_administrativos;
drop policy if exists processos_administrativos_approved_members_delete on public.processos_administrativos;

create policy processos_administrativos_profile_select
on public.processos_administrativos
for select
to authenticated
using (public.can_access_processos());

create policy processos_administrativos_profile_insert
on public.processos_administrativos
for insert
to authenticated
with check (public.can_access_processos());

create policy processos_administrativos_profile_update
on public.processos_administrativos
for update
to authenticated
using (public.can_access_processos())
with check (public.can_access_processos());

create policy processos_administrativos_profile_delete
on public.processos_administrativos
for delete
to authenticated
using (public.can_access_processos());

commit;
