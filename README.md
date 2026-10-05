# Condofy

Sistema de gestão para condomínios. O morador acompanha encomendas, visitas, reservas do salão e avisos; o porteiro registra o que chega e quem entra; o síndico vê tudo em um painel. Ainda não terminei, então algumas telas estão incompletas.

## O que já existe

- Encomendas: o porteiro registra a chegada e o morador é avisado
- Visitantes e veículos
- Reservas de áreas comuns (salão)
- Avisos, enquetes, ocorrências e documentos
- Financeiro e relatórios para o síndico
- Perfis de morador, porteiro e síndico, com permissões por linha no banco (RLS do Supabase)
- Painel interno (`backoffice`) para cadastrar condomínios, contratos e leads

## Estrutura

Monorepo com npm workspaces.

| Pasta | O que é |
|---|---|
| `apps/web` | Aplicação principal, Next.js 14 com App Router e Tailwind |
| `apps/api` | API em Node.js e Express (alertas e rotinas) |
| `apps/backoffice` | Painel interno em Next.js |
| `apps/mobile` | App mobile com Expo |
| `apps/mobile-native` | Protótipo nativo do app |
| `supabase` | Esquema do banco, políticas de acesso e migrações |

## Rodar localmente

Precisa de Node.js 20+ e de um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env
```

Preencha o `.env` com a URL e as chaves do seu projeto Supabase. Depois, no SQL Editor do Supabase, rode nesta ordem:

1. `supabase/schema-inicial-condofy.sql`
2. os demais arquivos de `supabase/` e de `supabase/migrations/`
3. `supabase/rls-policies.sql`
4. opcional, para ter dados de teste: `supabase/seed-dev.sql`

Para subir:

```bash
npm run dev:web      # http://localhost:3000
npm run dev:api      # http://localhost:3001
npm run dev:mobile   # Expo
```

## Variáveis de ambiente

| Variável | Onde |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | API |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | Web |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` | Mobile |

A `SUPABASE_SERVICE_ROLE_KEY` ignora as políticas de acesso. Use só no servidor e nunca a publique.

## Estado do projeto

Em desenvolvimento. O que falta: testes automatizados, acabamento do app mobile e a documentação de cada módulo.
