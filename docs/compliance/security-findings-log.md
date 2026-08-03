# Log de achados de segurança — corrigidos

Registro de vulnerabilidades concretas encontradas e corrigidas durante o
desenvolvimento — diferente de `security-exceptions.md`, que documenta riscos
conhecidos e conscientemente **aceitos, não corrigidos**. Tudo aqui foi fechado
antes do merge da etapa correspondente.

## Etapa 04 — Schema Drizzle + Row-Level Security

### 1. IDOR em `handle_account_deletion(target uuid)`

- **O que era:** a função é `SECURITY DEFINER` (roda com privilégios do dono,
  ignorando RLS) e recebe `target uuid` como parâmetro arbitrário. Postgres
  concede `EXECUTE` a `PUBLIC` por padrão em toda função nova, e o PostgREST
  expõe qualquer função do schema `public` como endpoint RPC. Sem restrição
  explícita, qualquer usuário autenticado podia chamar
  `supabase.rpc('handle_account_deletion', { target: '<uuid-de-outra-pessoa>' })`
  e apagar a conta/participações de qualquer outro usuário.
- **Como foi encontrado:** review de segurança automático rodado em background
  após o commit da migration `0002_account-deletion.sql`, sinalizando
  `authorization`/IDOR no arquivo. Confirmado por inspeção manual da função e
  do modelo de grants do Postgres/PostgREST antes de aplicar a correção.
- **Como foi corrigido:** `revoke execute ... from public/anon/authenticated` +
  `grant execute ... to service_role`, restringindo a chamada da função só ao
  client isolado de service-role (`lib/supabase/admin.ts`), nunca à aplicação
  em nome do próprio usuário. Ver `db/migrations/0002_account-deletion.sql`.
- **Auditoria de escopo (2026-08-03):** as outras três funções
  `SECURITY DEFINER` do projeto foram checadas com o mesmo rigor:
  - `create_workspace_with_owner(workspace_name text)` deriva o owner de
    `auth.uid()` internamente — não recebe `user_id`/`owner_id` como
    parâmetro, então não é o mesmo IDOR. Um usuário só consegue se tornar
    dono do workspace que ele mesmo está criando.
  - `is_workspace_member(ws uuid)` só lê, via `auth.uid()` interno; não vaza
    informação sobre outros usuários mesmo se chamada por `anon`.
  - `handle_new_user()` é `returns trigger` — testado diretamente contra o
    banco (`select public.handle_new_user()`), falha sempre com o erro nativo
    do Postgres `trigger functions can only be called as triggers`,
    independente de role ou grant. Não é invocável via RPC por construção.
  - Nenhuma das três precisou de correção. Observação de hardening (não
    corrigida, não é vulnerabilidade): as três ainda têm `EXECUTE` concedido a
    `PUBLIC`/`anon` por padrão, mais permissivo que o necessário já que só
    fazem sentido para `authenticated`. Sem exploração conhecida hoje.

### 2. Grants de tabela ausentes para `authenticated`/`service_role`

- **O que era:** as 6 tabelas do schema (`workspaces`, `workspace_members`,
  `transactions`, `fixed_bills`, `goals`, `profiles`) foram criadas via
  `drizzle-kit migrate` contra uma conexão externa (session pooler), não pelo
  Studio/Dashboard do Supabase. A plataforma só concede automaticamente
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` a `anon`/`authenticated`/`service_role`
  quando a tabela é criada pela própria ferramenta dela — via conexão externa,
  as tabelas só herdaram os grants padrão de `TRIGGER`/`REFERENCES`/
  `TRUNCATE`. RLS restringe linhas, não substitui o grant de tabela: toda
  query (mesmo com policy correta) falhava com `permission denied for table
  ...`.
- **Como foi encontrado:** não foi pego por lint nem `tsc` — só apareceu ao
  rodar de fato os testes de compliance contra o banco real (subtarefa de
  validação da etapa 04), com `service_role` (bypassa RLS mas ainda precisa do
  grant base) e `authenticated` ambos falhando.
- **Como foi corrigido:** migration própria (`db/migrations/0003_table-
  grants.sql`) concedendo `SELECT, INSERT, UPDATE, DELETE` a `authenticated` e
  `service_role` nas 6 tabelas. `anon` não recebeu nada — não há dado público
  nem rota sem sessão neste produto.

Ver `docs/planning/etapa-04-schema-rls.md` para o design completo e o
histórico de decisões da etapa.
