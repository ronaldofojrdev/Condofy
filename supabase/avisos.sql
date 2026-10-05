create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id),
  titulo text not null,
  conteudo text not null,
  categoria text not null default 'GERAL' check (categoria in ('GERAL', 'MANUTENCAO', 'SEGURANCA', 'FINANCEIRO', 'EVENTO')),
  fixado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists avisos_condominio_id_idx on public.avisos(condominio_id);
create index if not exists avisos_criado_em_idx on public.avisos(criado_em desc);

alter table public.avisos enable row level security;

-- Síndico pode tudo
create policy "sindico_all_avisos" on public.avisos
  for all using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

-- Morador e porteiro só leem
create policy "morador_select_avisos" on public.avisos
  for select using (public.perfil_ativo(condominio_id));
