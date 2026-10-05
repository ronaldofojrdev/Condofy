-- Fase 4: Módulo Financeiro
-- Execute no SQL Editor do Supabase

BEGIN;

-- Enum de status de pagamento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_status_enum') THEN
    CREATE TYPE public.pagamento_status_enum AS ENUM (
      'PENDENTE',
      'PAGO',
      'ATRASADO',
      'CANCELADO'
    );
  END IF;
END
$$;

-- Enum de método de pagamento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_metodo_enum') THEN
    CREATE TYPE public.pagamento_metodo_enum AS ENUM (
      'PIX',
      'BOLETO',
      'CARTAO',
      'TRANSFERENCIA',
      'OUTRO'
    );
  END IF;
END
$$;

-- Tabela de pagamentos mensais por cliente
CREATE TABLE IF NOT EXISTS public.backoffice_pagamentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid NOT NULL REFERENCES public.backoffice_clientes(id) ON DELETE CASCADE,
  competencia       date NOT NULL, -- mês de referência (sempre dia 1)
  valor             numeric(10, 2) NOT NULL CHECK (valor > 0),
  status            public.pagamento_status_enum NOT NULL DEFAULT 'PENDENTE',
  metodo            public.pagamento_metodo_enum,
  pago_em           timestamptz,
  vencimento        date NOT NULL,
  notas             text,
  registrado_por_id uuid REFERENCES public.backoffice_colaboradores(id) ON DELETE SET NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagamentos_cliente_competencia_uk UNIQUE (cliente_id, competencia)
);

CREATE INDEX IF NOT EXISTS pagamentos_cliente_idx ON public.backoffice_pagamentos (cliente_id);
CREATE INDEX IF NOT EXISTS pagamentos_status_idx ON public.backoffice_pagamentos (status);
CREATE INDEX IF NOT EXISTS pagamentos_competencia_idx ON public.backoffice_pagamentos (competencia);
CREATE INDEX IF NOT EXISTS pagamentos_vencimento_idx ON public.backoffice_pagamentos (vencimento);

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION update_pagamentos_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pagamentos_atualizado_em_trigger ON public.backoffice_pagamentos;
CREATE TRIGGER pagamentos_atualizado_em_trigger
  BEFORE UPDATE ON public.backoffice_pagamentos
  FOR EACH ROW EXECUTE FUNCTION update_pagamentos_atualizado_em();

-- Adiciona campo valor_mensal e cancelado_em em backoffice_clientes se não existir
ALTER TABLE public.backoffice_clientes
  ADD COLUMN IF NOT EXISTS valor_mensal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

COMMIT;
