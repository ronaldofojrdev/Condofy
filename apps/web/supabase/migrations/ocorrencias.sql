-- Livro de Ocorrências
-- Execute no Supabase SQL Editor

create type ocorrencia_tipo as enum ('BARULHO', 'DANO', 'SEGURANCA', 'MANUTENCAO', 'OUTRO');
create type ocorrencia_status as enum ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA');

create table if not exists ocorrencias (
  id            uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  unidade_id    uuid references unidades(id) on delete set null,
  reporter_id   uuid not null references usuarios(id) on delete cascade,
  tipo          ocorrencia_tipo not null default 'OUTRO',
  descricao     text not null,
  status        ocorrencia_status not null default 'ABERTA',
  foto_url      text,
  anonima       boolean not null default false,
  observacao_sindico text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- índices para queries comuns
create index if not exists ocorrencias_condominio_idx on ocorrencias(condominio_id);
create index if not exists ocorrencias_reporter_idx   on ocorrencias(reporter_id);
create index if not exists ocorrencias_status_idx     on ocorrencias(status);

-- RLS
alter table ocorrencias enable row level security;

-- síndico vê todas do seu condomínio
create policy "sindico_select_ocorrencias" on ocorrencias
  for select using (
    exists (
      select 1 from perfis_usuario
      where perfis_usuario.usuario_id = auth.uid()
        and perfis_usuario.condominio_id = ocorrencias.condominio_id
        and perfis_usuario.role = 'SINDICO'
        and perfis_usuario.ativo = true
    )
  );

-- morador vê só as suas
create policy "morador_select_ocorrencias" on ocorrencias
  for select using (
    reporter_id = auth.uid()
  );

-- morador insere (via service role na API)
-- síndico atualiza status (via service role na API)
-- Todas as operações de escrita passam pelo service role (admin client), sem RLS de escrita necessária aqui.
