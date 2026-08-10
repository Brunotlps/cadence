# Etapa 08 — Contas fixas / recorrentes

**Status:** em andamento
**Aberto em:** 10/08/2026
**Plano aprovado em:** 10/08/2026
**Depende de:** Etapa 06 (lançamentos), Etapa 07 (padrão de entidade vinculada +
lançamento, resolvedor de workspace compartilhado, trigger BEFORE INSERT/UPDATE
condicionada)

## Objetivo

Contas recorrentes (aluguel, luz, assinaturas): cadastro, vencimento, débito
automático, valor previsto vs. realizado, e o ciclo de "pagar" — sem exigir
job/cron para controle de estado mensal.

## Herdado do design

- Campos: nome da conta, dia de vencimento, débito automático (sim/não), valor
  fixo ou variável (com média como estimativa).
- Ao pagar: registrar valor real e data reais, distintos da estimativa.
- Filtros: Fixas × avulsas, situação (pagas/pendentes/automáticas).

## Decisões fechadas

1. **"Pagar" gera uma `transaction` vinculada** (`kind=expense`, nova coluna
   `fixed_bill_id` como FK) — mesmo padrão de `goal_id` em Metas. Sem entidade
   própria de histórico de pagamento.
2. **Status "pago/pendente" é derivado, nunca armazenado.** Calculado na leitura:
   existe uma `transaction` com esse `fixed_bill_id` e `occurred_on` dentro do
   mês corrente? Sim → pago; não → pendente. Elimina a necessidade de job/cron
   de reset mensal — mesmo princípio de "nunca persistir como snapshot" já
   validado em Metas.
3. **Aviso de vencimento próximo:** incluído, mas só como destaque visual (ex:
   badge/cor diferenciada no card quando o vencimento está próximo e ainda
   pendente). Sem notificação push, e-mail ou infraestrutura de agendamento.
4. **Encerrar recorrência:** hard-delete, mesmo padrão de exclusão de Metas —
   lançamentos já feitos preservados via `fixed_bill_id = NULL`
   (`ON DELETE SET NULL`), sem tombstone.

## Pontos técnicos a resolver na implementação

- **Definição de "período" para o vencimento:** dia de vencimento fixo (ex: dia 5) mapeado para o mês corrente — confirmar regra simples (mês civil) sem
  tentar modelar ciclos deslocados (ex: conta que "fecha" num mês e vence no
  seguinte). Manter simples nesta etapa.
- **Validação cross-workspace:** mesmo padrão da trigger de Metas — mas atenção
  ao gap que apareceu lá (trigger só em `INSERT` não cobre reatribuição via
  `UPDATE`). Se "pagar" permitir editar o lançamento gerado depois (trocar de
  conta fixa, por exemplo), a trigger precisa cobrir `UPDATE OF fixed_bill_id`
  condicionada a `WHEN (new.fixed_bill_id IS NOT NULL)`, desde o início — não
  como correção posterior.
- **Valor variável (estimativa vs. real):** como a estimativa (média) é usada
  no destaque visual de "vence em breve" antes do pagamento — mostrar o valor
  estimado ou deixar em branco até o pagamento real?
- **Edição de conta fixa com pagamentos já feitos:** mudar o valor estimado ou
  o dia de vencimento depois de já haver histórico — mesmo princípio de Metas
  (recalcula, não reescreve histórico)?

## Escopo reaberto e aceito na aprovação do plano

Quatro pontos ampliam o que a spec previa. Registrados separadamente para que a
ampliação seja rastreável, e não silenciosa:

- **S1 — `fixed_bills.category` obrigatória.** A constraint
  `transactions_kind_category_check` (migration `0006`) exige categoria válida para
  todo `kind='expense'`. Como a decisão fechada 1 diz que pagar gera uma despesa, a
  conta precisa carregar a categoria com que o pagamento será lançado; sem ela o
  insert é rejeitado pelo banco. Necessidade técnica, não conveniência.
