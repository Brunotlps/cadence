# Etapa 10 — Polimento visual por tela

**Status:** concluído
**Aberto em:** 11/08/2026
**Plano aprovado em:** 11/08/2026
**Concluído em:** 11/08/2026
**Depende de:** Etapa 09 (fundação visual concluída: shell persistente, tokens e
cor de destaque por pessoa)

## Objetivo

Fazer um passe de consistência visual, linguagem, responsividade e acessibilidade
sobre as 3 rotas principais já funcionais: Dashboard, Metas e Contas fixas.
Lançamentos permanece como seção do Dashboard; as rotas protegidas de edição também
entram no polimento para que o fluxo não perca consistência ao sair da página
principal.

Esta etapa não altera regras financeiras, schema, RLS, cálculos, exportação ou
Server Actions. A referência visual orienta composição e linguagem, mas as decisões
de produto registradas nas Etapas 06–09 continuam prevalecendo.

## Panorama da fundação existente

A Etapa 09 entregou o shell responsivo, os três destinos persistentes, os tokens
centrais e as três paletas aplicadas no HTML inicial. A auditoria da implementação
identificou os seguintes pontos de polimento:

- cabeçalhos, cards, navegação mensal e estados de erro repetidos com medidas
  diferentes entre páginas;
- estilos de formulário equivalentes mantidos em três CSS Modules;
- cinco confirmações destrutivas repetindo a mesma estrutura de diálogo;
- `RevealPanel` localizado sob Metas apesar de também ser usado em Contas fixas;
- ausência de `loading.tsx` e `error.tsx` próprios do grupo financeiro;
- estados vazios e microcopy com profundidade desigual entre as três rotas;
- associação incompleta entre alguns campos e suas mensagens de erro;
- responsividade coberta em 390 px, mas ainda sem contrato explícito de reflow em
  320 px;
- alguns estados comunicados por conteúdo CSS ou por cor, em vez de texto real no
  DOM.

## Decisões fechadas

### 1. Escopo exato

Entram:

- `/dashboard`, incluindo criação e listagem de Lançamentos;
- `/goals` e `/goals/[id]/edit`;
- `/contributions/[id]/edit`;
- `/fixed-bills` e `/fixed-bills/[id]/edit`;
- `/bill-payments/[id]/edit`;
- `/transactions/[id]/edit`;
- shell e estados compartilhados que envolvem essas rotas.

Autenticação e onboarding ficam fora. Não haverá rota `/transactions`, filtro por
pessoa, divisão de gastos entre membros, saldo acumulado, feature nova ou mudança de
semântica importada apenas do protótipo.

### 2. Fonte de verdade da linguagem

A precedência permanece:

1. specs de implementação em `docs/planning/`;
2. vocabulário em `docs/design/README.md`;
3. protótipo visual.

O tom será casual porém formal, com texto neutro que funcione para uma pessoa ou um
workspace compartilhado. A interface não presume casal nem usa nomes de membros.
Verbos ficam consistentes: Registrar lançamento, Criar/Salvar meta, Salvar aporte,
Nova/Salvar conta fixa, Confirmar/Salvar pagamento e Encerrar recorrência.

Mensagens de registro ausente, invisível por RLS ou falha de query continuam
genéricas e indistinguíveis. O polimento não pode recriar oráculos de existência.

### 3. Componentes compartilhados, sem biblioteca nova

Criar somente abstrações comprovadamente repetidas sob `components/ui/`:

```text
components/ui/
├── page-header.tsx
├── month-navigation.tsx
├── feedback-state.tsx
├── reveal-panel.tsx
├── confirm-dialog.tsx
├── page-patterns.module.css
├── form-controls.module.css
└── confirm-dialog.module.css
```

Cada componente recebe apenas texto, links e conteúdo de apresentação. Não faz
fetch, não conhece Supabase e não recebe dado financeiro além do que seus filhos já
renderizam. As actions específicas permanecem nos módulos de domínio.

Não será criada biblioteca genérica de design, Tailwind, CSS-in-JS, pacote de ícones
ou dependência runtime. Uma abstração só entra quando for consumida em pelo menos
dois contextos reais.

### 4. Estados de vazio, erro e carregamento

`app/(protected)/(workspace)/loading.tsx` fornecerá um estado imediato e leve,
mantendo o shell compartilhado navegável. O esqueleto não usa valores financeiros
fictícios nem animação obrigatória.

`app/(protected)/(workspace)/error.tsx` tratará exceções inesperadas com mensagem
genérica e ação de tentar novamente. Por ser Client Component, não logará o objeto
`Error`, mensagem bruta ou dado de request no navegador ou servidor. Erros esperados
dos loaders continuam modelados como retorno e usam o mesmo componente visual sem
exibir causa técnica.

