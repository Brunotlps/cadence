# Etapa 18 — Identificação visual dos membros do workspace

**Status:** em andamento
**Aberto em:** 27/08/2026
**Depende de:** Etapa 04 (schema + RLS de `profiles`), Etapa 17 (convite de
workspace — é o único jeito de um workspace ter mais de um membro hoje)

## Objetivo

Mostrar no dashboard, de forma simples, quem participa do workspace atual
(ex.: confirmar visualmente que uma segunda pessoa convidada — cônjuge,
familiar — já é membro). Decisão de produto do usuário, registrada em
27/08/2026 após análise da codebase e plano detalhado por subtarefas.

## Diagnóstico confirmado

- `profiles` tem só `id`, `display_name`, `accent_color` (`preto` | `rosa` |
  `verde`), `created_at`. Não há e-mail nem avatar/foto —
  `.cadence/policies/data-handling.md` §2 é explícito que isso é minimização
  deliberada, não limitação técnica.
- `profiles` tem RLS só de `select`/`update` do próprio dono da linha
  (`id = auth.uid()`), decisão fechada da Etapa 04. Um membro não consegue
  ler o `display_name` de outro membro do mesmo workspace.
- Não existe FK entre `workspace_members.user_id` e `profiles.id` (nenhuma
  das duas referencia `auth.users` via FK do schema público) — o PostgREST
  não faz embed automático entre as duas tabelas como faz para
  `workspaces(name)` em `getCurrentWorkspace`. A busca de membros precisa ser
  em duas consultas.
- Não existe nenhum componente tipo avatar/badge no projeto, nem menção a
  lista de membros em etapa anterior ou no protótipo de design
  (`docs/design/prototype.html`). O sistema de 3 cores de destaque
  (`accent_color`), já usado como swatch circular em `AccentColorForm`
  (`components/app-shell/app-shell.module.css:130-141,198-216`, atributo
  `data-color`), é o padrão visual reaproveitável.
- Etapa 17 deixou "remover ou trocar papel de um membro" fora de escopo, mas
  nunca tratou de *listar/exibir* membros — território aberto, sem conflito
  com decisões fechadas anteriores.

## Decisões fechadas

### 1. Escopo exato

Entram: nova policy `select` aditiva em `profiles` (escopada por workspace
compartilhado), função `listWorkspaceMembers` em
`lib/workspace/repository.ts`, componente de UI com iniciais em círculo
colorido no `PageHeader` do dashboard.

Não entram: foto/avatar do Google, indicação de papel (dono/membro) na UI,
remover/trocar papel de membro, e-mail de membro em qualquer lugar da
interface.

### 2. Estilo visual: iniciais em círculo colorido, sem foto

Cada membro aparece como um círculo com as iniciais do `display_name`,
colorido com o próprio `accent_color` daquele membro (não o `data-accent` de
tema da página que vem do usuário logado — cada badge usa a cor de quem ela
representa). Sem avatar do Google: mantém a minimização já decidida em
`data-handling.md` §2, não introduz coleta de dado novo.

### 3. RLS: nova policy aditiva em `profiles`

```sql
create policy "profiles_select_workspace_members"
  on "profiles" for select
  using (
    exists (
      select 1 from workspace_members theirs
      where theirs.user_id = profiles.id
        and is_workspace_member(theirs.workspace_id)
    )
  );
```

Reaproveita `is_workspace_member(ws uuid)` (existe desde a migration 0001).
Policy aditiva — RLS combina policies com OR, então `profiles_select_own`
continua valendo; isso só amplia o que já era visível, nunca restringe.

### 4. Sem indicação de papel na UI

`workspace_members.role` (`owner`/`member`) não é exibido — decisão de
produto para manter a UI simples nesta etapa. A coluna já existe e pode ser
usada em uma etapa futura, se necessário.

### 5. Nota LGPD — nova finalidade de tratamento a documentar