- **S2 — `fixed_bills.started_on`.** Sem essa data civil imutável, uma conta
  cadastrada hoje apareceria como pendente em todos os meses anteriores do
  histórico — status derivado fabricando inadimplência que nunca existiu. Mesmo
  mecanismo já validado em `goals.started_on`.
- **S3 — limitação aceita conscientemente.** Como o status vem de `occurred_on`
  dentro do mês civil (decisão fechada 2), pagar em 3 de agosto a conta de julho
  marca **agosto** como pago e deixa **julho pendente permanentemente**. É o preço
  de não modelar ciclo deslocado nesta etapa. Mitigado pelo pré-preenchimento de
  data da decisão 9, não eliminado.
- **S4 — pagamento sai do editor genérico de lançamento.** Hoje
  `/transactions/[id]/edit` atualiza `kind` + `category` sem tocar `fixed_bill_id`:
  trocar a categoria para "Renda" produziria `income` com `fixed_bill_id`
  preenchido, violando o novo CHECK com erro opaco. `loadTransactionForEdit` passa
  a rejeitar transações vinculadas, exatamente como já rejeita `contribution`, e o
  pagamento ganha rota própria.

## Gaps identificados na spec e decisões técnicas propostas

Os pontos abaixo foram aprovados antes da implementação, após conferir o schema, as
policies, a camada Supabase autenticada e os padrões das Etapas 04–07. Nenhuma
decisão reintroduz Drizzle, `DATABASE_URL` ou service-role em runtime.

### 5. Definição de "período" e do vencimento no mês

Mês civil de `America/Sao_Paulo`, reaproveitando `resolveMonth`, `getMonthRange` e
`shiftMonth` de `lib/transactions/civil-date.ts`. Sem ciclo deslocado e sem
competência separada de vencimento.

`due_day` é um inteiro de 1 a 31. A data de vencimento do mês `M` é
`clamp(due_day, último dia de M)`: dia 31 vence em 28/29 de fevereiro e em 30 de
abril. Isso repete o "aniversário mensal ajustado ao fim do mês" já implementado e
testado em `calculate-goal-progress.ts` — consistência com o precedente vale mais do
que restringir a faixa a 1–28.

A página `/fixed-bills` abre no mês atual de São Paulo e aceita `?month=YYYY-MM`
estritamente validado, com navegação anterior/próximo, igual ao Dashboard. Todo
status é relativo ao **mês exibido**, nunca a "hoje" — exceto o aviso de vencimento
próximo, que só faz sentido no mês corrente (decisão 8).

### 6. Colunas, domínio e integridade de `fixed_bills`

A tabela existe desde a migration `0000` com RLS e as quatro policies (`0001`) e os
grants (`0003`), mas sem nenhuma constraint. A migration desta etapa faz preflight e
falha diante de dado incompatível, sem corrigir nem apagar:

| Coluna             | Decisão                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `name`             | `text not null`, normalizado sem espaços nas pontas, não vazio, ≤ 100 caracteres            |
| `due_day`          | trocar `numeric` por `integer not null`, CHECK `between 1 and 31`                            |
| `autopay`          | `boolean not null default false`, mantido                                                    |
| `estimated_amount` | passa a `not null`, CHECK `> 0`, `<> 'NaN'` e dentro de `numeric(12,2)`                      |
| `variable_amount`  | nova, `boolean not null default false` — o "valor variável (média)" do protótipo             |
| `category`         | nova, `text not null`, CHECK restrita ao domínio de despesa (as 10 categorias, sem `renda`)  |
| `started_on`       | nova, `date not null`, default `(timezone('America/Sao_Paulo', now()))::date`, derivada pelo banco |
| `created_at`       | mantido                                                                                      |

Imutáveis por trigger `SECURITY INVOKER` com `search_path` fixo e `EXECUTE` revogado
de `public`/`anon`/`authenticated`, espelhando `protect_goal_system_fields`:
`workspace_id`, `created_at` e `started_on`. Continuam editáveis nome, dia,
categoria, débito automático, estimativa e a flag de valor variável.

Índice `(workspace_id, name)` para a listagem. Sem unicidade de nome: duas contas
"Luz" para dois imóveis são legítimas.

