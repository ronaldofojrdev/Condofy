-- Condofy - Notificações in-app
-- Execute este arquivo no SQL Editor do Supabase.

begin;

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('AVISO', 'ENTREGA', 'COBRANCA')),
  titulo text not null,
  mensagem text not null,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_condominio_id_idx on public.notificacoes(condominio_id);
create index if not exists notificacoes_usuario_id_idx on public.notificacoes(usuario_id);
create index if not exists notificacoes_lida_idx on public.notificacoes(lida);
create index if not exists notificacoes_created_at_idx on public.notificacoes(created_at desc);

alter table public.notificacoes enable row level security;

drop policy if exists notificacoes_select_own on public.notificacoes;
create policy notificacoes_select_own
  on public.notificacoes
  for select
  to authenticated
  using (usuario_id = auth.uid());

drop policy if exists notificacoes_update_own on public.notificacoes;
create policy notificacoes_update_own
  on public.notificacoes
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists notificacoes_insert_service_role on public.notificacoes;
create policy notificacoes_insert_service_role
  on public.notificacoes
  for insert
  to service_role
  with check (true);

create or replace function public.criar_notificacoes_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificacoes (condominio_id, usuario_id, tipo, titulo, mensagem)
  select
    new.condominio_id,
    pu.usuario_id,
    'ENTREGA',
    'Nova entrega na portaria',
    case
      when new.remetente is not null and length(trim(new.remetente)) > 0
        then 'Uma entrega de ' || new.remetente || ' foi registrada para sua unidade.'
      else 'Uma nova entrega foi registrada para sua unidade.'
    end
  from public.perfis_usuario pu
  where pu.condominio_id = new.condominio_id
    and pu.unidade_id = new.unidade_id
    and pu.role = 'MORADOR'
    and pu.ativo = true;

  return new;
end;
$$;

drop trigger if exists trg_notificacoes_entrega on public.entregas;
create trigger trg_notificacoes_entrega
after insert on public.entregas
for each row execute function public.criar_notificacoes_entrega();

create or replace function public.criar_notificacoes_aviso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificacoes (condominio_id, usuario_id, tipo, titulo, mensagem)
  select
    new.condominio_id,
    pu.usuario_id,
    'AVISO',
    'Novo aviso publicado',
    new.titulo
  from public.perfis_usuario pu
  where pu.condominio_id = new.condominio_id
    and pu.role = 'MORADOR'
    and pu.ativo = true;

  return new;
end;
$$;

drop trigger if exists trg_notificacoes_aviso on public.avisos;
create trigger trg_notificacoes_aviso
after insert on public.avisos
for each row execute function public.criar_notificacoes_aviso();

create or replace function public.criar_notificacoes_cobranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificacoes (condominio_id, usuario_id, tipo, titulo, mensagem)
  select
    new.condominio_id,
    pu.usuario_id,
    'COBRANCA',
    'Nova cobrança lançada',
    'Foi lançada a cobrança "' || new.descricao || '" no valor de ' || to_char(new.valor, 'FM999G999G990D00') || '.'
  from public.perfis_usuario pu
  where pu.condominio_id = new.condominio_id
    and pu.unidade_id = new.unidade_id
    and pu.role = 'MORADOR'
    and pu.ativo = true;

  return new;
end;
$$;

drop trigger if exists trg_notificacoes_cobranca on public.cobrancas;
create trigger trg_notificacoes_cobranca
after insert on public.cobrancas
for each row execute function public.criar_notificacoes_cobranca();

commit;