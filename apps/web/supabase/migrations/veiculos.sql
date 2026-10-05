create table if not exists veiculos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  morador_id uuid references usuarios(id) on delete set null,
  placa text not null,
  modelo text not null,
  cor text,
  registrado_por uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  ativo boolean not null default true,
  constraint veiculos_placa_condominio_unique unique (condominio_id, placa)
);
