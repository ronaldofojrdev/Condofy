-- ============================================================
-- Backoffice Condofy — Migration inicial
-- Rodar no Supabase SQL Editor (mesmo projeto do app principal)
-- Schema isolado: tabelas com prefixo backoffice_
-- ============================================================

-- Colaboradores internos da equipe Condofy
CREATE TABLE IF NOT EXISTS backoffice_colaboradores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('ADMIN', 'IMPLEMENTACAO', 'COMERCIAL', 'FINANCEIRO', 'JURIDICO', 'DEV')),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: cada colaborador lê apenas seu próprio registro
-- O admin client (service role) tem acesso irrestrito server-side
ALTER TABLE backoffice_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaborador_read_own" ON backoffice_colaboradores
  FOR SELECT USING (auth.uid() = usuario_id);

-- Log de auditoria (ações sensíveis do backoffice)
CREATE TABLE IF NOT EXISTS backoffice_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID REFERENCES backoffice_colaboradores(id) ON DELETE SET NULL,
  acao            TEXT NOT NULL,   -- ex: 'CRIAR_CONDOMINIO', 'IMPERSONAR_USUARIO'
  recurso         TEXT NOT NULL,   -- ex: 'condominio', 'usuario'
  recurso_id      TEXT,            -- UUID do recurso afetado
  detalhes        JSONB,           -- dados extras da ação
  ip              TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE backoffice_audit_log ENABLE ROW LEVEL SECURITY;

-- Somente ADMIN lê o audit log (via service role server-side)
-- RLS não bloqueia service role, então a policy abaixo protege leitura client-side
CREATE POLICY "admin_read_audit" ON backoffice_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM backoffice_colaboradores
      WHERE usuario_id = auth.uid()
        AND role = 'ADMIN'
        AND ativo = true
    )
  );

-- ============================================================
-- Inserir primeiro colaborador ADMIN
-- 1. Crie o usuário em Authentication > Users no Supabase
-- 2. Copie o UUID gerado e substitua abaixo
-- ============================================================
-- INSERT INTO backoffice_colaboradores (usuario_id, nome, email, role)
-- VALUES ('<UUID_DO_AUTH_USER>', 'Seu Nome', 'seu@email.com', 'ADMIN');