`estimated_amount` é obrigatório nos dois modos. Em `fixed` é o valor previsto e
pré-preenche o pagamento; em `variable` é a média estimada **digitada pelo usuário**,
exibida com marcação de aproximação. A média não é calculada a partir do histórico de
pagamentos nesta etapa (ver nota de follow-up).

### 7. `transactions.fixed_bill_id` e validação cross-workspace desde o início

Nova coluna `fixed_bill_id uuid null references fixed_bills(id) on delete set null`,
mais:

- CHECK `fixed_bill_id is null or kind = 'expense'` — pagamento é sempre despesa,
  espelhando `transactions_goal_kind_check`;
- CHECK `not (fixed_bill_id is not null and goal_id is not null)` — um lançamento
  nunca é aporte e pagamento ao mesmo tempo;
- índice parcial `(workspace_id, fixed_bill_id, occurred_on desc)`
  `where fixed_bill_id is not null`, que sustenta a consulta de status da decisão 10.

Duas triggers, ambas na **mesma migration**, nunca uma como correção posterior:

```
validate_fixed_bill_link_on_insert
  before insert on transactions
  for each row when (new.fixed_bill_id is not null)

validate_fixed_bill_link_on_update
  before update of fixed_bill_id on transactions
  for each row when (new.fixed_bill_id is not null)
```

As duas leem `fixed_bills.workspace_id` pelo `new.fixed_bill_id` e rejeitam
(`errcode 23514`) quando a conta não existe ou pertence a outro workspace. Ambas
`SECURITY INVOKER`, com `search_path = public` e `EXECUTE` revogado.

Uma diferença deliberada em relação a Metas: a trigger de aporte **exige** `goal_id`
para todo `contribution`, porque aporte sem meta não existe. Aqui é o contrário —
despesa avulsa é o caso normal, então a validação é condicionada a
`fixed_bill_id is not null` pelo `WHEN`, em vez de exigir o vínculo. Esse mesmo
`WHEN` é o que permite ao `ON DELETE SET NULL` do FK executar quando a conta é
encerrada (decisão 12), pelo motivo já documentado em `0008`.

Mover a transação inteira para outro workspace continua impossível: a trigger de
imutabilidade de `workspace_id` da migration `0005` segue valendo.

### 8. Aviso de vencimento e valor exibido

Estados derivados por conta, para o mês exibido:

- **pago** — existe ao menos um pagamento vinculado no mês;
- **pendente** — nenhum pagamento e `hoje ≤ vencimento`;
- **vence em breve** — pendente, mês corrente, `0 ≤ vencimento − hoje ≤ 5`;
- **em atraso** — pendente, mês corrente, `vencimento < hoje`;
- em meses passados ou futuros, apenas **pago** / **não registrado** — "atraso" só
  faz sentido contra a data de hoje.

`autopay` é badge informativo e **não** presume pagamento: sem integração bancária,
marcar uma conta como paga porque "é automática" seria inventar dado financeiro. Ela
aparece como filtro (decisão 13) e como rótulo, nada além disso.

**O aviso mostra o valor estimado, sempre.** Um aviso "Luz vence em 3 dias" sem valor
não permite planejar o mês, que é a razão de existir da tela; o número já está no
banco e é o próprio usuário quem o digitou. A distinção visual carrega a incerteza em
vez de esconder o dado: `≈ R$ 180,00 previsto` para conta variável, `R$ 180,00
previsto` para fixa e, depois do pagamento, `R$ 194,32 pago em 05/08`. Quando
previsto e realizado divergem, a interface mostra os dois — é o "valor previsto vs.
realizado" do objetivo desta etapa.

### 9. Registrar pagamento

Formulário próprio ("Confirmar pagamento", vocabulário do protótipo), partindo do
card da conta. Não reutiliza `TransactionForm`: categoria vem da conta e o vínculo
vem do contexto, mesma decisão que Metas tomou para aporte.

Campos visíveis: valor (pré-preenchido com `estimated_amount`, editável), data do
pagamento e forma de pagamento (opcional, domínio existente). O servidor deriva
`kind='expense'`, a `category` da conta fixa, `goal_id=null`, `fixed_bill_id`,
autoria e workspace — nada disso vem do navegador.

