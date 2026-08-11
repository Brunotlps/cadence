# Etapa 12 — Experiência mobile completa

**Status:** em andamento
**Aberto em:** 11/08/2026
**Plano aprovado em:** 11/08/2026
**Depende de:** Etapas 09–11 (fundação, polimento por tela e login concluídos)

## Objetivo

Transformar a responsividade técnica já existente em uma experiência mobile coesa,
compacta e previsível em todo o fluxo principal: shell autenticado, Dashboard, Metas,
Contas fixas, edições, autenticação por e-mail/senha e onboarding inicial.

A etapa preserva regras financeiras, Supabase Auth, sessão, Server Actions, schema,
RLS, logs e mensagens genéricas de segurança. Não adiciona coleta, analytics,
dependência runtime ou destino de navegação.

## Diagnóstico confirmado

A auditoria em 320 × 720 e 390 × 844 com conteúdo sintético longo confirmou que a
aplicação evita overflow horizontal, mas ainda apresenta problemas de composição:

- cabeçalho autenticado com 121 px e navegação inferior com 64 px ocupam juntos
  aproximadamente 26% da altura de 720 px antes do conteúdo;
- o gatilho de aparência ocupa uma segunda linha permanente e o painel não fecha por
  clique externo ou `Escape`;
- o nome longo do workspace domina o título do Dashboard;
- navegação mensal quebra os dois destinos em duas linhas em 320 px;
- o formulário compacto de lançamento cria uma última linha órfã em 390 px;
- descrições de lançamentos são truncadas cedo demais;
- ações de meta somam 273 px dentro de 270 px úteis e quebram por apenas 3 px;
- filtros de contas fixas deixam “Automáticas” isolado na segunda linha;
- a barra inferior fixa pode cobrir o campo focado ou a ação durante a rolagem;
- signup, confirmação, recuperação, redefinição e onboarding ainda usam apresentação
  padrão do navegador e controles abaixo do alvo interno de 44 px.

Os E2E atuais cobrem principalmente ausência de overflow e presença de conteúdo. Não
fixam sobreposição, recorte, agrupamento de ações, área útil do shell, fechamento do
seletor, compensação da barra fixa ou continuidade visual das páginas de conta.

## Decisões fechadas

### 1. Escopo exato

Entram:

- shell autenticado e seus três destinos persistentes;
- `/dashboard`, `/goals`, `/fixed-bills` e todos os cinco editores já existentes;
- diálogos, formulários e padrões compartilhados consumidos por essas rotas;
- `/login` como referência e regressão;
- `/signup`, `/confirm-email`, `/forgot-password`, `/reset-password` e
  `/onboarding/workspace` como continuidade do fluxo de acesso.

A homepage `/` fica fora. Transformá-la em landing page ou redirecionamento exige uma
decisão de produto própria, não é consequência automática de responsividade.

Não entram nova rota, método de autenticação, campo, filtro financeiro, gesto oculto,
PWA, instalação, notificação, analytics ou mudança de regra de negócio.

### 2. Shell mobile compacto

Desktop permanece inalterado. Até 800 px, o cabeçalho passa a uma única linha com:

- marca Cadence;
- botão compacto que expõe a cor atual e tem nome acessível completo;
- logout com alvo mínimo de 44 px.

O seletor continua persistindo a mesma preferência pela mesma Server Action. O painel
fecha após sucesso, clique externo, `Escape` ou mudança de rota, devolve o foco ao
gatilho quando fechado pelo teclado e permanece navegável sem comunicar a cor apenas
visualmente.

A navegação inferior mantém exatamente Dashboard, Metas e Fixas. Ela preserva
`aria-current`, alvo mínimo, safe area e estado ativo nas edições. O conteúdo recebe
compensação de scroll/foco equivalente à altura fixa da navegação.

### 3. Hierarquia e navegação mensal

No Dashboard, “Dashboard” vira o `h1` e o workspace aparece como contexto compacto,
alinhando a rota a Metas e Contas fixas e impedindo que nomes longos dominem a dobra.

Em telas estreitas, os rótulos visíveis da navegação mensal passam a “Anterior” e
“Próximo”; os nomes acessíveis continuam “Mês anterior” e “Próximo mês”. O mês mantém
posição central e os três alvos permanecem com 44 px.

### 4. Dashboard e lançamentos

- tornar o grid compacto intencional: uma coluna em 320 px; em larguras intermediárias,
  valor e categoria podem compartilhar a linha, mas data ocupa a linha completa;
- permitir até duas linhas de descrição no mobile, em vez de elipse de uma linha;
- equilibrar descrição, valor, metadata e ações sem esconder conteúdo essencial;
- manter o formulário como ação principal e detalhes opcionais recolhidos;
- reduzir o gráfico somente quando o container exigir, preservando legenda textual e
  foco do SVG.

### 5. Metas e contas fixas

Ações secundárias passam a usar composição deliberada em vez de wrap acidental. Em
Metas, editar/excluir e editar/excluir aporte formam grupos estáveis; “Aportar” segue
separado como ação do fluxo.

Em Contas fixas, os filtros formam grade 2 × 2 em telas estreitas. Editar e encerrar
ficam agrupados como ações secundárias, enquanto confirmar pagamento permanece ação
principal. Badges, nome, vencimento, previsto e realizado preservam sua ordem
semântica.

