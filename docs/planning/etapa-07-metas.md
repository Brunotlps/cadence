# Etapa 07 — Metas financeiras

**Status:** planejado
**Aberto em:** 07/08/2026
**Plano aprovado em:** 07/08/2026
**Depende de:** Etapa 06 (lançamentos, formatadores, camada de acesso a dado)

## Objetivo

Metas com valor-alvo, ritmo sugerido mensal (editável, referencial) e aportes
livres registrados a qualquer momento — o modelo fechado desde a fase de design,
corrigindo o problema original de "aporte fixo".

## Herdado do design

- Meta: nome, valor-alvo, ritmo sugerido mensal (editável, não obrigatório).
- Aporte: lançamento livre vinculado à meta, qualquer valor, qualquer momento.
- Progresso = soma de todos os aportes vs. valor-alvo, comparado ao ritmo
  sugerido (ex: "2 aportes à frente do ritmo").

## Decisões fechadas

1. **Aporte é uma `transaction`** com `kind=contribution`, vinculada à meta via
   `goal_id` (já suportado no schema desde a Etapa 04). Sem tabela nova para
   histórico de aportes — reaproveita a tabela existente.
2. **Sem diferenciação de acesso** entre membros do workspace ("meta conjunta"
   não é um modelo à parte) — segue o mesmo padrão de `transactions`: qualquer
   membro vê e aporta em qualquer meta do workspace.
3. **Saldo do Dashboard confirmado:** `receitas − despesas − aportes`, decisão
   provisória da Etapa 6 agora efetivada — deixa de ser provisória.
4. **Meta em 100%:** recebe destaque visual (selo/cor diferenciada), não só a
   barra de progresso cheia.
5. **Meta é editável** depois de criada — valor-alvo e ritmo sugerido podem ser
   alterados. (A decisão de _como_ tratar o histórico de progresso quando o
   valor-alvo muda — ex: uma meta de R$5.000 já com R$3.000 aportados que vira
   R$4.000 — fica para o plano de implementação resolver.)

## Pontos técnicos a resolver na implementação

- Query de progresso: agregação de aportes por meta, seguindo o mesmo padrão de
  agregação em JS no servidor já validado na Etapa 6 (sem view/RPC nova, pelos
  mesmos motivos já documentados lá).
- Cálculo de "adiantado/atrasado em relação ao ritmo": precisa de uma fórmula
  explícita (ex: comparar aportes acumulados vs. ritmo sugerido × meses
  decorridos desde a criação da meta) — o plano de implementação deve propor
  essa fórmula com clareza, não deixar implícita no código.
- Formulário de aporte: reaproveita o padrão de formulário rápido da Etapa 6
  (valor + confirmação), ou precisa de campo adicional (qual meta)?
- Exclusão de meta: o que acontece com os aportes já vinculados a ela (`goal_id`
  já tem `ON DELETE SET NULL` no schema — confirmar se esse é o comportamento
  desejado, ou se deveria ser bloqueado/cascata).

## Gaps identificados na spec e decisões técnicas propostas

Os pontos abaixo foram aprovados antes da implementação, após conferir o schema,
as policies, a camada Supabase autenticada e os padrões das Etapas 04–06. Nenhuma
decisão reintroduz Drizzle, `DATABASE_URL` ou service-role em runtime.

### 6. Leitura e agregação do progresso

Manter o padrão da Etapa 06: `/goals` será um Server Component, confirmará a sessão
com `auth.getUser()`, resolverá o workspace pela membership visível via RLS e fará
duas consultas autenticadas — metas e transações `kind=contribution`, selecionando
somente as colunas necessárias. Um helper puro agregará os aportes por `goal_id` em
JavaScript no servidor.

Não haverá view ou RPC nova. Para o volume pessoal esperado, a agregação linear é
suficiente e evita nova superfície de grants/RLS e o risco de uma view sem
`security_invoker`. Um índice voltado a `workspace_id`, `goal_id` e data sustentará
a leitura. Aportes com `occurred_on` futuro, caso existam por dado legado ou chamada
direta, só entram no progresso quando a data chegar.

### 7. Fórmula explícita do ritmo

Adicionar `goals.started_on` como data civil imutável, preenchida em
`America/Sao_Paulo`. Isso evita derivar calendário de um `created_at` sem timezone
explícito.

Para cada meta:

