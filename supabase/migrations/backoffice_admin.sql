-- ============================================================
-- Backoffice Condofy — Fase 6: Admin (Feature Flags)
-- ============================================================

-- Feature Flags globais
CREATE TABLE IF NOT EXISTS backoffice_feature_flags (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chave             TEXT        NOT NULL UNIQUE,
  descricao         TEXT,
  ativo             BOOLEAN     NOT NULL DEFAULT false,
  planos            TEXT[]      NOT NULL DEFAULT '{}', -- vazio = todos os planos
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por_id UUID        REFERENCES backoffice_colaboradores(id)
);

ALTER TABLE backoffice_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_dev_read_flags" ON backoffice_feature_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM backoffice_colaboradores
      WHERE usuario_id = auth.uid()
        AND role IN ('ADMIN', 'DEV')
        AND ativo = true
    )
  );

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION set_feature_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON backoffice_feature_flags
  FOR EACH ROW EXECUTE FUNCTION set_feature_flags_updated_at();

-- Seed: flags iniciais
INSERT INTO backoffice_feature_flags (chave, descricao, ativo) VALUES
  ('modulo_veiculos',      'Módulo de controle de veículos',              true),
  ('modulo_visitantes',    'Módulo de controle de visitantes',            true),
  ('modulo_enquetes',      'Módulo de enquetes para moradores',           true),
  ('modulo_documentos',    'Módulo de documentos do condomínio',          true),
  ('modulo_manutencoes',   'Módulo de manutenção preventiva',             true),
  ('relatorios_avancados', 'Relatórios avançados (Excel/PDF)',            true),
  ('notificacoes_push',    'Notificações push mobile',                    false),
  ('pagamentos_online',    'Pagamentos online integrados',                false),
  ('qrcode_acesso',        'Controle de acesso por QR Code',              false),
  ('onboarding_wizard',    'Wizard de onboarding para novos síndicos',    false)
ON CONFLICT (chave) DO NOTHING;