Data pré-preenchida: hoje, se hoje estiver dentro do mês exibido; senão, o vencimento
daquele mês. Data futura é rejeitada, mesma regra de aporte — logo não se paga
adiantado um mês futuro.

O nome da conta **não** é copiado para `description`, pelas três razões já registradas
em Metas: duplicação, desatualização após edição e retenção do nome depois do
hard-delete.

Múltiplos pagamentos no mesmo mês são permitidos (pagamento parcial, correção). O
status é "pago" com pelo menos um; o realizado exibido é a **soma** do mês, com a
contagem quando maior que um. Um índice único parcial por
`(fixed_bill_id, date_trunc('month', occurred_on))` foi avaliado e descartado:
bloquearia casos legítimos e transformaria um erro de digitação em falha opaca de
banco.

### 10. Status derivado — leitura, agregação e performance

Mantida a agregação em JavaScript no servidor, o padrão validado nas Etapas 06–07.
`/fixed-bills` é Server Component: confirma a sessão com `auth.getUser()`, resolve o
workspace por `lib/workspace/repository.ts` e dispara duas consultas autenticadas em
paralelo:

1. `fixed_bills` do workspace com `started_on <= último dia do mês exibido`, apenas
   as colunas necessárias;
2. `transactions` com `workspace_id`, `kind='expense'`, `fixed_bill_id not null`,
   `occurred_on >= start` e `< endExclusive`, servida pelo índice parcial da
   decisão 7.

Um helper puro agrupa os pagamentos por `fixed_bill_id` num `Map` e deriva status,
previsto, realizado e aviso. O custo é linear no número de contas somado ao de
pagamentos do mês — dezenas de linhas, não milhares.

Não haverá view nem RPC. Elas criariam nova superfície de grants/RLS e o risco de uma
view sem `security_invoker` rodar com privilégio do owner — o mesmo motivo já
documentado na decisão 10 da Etapa 06 e reafirmado na 6 da Etapa 07. A rejeição aqui
é por conferência, não por inércia: o volume desta tela é menor que o do Dashboard,
que já roda assim. Se o volume real mudar, migrar para função autenticada exige
revisão de grants e testes novos de RLS.

Nenhuma consulta extra é necessária para o estado vazio: zero contas já distingue
"workspace sem conta fixa" de "mês sem pagamento", diferente do Dashboard.

### 11. Edição de conta fixa com pagamentos existentes

Mesmo princípio de Metas — recalcula, nunca reescreve histórico — com as
consequências explicitadas aqui em vez de descobertas em produção:

- alterar a **estimativa** muda apenas o previsto, em todos os meses; nenhum
  lançamento é tocado e o realizado permanece;
- alterar o **dia de vencimento** recalcula o vencimento de todos os meses, inclusive
  passados. Um mês que exibia "pago em dia" pode passar a exibir outra relação com a
  data. É aceitável precisamente porque nada disso é persistido: só o pagamento é, e
  ele não muda;
- alterar o **nome** muda o rótulo em toda a linha do tempo, já que ele não é
  duplicado na transação;
- alterar a **categoria** afeta apenas pagamentos futuros. Os já lançados mantêm a
  categoria com que foram registrados e o donut do Dashboard de meses passados não é
  reescrito. É a única assimetria do conjunto e recebe aviso explícito no formulário
  de edição;
- alterar `variable_amount` muda apenas a apresentação do previsto.

Nenhum status, previsto ou média é persistido como snapshot em lugar nenhum.

### 12. Encerrar recorrência

Hard-delete com `ON DELETE SET NULL` em `fixed_bill_id`, como fechado na decisão 4.
Os pagamentos continuam como `expense`, com categoria, valor e data intactos.

Diferença deliberada em relação ao aporte órfão: um aporte sem meta é incompreensível
na lista e por isso ganhou o rótulo "Aporte de meta excluída". Uma despesa sem conta
fixa **não é anômala** — é uma despesa comum e completa. Não haverá rótulo especial
nem tombstone, e ela volta a ser editável pelo editor genérico, que só a rejeita
enquanto o vínculo existe (S4). A confirmação informa quantos pagamentos ficarão
desvinculados.