- `A` = total dos aportes ocorridos até hoje;
- `R` = ritmo mensal sugerido;
- `M` = ciclos mensais completos desde `started_on`;
- `E = min(valor-alvo, R × M)`;
- `D = A − E`.

Os ciclos usam o aniversário mensal da meta, ajustado ao último dia de meses curtos:
uma meta criada em 31 de janeiro completa o primeiro ciclo em 28/29 de fevereiro. No
dia da criação, `M = 0`.

Sem ritmo, a interface mostra “Sem ritmo definido”. Meta atingida mostra “Meta
concluída” e esse estado prevalece sobre ritmo. Se `|D| < R`, mostra “Em dia com o
ritmo”; caso contrário, mostra `floor(|D| / R)` meses de ritmo à frente ou atrás,
além do valor monetário exato acima/abaixo do esperado.

**Divergência aprovada do protótipo:** o protótipo contava o mês de criação
imediatamente. A implementação usa ciclos completos para que uma meta recém-criada
não apareça atrasada.

### 8. Formulário e ciclo de vida de aportes

O aporte terá formulário próprio, reutilizando padrões visuais e helpers de moeda e
data da Etapa 06, mas não o `TransactionForm`: categoria e forma de pagamento não se
aplicam. A criação parte do card da meta e mostra valor + data; a meta vem do contexto
do card. O servidor deriva `kind=contribution`, `category=null`,
`payment_method=null`, `goal_id`, autoria e workspace. Datas futuras são rejeitadas;
aportes retroativos são permitidos.

O nome da meta não será copiado para `description`, evitando duplicação, informação
desatualizada após edição e retenção do nome depois de a meta ser excluída.

Edição e hard-delete de aportes individuais fazem parte desta etapa. A edição permite
corrigir valor/data e reatribuir o aporte a outra meta do mesmo workspace. Aportes
órfãos também poderão ser editados, reatribuídos ou excluídos pelo Dashboard.

### 9. Exclusão de meta e destino dos aportes

Confirmado o comportamento `ON DELETE SET NULL`: a meta sofre hard-delete e seus
aportes permanecem como transações `contribution`, com `goal_id=null`. Eles continuam
no histórico, nas exportações e no saldo do Dashboard. Não há tombstone, cópia de
auditoria ou service-role.

Esse comportamento é compatível com `.cadence/policies/data-handling.md`: não mantém
uma meta escondida por soft-delete nem apaga silenciosamente lançamentos financeiros
válidos. A confirmação informa quantos aportes ficarão desvinculados. Como o nome da
meta não é duplicado, eles passam a aparecer como “Aporte de meta excluída”.

### 10. Edição de meta com aportes existentes

Progresso e conclusão nunca serão snapshots persistidos; serão recalculados em cada
leitura:

- reduzir o alvo para valor menor ou igual ao total marca a meta como concluída;
- aumentar o alvo acima do total remove o estado de concluída;
- alterar o ritmo recalcula todo o comparativo desde `started_on`, sem reiniciar o
  relógio;
- o total aportado não muda quando a meta é editada;
- o percentual textual pode passar de 100%, mas a barra visual para em 100%;
- reatribuir um aporte move o valor entre metas, sem alterar o saldo mensal total.

### 11. Integridade e segurança no banco

O schema atual tem um gap real: o FK simples de `transactions.goal_id` garante que a
meta existe, mas não que transação e meta pertençam ao mesmo workspace; também não
impede uma despesa/receita de receber `goal_id`.

A migration fará preflight e falhará diante de dado incompatível, sem corrigir,
reclassificar ou apagar dado financeiro silenciosamente. Ela deverá:

- validar nome de meta não vazio e com limite explícito;
- exigir `target_amount > 0` e permitir `suggested_monthly` nulo ou positivo;
- adicionar `started_on` e tornar `workspace_id`, `created_at` e `started_on`
  imutáveis, mantendo nome, alvo e ritmo editáveis;
- permitir `goal_id` somente quando `kind=contribution`;
- manter `transactions.goal_id` anulável e preservar o FK com
  `ON DELETE SET NULL`;
- instalar uma trigger **`BEFORE INSERT` somente para `TG_OP = 'INSERT'`, nunca
  `UPDATE`**, que, ao inserir `kind=contribution`, exige `goal_id IS NOT NULL`, lê a
  meta referenciada e rejeita quando `transactions.workspace_id` difere de
  `goals.workspace_id`;
