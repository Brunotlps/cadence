# Implementation Plan: Refinamento Visual da Interface

**Branch**: `002-ui-visual-refresh` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ui-visual-refresh/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Refinar a linguagem visual do Cadence para melhorar hierarquia, harmonia e percepção de qualidade, preservando todos os fluxos e a preferência existente de cor de destaque. A abordagem concentra a mudança nos tokens semânticos e nos padrões visuais compartilhados, propaga aliases para as superfícies que ainda usam cores fixas e adiciona um favicon institucional estático por convenção de metadata. Não haverá alterações em dados, rotas, autenticação, Server Actions, regras de domínio ou preferências persistidas.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2, Next.js 16.2 (App Router)

**Primary Dependencies**: Next.js App Router, React, CSS Modules; metadados file-based do Next.js

**Storage**: N/A para esta feature; a preferência existente de cor permanece no perfil, sem alteração de schema, migração ou acesso a dados

**Testing**: ESLint, Vitest, Playwright (fundação visual, polimento visual, mobile e fluxos funcionais existentes), revisão manual de contraste e favicon

**Target Platform**: Web responsiva em navegadores modernos; favicon com fallbacks para clientes compatíveis

**Project Type**: Aplicação web monolítica com App Router

**Performance Goals**: Preservar a responsividade atual; não adicionar chamadas de rede, scripts de terceiros, coleta de dados nem carregamento dependente de dados para a camada visual

**Constraints**: Nenhuma mudança funcional; manter as opções Preto/Rosa/Verde, SSR da preferência, semântica/ARIA, foco visível, reflow a 320 px e os guardrails de privacidade

**Scale/Scope**: Tokens globais, páginas pública e de login, shell protegido, padrões reutilizáveis, telas de Dashboard/Metas/Contas fixas/conta/convite/formulários e seus estados; um conjunto de assets de ícone institucional

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pré-pesquisa — aprovado**

| Princípio | Avaliação | Evidência/decisão |
|-----------|-----------|-------------------|
| I. Isolamento por workspace | Não afetado | Não há tabelas, queries, policies, rotas nem dados novos. |
| II. Acesso autenticado e menor privilégio | Não afetado | A preferência de cor continua sendo consumida pelo mesmo layout protegido e contexto autenticado; não há novo acesso a dados. |
| III. Privacidade e minimização | Aprovado | Ícones estáticos e CSS não coletam, armazenam, registram ou transmitem dados; analytics, cookies e scripts de terceiros estão fora de escopo. |
| IV. Ciclo de vida de dados | Não afetado | Não existem entidades, retenção ou exclusão introduzidas. |
| V. Prova de regressão | Aprovado | Preservar e ampliar, se necessário, as verificações E2E de preferência de cor, teclado, reflow e fluxos visuais; não há invariante crítico de banco a provar. |

Não há violação constitucional nem exceção necessária.

## Project Structure

### Documentation (this feature)

```text
specs/002-ui-visual-refresh/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)
```text
app/
├── layout.tsx                       # metadata raiz e escopo de ícones
├── icon.svg                         # ícone escalável da marca (novo)
├── apple-icon.png                   # fallback para atalhos Apple (novo)
├── favicon.ico                      # fallback para clientes legados (novo)
├── design-tokens.css                # papéis de cor globais e variações por destaque
├── globals.css
├── page.tsx + page.module.css       # página pública
├── login/                           # autenticação
└── (protected)/                     # shell, áreas e páginas autenticadas

components/
├── app-shell/                       # navegação, seletor de aparência e diálogo
└── ui/                              # formulários, headers, painéis e estados compartilhados

tests/e2e/
├── visual-foundation.spec.ts        # preferência de cor, navegação, teclado e SSR
├── visual-polish.spec.ts            # hierarquia, acessibilidade e reflow
└── mobile-experience.spec.ts        # reflow e controles em viewports móveis
```

**Structure Decision**: Aplicação web existente de projeto único. A implementação reutiliza o sistema de tokens, os módulos CSS e os testes E2E presentes; não cria camada de backend, entidade, API ou mecanismo de persistência.
