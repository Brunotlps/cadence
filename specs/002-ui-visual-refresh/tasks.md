# Tasks: Refinamento Visual da Interface

**Input**: Design documents from `/specs/002-ui-visual-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-presentation.md, quickstart.md

**Tests**: Esta feature exige prova de regressão visual/funcional. Escreva ou ajuste os testes indicados antes das alterações correspondentes e confirme que falham pelo motivo esperado quando aplicável.

**Organization**: Tarefas agrupadas por jornada para manter cada incremento verificável de forma independente.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Delimitar as superfícies de apresentação e a baseline de validação sem tocar em dados ou fluxos.

- [X] T001 Mapear tokens, cores fixas e consumidores de apresentação em `app/design-tokens.css`, `app/globals.css`, `app/page.module.css`, `app/login/login.module.css`, `components/app-shell/app-shell.module.css` e `components/ui/*.module.css`, preservando as cores categóricas de `components/transactions/expense-donut.tsx`.
- [X] T002 [P] Revisar os testes de regressão existentes em `tests/e2e/visual-foundation.spec.ts`, `tests/e2e/visual-polish.spec.ts` e `tests/e2e/mobile-experience.spec.ts` para identificar as asserções que devem continuar inalteradas.
- [X] T003 [P] Verificar os padrões de ignore existentes em `.gitignore` e `eslint.config.mjs` para confirmar que assets e saídas locais não introduzem arquivos indevidos no repositório.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar a base semântica compartilhada antes de alterar telas específicas.

**⚠️ CRITICAL**: Nenhuma jornada deve avançar antes de a base preservar as três preferências e os estados acessíveis.

- [X] T004 Adicionar aliases de superfície, borda, texto, foco e destaque em `app/design-tokens.css`, mantendo as chaves `verde`, `rosa` e `preto`, seus valores persistidos e a separação entre destaque e estados semânticos.
- [X] T005 Atualizar regras globais de canvas, tipografia, foco e redução de movimento em `app/globals.css` para consumir os aliases sem alterar semântica, ARIA ou comportamento interativo.
- [X] T006 Ajustar padrões reutilizáveis de cabeçalho, painéis, feedback e controles em `components/ui/page-patterns.module.css` e `components/ui/form-controls.module.css` para refletir a hierarquia de tokens sem depender apenas de cor.

**Checkpoint**: Base de apresentação pronta; as três preferências, sinais redundantes de estado e fluxos existentes continuam sendo o contrato.

---

## Phase 3: User Story 1 - Navegar com clareza e consistência (Priority: P1) 🎯 MVP

**Goal**: Tornar as telas existentes mais claras e coerentes, sem alterar ações, rotas, textos de produto ou resultados.

**Independent Test**: Percorrer Dashboard, Metas, Contas fixas, conta, formulários/edições e convite por teclado e em telas estreitas; os controles e resultados existentes permanecem disponíveis e a hierarquia é perceptível sem depender só de cor.

### Tests for User Story 1

- [X] T007 [P] [US1] Estender cenários de hierarquia, foco, mensagens e diálogos semânticos em `tests/e2e/visual-polish.spec.ts` antes dos ajustes de apresentação.
- [X] T008 [P] [US1] Estender cenários de navegação ativa, teclado e ausência de overflow em `tests/e2e/visual-foundation.spec.ts` e `tests/e2e/mobile-experience.spec.ts` antes dos ajustes do shell.

### Implementation for User Story 1

- [X] T009 [US1] Refinar o shell, navegação ativa, seletor de aparência e diálogos em `components/app-shell/app-shell.module.css` e `components/app-shell/feedback-dialog.module.css`, preservando DOM, labels, ARIA e ações existentes.
- [X] T010 [P] [US1] Refinar superfície e hierarquia da página pública em `app/page.module.css` sem mudar o fluxo de entrada em `app/page.tsx`.
- [X] T011 [P] [US1] Refinar autenticação e seus estados de retorno em `app/login/login.module.css` e `components/auth/auth-shell.module.css`, sem alterar o fluxo OAuth.
- [X] T012 [US1] Aplicar os aliases de apresentação às páginas protegidas e seus módulos em `app/(protected)/(workspace)/**/*.module.css`, preservando conteúdos, controles e estados de Dashboard, Metas, Contas fixas, conta, convite e edições.
- [X] T013 [US1] Atualizar os estilos reutilizáveis afetados em `components/ui/confirm-dialog.module.css` e `components/ui/form-controls.module.css` somente se necessário para manter foco e estados visíveis após o refinamento.

**Checkpoint**: A jornada P1 está completa quando todos os fluxos existentes continuam concluíveis, com hierarquia e feedback perceptíveis em desktop e mobile.

---

## Phase 4: User Story 2 - Reconhecer o Cadence no navegador (Priority: P2)

**Goal**: Identificar o Cadence por um favicon institucional estático, legível e compatível, sem ampliar o escopo para PWA ou metadados dinâmicos.

**Independent Test**: Abrir uma página pública e uma protegida e confirmar os links/arquivos de ícone; verificar visualmente o símbolo em tamanhos reduzidos e que a falta de suporte não altera navegação.

### Tests for User Story 2

- [X] T014 [US2] Criar verificação de assets de metadata e disponibilidade do favicon em página pública no `tests/e2e/favicon.spec.ts` antes de criar os assets.

### Implementation for User Story 2

- [X] T015 [US2] Criar o símbolo institucional vetorial, simples e sem texto em `app/icon.svg`, legível em 16 px e independente da preferência individual de cor.
- [X] T016 [US2] Gerar os fallbacks raster `app/favicon.ico` (16/32/48 px) e `app/apple-icon.png` (180 × 180) a partir do símbolo aprovado, sem adicionar manifest, PWA, dados ou rastreamento.
- [X] T017 [US2] Confirmar em `app/layout.tsx` que os metadados raiz permanecem compatíveis com os assets file-based, sem inserir links manuais duplicados nem mudar títulos/descrições das rotas.

**Checkpoint**: A jornada P2 está completa quando o navegador compatível recebe um ícone estático do Cadence e todas as páginas preservam seu comportamento atual.

---

## Phase 5: User Story 3 - Manter a personalização de cor harmoniosa (Priority: P3)

**Goal**: Preservar Verde, Rosa e Preto, aplicando tons secundários coerentes à interface e sem mudar a preferência persistida.

**Independent Test**: Alternar entre as três cores, recarregar e verificar a preferência no HTML sem JavaScript; revisar superfícies, bordas, foco e estados semânticos em cada variação.

### Tests for User Story 3

- [X] T018 [US3] Estender a prova de persistência SSR, teclado e aplicação de cada preferência em `tests/e2e/visual-foundation.spec.ts` antes dos ajustes finais de tema.

### Implementation for User Story 3

- [X] T019 [US3] Remover cores de marca fixas e aplicar aliases dependentes de tema em `app/page.module.css`, `app/login/login.module.css`, `components/app-shell/app-shell.module.css` e `components/auth/auth-shell.module.css`, sem alterar as opções em `lib/profiles/accent-colors.ts`.
- [X] T020 [US3] Harmonizar superfícies, bordas e destaques dos módulos de interface em `components/**/*.module.css` e `app/(protected)/**/*.module.css`, mantendo cores de categoria e tokens de erro/sucesso/aviso semanticamente separados.

**Checkpoint**: As três preferências continuam persistidas e aplicadas no SSR, com tons secundários legíveis e estados semânticos distinguíveis.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificar o contrato completo, qualidade e limites de escopo.

- [X] T021 Executar lint, testes unitários e build conforme `package.json`; registrar os resultados em `specs/002-ui-visual-refresh/quickstart.md` somente se o guia de validação precisar de correção factual.
- [X] T022 Executar os testes E2E visuais e de favicon com ambiente autorizado, conforme `tests/e2e/visual-foundation.spec.ts`, `tests/e2e/visual-polish.spec.ts`, `tests/e2e/mobile-experience.spec.ts` e `tests/e2e/favicon.spec.ts`.
- [ ] T023 Fazer revisão manual de contraste, reflow em 320/390 px e legibilidade do favicon em `specs/002-ui-visual-refresh/quickstart.md`, documentando apenas lacunas de validação, sem alterar o escopo de dados/privacidade.
- [X] T024 Confirmar que o diff final não inclui migrations, acesso a dados, cookies, analytics, scripts de terceiros, mudanças de rota ou alterações em `lib/profiles/accent-colors.ts` e `lib/profiles/actions.ts`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: começa imediatamente.
- **Foundational (Phase 2)**: depende de T001–T003 e bloqueia as jornadas.
- **US1 (Phase 3)**: depende de T004–T006; é o MVP.
- **US2 (Phase 4)**: depende de T004–T006, mas não de US1; pode seguir em paralelo após a base.
- **US3 (Phase 5)**: depende de T004–T006 e coordena os mesmos arquivos de US1; execute após T009–T013 para evitar conflito de arquivos.
- **Polish (Phase 6)**: depende de todas as jornadas desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: independente após a base compartilhada.
- **US2 (P2)**: independente após a base compartilhada.
- **US3 (P3)**: independente em valor, mas sequencial na execução local por tocar tokens e módulos já refinados por US1.

## Parallel Opportunities

- T002 e T003 podem ser feitas em paralelo com T001.
- T007 e T008 podem ser feitas em paralelo.
- T010 e T011 podem ser feitas em paralelo após T004–T006; T012 e T013 devem respeitar arquivos compartilhados.
- T015 pode avançar em paralelo com a criação do teste T014; T016 depende de T015.

## Parallel Example: User Story 1

```text
T007: testes de hierarquia, foco e diálogos em tests/e2e/visual-polish.spec.ts
T008: testes de navegação, teclado e reflow em tests/e2e/visual-foundation.spec.ts e tests/e2e/mobile-experience.spec.ts

Após a base:
T010: página pública em app/page.module.css
T011: autenticação em app/login/login.module.css e components/auth/auth-shell.module.css
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001–T006 para estabelecer tokens e padrões compartilhados.
2. Complete T007–T013.
3. Valide as jornadas, teclado e reflow de US1 antes de prosseguir.

### Incremental Delivery

1. Base compartilhada → tokens consistentes sem mudança de contrato.
2. US1 → refinamento de interface e fluxos preservados.
3. US2 → favicon compatível.
4. US3 → coerência integral das três preferências.
5. Polish → prova automatizada e revisão humana.

## Notes

- Todos os itens seguem o formato de checklist com ID, rótulo de jornada quando aplicável e caminhos exatos.
- Não criar nem alterar dados, autenticação, RLS, migrations, rotas, analytics ou cookies.
- A execução E2E hospedada só ocorre mediante aprovação explícita do usuário e ambiente de teste autorizado.
