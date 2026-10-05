-- Migration: add onboarding_completo and cnpj to condominios
-- onboarding_completo defaults to true so existing condominios are not affected.
-- The wizard explicitly sets it to false on creation and true on completion.

ALTER TABLE condominios
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT true;

ALTER TABLE condominios
  ADD COLUMN IF NOT EXISTS cnpj text;