- criar o índice da consulta de aportes.

Esse desenho é obrigatório: `goal_id` não recebe `NOT NULL`, e a igualdade entre
workspaces não será um `CHECK` entre tabelas. Como o `ON DELETE SET NULL` executa um
`UPDATE`, ele nunca aciona a trigger escopada a `INSERT` e pode desvincular os
aportes normalmente.

Os testes de compliance provarão exatamente: insert de aporte sem meta falha; insert
com meta de outro workspace falha; insert legítimo passa; excluir meta com aportes
passa e deixa as transações preservadas com `goal_id=null`. Também cobrirão RLS,
imutabilidade, vínculo de `goal_id` apenas a aporte e CRUD cruzado.

Não será adicionada `created_by` a metas: ela não é necessária para autorização ou
produto, pois qualquer membro pode criar, editar e excluir qualquer meta.

### 12. Interface e navegação

Criar a rota protegida `/goals`, acessível pelo Dashboard, com estado vazio, criação,
cards de meta, progresso, ritmo, aportes recentes, ações de aportar/editar/excluir e
destaque visual explícito para meta concluída. O formulário de meta será reutilizado
na edição. A interface terá layout responsivo e falhas genéricas.

“Meta conjunta” do protótipo não vira campo nem permissão: prevalece a decisão
fechada de acesso idêntico entre membros do workspace.

### 13. Camada de aplicação e segurança das mutações

Criar módulos sob `lib/goals/` para validação, cálculo de progresso/ritmo,
repositório Supabase autenticado e loaders. O resolvedor de workspace, hoje dentro
do repositório de transações, será extraído para módulo compartilhado sem alterar o
comportamento existente.

Server Actions finas de metas e aportes confirmarão novamente a sessão, resolverão
workspace/autoria no servidor e filtrarão get/update/delete por `id + workspace_id`
além da RLS. Meta inexistente e invisível produzirão o mesmo erro genérico. Nenhum
erro ou log incluirá nome, valor ou corpo do formulário. Mutações de aporte revalidam
`/goals` e `/dashboard`; mutações só de meta revalidam `/goals`.

### 14. Portabilidade e documentação

Atualizar modelo e portabilidade com `started_on`, constraints de metas, semântica de
aporte órfão, recálculo após edição e exportação de aportes com `goal_id=null`. Metas
excluídas não aparecem em exportações posteriores; os lançamentos preservados
continuam aparecendo sem duplicar o nome apagado.

## Subtarefas

- [x] 1. Registrar o plano aprovado neste documento antes de escrever código
- [x] 2. Testes unitários primeiro (TDD): validação de meta/aporte, ciclos mensais,
      progresso, conclusão, mudança de alvo/ritmo e reatribuição/edição/exclusão de
      aportes
- [x] 3. Testes de compliance primeiro: constraints, imutabilidade, CRUD cruzado,
      aporte sem meta, meta de outro workspace, vínculo de `goal_id` só a aporte e
      exclusão de meta preservando aportes via `ON DELETE SET NULL`
- [x] 4. E2E primeiro: estado vazio, criação/edição/exclusão de meta, aporte,
      reatribuição/edição/exclusão de aporte, saldo, ritmo, conclusão e aporte órfão
- [x] 5. `db/schema.ts` + migration com preflight, `started_on`, constraints,
      triggers de integridade/imutabilidade e índice de aportes
- [x] 6. Extrair o resolvedor compartilhado de workspace
- [x] 7. Helpers puros de validação, moeda/data, progresso e ritmo em `lib/goals/`
- [x] 8. Repositório Supabase autenticado de metas e aportes
- [ ] 9. Loaders de listagem e edição
- [ ] 10. Server Actions finas de metas e aportes, com `revalidatePath`
- [ ] 11. Página `/goals`, navegação, formulários, cards e destaque de conclusão
- [ ] 12. Edição/hard-delete/reatribuição de aportes e tratamento de órfãos no
       Dashboard
- [ ] 13. Atualizar modelo de dados, portabilidade e compliance aplicável
- [ ] 14. Validação final: migration no ambiente de teste, compliance, unitários,
       E2E sem skips, lint, TypeScript e build verdes

## Estratégia de commits

Conventional Commits em inglês, no imperativo e sem referência a IA. Cada commit
cobre um módulo ou arquivo lógico e inclui os testes escritos antes ou junto da
implementação correspondente; nenhuma implementação precede sua cobertura TDD.

