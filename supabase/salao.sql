-- Salões de festa do condomínio
create table if not exists public.saloes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  nome text not null,
  capacidade int not null,
  descricao text null,
  regras text null,
  taxa_reserva numeric(10,2) null, -- null = sem cobrança
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Reservas do salão
create table if not exists public.reservas_salao (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  solicitante_id uuid not null references public.usuarios(id),
  data_reserva date not null,
  horario_inicio time not null,
  horario_fim time not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO')),
  motivo_rejeicao text null,
  criado_em timestamptz not null default now(),
  -- Impede duas reservas aprovadas no mesmo salão/data com horário conflitante
  constraint reserva_unica_aprovada exclude using gist (
    salao_id with =,
    daterange(data_reserva, data_reserva, '[]') with &&,
    tsrange(
      (data_reserva + horario_inicio)::timestamp,
      (data_reserva + horario_fim)::timestamp
    ) with &&
  ) where (status = 'APROVADO')
);

create index if not exists saloes_condominio_id_idx on public.saloes(condominio_id);
create index if not exists reservas_salao_condominio_idx on public.reservas_salao(condominio_id);
create index if not exists reservas_salao_data_idx on public.reservas_salao(data_reserva);

alter table public.saloes enable row level security;
alter table public.reservas_salao enable row level security;

-- Salões: síndico gerencia, todos veem
create policy "sindico_all_saloes" on public.saloes
  for all using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

create policy "todos_select_saloes" on public.saloes
  for select using (public.perfil_ativo(condominio_id));

-- Reservas: síndico vê e aprova tudo, morador vê e cria as suas
create policy "sindico_all_reservas" on public.reservas_salao
  for all using (public.perfil_ativo(condominio_id, 'SINDICO'))
  with check (public.perfil_ativo(condominio_id, 'SINDICO'));

create policy "morador_select_reservas" on public.reservas_salao
  for select using (public.perfil_ativo(condominio_id));

create policy "morador_insert_reservas" on public.reservas_salao
  for insert with check (
    public.perfil_ativo(condominio_id)
    and solicitante_id = auth.uid()
  );

create policy "morador_cancel_reservas" on public.reservas_salao
  for update using (
    solicitante_id = auth.uid()
    and status = 'PENDENTE'
  )
  with check (status = 'CANCELADO');
