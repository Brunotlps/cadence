# Cadence

App de controle financeiro para grupo. Cada pessoa registra suas próprias
movimentações e todas acompanham, de forma consolidada, o saldo do mês, contas fixas
e metas compartilhadas — em um espaço financeiro comum (workspace).

Construído com privacidade por padrão e em conformidade com a LGPD: coleta mínima de
dados, sem rastreio, sem armazenamento de IP, e com direito ao apagamento real.

## O que o projeto faz

- **Dashboard** — saldo do mês, resumo de gastos por categoria e últimos lançamentos.
- **Lançamentos** — registro rápido de despesas, receitas e aportes.
- **Contas fixas** — contas recorrentes com valor previsto vs. valor realizado.
- **Metas** — objetivos financeiros com ritmo sugerido e aportes livres.

Um workspace pode ter mais de um membro (ex: um casal), com dados isolados por
`workspace_id` e protegidos por Row-Level Security no banco.

## Stack

- **Next.js** (App Router) — frontend + API routes
- **Supabase** (Postgres + Auth) — dados e autenticação, isolamento via RLS
- **Drizzle ORM** — schema e migrations
- **Vitest** — testes unitários e de integração
- **Playwright** — testes end-to-end
- **Vercel** — hospedagem e deploy contínuo

## Pré-requisitos

- Node.js 20+ (testado com 24)
- Conta no Supabase (projeto na região São Paulo / sa-east-1)
- Conta no Vercel (para deploy)

## Instalação e execução local

```bash
# 1. Clone o repositório
git clone git@github.com:<seu-usuario>/cadence.git
cd cadence

# 2. Instale as dependências
npm ci

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# preencha .env.local com as chaves do seu projeto Supabase (ver seção abaixo)

# 4. Rode as migrations do banco
npm run db:migrate

# 5. Suba o servidor de desenvolvimento
npm run dev
# app disponível em http://localhost:3000
```

> Os comandos acima assumem que o scaffold da aplicação Next.js já foi criado.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. **Nunca** commite `.env.local`.

| Variável                        | Descrição                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL do projeto Supabase                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role isolada, somente para apagamento de conta                  |
| `APP_URL`                       | Origem confiável usada nos links de autenticação em produção       |
| `DATABASE_URL`                  | Opcional; teste de conectividade, no mesmo projeto da URL pública       |
| `DIRECT_URL`                    | Conexão administrativa no mesmo projeto da URL pública; nunca para runtime |

Leituras e mutações de dados de usuário em runtime usam exclusivamente o cliente
Supabase JS autenticado, mantendo as policies de RLS ativas. Drizzle e conexões
Postgres diretas ficam restritos a schema, migrations, conectividade e provas de
compliance hospedadas; nunca pertencem ao runtime da aplicação.
Antes de abrir uma conexão administrativa, os comandos de migration e as provas
hospedadas comparam o project ref com `NEXT_PUBLIC_SUPABASE_URL` e falham sem
conectar se as variáveis apontarem para projetos diferentes.

`npm run db:migrate` usa diretamente o migrador PostgreSQL do `drizzle-orm`,
contornando o renderer do `drizzle-kit@0.31.10`, que oculta a causa de migrations
rejeitadas. Falhas são escritas em `stderr` com mensagem, código PostgreSQL,
detalhe e dica quando disponíveis, sem imprimir a connection string ou sua senha.
O comando mantém o mesmo diretório `db/migrations`, journal e tabela de controle
usados pelo Drizzle e sempre encerra a conexão antes de terminar.

Se o schema hospedado já contém migrations, mas `drizzle.__drizzle_migrations`
está incompleta, use primeiro o reparo controlado. O comando é dry-run por
padrão e valida o schema, o project ref, os objetos de segurança e a cadeia
contígua de hashes antes de qualquer escrita:

```bash
npm run db:migrations:repair
npm run db:migrations:repair -- --apply
```

`--apply` registra somente as migrations ausentes até o baseline aprovado
`0016_profiles_workspace_visibility`, usando os timestamps originais do
journal. Ele aborta em caso de gap, hash divergente, registro desconhecido ou
schema incompleto; nunca use timestamps atuais para preencher o histórico.

## Comandos de teste

```bash
npm run test          # roda unit + e2e
npm run test:unit     # só unitários (Vitest)
npm run test:unit:watch  # unitários em watch mode
npm run test:e2e      # end-to-end (Playwright)
```

Testes de conformidade (isolamento por workspace e apagamento em cascata) ficam em
`tests/compliance/` e rodam junto dos unitários. São obrigatórios e não podem ser
ignorados ao mexer em dados de usuário.

## Padrões e convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`,
  `refactor:`, `ci:`), em inglês, no imperativo. Um commit por módulo/arquivo lógico.
- **Testes primeiro:** escreva o teste antes da implementação sempre que viável.
  Nenhuma feature entra sem teste correspondente.
- **Isolamento de dados:** toda tabela com dado de usuário tem `workspace_id` + RLS.
  Nunca confie apenas em filtro na aplicação.
- **Privacidade:** sem coleta de IP, geolocalização, dado sensível ou analytics. Sem
  PII em logs. Ver `.cadence/policies/data-handling.md`.
- **Guardrails do projeto:** ver `CLAUDE.md` e os documentos em `docs/`.

## Estrutura do repositório

```text
.
├── .cadence/
│   └── policies/
│       └── data-handling.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── CLAUDE.md
├── app/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   └── layout.tsx
│   ├── login/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── db/
│   ├── migrations/
│   └── schema.ts
├── docs/
│   ├── compliance/
│   ├── legal/
│   ├── planning/
│   └── specs/
├── lib/
│   └── supabase/
├── package.json
├── playwright.config.ts
├── README.md
├── tests/
│   ├── compliance/
│   ├── e2e/
│   └── integration/
├── tsconfig.json
└── vitest.config.mts
```

## CI/CD

Cada pull request roda a pipeline em `.github/workflows/ci.yml` com cinco
verificações paralelas: auditoria de dependências, lint, testes unitários,
build de produção e testes E2E. O merge só deve ocorrer com as cinco verdes.
Push na `main` publica
automaticamente em produção via Vercel; cada PR gera um preview deploy isolado.

O Dependabot verifica dependências npm às segundas e GitHub Actions às terças.
Updates minor/patch de versão são agrupados por tipo; majors e correções de
segurança permanecem isolados para revisão. Como workflows iniciados pelo bot não
recebem Actions secrets, eles rodam unitários offline e build com configuração
sintética, sem acesso ao Supabase hospedado. E2E e compliance hospedados continuam
obrigatórios para PRs humanos e para todo push na `main`.

## Próximos passos recomendados

- Ativar branch protection na `main` (exigir PR + CI verde, impedir push direto):
  atualmente o CI roda mas não bloqueia tecnicamente o merge.
- Revisão jurídica dos documentos em `docs/legal/` antes de qualquer uso em produção.

## Conformidade e privacidade

Este projeto trata dados pessoais e financeiros sob a LGPD. Princípios: minimização,
isolamento por workspace, apagamento real e transparência. Os documentos legais em
`docs/legal/` são rascunhos técnicos e **não constituem aconselhamento jurídico** —
devem ser revisados por um advogado antes de publicação.
