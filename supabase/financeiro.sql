-- Cobranças por unidade (taxa condominial, multas, extras)
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  descricao text not null,
  tipo text not null default 'TAXA_MENSAL' check (tipo in ('TAXA_MENSAL', 'MULTA', 'EXTRA')),
  valor numeric(10,2) not null,
  vencimento date not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PAGO', 'ATRASADO')),
  pago_em timestamptz null,
  criado_em timestamptz not null default now()
);

create index if not exists cobrancas_condominio_id_idx on public.cobrancas(condominio_id);
create index if not exists cobrancas_unidade_id_idx on public.cobrancas(unidade_id);
create index if not exists cobrancas_vencimento_idx on public.cobrancas(vencimento);
create index if not exists cobrancas_status_idx on public.cobrancas(status);

alter table public.cobrancas enable row level security;

-- Síndico gerencia tudo
create policy "sindico_all_cobrancas" on public.cobrancas
  for all using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

-- Morador vê apenas cobranças da própria unidade
create policy "morador_select_cobrancas" on public.cobrancas
  for select using (
    public.perfil_ativo(condominio_id)
    and unidade_id in (
      select pu.unidade_id from public.perfis_usuario pu
      where pu.usuario_id = auth.uid()
        and pu.condominio_id = cobrancas.condominio_id
        and pu.ativo = true
    )
  );