Não é coleta de dado novo (regra 2 de `CLAUDE.md`), só uma nova
*visibilidade* de `display_name` já coletado, restrita a colegas do mesmo
workspace via RLS. Ainda assim, é uma finalidade de tratamento que não
estava mapeada em `docs/compliance/lgpd-mapping.md` ("Base legal por
finalidade" só cobria auth e personalização) — adicionar uma linha ali como
parte da implementação.

### 6. Testes

- Compliance (`tests/compliance/profile-workspace-visibility.test.ts`):
  membro A lê `profiles` de membro B do mesmo workspace; usuário C de outro
  workspace não lê `profiles` de A nem de B; cada usuário continua lendo o
  próprio `profiles` (regressão de `profiles_select_own`).
- Unitário: `listWorkspaceMembers` (`lib/workspace/repository.ts`) e
  `getMemberInitials` (`lib/workspace/member-initials.ts`).
- Sem E2E dedicado nesta etapa — cobertura via compliance + unitário +
  verificação manual no dashboard (mesmo padrão de outras seções visuais do
  dashboard que não têm E2E próprio).

## Estrutura prevista

```text
db/
└── migrations/
    └── 0016_profiles_workspace_visibility.sql   (nova policy)

lib/
└── workspace/
    ├── repository.ts            (+ listWorkspaceMembers)
    └── member-initials.ts       (novo)

components/
└── workspace/
    ├── member-badges.tsx           (novo)
    └── member-badges.module.css    (novo)

app/(protected)/(workspace)/dashboard/page.tsx   (integração no PageHeader)

tests/
├── compliance/profile-workspace-visibility.test.ts   (novo)
└── unit/workspace/
    ├── repository.test.ts          (+ casos)
    └── member-initials.test.ts     (novo)

docs/compliance/lgpd-mapping.md          (+ linha de finalidade)
docs/specs/data-model-and-deletion.md    (+ nota)
```

## Subtarefas

- [x] 1. Teste de compliance (`profile-workspace-visibility.test.ts`),
      confirmando que falha sem a policy
- [x] 2. Migration `0016_profiles_workspace_visibility.sql` aplicada no
      projeto Supabase referenciado por `.env.local`, confirmando que o
      teste de compliance passa a verde — ver "Achados sobre `db:migrate`"
      abaixo, subtarefa marcada como bem mais trabalhosa do que o previsto
- [x] 3. `listWorkspaceMembers` em `lib/workspace/repository.ts` + testes
      unitários
- [x] 4. `getMemberInitials` em `lib/workspace/member-initials.ts` + teste
      unitário
- [x] 5. Componente `MemberBadges` + CSS
- [x] 6. Integração no `PageHeader` do dashboard
- [x] 7. Atualizar `docs/compliance/lgpd-mapping.md` e
      `docs/specs/data-model-and-deletion.md`
- [x] 8. Validação final: 577/577 testes verdes (unit + compliance, 68
      arquivos), lint sem avisos, TypeScript sem erros, build de produção
      verde. Verificação visual no dashboard real pendente de confirmação do
      usuário.

## Achados sobre `db:migrate` (fora do escopo original, descobertos aqui)

Aplicar a migration 0016 revelou três problemas pré-existentes e não
relacionados ao código desta etapa, que valem registro para não se repetirem:

1. **`DIRECT_URL` em `.env.local` não batia com `NEXT_PUBLIC_SUPABASE_URL`**
   (`wwkgnkowcymoypqgfdyl` vs `wvylbahzgwflmgvhqqbc`). Isso já estava assim
   antes desta etapa. Investigação de produção (confirmada via Vercel + tela
   de login do Google + dados reais no painel do Supabase) esclareceu que
   **`wwkgnkowcymoypqgfdyl` é a produção real** (usuários reais) e
   **`wvylbahzgwflmgvhqqbc` é um projeto separado de dev/teste local**, que
   é o que `NEXT_PUBLIC_SUPABASE_URL` do `.env.local` sempre usou — separação
   intencional e correta. O bug real era só `DIRECT_URL` (usado só por
   `db:migrate`/provas de compliance hospedadas) apontar pro projeto errado
   *dentro do próprio `.env.local`*; corrigido para apontar pro mesmo projeto
   de dev que `NEXT_PUBLIC_SUPABASE_URL` já usava. A policy desta etapa foi
   confirmada presente e com a `qual` correta em **ambos** os projetos —
   produção já tinha sido corrigida manualmente bem no início desta sessão,
   antes da confusão sobre qual projeto era qual ter sido esclarecida.
2. **`drizzle-kit migrate` (0.31.10) engole o erro real em caso de falha.**
   `MigrateProgress.render(status)`, em `node_modules/drizzle-kit/bin.cjs`,
   trata `"rejected"` igual a `"pending"` (mostra só o spinner), então uma
   migration que falha aparece como se nada tivesse acontecido — sem
   mensagem, só volta pro prompt com exit code 1. Reportar upstream é uma
   boa ideia; por ora, qualquer `db:migrate` "silencioso" deve ser
   re-verificado rodando a mesma migration via um script Node avulso
   chamando `drizzle-orm/*/migrator` diretamente, com try/catch explícito.
3. **A tabela de controle do drizzle (`drizzle.__drizzle_migrations`) no
   projeto real está dessincronizada do schema de fato aplicado** — ela não
   tem registro das migrations 0000–0015 (que já rodaram, o schema existe),
   então `drizzle-kit migrate`/`migrate()` tenta re-executar desde o início e
   falha em "relation already exists" na primeira tabela que encontra. A
   migration 0016 desta etapa foi aplicada com `CREATE POLICY` direto via
   `psql`, contornando o drizzle-kit. **Reconciliar essa tabela de controle
   (ou aceitar rodar migrations futuras manualmente até resolver) fica como
   dívida técnica separada, fora do escopo desta etapa.**

Nenhum desses três achados é specific a `profiles_select_workspace_members`
— são problemas de infraestrutura/tooling que afetam qualquer migration
futura até serem corrigidos.

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Um commit
por módulo: (1) migration + teste de compliance, (2) `listWorkspaceMembers` +
testes, (3) `member-initials` + teste, (4) componente `MemberBadges` + CSS,
(5) integração no dashboard, (6) documentação.

## Notas

- Plano registrado a pedido do usuário após análise da codebase (2 agentes
  de exploração — backend/RLS e frontend/UI) e alinhamento de decisões via
  perguntas diretas (estilo visual, localização, indicação de papel).
- Confirmado antes da implementação: o projeto não tem banco de testes
  separado/dockerizado — os testes de compliance rodam contra o mesmo
  projeto Supabase real referenciado em `.env.local`
  (`vitest.config.mts`, `tests/compliance/support.ts`). A migration desta
  etapa precisa ser aplicada nesse projeto via `npm run db:migrate` antes do
  teste de compliance novo poder passar.