Estados vazios compartilham composição, mas preservam texto e ação específicos por
rota. Registros inexistentes ou invisíveis nas edições não mudam para `notFound()`:
continuam indistinguíveis pelo mesmo guardrail das Etapas 06–08.

### 5. Hierarquia e microcopy por rota

**Dashboard:** workspace como contexto, mês como navegação, criação de lançamento
como ação primária, resumo financeiro e donut como leitura rápida, lista mensal como
histórico. O CTA passa a usar “Registrar lançamento”, conforme o vocabulário oficial.

**Metas:** título curto, explicação de que o ritmo é uma referência, progresso e
conclusão legíveis sem depender de cor, aportes recentes e ações secundárias com
hierarquia consistente.

**Contas fixas:** explicação de previsto versus realizado, filtros e mês alinhados,
status semântico em texto real, vencimento e valores priorizados, pagamento como
ação primária e edição/encerramento como ações secundárias.

**Edições:** mesmo cabeçalho, largura, card, feedback, cancelar e ação destrutiva.
Avisos de regra financeira já existentes permanecem próximos do campo relevante.

### 6. Cor de destaque versus cores semânticas

A preferência pessoal identifica navegação, foco e ações primárias. Sucesso, aviso e
perigo usam os tokens semânticos fixos e mantêm o mesmo significado em Preto, Rosa e
Verde. Status nunca depende somente da cor; rótulo textual ou alternativa acessível
permanece no DOM.

As cores por categoria do donut continuam independentes da preferência e acompanhadas
pela legenda textual com rótulo e valor.

### 7. Acessibilidade e responsividade

Meta: WCAG 2.2 nível AA, mantendo o padrão interno mais forte de alvo mínimo de
44 px para controles próprios. A revisão cobre:

- landmarks, hierarquia de títulos e títulos de documento por rota;
- navegação completa por teclado, ordem de foco e foco visível;
- `aria-expanded`/`aria-controls` nos painéis;
- abertura, Escape, cancelamento e retorno de foco nos diálogos;
- `aria-invalid` junto de `aria-describedby` em todos os erros de campo;
- feedback de action com `role="status"` ou `role="alert"` conforme a urgência;
- status e progresso compreensíveis sem cor;
- contraste nas três paletas e nas cores semânticas;
- reflow sem perda ou scroll horizontal em 320, 390 e desktop;
- nomes, descrições e valores longos sem romper cards;
- respeito a `prefers-reduced-motion` nas transições decorativas.

Não haverá pacote automatizado novo de acessibilidade. Playwright, árvore semântica,
interações por teclado e checklist manual cobrem o escopo sem ampliar dependências.
Também não haverá snapshot pixel a pixel: o protótipo é direção visual, não contrato
exato, e os contratos relevantes serão de conteúdo, semântica e comportamento.

### 8. Segurança, privacidade e compliance

Nenhuma nova coleta, persistência, retenção, exportação, query ou log é necessária.
Os componentes compartilhados recebem apenas o conteúdo que as páginas já exibem e
não fazem instrumentação, analytics ou telemetria.

`data-handling.md`, modelo, portabilidade, mapeamento LGPD e logs de segurança serão
revisados ao final. A expectativa é não editá-los: sem dado, finalidade, achado,
exceção ou controle novo. Qualquer necessidade de mudar schema ou regra de acesso
interrompe esta etapa e exige novo plano aprovado.

## Cobertura de testes

Testes antes ou junto da implementação:

- E2E focal de polimento: nomenclatura, hierarquia, estados vazios, três destinos,
  edições coerentes e status textuais;
- teclado: navegação, painéis, formulário, donut e diálogos;
- formulários: associação entre campo inválido e mensagem, pending e feedback;
- responsividade: 320, 390 e desktop, nomes longos e ausência de overflow;
- três paletas: ações, foco e estados semânticos preservados;
- loading/error: fallback genérico, retry e ausência de detalhe técnico;
- regressão completa dos fluxos funcionais existentes.

Testes unitários de domínio e compliance existentes devem permanecer inalterados e
verdes. Helper puro novo, se necessário, recebe teste unitário próprio.

## Subtarefas

- [x] 1. Registrar o plano aprovado e alinhar o índice antes de escrever código
- [x] 2. Escrever os contratos E2E de polimento e confirmar o vermelho
- [x] 3. Extrair cabeçalho, navegação mensal, feedback, painel expansível, diálogo e
      estilos compartilhados de formulário