### 6. Formulários, edições e diálogos

Os controles mantêm 44 px, fonte de 16 px herdada e teclados móveis adequados via
`inputMode`/tipos existentes. Campos focados, mensagens e submits recebem margem de
scroll suficiente para não ficarem sob a navegação fixa.

Os cinco editores preservam o mesmo card e passam a ter ações inferiores consistentes
em 320/390 px. Diálogos usam a largura disponível, ações empilhadas quando necessário,
safe area e retorno de foco já existente.

Não será afirmada cobertura de teclado virtual nativo pelo Chromium desktop. O
contrato automatizado cobre foco, scroll e geometria da barra; a inspeção manual cobre
o comportamento com viewport reduzido.

### 7. Continuidade do fluxo de conta

Agora existem consumidores suficientes para justificar um padrão compartilhado sob
`components/auth/`. Signup, confirmação, recuperação e redefinição recebem uma
composição compacta derivada do login: marca, card, hierarquia, labels visíveis,
controles de 44 px, estados e links coerentes.

Login mantém sua composição especial de duas áreas, mas pode compartilhar controles
e elementos comprovadamente repetidos sem reescrever seu comportamento. Signup e
redefinição recebem inspeção local da senha somente se a abstração puder preservar o
valor e o contrato atual sem tocar nas actions.

Onboarding usa a mesma linguagem visual compacta dentro do tema autenticado, sem shell
financeiro. `createWorkspaceAction`, texto funcional e redirect permanecem intactos.

### 8. Testes mobile mais fortes

Criar `tests/e2e/mobile-experience.spec.ts`, primeiro em vermelho, com fixtures
descartáveis e conteúdo longo. A cobertura inclui:

- 320, 360 e 390 px em retrato e uma largura móvel em paisagem;
- cabeçalho de uma linha, três destinos, safe area e alvos mínimos;
- seletor de aparência por clique, clique externo e `Escape`;
- navegação mensal sem quebra, grid do lançamento e descrições legíveis;
- ações estáveis de metas/contas, filtros 2 × 2 e formulários expandidos;
- foco/scroll sem controle encoberto pela navegação inferior;
- páginas de conta e onboarding com card, labels, estados e alvos mínimos;
- conteúdo longo dentro dos limites do viewport, sem depender do `overflow-x: hidden`
  global como prova única.

Snapshots pixel a pixel continuam fora. Os contratos são de geometria relevante,
semântica e comportamento, complementados por inspeção visual.

### 9. Segurança, privacidade e documentação

Não há dado, finalidade, persistência, query, cookie, log, schema, policy ou retenção
nova. Os componentes de apresentação não recebem nem registram valores financeiros,
e-mail ou conteúdo de formulário. Mensagens de autenticação permanecem genéricas e
indistinguíveis.

A revisão obrigatória identificou uma frase obsoleta em
`docs/compliance/security-exceptions.md`: ela ainda dizia que signup público estava
fora do MVP. A correção registra que o gatilho de reavaliação da retenção de contas
não confirmadas já foi atingido, sem declarar a exceção resolvida nem alterar o risco
nesta etapa.

## Estrutura prevista

```text
components/auth/
├── auth-shell.tsx
└── auth-shell.module.css

tests/e2e/
└── mobile-experience.spec.ts
```

CSS Modules existentes continuam responsáveis por cada composição. Não haverá
biblioteca de componentes, Tailwind, CSS-in-JS ou pacote de ícones.

## Subtarefas

- [x] 1. Registrar o plano aprovado, atualizar o índice e corrigir a frase obsoleta
      sobre signup em `security-exceptions.md`
- [ ] 2. Escrever contratos E2E mobile com conteúdo longo e confirmar o vermelho
- [ ] 3. Compactar o shell, refinar o seletor e compensar a navegação fixa
- [ ] 4. Refinar cabeçalhos e navegação mensal
- [ ] 5. Refinar Dashboard, formulário, lista e gráfico
- [ ] 6. Refinar Metas, aportes e seus grupos de ação
- [ ] 7. Refinar Contas fixas, filtros, pagamentos e seus grupos de ação
- [ ] 8. Uniformizar edições, diálogos, foco e scroll em telas estreitas
- [ ] 9. Criar padrão compartilhado para signup, confirmação, recuperação,
      redefinição e onboarding
- [ ] 10. Inspecionar 320/360/390 px, paisagem, conteúdo longo e três paletas
- [ ] 11. Revisar documentação de compliance aplicável
- [ ] 12. Validação final: unitários, compliance, E2E sem skips, lint, TypeScript e
      build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo e sem referência a IA. Plano e correção
documental entram primeiro; contratos E2E são registrados em vermelho; shell,
conteúdo financeiro, fluxo de conta e conclusão documental ficam em commits lógicos
separados.

## Notas

- A auditoria usou somente fixtures sintéticas descartáveis e encerrou seu servidor
  temporário. Nenhum dado pessoal ou financeiro real foi registrado.
- A árvore estava limpa em `main` antes da abertura desta etapa.
- Nenhuma decisão das Etapas 04–11 foi reaberta.
