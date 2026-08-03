# Etapa 04 — Schema Drizzle + Row-Level Security

**Status:** concluído
**Aberto em:** [PREENCHER DATA]
**Depende de:** Etapas 01–03 (bootstrap, CI, deploy)

## Objetivo

Implementar o schema de dados (workspaces, membros, transações, contas fixas, metas)
com isolamento por workspace garantido por RLS no Postgres — não pela aplicação.

## Gaps identificados na spec ilustrativa

A spec original (`docs/specs/data-model-and-deletion.md`) é um desenho ilustrativo;
os seguintes gaps foram identificados e resolvidos antes de codar:

1. `workspace_members` sem chave primária — corrigido com PK composta `(workspace_id, user_id)`.
2. Problema de bootstrap na policy de insert (usuário precisa ser membro para inserir,
   mas criar o primeiro membro exige inserir) — resolvido com função `SECURITY DEFINER`.
3. `profiles` sem policy definida — tratado como caso à parte (RLS por `auth.uid()`,
   não por workspace).
4. Drizzle não gera RLS/policies a partir do schema — resolvido com migration SQL manual.
5. Connection string de migration (pooler, transaction mode) incompatível com DDL —
   resolvido com `DIRECT_URL` separada.
6. A "Direct connection" real do Supabase (`db.<ref>.supabase.co`) é IPv6-only;
   em ambiente sem saída IPv6 o `drizzle-kit migrate` trava indefinidamente sem
   erro. Resolvido usando a "Session pooler" (porta 5432, IPv4) como `DIRECT_URL`.
7. Tabelas criadas via conexão externa (drizzle-kit) não recebem os grants de
   `SELECT`/`INSERT`/`UPDATE`/`DELETE` que o Supabase concede automaticamente
   quando a tabela é criada pelo Studio/Dashboard — toda query falhava com
   "permission denied" mesmo com as policies corretas. Resolvido com grants
   explícitos (`0003_table-grants.sql`).

## Decisões de design (fechadas)

### 1. Bootstrap de `profiles`

Trigger em `auth.users` (`on_auth_user_created`, `AFTER INSERT`) chamando função
`SECURITY DEFINER` `handle_new_user()` que insere a linha em `public.profiles`. Roda no
contexto do evento de criação do usuário, não depende de `auth.uid()` nem de a
aplicação lembrar de inserir após o signup.

### 2. Bootstrap de `workspace_members`

Função `SECURITY DEFINER` `create_workspace_with_owner(name)` insere `workspace` +
primeiro `workspace_member` (role `owner`) atomicamente. A aplicação nunca insere
direto em `workspace_members` na criação inicial. `set search_path = public`
obrigatório nesta e em toda função `SECURITY DEFINER` do projeto (mitigação de
search_path hijacking).

### 3. Acesso a dado em runtime — quem fala com o banco

Nenhuma rota autenticada ou rotina de exportação abre conexão Drizzle crua via
`DATABASE_URL` (role `postgres`, `BYPASSRLS` — ignoraria RLS silenciosamente).

| Papel                              | Ferramenta                                                                | Uso                                                             |
| ---------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Leitura/escrita de dado de usuário | Cliente Supabase JS autenticado (anon key + sessão, role `authenticated`) | Rotas normais, exportação de dados                              |
| Apagamento de conta                | Cliente Supabase JS com service-role key, módulo isolado server-side      | Só a rotina de apagamento, via RPC de `handle_account_deletion` |
| Schema e migrations                | Drizzle, via `DIRECT_URL`                                                 | `drizzle-kit generate/migrate`, nunca em request handler        |

## Subtarefas

- [x] `drizzle.config.ts` lendo `DIRECT_URL`
- [x] `db/schema.ts` — tabelas com PK composta em `workspace_members`, só como fonte de tipos/migrations
- [x] Migration SQL manual: `is_workspace_member()`, RLS + policies (`transactions`, `fixed_bills`, `goals`, `workspace_members`), policy de `profiles`, `create_workspace_with_owner()`, trigger + `handle_new_user()`
- [x] Migration `handle_account_deletion()`
- [x] `lib/supabase/server.ts` (cliente autenticado, RLS ativo)
- [x] `lib/supabase/admin.ts` (service-role, isolado, só apagamento de conta)
- [x] Reescrever `tests/compliance/rls-isolation.test.ts` e `cascade-deletion.test.ts` usando Supabase JS autenticado (não Drizzle/Postgres direto)
- [x] Validação: `db:generate`/`db:migrate` contra `DIRECT_URL`, testes de compliance passando, lint/build verdes

## Notas de revisão

- [x] `set search_path = public` confirmado em `handle_new_user()`, `is_workspace_member()` e `create_workspace_with_owner()` (migration `0001_rls-and-security-definer-functions.sql`).
- [x] `workspace_members.role` restrito a `'owner'`/`'member'` via `CHECK` na mesma migration.
- [x] `handle_account_deletion()` restrita a `service_role` via `revoke`/`grant execute` — sem isso, qualquer usuário autenticado poderia chamá-la via RPC com uuid de outra pessoa (IDOR). Achado pelo review automático de segurança, corrigido em `0002_account-deletion.sql`.
- [x] Nota anterior corrigida: `handle_account_deletion()` (`0002_account-deletion.sql`) segue a rotina ilustrativa de `docs/specs/data-model-and-deletion.md` à risca — apaga `workspace_members` e `profiles` do usuário, e workspaces órfãos (sem membros). `transactions.created_by`/`fixed_bills`/`goals` de um workspace que continua com outros membros NÃO são tocados: são dados do workspace compartilhado, não dados pessoais exclusivos do usuário. A falta de FK para `auth.users` nessas colunas é intencional, não uma lacuna a fechar.