### 13. Interface, navegação e filtros

Rota protegida `/fixed-bills` sob `app/(protected)/`, ligada por navegação a
Dashboard e Metas. Estado vazio, criação, cards por conta com nome, categoria,
vencimento do mês, badge de débito automático, previsto/realizado, status e destaque
de "vence em breve"/"em atraso". Ações: confirmar pagamento, editar conta
(`/fixed-bills/[id]/edit`) e encerrar recorrência.

Filtro de situação (todas / pendentes / pagas / automáticas) por query string
validada, aplicado em JavaScript sobre o conjunto já carregado, sem segunda ida ao
banco.

O filtro "Fixas × avulsas" do protótipo é resolvido pela existência da própria página,
mais uma marcação visual dos lançamentos vinculados na lista do Dashboard (o
`fixed_bill_id` já será lido), em vez de um filtro persistente no Dashboard.
**Divergência consciente do protótipo**, registrada aqui em vez de resolvida em
silêncio; a spec de implementação vence o protótipo por regra do `CLAUDE.md`.

Layout responsivo com CSS Modules por página, estados vazios e falhas genéricas,
mesmos padrões da Etapa 06.

### 14. Camada de aplicação e segurança das mutações

Módulos novos sob `lib/fixed-bills/`: `validate-fixed-bill.ts`,
`validate-bill-payment.ts`, `due-date.ts` (clamp e faixa de aviso),
`derive-bill-status.ts` (agregação pura), `repository.ts` (cliente Supabase
autenticado injetado), `load-dashboard.ts` e `load-edit.ts`. Server Actions finas em
`lib/actions/fixed-bills.ts`.

Cada action confirma a sessão novamente, resolve workspace e autoria no servidor,
valida por helper puro e filtra get/update/delete por `id + workspace_id` além da
RLS. Antes de registrar ou reatribuir um pagamento, a action confirma a conta de
destino por `id + workspace_id` — a trigger é a segunda linha de defesa, não a
primeira. Conta inexistente e invisível produzem o mesmo erro genérico. Nenhum log ou
mensagem carrega nome, categoria, valor ou corpo de formulário.

Mutação de pagamento revalida `/fixed-bills` e `/dashboard`; mutação apenas da conta
revalida `/fixed-bills`.

O pagamento tem rota própria de edição (`/bill-payments/[id]/edit`, simétrica a
`/contributions/[id]/edit`), permitindo corrigir valor, data e forma de pagamento,
reatribuir a outra conta fixa do mesmo workspace e hard-delete — desfazer o pagamento
devolve a conta ao estado pendente, sem entidade de estado a limpar. É esse caminho de
reatribuição que torna a trigger de `UPDATE` obrigatória desde já, e não opcional.

### 15. Portabilidade e documentação

`data-model-and-deletion.md` ganha a seção de integridade de contas fixas
(constraints, imutabilidade, as duas triggers, exclusividade entre `goal_id` e
`fixed_bill_id`, semântica do `SET NULL`). `data-portability.md` ganha o contrato de
exportação de `fixed_bills` — hoje as contas fixas só são citadas de passagem — e
`fixed_bill_id` entra no contrato de lançamentos. `lgpd-mapping.md` e os logs de
segurança são revisados; nenhum dado novo de pessoa é coletado, então a expectativa é
de revisão sem alteração.

## Subtarefas

- [x] 1. Registrar o plano aprovado neste documento e no índice, antes de escrever
      código
- [x] 2. Testes unitários primeiro (TDD): validação de conta fixa e de pagamento,
      clamp de vencimento em meses curtos, faixa de "vence em breve"/"em atraso",
      derivação de status por mês, previsto vs. realizado, múltiplos pagamentos e
      recálculo após edição
