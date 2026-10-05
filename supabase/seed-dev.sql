-- SEED DE DESENVOLVIMENTO — substitua <AUTH_USER_UUID> pelo UUID real
-- Encontre o UUID em: Supabase → SQL Editor → select id from auth.users where email = 'seu@email.com'

begin;

insert into public.condominios (
  id,
  nome,
  tipo,
  endereco,
  cidade,
  estado,
  cep,
  total_unidades
) values (
  '11111111-1111-1111-1111-111111111111',
  'Residencial Condofy',
  'VERTICAL',
  'Rua das Acacias, 100',
  'Sao Paulo',
  'SP',
  '01000-000',
  2
);

insert into public.blocos (
  id,
  condominio_id,
  nome
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Bloco A'
);

insert into public.unidades (
  id,
  condominio_id,
  bloco_id,
  numero,
  andar,
  tipo,
  status
) values
(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '101',
  1,
  'APARTAMENTO',
  'OCUPADA'
),
(
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '102',
  1,
  'APARTAMENTO',
  'VAZIA'
);

insert into public.usuarios (
  id,
  nome,
  email,
  telefone,
  avatar_url
) values (
  '<AUTH_USER_UUID>',
  'Morador Teste',
  'seu@email.com',
  '(11) 99999-9999',
  null
)
on conflict (id) do update set
  nome = excluded.nome,
  email = excluded.email,
  telefone = excluded.telefone,
  avatar_url = excluded.avatar_url;

insert into public.perfis_usuario (
  id,
  usuario_id,
  condominio_id,
  unidade_id,
  role,
  ativo
) values (
  '55555555-5555-5555-5555-555555555555',
  '<AUTH_USER_UUID>',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'MORADOR',
  true
)
on conflict (id) do update set
  usuario_id = excluded.usuario_id,
  condominio_id = excluded.condominio_id,
  unidade_id = excluded.unidade_id,
  role = excluded.role,
  ativo = excluded.ativo;

commit;
