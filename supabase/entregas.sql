-- Condofy - Tabela de entregas
-- Execute este arquivo no SQL Editor do Supabase.

begin;

create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  registrado_por uuid not null references public.usuarios(id),
  remetente text null,
  foto_url text null,
  status text not null default 'AGUARDANDO' check (status in ('AGUARDANDO', 'RETIRADO')),
  criado_em timestamptz not null default now(),
  retirado_em timestamptz null
);

create index if not exists entregas_condominio_idx on public.entregas(condominio_id);
create index if not exists entregas_unidade_idx on public.entregas(unidade_id);
create index if not exists entregas_status_idx on public.entregas(status);

alter table public.entregas enable row level security;

drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas for select to authenticated
  using (public.perfil_ativo(condominio_id));

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas for insert to authenticated
  with check (public.perfil_ativo(condominio_id, 'PORTEIRO') or public.perfil_ativo(condominio_id, 'SINDICO'));

drop policy if exists entregas_update on public.entregas;
create policy entregas_update on public.entregas for update to authenticated
  using (public.perfil_ativo(condominio_id))
  with check (public.perfil_ativo(condominio_id));

commit;