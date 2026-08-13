# Etapa 13 — Refinamento de interação, acessibilidade e landing page

**Status:** planejado
**Aberto em:** 13/08/2026
**Depende de:** Etapas 09–12 (fundação, polimento por tela, login e mobile concluídos)

## Objetivo

Corrigir dois bugs de comportamento confirmados por inspeção ao vivo do fluxo
principal, estender às cinco telas de conta o padrão de acessibilidade de erro de
campo e de título de rota que `/login` já usa, e transformar a homepage `/` — hoje
um beco sem saída — em uma landing page real. A etapa preserva regras financeiras,
Supabase Auth, sessão, Server Actions, schema, RLS, logs e mensagens genéricas de
segurança. Não adiciona coleta, analytics, dependência runtime ou rota nova além da
própria `/`.

## Diagnóstico confirmado

Auditoria de UI/UX (13/08/2026) com fixtures descartáveis contra o servidor local e
inspeção direta de código:

- `components/app-shell/accent-color-form.tsx:103-105` — cada `onChange` do radio de
  cor (inclusive os disparados por navegação por seta do teclado, não só clique)
  chama `event.currentTarget.form?.requestSubmit()`; o sucesso fecha o painel
  (`:35`). Confirmado ao vivo: a primeira tecla de seta já fecha o painel antes de o
  usuário alcançar a opção pretendida.
- `components/transactions/transaction-form.tsx` — todos os campos usam
  `defaultValue` (não controlados: `:71,90,119,156,181`) e nada remonta os inputs
  quando `state.success` fica verdadeiro (`:212-216`). Confirmado ao vivo: o campo
  Valor manteve o número digitado após um envio bem-sucedido. Aplica-se de fato só
  ao composer do Dashboard (`createTransactionAction` não redireciona, só chama
  `revalidatePath`) — a edição (`updateTransactionAction`) já redireciona após
  sucesso (`lib/actions/transactions.ts:119-120`), então lá o componente é
  desmontado e o problema não é observável.
- `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`,
  `app/confirm-email/page.tsx`, `app/(protected)/onboarding/workspace/page.tsx` — a
  mensagem de erro/status tem `role="alert"`/`role="status"` mas nenhum `id`; nenhum
  input usa `aria-invalid`/`aria-describedby`. `app/login/page.tsx:65-66,79-80`
  já faz isso corretamente e é o padrão a replicar. Nem todas as cinco telas têm de
  fato um estado de erro por campo hoje: `RequestPasswordResetState` e
  `ResendConfirmationState` (`lib/actions/auth.ts:90,122`) só têm `message`, nunca
  `error` — decisão deliberada de anti-enumeração (Etapa 05). Só `SignUpState`,
  `UpdatePasswordState` (`lib/actions/auth.ts:42,105`) e `CreateWorkspaceState`
  (`lib/actions/workspace.ts:7`) têm `error`. E, de fato, `create_workspace_with_owner`
  (`db/migrations/0001_rls-and-security-definer-functions.sql:123-141`) e a tabela
  `workspaces` não têm nenhuma validação de nome hoje — o caminho de erro do
  onboarding só é alcançável por falha de infraestrutura, não por entrada de
  usuário, então não há um cenário de "vermelho" reproduzível via UI para ele.
- Nenhuma dessas cinco rotas, nem a homepage, tem `layout.tsx` próprio — todas
  herdam o `<title>` genérico `"Cadence"` do `app/layout.tsx`. Só `/login` tem
  `layout.tsx` com metadata própria.
- `app/page.tsx` (5 linhas): `<h1>Cadence</h1>` + parágrafo "em construção", sem
  CSS, sem link para `/login` ou `/signup`. Único ponto do produto sem caminho de
  volta ao fluxo autenticado. A Etapa 12 já registrou que transformar `/` em landing
  page "exige uma decisão de produto própria" e a deixou fora de escopo — essa
  decisão foi tomada agora (13/08/2026): `/` vira landing page real.

## Decisões fechadas

### 1. Escopo exato

Entram: o seletor de cor de destaque (`accent-color-form.tsx`), o composer de
lançamento do Dashboard (`transaction-form.tsx`), as cinco telas de conta sem
`/login` (signup, confirm-email, forgot-password, reset-password,
onboarding/workspace) e a homepage `/`.

Não entram: schema, RLS, Server Actions existentes (só o componente que as consome
muda), nova rota, novo método de autenticação, analytics, cookie, gesto oculto ou
qualquer decisão de produto além da conversão de `/` em landing page.

### 2. Seletor de cor — não fechar por navegação de teclado

O painel não fecha mais a cada `onChange`. A seleção por teclado (setas dentro do
`radiogroup` nativo) só persiste depois de uma pausa curta sem nova mudança
(debounce), preservando o comportamento de "sem botão salvar explícito" já
decidido na Etapa 09/12. Clique direto em uma opção continua submetendo — o
debounce não é perceptível nesse caso porque não há mudanças subsequentes.
Fechamento por sucesso, clique externo, `Escape` e mudança de rota continuam como
estão.

### 3. Composer de lançamento — reset após sucesso

`TransactionForm` remonta os campos não controlados (via `key` ligada a um
contador de envios bem-sucedidos) quando `state.success` passa a verdadeiro. Para
o composer do Dashboard, isso limpa os campos para os valores iniciais vazios
enviados pelo componente pai. Para a edição, o mesmo mecanismo é inofensivo — a
rota já redireciona antes de o usuário ver qualquer diferença.

### 4. Paridade de acessibilidade nas telas de conta