- [x] 3. Testes de compliance primeiro: constraints de `fixed_bills`, imutabilidade
      de `workspace_id`/`created_at`/`started_on`, `fixed_bill_id` só em `expense`,
      exclusividade com `goal_id`, insert com conta de outro workspace rejeitado,
      `UPDATE` de reatribuição cruzada rejeitado, encerrar recorrência preservando
      pagamentos com `fixed_bill_id=null`, CRUD cruzado e RLS
- [x] 4. E2E primeiro: estado vazio, criação, card com previsto e vencimento,
      confirmar pagamento e virar "pago", navegação de mês, aviso de "vence em
      breve", filtros de situação, edição de conta com pagamento existente,
      edição/reatribuição/hard-delete de pagamento, encerrar recorrência e viewport
      móvel
- [x] 5. `db/schema.ts` + migration com preflight: colunas e constraints de
      `fixed_bills`, `started_on`, `fixed_bill_id` em `transactions`, CHECKs, índice
      parcial, trigger de imutabilidade e as duas triggers de validação
      cross-workspace na mesma migration
- [x] 6. Helpers puros de vencimento e calendário (`due-date.ts`), reaproveitando
      `civil-date.ts`
- [x] 7. Validação pura de conta fixa e de pagamento, reaproveitando `money.ts`
- [x] 8. `derive-bill-status.ts` — agregação pura de pagamentos por conta e derivação
      de status, previsto, realizado e aviso
- [x] 9. `lib/fixed-bills/repository.ts` com cliente Supabase autenticado injetado
- [x] 10. Loaders de listagem mensal e de edição, incluindo o filtro de situação
       validado
- [ ] 11. Server Actions finas em `lib/actions/fixed-bills.ts`, com `revalidatePath`
- [ ] 12. Página `/fixed-bills`, navegação, formulários, cards, filtros e destaques
       visuais
- [ ] 13. Edição de conta fixa e ciclo de vida do pagamento
       (`/fixed-bills/[id]/edit`, `/bill-payments/[id]/edit`, hard-delete), ajuste do
       editor genérico e marcação no Dashboard (S4)
- [ ] 14. Layout responsivo, estados vazios e falhas genéricas
- [ ] 15. Atualizar modelo de dados, portabilidade e compliance aplicável, incluindo
       o registro da limitação S3
- [ ] 16. Validação final: migration no ambiente de teste, compliance, unitários, E2E
       sem skips, lint, TypeScript, build e sincronização Drizzle verdes

## Estratégia de commits

Conventional Commits em inglês, no imperativo e sem referência a IA. Cada commit
cobre um módulo ou arquivo lógico e inclui os testes escritos antes ou junto da
implementação correspondente; nenhuma implementação precede sua cobertura TDD.

## Notas

- Nota de arquitetura: esta etapa reaproveita deliberadamente o padrão de "entidade
  recorrente + transaction vinculada + trigger de validação de workspace" já
  implementado e testado em Metas (Etapa 07), evitando redesenhar do zero.
- Subtarefa 2 confirmada em vermelho com `npx vitest run tests/unit/fixed-bills`:
  quatro suítes falham somente porque os módulos `lib/fixed-bills/*` ainda não
  existem, antes de qualquer implementação. Os casos fixam o contrato de
  `resolveDueDate`/`countCivilDaysBetween` com clamp em meses curtos e janela de
  aviso de 5 dias, a validação de conta fixa (categoria de despesa obrigatória, dia
  1–31, estimativa obrigatória inclusive no modo variável, checkbox ausente como
  falso) e de pagamento (data futura rejeitada, forma de pagamento opcional do
  domínio persistido, vínculo uuid), e a derivação mensal de status — atraso/aviso/
  pendência só no mês corrente, `not_recorded` fora dele, soma de múltiplos
  pagamentos, pagamento fora do mês ou de conta desconhecida ignorado e recálculo
  após edição sem tocar no histórico lançado. Lint verde nos arquivos novos.
