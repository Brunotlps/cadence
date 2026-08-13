# Etapa 14 — Contas fixas pendentes no Dashboard e grid contido em Metas/Fixas

**Status:** concluído
**Aberto em:** 13/08/2026
**Concluído em:** 13/08/2026
**Depende de:** Etapas 09–13 (fundação, polimento, login, mobile e refinamento de
interação concluídos)

## Objetivo

Dois ajustes independentes, pedidos juntos pelo usuário:

1. Mostrar contas fixas pendentes do mês (a vencer ou em atraso) dentro da seção
   "Lançamentos do mês" do Dashboard, além da tela própria de Contas fixas — de
   forma discreta, sem se misturar com dinheiro já movimentado.
2. Conter a largura dos cards de Metas e Contas fixas, hoje esticados para
   preencher toda a linha quando há poucos itens na tela.

A etapa preserva regras financeiras, Server Actions, schema, RLS e os três
destinos persistentes. Não adiciona rota, campo, ação de pagamento nova no
Dashboard nem dado coletado.

## Diagnóstico confirmado

- Contas fixas **pagas** já aparecem em "Lançamentos do mês": o pagamento vira uma
  transação real (`fixed_bill_id` preenchido) e a linha já mostra o badge "Conta
  fixa" (`dashboard/page.tsx:213-217`). O que falta é a conta **pendente** (ainda
  sem pagamento) — hoje só visível em `/fixed-bills`.
- `lib/fixed-bills/derive-bill-status.ts` já resolve isso: status
  `pending`/`due_soon`/`overdue` só existem quando `reference.month` é o mês atual
  (`isCurrentMonth`); em qualquer outro mês, uma conta sem pagamento cai em
  `not_recorded`. Reaproveitar essa função entrega de graça o comportamento certo
  ao navegar entre meses no Dashboard — não é preciso tratar isso à parte.
- `loadTransactionDashboard` (`lib/transactions/load-dashboard.ts`) e
  `loadFixedBillsDashboard` (`lib/fixed-bills/load-dashboard.ts`) chamam
  `getCurrentWorkspace` cada um independentemente. Em vez de compor os dois
  loaders na página, `loadTransactionDashboard` passa a buscar
  `listFixedBills`/`listBillPayments` também, em paralelo com
  `listMonthlyTransactions`, reaproveitando o único `getCurrentWorkspace` já
  chamado ali.
- `goals.module.css:41` e `fixed-bills.module.css:75` usam
  `grid-template-columns: repeat(auto-fit, minmax(min(100%, Xrem), 1fr))`. Com
  `auto-fit` + `1fr`, colunas vazias colapsam e o espaço liberado é redistribuído
  para os cards existentes — com 1 ou 2 itens em tela larga, o card estica até
  preencher a linha inteira (até `--content-width`, 76rem), esticando também
  barra de progresso, badges e ações internas. Confirmado por leitura do CSS, sem
  necessidade de captura visual para diagnosticar (é o comportamento padrão do
  `auto-fit`).

## Decisões fechadas

### 1. Escopo exato

Entram: `lib/transactions/load-dashboard.ts`, `app/(protected)/(workspace)/dashboard/`
(page + CSS module), `goals.module.css`, `fixed-bills.module.css`.

Não entram: ação de pagar conta fixa a partir do Dashboard (continua só em
`/fixed-bills`), mudança na tela de Contas fixas além do CSS do grid, mudança de
schema/RLS, nova rota.

### 2. Contas fixas pendentes — subseção discreta

Dentro do card "Lançamentos do mês", depois da lista de lançamentos (ou do estado
vazio), uma subseção separada por divisor pontilhado: "Contas fixas pendentes"
com contador, listando nome, um rótulo de status curto ("vence dia D" /
"em atraso") e o valor estimado (prefixo "≈" quando `variableAmount`). Sem ação de
editar/pagar inline — um único link "Ver contas fixas" no fim da subseção leva a
`/fixed-bills`. A subseção não aparece quando a lista de pendentes está vazia
(inclusive em meses que não são o atual, onde o status nunca é
`pending`/`due_soon`/`overdue`). Não conta para "X no período" nem afeta o saldo
do mês — são só um lembrete, nunca uma transação.

### 3. Grid de Metas e Contas fixas — contido, não esticado

Troca `minmax(min(100%, Xrem), 1fr)` por um teto de largura sem `1fr`
(`minmax(Xrem, Yrem)`), mantendo `auto-fit` só para permitir múltiplas colunas em
telas largas sem esticar cards isolados. Cards continuam responsivos até a
largura mínima já testada em 320/390 px — só o teto muda.

### 4. Testes

- `tests/unit/transactions/load-dashboard.test.ts` recebe casos para
  `pendingFixedBills`: inclui pending/due_soon/overdue, exclui paid e
  not_recorded, ordena por vencimento.
- `tests/e2e/transactions-dashboard.spec.ts` recebe um caso com uma conta fixa
  pendente (aparece na subseção) e uma paga (aparece na lista principal com o
  badge já existente, não na subseção).
- Sem novo teste E2E dedicado ao grid — é CSS puro; validado por inspeção visual
  em 1024/1440 px com 1 e com 2 itens.

### 5. Segurança, privacidade e documentação

Nenhum dado novo, nenhuma query fora do workspace do usuário autenticado (RLS já
cobre `fixed_bills`/`transactions`), nenhuma mudança de schema ou policy.

## Subtarefas

- [x] 1. Registrar este plano e atualizar o índice em `docs/planning/README.md`
- [x] 2. Estender `loadTransactionDashboard` com `pendingFixedBills`, com teste
      unitário em vermelho antes
- [x] 3. Renderizar a subseção no Dashboard, com teste E2E em vermelho antes
- [x] 4. Ajustar o grid de Metas e Contas fixas (CSS)
- [x] 5. Inspecionar 1024/1440 px com 1 e 2 itens, e o Dashboard com contas
      pendentes/pagas
- [x] 6. Validação final: unitários, compliance, E2E sem skips, lint, TypeScript e
      build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Plano primeiro;
loader e contrato de vermelho depois; UI do Dashboard em commit próprio; grid de
Metas/Fixas em commit próprio; conclusão documental por último.

## Notas

- Decisão de posicionamento (subseção discreta separada, em vez de intercalar na
  mesma lista por data) confirmada com o usuário em 13/08/2026.
- Grid: a troca de `auto-fit` para `auto-fill` sem `1fr` foi confirmada por
  inspeção visual (1 meta em 1024/1440 px, 2 contas fixas em 1024/1440 px) — o
  card isolado mantém uma largura confortável (~26rem) em vez de esticar até
  preencher os 76rem do container, sem regressão nos testes de overflow em
  320/390 px já existentes.
- Validação final: 458/458 testes Vitest verdes em 49 arquivos (incluindo
  compliance); 44/44 E2E aprovados sem skips; lint sem avisos, TypeScript sem
  erros, build de produção verde. Nenhum arquivo de schema, migration ou RLS
  foi alterado.
- Inspeção visual usou fixtures descartáveis do Supabase de teste contra o
  servidor de desenvolvimento local; todos os usuários temporários foram
  apagados ao final e o servidor foi encerrado.