As três telas com estado de erro real (`signup`, `reset-password`,
`onboarding/workspace`) passam a associar a mensagem de erro por `id` ao input
correspondente via `aria-describedby`, e a marcar `aria-invalid` quando há erro —
replicando exatamente o padrão de `login/page.tsx`, sem herdar sua composição de
duas colunas (elas usam `AuthShell`, que não muda de estrutura).
`confirm-email` e `forgot-password` não têm campo em estado de erro hoje (só
`message`/`status`, por desenho anti-enumeração), então não recebem essa
mudança — só a de título (item 5).

### 5. Título de rota nas cinco telas de conta e na homepage

Cada uma das cinco rotas ganha um `layout.tsx` com `metadata.title` próprio,
seguindo o padrão de `app/login/layout.tsx` (`"Ação | Cadence"`). A homepage usa a
metadata já existente em `app/layout.tsx` (já é adequada para a raiz do site).

### 6. Homepage como landing page

`/` deixa de ser um stub e passa a apresentar o produto e a levar para `/login` e
`/signup`, reaproveitando exatamente a mensagem de marca já usada em
`login/page.tsx` (`"Seu dinheiro, no seu ritmo."`, a lista Dashboard/Metas/Contas
fixas, e a frase de privacidade) — sem inventar copy de marketing nova, sem
depoimento, sem métricas, sem formulário de captura de e-mail e sem qualquer
elemento que colete dado. Estilo minimalista, alinhado aos tokens de
`design-tokens.css` já em uso, sem nova dependência visual. Não é uma decisão de
onboarding: usuário autenticado que acessa `/` continua indo para `/dashboard`
pelo fluxo que já existe (login → shell), a landing page é só a porta de entrada
pública.

### 7. Testes

Estende os specs existentes em vez de criar arquivos novos onde fizer sentido:

- `tests/e2e/visual-polish.spec.ts` ou `mobile-experience.spec.ts` (avaliar o mais
  próximo do contrato) recebe o caso de teclado no seletor de cor: setas até a
  terceira opção, aguardar o debounce, e confirmar que a cor persistida é a
  terceira, não uma intermediária.
- `tests/e2e/transactions-dashboard.spec.ts` recebe o caso de reset do composer:
  enviar um lançamento e confirmar que o campo Valor volta a vazio.
- `tests/e2e/auth-flow.spec.ts` recebe a asserção de `aria-describedby` resolvendo
  para um elemento presente em erro real de `signup` (senha curta) e
  `reset-password` (senha curta) — os dois únicos casos de erro por campo
  reproduzíveis via UI. `onboarding/workspace` recebe a mesma correção de código,
  por consistência, sem um contrato de vermelho dedicado (nenhuma entrada de
  usuário alcança hoje o estado de erro dessa tela).
- Novo `tests/e2e/homepage.spec.ts`: título, link acessível para `/login`, sem
  coleta de dado, sem overflow em 320/1440 px.

Sem snapshot pixel a pixel — contratos de geometria, semântica e comportamento,
complementados por inspeção visual em 320/390/1440 px e nas três paletas de cor.

### 8. Segurança, privacidade e documentação

Nenhum dado, finalidade, persistência, query, cookie, log, schema, policy ou
retenção nova. A landing page não injeta script, não faz fetch de terceiro e não
coleta e-mail. Nenhum documento de `docs/compliance/` precisa de atualização nesta
etapa — a exceção de retenção de contas não confirmadas (já registrada em
`security-exceptions.md`) não é afetada.

## Estrutura prevista

```text
app/
├── page.tsx                              (reescrita — landing page)
├── page.module.css                       (novo)
├── signup/layout.tsx                     (novo)
├── confirm-email/layout.tsx              (novo)
├── forgot-password/layout.tsx            (novo)
├── reset-password/layout.tsx             (novo)
└── (protected)/onboarding/workspace/layout.tsx  (novo)

components/
├── app-shell/accent-color-form.tsx       (debounce no submit por teclado)
└── transactions/transaction-form.tsx     (reset por key após sucesso)

tests/e2e/
└── homepage.spec.ts                      (novo)
```

## Subtarefas

- [ ] 1. Registrar este plano e atualizar o índice em `docs/planning/README.md`
- [ ] 2. Escrever/estender contratos E2E (teclado no seletor, reset do composer,
      `aria-describedby` nas cinco telas, homepage) e confirmar o vermelho
- [ ] 3. Corrigir `accent-color-form.tsx` (debounce de submit por teclado)
- [ ] 4. Corrigir `transaction-form.tsx` (reset por `key` após sucesso)
- [ ] 5. Aplicar `aria-invalid`/`aria-describedby` nas cinco telas de conta
- [ ] 6. Criar os cinco `layout.tsx` com título de rota
- [ ] 7. Reescrever a homepage como landing page
- [ ] 8. Inspecionar 320/390/1440 px e as três paletas de cor
- [ ] 9. Validação final: unitários, compliance, E2E sem skips, lint, TypeScript e
      build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Plano primeiro;
contratos E2E em vermelho depois; cada correção de componente e cada bloco de
telas de conta em commits lógicos separados; landing page em commit próprio;
conclusão documental por último.

## Notas

- Auditoria e testes usaram somente fixtures sintéticas descartáveis; nenhum dado
  pessoal ou financeiro real foi registrado.
- Nenhuma decisão das Etapas 04–12 é reaberta, exceto a decisão explicitamente
  adiada na Etapa 12 sobre o destino de `/`, agora resolvida a favor de landing
  page.
