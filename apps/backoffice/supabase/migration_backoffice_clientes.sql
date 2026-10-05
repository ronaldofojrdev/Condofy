-- ============================================================
-- Backoffice Fase 2 — Tabela de clientes (implementação)
-- ============================================================

CREATE TABLE IF NOT EXISTS backoffice_clientes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id         UUID REFERENCES condominios(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plano                 TEXT NOT NULL DEFAULT 'ESSENCIAL'
                          CHECK (plano IN ('ESSENCIAL', 'CRESCIMENTO', 'PRO')),
  status_implementacao  TEXT NOT NULL DEFAULT 'AGUARDANDO'
                          CHECK (status_implementacao IN ('AGUARDANDO', 'CONFIGURANDO', 'TREINAMENTO', 'ATIVO', 'CANCELADO')),
  responsavel_id        UUID REFERENCES backoffice_colaboradores(id) ON DELETE SET NULL,
  notas                 TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE backoffice_clientes ENABLE ROW LEVEL SECURITY;

-- Colaboradores do backoffice leem via service role (server-side)
-- RLS permite leitura para qualquer colaborador autenticado
CREATE POLICY "colaborador_read_clientes" ON backoffice_clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM backoffice_colaboradores
      WHERE usuario_id = auth.uid() AND ativo = true
    )
  );