## Notas

- O plano foi aprovado com a trigger de integridade de aporte explicitamente
  restrita a `BEFORE INSERT`; nenhuma migration ou implementação foi escrita antes
  desse registro.
- Subtarefa 2 confirmada em vermelho com
  `npx vitest run tests/unit/goals`: quatro suítes falham somente porque os módulos
  `lib/goals/*` e `lib/actions/goals.ts` ainda não existem. Os casos fixam validação,
  ciclos completos, progresso/conclusão, edição de alvo/ritmo e criação, edição,
  reatribuição e hard-delete de aportes antes da implementação.
- Subtarefa 3 confirmada em vermelho contra o Supabase de teste com
  `npx vitest run tests/compliance/goal-integrity.test.ts`: 22 casos executados, 6
  já verdes pelas policies/FKs existentes e 16 falhando somente nas garantias ainda
  ausentes (constraints de metas, `started_on`, campos imutáveis, aporte sem meta,
  vínculo entre workspaces e `goal_id` em despesa/receita). O cenário de exclusão de
  meta já prova que o FK atual preserva o aporte com `goal_id=null`; a trigger futura
  não pode regredir esse comportamento. A suíte existente de integridade de
  transações permaneceu verde (19/19) após vincular sua fixture de `contribution` a
  uma meta real.
- Subtarefa 4 confirmada em vermelho com
  `npx playwright test tests/e2e/goals.spec.ts --workers=1`: cinco cenários falham
  na navegação, rota e componentes de metas ainda ausentes, depois de fixtures e
  autenticação completarem normalmente. A cobertura fixa estado vazio/criação,
  aporte e saldo, edição/reatribuição/hard-delete de aporte, recálculo de conclusão,
  exclusão de meta com aporte órfão e viewport móvel. O E2E existente de lançamentos
  e Dashboard permaneceu verde (5/5) após sua fixture de aporte passar a usar uma
  meta real.
- Subtarefa 5 implementada em `0007_zippy_moira_mactaggert.sql`: preflight sem
  correção silenciosa, backfill de `started_on` derivado do `created_at` histórico,
  constraints monetárias/nome, índices e campos sistêmicos de meta protegidos por
  trigger. A trigger de aporte é declarada exclusivamente `BEFORE INSERT`, exige
  `goal_id` e igualdade de workspace na criação e não participa do `UPDATE` do FK.
  Migration aplicada no Supabase de teste; excluir uma meta continua preservando o
  aporte com `goal_id=null`. As suítes centrais ficaram verdes (42/42) e toda a pasta
  de compliance permaneceu verde (50/50 em 5 arquivos). Uma segunda geração Drizzle
  confirmou que schema e snapshot estão sincronizados.
- Subtarefa 6 extraiu `getCurrentWorkspace` e `CurrentWorkspace` para
  `lib/workspace/repository.ts`, removendo a dependência conceitual de metas sobre o
  repositório de lançamentos. Actions/loaders existentes passaram a consumir o
  módulo compartilhado e a cobertura foi movida para `tests/unit/workspace`. Testes
  unitários de workspace + transações permaneceram verdes (128/128 em 14 arquivos),
  com lint dos arquivos afetados também verde.
- Subtarefa 7 implementou `validate-goal.ts`, `validate-contribution.ts` e
  `calculate-goal-progress.ts`: normalização monetária em centavos, data futura
  rejeitada para aporte, ciclos mensais completos com aniversário ajustado ao fim do
  mês, expectativa limitada pelo alvo, status de ritmo e barra limitada a 100% sem
  truncar o percentual textual. O limite de `numeric(12,2)` foi centralizado no
  helper monetário já existente. Helpers de metas + toda a unidade de transações
  ficaram verdes (157/157 em 15 arquivos), com lint verde.
- Subtarefa 8 implementou `lib/goals/repository.ts` com cliente Supabase autenticado
  injetado: metas e aportes são limitados por `workspace_id`, leituras de progresso
  excluem órfãos e datas futuras, get/update/delete reforçam `id + workspace_id` e
  mutações de aporte também filtram `kind=contribution`. Payloads não aceitam campos
  sistêmicos e erros do Supabase viram somente `query_failed`. Os testes foram
  confirmados em vermelho antes do módulo e depois verdes (47 casos em 4 arquivos de
  metas), com lint verde.