- Subtarefa 3 confirmada em vermelho contra o Supabase de teste com
  `npx vitest run tests/compliance/fixed-bill-integrity.test.ts`: 32 casos, 30
  falhando somente nas garantias ainda ausentes (colunas `category`,
  `variable_amount`, `started_on`, constraints, imutabilidade e
  `transactions.fixed_bill_id` com suas duas triggers) e 2 já verdes. Os dois verdes
  merecem ressalva: hoje eles passam pelo erro de coluna inexistente, não pelo
  controle que descrevem — "insert em workspace alheio" só provará a RLS e
  "dia fracionário" só provará o tipo `integer` depois da migration da subtarefa 5.
  A suíte cobre ainda a diferença deliberada em relação a Metas: despesa avulsa sem
  `fixed_bill_id` continua aceita, porque a trigger é condicionada ao vínculo em vez
  de exigi-lo. Os outros 5 arquivos de compliance permaneceram verdes (53 casos), e
  o `tsc --noEmit` só acusa os módulos `lib/fixed-bills/*` ainda inexistentes.
- Subtarefa 4 confirmada em vermelho com
  `npx playwright test tests/e2e/fixed-bills.spec.ts --workers=1`: oito cenários
  falham, o primeiro por timeout na navegação "Fixas" ainda inexistente, depois de a
  autenticação completar normalmente, e os outros sete já na fixture, porque as
  colunas de `fixed_bills` só chegam na subtarefa 5. A cobertura fixa estado
  vazio/criação, aviso de vencimento próximo, pagamento com valor pré-preenchido e
  reflexo no saldo, status relativo ao mês exibido, filtros de situação, edição
  recalculando previsto/vencimento sem tocar no realizado, ciclo de vida do
  pagamento com reatribuição e hard-delete devolvendo a conta a pendente,
  encerramento preservando a despesa comum e viewport móvel. Os 16 E2E existentes
  permaneceram verdes.
- Subtarefa 5 implementada em `0009_fixed_bills_integrity.sql`, com `fixed_bills`
  movida no schema para antes de `transactions`, que agora a referencia. O preflight
  falha se existir qualquer linha em `fixed_bills`: `category` passou a ser
  obrigatória e não tem origem histórica possível, porque a tabela nunca foi escrita
  pela aplicação — um backfill ali seria inventar dado financeiro, então a migration
  para e exige decisão explícita. A trigger de vínculo é uma função única servindo
  duas triggers, `BEFORE INSERT` e `BEFORE UPDATE OF fixed_bill_id`, ambas com
  `WHEN (new.fixed_bill_id IS NOT NULL)` — o mesmo `WHEN` que deixa o
  `ON DELETE SET NULL` gravar `NULL` ao encerrar a recorrência. Migration aplicada no
  Supabase de teste; os 32 casos de compliance de contas fixas ficaram verdes, e uma
  segunda geração Drizzle confirmou schema, migration e snapshot sincronizados.
- Regressão encontrada e corrigida na mesma subtarefa: a fixture de
  `cascade-deletion.test.ts` inseria conta fixa sem `category` nem
  `estimated_amount`, o que as novas colunas obrigatórias passaram a rejeitar. A
  fixture foi ajustada (e `due_day` deixou de ser string), sem afrouxar nenhuma
  asserção do teste. Toda a pasta de compliance voltou verde (83/83 em 6 arquivos),
  com 288 unitários verdes, lint, TypeScript e build de produção também verdes; os
  únicos vermelhos restantes são as quatro suítes de `lib/fixed-bills/*` ainda não
  implementadas.
- Subtarefa 6 implementada em `lib/fixed-bills/due-date.ts`, consumindo
  `isValidMonth`/`isValidCivilDate` da Etapa 06: vencimento preso ao último dia em
  meses curtos, diferença de dias com sinal ancorada em meia-noite UTC (sem depender
  do fuso do servidor) e a janela de aviso centralizada em `DUE_SOON_WINDOW_DAYS`.
  Dia fora da faixa, não inteiro, mês ou data civil inválidos são erro de
  programação (`RangeError`), não estado de formulário. O cálculo do último dia do
  mês ficou local em vez de compartilhado com `calculate-goal-progress.ts`: as duas
  assinaturas diferem e mexer no módulo de metas já fechado custaria mais do que as
  duas linhas duplicadas. Suíte verde (19/19), lint e TypeScript verdes.