- [x] 4. Implementar `loading.tsx` e `error.tsx` do grupo financeiro sem log bruto
- [x] 5. Polir o Dashboard e a seção de Lançamentos
- [x] 6. Polir Metas e seus aportes
- [x] 7. Polir Contas fixas e seus pagamentos
- [x] 8. Uniformizar as cinco rotas de edição
- [x] 9. Corrigir associações acessíveis, teclado, foco, contraste e conteúdo não
      dependente de cor
- [x] 10. Validar reflow em 320/390 px, desktop e conteúdo longo
- [x] 11. Revisar documentação de compliance aplicável
- [x] 12. Validação final: unitários, compliance, E2E sem skips, lint, TypeScript e
      build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo e sem referência a IA. Cada commit cobre
um módulo lógico e inclui os testes escritos antes ou junto da implementação
correspondente.

## Notas

- O rascunho anterior ainda dizia “4 telas” e “aguardando Etapa 09”. Corrigido na
  aprovação: são 3 rotas persistentes, Lançamentos é seção do Dashboard e a Etapa 09
  está concluída.
- O aviso do GitHub Actions sobre actions baseadas em Node 20 sendo forçadas a Node
  24 é manutenção de CI, não polimento de interface, e permanece fora desta etapa.
- Subtarefa 2 confirmada em vermelho. A suíte unitária de estados compartilhados
  falha exclusivamente porque `FeedbackState`, `loading.tsx` e `error.tsx` ainda não
  existem. O E2E focal executa fixtures e autenticação normalmente e falha nos dois
  contratos deliberadamente ausentes: título específico por rota (`Cadence` ainda é
  global) e alvo mínimo de 44 px no gatilho “Criar meta” (24 px antes do polimento).
  O lint dos arquivos de teste está verde.
- Subtarefas 3–8 concluídas com componentes compartilhados sem dependência nova,
  fallbacks do grupo financeiro e hierarquia/microcopy consistentes nas três rotas e
  nas cinco edições. As regras, queries e Server Actions financeiras não mudaram.
- Subtarefas 9–10 concluídas com erros de campo associados por
  `aria-describedby`, painéis com estado exposto, confirmações nativas por teclado e
  retorno de foco, alternativa textual do donut, status “Pago” real no DOM, alvos de
  44 px e reflow sem scroll horizontal em 320/390 px. Transições decorativas respeitam
  `prefers-reduced-motion`. O token de aviso foi ajustado para `#8a621f`, com contraste
  de 4,77:1 sobre o fundo suave e 5,46:1 sobre branco; sucesso e perigo também
  permanecem acima de 4,5:1 nos usos textuais auditados.
- A documentação de tratamento de dados, modelo, portabilidade, mapeamento LGPD,
  achados e exceções de segurança foi revisada. Como não houve coleta, finalidade,
  persistência, query, log, schema, RLS ou risco novo, esses documentos não exigiram
  alteração. O fallback de cor e seu log sanitizado da Etapa 09 permanecem intactos.
- A primeira tentativa integral com seis workers expôs apenas o rate limit do Auth
  hospedado, sem falha de produto; os mesmos cenários já estavam verdes em série. O
  Playwright passou a usar um worker para evitar rajadas concorrentes e tornar o
  caminho local/CI determinístico.
- Validação final: 454/454 testes Vitest verdes em 49 arquivos, incluindo toda a
  compliance; 30/30 E2E executados e aprovados sem skips; lint sem avisos, TypeScript
  sem erros, build de produção verde e `git diff --check` limpo. Nenhum arquivo de
  schema ou migration foi alterado.
- Após revisão visual local, o Dashboard recebeu uma composição mais densa: entrada
  rápida de lançamento em linha, resumo ao lado, histórico como conteúdo principal e
  donut complementar com layout orientado pela largura do próprio card. Cabeçalhos,
  cards, formulários, shell, Metas, Contas fixas e edições tiveram espaçamentos,
  raios e sombras harmonizados sem reduzir os alvos interativos de 44 px.
- O seletor persistente de cor passou a ficar recolhido sob “Aparência”. Escolher
  Preto, Rosa ou Verde envia imediatamente a mesma Server Action já auditada, fecha
  o painel após sucesso e elimina o passo “Salvar cor”. O E2E continua provando
  persistência independente por pessoa, HTML inicial correto sem JavaScript,
  ausência de overflow móvel e agora também a inexistência do botão antigo.
- O usuário aprovou o passe visual final no servidor local. A validação integral foi
  repetida depois desses ajustes com os mesmos resultados verdes: 454/454 Vitest,
  30/30 E2E sem skips, lint, TypeScript, build e `git diff --check`.
