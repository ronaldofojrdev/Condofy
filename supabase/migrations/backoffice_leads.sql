-- Fase 3: Módulo Comercial
-- Execute no SQL Editor do Supabase

BEGIN;

-- Enum de status do pipeline
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_status_enum') THEN
    CREATE TYPE public.pipeline_status_enum AS ENUM (
      'LEAD',
      'DEMO',
      'PROPOSTA',
      'FECHADO',
      'PERDIDO'
    );
  END IF;
END
$$;

-- Enum de origem do lead
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_origem_enum') THEN
    CREATE TYPE public.lead_origem_enum AS ENUM (
      'INDICACAO',
      'SITE',
      'WHATSAPP',
      'COLD_OUTREACH',
      'EVENTO',
      'OUTRO'
    );
  END IF;
END
$$;

-- Enum de tipo de interação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interacao_tipo_enum') THEN
    CREATE TYPE public.interacao_tipo_enum AS ENUM (
      'LIGACAO',
      'WHATSAPP',
      'REUNIAO',
      'EMAIL',
      'OUTRO'
    );
  END IF;
END
$$;

-- Tabela de leads
CREATE TABLE IF NOT EXISTS public.backoffice_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  cidade            text NOT NULL,
  estado            text,
  total_unidades    integer,
  origem            public.lead_origem_enum NOT NULL DEFAULT 'OUTRO',
  status_pipeline   public.pipeline_status_enum NOT NULL DEFAULT 'LEAD',
  plano_esperado    text,
  valor_proposta    numeric(10, 2),
  follow_up_em      timestamptz,
  motivo_perda      text,
  responsavel_id    uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  criado_por_id     uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON public.backoffice_leads (status_pipeline);
CREATE INDEX IF NOT EXISTS leads_responsavel_idx ON public.backoffice_leads (responsavel_id);
CREATE INDEX IF NOT EXISTS leads_follow_up_idx ON public.backoffice_leads (follow_up_em);

-- Tabela de interações
CREATE TABLE IF NOT EXISTS public.backoffice_interacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.backoffice_leads(id) ON DELETE CASCADE,
  tipo            public.interacao_tipo_enum NOT NULL,
  descricao       text NOT NULL,
  colaborador_id  uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interacoes_lead_idx ON public.backoffice_interacoes (lead_id);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_leads_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_atualizado_em_trigger ON public.backoffice_leads;
CREATE TRIGGER leads_atualizado_em_trigger
  BEFORE UPDATE ON public.backoffice_leads
  FOR EACH ROW EXECUTE FUNCTION update_leads_atualizado_em();

COMMIT;