- Subtarefa 7 implementada em `validate-fixed-bill.ts` e `validate-bill-payment.ts`,
  reaproveitando o parser monetário, o domínio de categorias e o de formas de
  pagamento da Etapa 06. A categoria da conta é validada por
  `deriveTransactionKind(...) === "expense"`, o que rejeita `renda` pela mesma regra
  que o banco aplicaria depois, em vez de por uma lista paralela que poderia
  divergir. Dia de vencimento aceita só dígitos, descartando `5.5` e `5,5` antes de
  virar número. Caixa de seleção ausente vira `false` sem erro de campo, porque
  checkbox não marcada não chega no `FormData`. Pagamento futuro é rejeitado e
  retroativo permitido, mesma regra do aporte; `today` inválido é `RangeError`, não
  estado de formulário. Nenhum retorno ecoa o input inválido. Suítes verdes (50/50),
  lint e TypeScript verdes.
- Subtarefa 8 implementada em `derive-bill-status.ts`: a agregação preserva a ordem
  das contas e dos pagamentos, descarta vínculos desconhecidos e lançamentos fora do
  mês, soma valores em centavos com guarda de inteiro seguro e dá precedência ao
  estado pago. Contas sem pagamento só recebem atraso, aviso ou pendência no mês
  corrente; nos demais meses ficam como não registradas. Referências civis inválidas
  e valores monetários não positivos falham explicitamente, sem fabricar totais. A
  pasta unitária de contas fixas ficou verde (84/84 em 4 arquivos), com lint sem
  avisos e TypeScript sem erros.
- Subtarefa 9 implementou `lib/fixed-bills/repository.ts` com cliente Supabase
  autenticado injetado e colunas explícitas: contas são limitadas por
  `workspace_id` e `started_on`; pagamentos exigem também `kind='expense'`, vínculo
  não nulo e intervalo civil do mês. Get, update e delete reforçam `id +
  workspace_id`, e as mutações de pagamento ainda limitam a linha ao tipo e vínculo
  esperados. Payloads excluem auxiliares em centavos e campos sistêmicos; categoria,
  tipo, ausência de meta, autoria e workspace são derivados no servidor. Erros do
  Supabase viram apenas `query_failed`, e ausência/invisibilidade têm o mesmo
  resultado. Os 12 testes do repositório e toda a pasta unitária de contas fixas
  ficaram verdes (96/96 em 5 arquivos), com lint sem avisos e TypeScript sem erros.
- Subtarefa 10 implementou os loaders de listagem mensal e edição. Depois de resolver
  o workspace, a listagem valida mês e filtro estritamente, dispara em paralelo a
  consulta de contas iniciadas até o fim do mês e a de pagamentos no intervalo,
  deriva status e totais no servidor e só então aplica em memória `todas`,
  `pendentes`, `pagas` ou `automaticas`. A contagem total permanece separada do
  resultado filtrado para distinguir workspace sem conta de filtro sem resultado.
  Os loaders de edição reforçam o mesmo workspace e tornam dado ausente, invisível
  ou falha de consulta indistinguíveis. Os 13 casos novos e toda a pasta unitária de
  contas fixas ficaram verdes (109/109 em 7 arquivos), com lint sem avisos e
  TypeScript sem erros.
- **Decisão de cobertura E2E:** só o estado "vence em breve" é construível em
  qualquer dia do mês (vencimento entre hoje e hoje+2, com o clamp prendendo no
  último dia). "Em atraso" exige hoje ≥ dia 2 e "pendente" exige mais de cinco dias
  até o fim do mês, então dependeriam da data em que a suíte roda. A matriz completa
  de status fica nos testes unitários, onde a data de referência é parâmetro; o E2E
  verifica a ligação da UI com o destaque e a relatividade ao mês exibido.
- **Follow-up futuro:** cálculo automático de média real a partir do histórico de
  pagamentos para contas de valor variável — avaliado e conscientemente adiado nesta
  etapa por simplicidade. Retomar se o uso real mostrar que a estimativa manual
  diverge muito do valor real ao longo do tempo.
