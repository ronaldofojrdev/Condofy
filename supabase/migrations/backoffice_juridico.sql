-- Fase 5: Módulo Jurídico
-- Execute no SQL Editor do Supabase

BEGIN;

-- Enum tipo de contrato
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contrato_tipo_enum') THEN
    CREATE TYPE public.contrato_tipo_enum AS ENUM (
      'CONTRATO_SERVICO',
      'ADITIVO',
      'DISTRATO',
      'TERMO_USO'
    );
  END IF;
END
$$;

-- Enum status de contrato
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contrato_status_enum') THEN
    CREATE TYPE public.contrato_status_enum AS ENUM (
      'PENDENTE_ASSINATURA',
      'ATIVO',
      'SUSPENSO',
      'ENCERRADO'
    );
  END IF;
END
$$;

-- Enum tipo de solicitação LGPD
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_tipo_enum') THEN
    CREATE TYPE public.lgpd_tipo_enum AS ENUM (
      'ACESSO',
      'RETIFICACAO',
      'EXCLUSAO',
      'PORTABILIDADE',
      'OPOSICAO',
      'OUTRO'
    );
  END IF;
END
$$;

-- Enum status de solicitação LGPD
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lgpd_status_enum') THEN
    CREATE TYPE public.lgpd_status_enum AS ENUM (
      'PENDENTE',
      'EM_ANALISE',
      'CONCLUIDO',
      'REJEITADO'
    );
  END IF;
END
$$;

-- Tabela de contratos
CREATE TABLE IF NOT EXISTS public.backoffice_contratos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid REFERENCES public.backoffice_clientes(id) ON DELETE SET NULL,
  tipo              public.contrato_tipo_enum NOT NULL DEFAULT 'CONTRATO_SERVICO',
  status            public.contrato_status_enum NOT NULL DEFAULT 'PENDENTE_ASSINATURA',
  titulo            text NOT NULL,
  url_arquivo       text,
  data_inicio       date,
  data_vencimento   date,
  notas             text,
  criado_por_id     uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contratos_cliente_idx ON public.backoffice_contratos (cliente_id);
CREATE INDEX IF NOT EXISTS contratos_status_idx ON public.backoffice_contratos (status);
CREATE INDEX IF NOT EXISTS contratos_vencimento_idx ON public.backoffice_contratos (data_vencimento);

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION update_contratos_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contratos_atualizado_em_trigger ON public.backoffice_contratos;
CREATE TRIGGER contratos_atualizado_em_trigger
  BEFORE UPDATE ON public.backoffice_contratos
  FOR EACH ROW EXECUTE FUNCTION update_contratos_atualizado_em();

-- Tabela de solicitações LGPD
CREATE TABLE IF NOT EXISTS public.backoffice_lgpd_solicitacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                public.lgpd_tipo_enum NOT NULL,
  status              public.lgpd_status_enum NOT NULL DEFAULT 'PENDENTE',
  solicitante_nome    text NOT NULL,
  solicitante_email   text NOT NULL,
  condominio_id       uuid REFERENCES public.condominios(id) ON DELETE SET NULL,
  descricao           text,
  prazo_legal         date NOT NULL, -- 15 dias corridos por padrão (LGPD art. 19)
  resolvido_em        timestamptz,
  resolvido_por_id    uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  notas_internas      text,
  criado_em           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lgpd_status_idx ON public.backoffice_lgpd_solicitacoes (status);
CREATE INDEX IF NOT EXISTS lgpd_prazo_idx ON public.backoffice_lgpd_solicitacoes (prazo_legal);
CREATE INDEX IF NOT EXISTS lgpd_condominio_idx ON public.backoffice_lgpd_solicitacoes (condominio_id);

COMMIT;
