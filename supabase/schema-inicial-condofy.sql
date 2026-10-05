-- Condofy - Schema inicial para Supabase
-- Execute este arquivo no SQL Editor do Supabase.

begin;

create extension if not exists pgcrypto;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_condominio_enum') THEN
    CREATE TYPE public.tipo_condominio_enum AS ENUM ('VERTICAL', 'HORIZONTAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_unidade_enum') THEN
    CREATE TYPE public.tipo_unidade_enum AS ENUM ('APARTAMENTO', 'CASA', 'COMERCIAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_unidade_enum') THEN
    CREATE TYPE public.status_unidade_enum AS ENUM ('OCUPADA', 'VAZIA');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_usuario_enum') THEN
    CREATE TYPE public.role_usuario_enum AS ENUM ('SINDICO', 'MORADOR', 'PORTEIRO');
  END IF;
END
$$;

-- Tabelas
create table if not exists public.condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo public.tipo_condominio_enum not null,
  endereco text not null,
  cidade text not null,
  estado text not null,
  cep text not null,
  total_unidades integer not null check (total_unidades >= 0),
  criado_em timestamptz not null default now(),
  constraint condominios_estado_uf_check check (char_length(estado) = 2),
  constraint condominios_cep_formato_check check (cep ~ '^[0-9]{5}-?[0-9]{3}$')
);

create table if not exists public.blocos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  nome text not null,
  constraint blocos_condominio_fk
    foreign key (condominio_id)
    references public.condominios (id)
    on update cascade
    on delete cascade,
  constraint blocos_nome_por_condominio_uk unique (condominio_id, nome),
  constraint blocos_id_condominio_uk unique (id, condominio_id)
);

create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null,
  bloco_id uuid null,
  numero text not null,
  andar integer null,
  tipo public.tipo_unidade_enum not null,
  status public.status_unidade_enum not null,
  constraint unidades_condominio_fk
    foreign key (condominio_id)
    references public.condominios (id)
    on update cascade
    on delete cascade,
  constraint unidades_bloco_fk
    foreign key (bloco_id)
    references public.blocos (id)
    on update cascade
    on delete set null,
  constraint unidades_andar_check check (andar is null or andar >= 0)
);

create unique index if not exists unidades_numero_sem_bloco_uk
  on public.unidades (condominio_id, numero)
  where bloco_id is null;

create unique index if not exists unidades_numero_com_bloco_uk
  on public.unidades (condominio_id, bloco_id, numero)
  where bloco_id is not null;

create table if not exists public.usuarios (
  id uuid primary key,
  nome text not null,
  email text not null,
  telefone text null,
  avatar_url text null,
  criado_em timestamptz not null default now(),
  constraint usuarios_email_uk unique (email),
  constraint usuarios_auth_fk
    foreign key (id)
    references auth.users (id)
    on update cascade
    on delete cascade
);

create table if not exists public.perfis_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  condominio_id uuid not null,
  unidade_id uuid null,
  role public.role_usuario_enum not null,
  ativo boolean not null default true,
  constraint perfis_usuario_usuario_fk
    foreign key (usuario_id)
    references public.usuarios (id)
    on update cascade
    on delete cascade,
  constraint perfis_usuario_condominio_fk
    foreign key (condominio_id)
    references public.condominios (id)
    on update cascade
    on delete cascade,
  constraint perfis_usuario_unidade_fk
    foreign key (unidade_id)
    references public.unidades (id)
    on update cascade
    on delete set null
);

create unique index if not exists perfis_sem_unidade_uk
  on public.perfis_usuario (usuario_id, condominio_id, role)
  where unidade_id is null;

create unique index if not exists perfis_com_unidade_uk
  on public.perfis_usuario (usuario_id, condominio_id, unidade_id, role)
  where unidade_id is not null;

create index if not exists perfis_usuario_usuario_idx on public.perfis_usuario (usuario_id);
create index if not exists perfis_usuario_condominio_idx on public.perfis_usuario (condominio_id);
create index if not exists unidades_condominio_idx on public.unidades (condominio_id);
create index if not exists blocos_condominio_idx on public.blocos (condominio_id);

commit;
