-- Condofy - RLS policies (idempotente)
-- Execute este arquivo no SQL Editor do Supabase.

begin;

-- Helper reutilizavel para verificar perfil ativo no condominio.
create or replace function public.perfil_ativo(
  p_condominio_id uuid,
  p_role public.role_usuario_enum default null
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis_usuario
    where usuario_id = auth.uid()
      and condominio_id = p_condominio_id
      and ativo = true
      and (p_role is null or role = p_role)
  )
$$;

-- Habilitar RLS
alter table public.condominios enable row level security;
alter table public.blocos enable row level security;
alter table public.unidades enable row level security;
alter table public.usuarios enable row level security;
alter table public.perfis_usuario enable row level security;

-- ==========================================
-- Tabela: condominios
-- ==========================================
drop policy if exists condominios_select on public.condominios;
create policy condominios_select
  on public.condominios
  for select
  to authenticated
  using (public.perfil_ativo(id));

drop policy if exists condominios_update on public.condominios;
create policy condominios_update
  on public.condominios
  for update
  to authenticated
  using (public.perfil_ativo(id, 'SINDICO'))
  with check (public.perfil_ativo(id, 'SINDICO'));

-- ==========================================
-- Tabela: blocos
-- ==========================================
drop policy if exists blocos_select on public.blocos;
create policy blocos_select
  on public.blocos
  for select
  to authenticated
  using (public.perfil_ativo(condominio_id));

drop policy if exists blocos_insert on public.blocos;
create policy blocos_insert
  on public.blocos
  for insert
  to authenticated
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

drop policy if exists blocos_update on public.blocos;
create policy blocos_update
  on public.blocos
  for update
  to authenticated
  using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

drop policy if exists blocos_delete on public.blocos;
create policy blocos_delete
  on public.blocos
  for delete
  to authenticated
  using (public.perfil_ativo(condominio_id, 'SINDICO'));

-- ==========================================
-- Tabela: unidades
-- ==========================================
drop policy if exists unidades_select on public.unidades;
create policy unidades_select
  on public.unidades
  for select
  to authenticated
  using (public.perfil_ativo(condominio_id));

drop policy if exists unidades_insert on public.unidades;
create policy unidades_insert
  on public.unidades
  for insert
  to authenticated
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

drop policy if exists unidades_update on public.unidades;
create policy unidades_update
  on public.unidades
  for update
  to authenticated
  using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

drop policy if exists unidades_delete on public.unidades;
create policy unidades_delete
  on public.unidades
  for delete
  to authenticated
  using (public.perfil_ativo(condominio_id, 'SINDICO'));

-- ==========================================
-- Tabela: usuarios
-- ==========================================
drop policy if exists usuarios_select_self on public.usuarios;
create policy usuarios_select_self
  on public.usuarios
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.perfis_usuario leitor
      join public.perfis_usuario alvo
        on alvo.condominio_id = leitor.condominio_id
      where leitor.usuario_id = auth.uid()
        and leitor.ativo = true
        and alvo.usuario_id = usuarios.id
        and alvo.ativo = true
    )
  );

drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self
  on public.usuarios
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ==========================================
-- Tabela: perfis_usuario
-- ==========================================
drop policy if exists perfis_usuario_select_self on public.perfis_usuario;
create policy perfis_usuario_select_self
  on public.perfis_usuario
  for select
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.perfil_ativo(condominio_id, 'SINDICO')
  );

drop policy if exists perfis_usuario_insert_sindico on public.perfis_usuario;
create policy perfis_usuario_insert_sindico
  on public.perfis_usuario
  for insert
  to authenticated
  with check (
    public.perfil_ativo(condominio_id, 'SINDICO')
    or (
      role = 'SINDICO'
      and usuario_id = auth.uid()
      and not exists (
        select 1
        from public.perfis_usuario p2
        where p2.condominio_id = condominio_id
          and p2.role = 'SINDICO'
          and p2.ativo = true
      )
    )
  );

drop policy if exists perfis_usuario_update_sindico on public.perfis_usuario;
create policy perfis_usuario_update_sindico
  on public.perfis_usuario
  for update
  to authenticated
  using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

commit;
