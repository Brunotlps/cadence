# Etapa 15 — Ajustes finos: botões de criação e contas fixas no Dashboard

**Status:** planejado
**Aberto em:** 13/08/2026
**Depende de:** Etapa 14 (contas fixas pendentes no Dashboard e grid contido)

## Objetivo

Dois ajustes pontuais pedidos pelo usuário logo após a Etapa 14:

1. Encolher os gatilhos "Criar meta" e "Nova conta fixa", hoje esticados à
   largura total da página mesmo com um formulário simples dentro.
2. Simplificar a área de contas fixas no Dashboard: em vez de só "pendentes",
   duas subseções — pendentes e pagas — mostrando somente nome e uma data
   (vencimento ou pagamento), sem valor.

## Diagnóstico confirmado

- `goals.module.css:17-19` e `fixed-bills.module.css:51-53` — a classe `.create`
  (usada no `RevealPanel` de "Criar meta"/"Nova conta fixa") herda `.card`, que só
  define `padding`, sem teto de largura. Como esses painéis não estão dentro do
  `.grid` corrigido na Etapa 14, continuam esticados a `--content-width` (76rem)
  inteiro — tanto o botão fechado quanto o formulário aberto (que é uma única
  coluna, `form-controls.module.css:1-4`), deixando cada campo de input
  visualmente esticado também.
- No Dashboard, a subseção "Contas fixas pendentes" (Etapa 14) mostra nome,
  status ("Vence dia D" / "Em atraso") e valor estimado. O pedido agora é
  remover o valor de qualquer subseção de contas fixas e acrescentar uma
  segunda subseção só para as pagas no mês — nome e dia do pagamento. O valor
  pago continua visível de qualquer forma na lista principal de lançamentos
  (linha da transação com o badge "Conta fixa"), então não se perde informação.

## Decisões fechadas

### 1. Escopo exato

Entram: `goals.module.css`, `fixed-bills.module.css` (só a classe `.create`),
`lib/transactions/load-dashboard.ts`, `app/(protected)/(workspace)/dashboard/`
(page + CSS module).

Não entram: schema, RLS, Server Actions, formulários em si (`GoalForm`,
`FixedBillForm` continuam iguais por dentro), remoção do valor da lista
principal de lançamentos.

### 2. Botões de criação — largura contida

`.create` ganha um teto de largura igual ao teto já usado no grid de cada
página: 26rem em Metas, 22rem em Contas fixas. Sem mudança de padding, fonte ou
comportamento — só a largura do container passa a acompanhar a dos cards
abaixo, fechado ou aberto.

### 3. Contas fixas no Dashboard — pendentes e pagas, sem valor

`PendingFixedBill` perde `category`, `autopay`, `variableAmount` e
`estimatedCents` — campos que só existiam para renderizar o valor, agora fora
de escopo. Fica só `{ id, name, dueOn, status }`.

Novo tipo `PaidFixedBill = { id, name, paidOn }`, derivado das mesmas contas e
pagamentos já buscados (`deriveBillStatuses` já calcula `status: "paid"` e
`payments`), sem query adicional. Quando uma conta tem mais de um pagamento no
mês (caso raro), usa o mais recente (`payments[0]`, já ordenado por
`listBillPayments`).

No Dashboard, duas subseções dentro do mesmo card "Lançamentos do mês", cada
uma só aparecendo se tiver item: "Contas fixas pendentes" (nome + "Vence dia D"
ou "Em atraso", cor de aviso/perigo herdada da Etapa 14) e "Contas fixas pagas"
(nome + "Pago em DD/MM"). Nenhuma delas mostra valor. A lista principal de
lançamentos continua exibindo o valor pago normalmente — nada muda lá.

### 4. Testes

- `tests/unit/transactions/load-dashboard.test.ts`: atualiza os casos de
  `pendingFixedBills` para o tipo reduzido; adiciona casos para
  `paidFixedBills` (inclui pagas do mês, ordena por data de pagamento, usa o
  pagamento mais recente quando há mais de um).
- `tests/e2e/transactions-dashboard.spec.ts`: atualiza o teste existente para
  não esperar mais valor nas subseções; acrescenta a conta paga aparecendo em
  "Contas fixas pagas" com a data certa.
- Sem novo teste E2E para a largura dos botões de criação — CSS puro, validado
  por inspeção visual.

### 5. Segurança, privacidade e documentação

Nenhum dado novo, nenhuma query adicional, nenhuma mudança de schema/RLS.

## Subtarefas

- [ ] 1. Registrar este plano e atualizar o índice em `docs/planning/README.md`
- [ ] 2. Atualizar testes unitários de `load-dashboard.ts` (vermelho) e ajustar
      o loader (`pendingFixedBills` reduzido + `paidFixedBills` novo)
- [ ] 3. Atualizar o teste E2E do Dashboard (vermelho) e renderizar as duas
      subseções sem valor
- [ ] 4. Conter a largura de `.create` em Metas e Contas fixas
- [ ] 5. Inspecionar visualmente os dois ajustes
- [ ] 6. Validação final: unitários, compliance, E2E sem skips, lint,
      TypeScript e build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Plano
primeiro; loader e contrato de vermelho depois; UI do Dashboard em commit
próprio; largura dos botões de criação em commit próprio; conclusão
documental por último.
