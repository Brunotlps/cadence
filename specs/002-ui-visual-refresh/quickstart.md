# Quickstart: Validar o Refinamento Visual

## Pré-requisitos

- Dependências já instaladas e Node.js compatível com o projeto.
- Não ler nem expor arquivos de ambiente ou credenciais.
- Para E2E autenticado, usar exclusivamente o ambiente de testes autorizado e configurado pelo mantenedor. A execução de E2E hospedado requer aprovação explícita conforme as regras do repositório.

## Validação local de qualidade

1. Rode `npm run lint` e confirme que não há violações de lint.
2. Rode `npm run test:unit` e confirme que as validações existentes, inclusive a preferência de cor, continuam aprovadas.
3. Rode `npm run build` e confirme que o build conclui e reconhece os arquivos de metadata sem erros.

## Validação de jornadas visuais

Com um ambiente E2E autorizado, execute os testes relevantes:

```bash
npm run test:e2e -- tests/e2e/visual-foundation.spec.ts
npm run test:e2e -- tests/e2e/visual-polish.spec.ts
npm run test:e2e -- tests/e2e/mobile-experience.spec.ts
```

Confirme, conforme [ui-presentation.md](./contracts/ui-presentation.md), que a navegação, o seletor de aparência, teclado, foco, diálogos, erros e reflow continuam funcionais. Para cobrir os fluxos de produto preservados, execute também a suíte E2E completa quando autorizada.

## Revisão manual obrigatória

1. Abra home, login, Dashboard, Metas, Contas fixas, formulários/edições, conta e convite em desktop e nas larguras de 320 px, 390 px e paisagem móvel já cobertas pela suíte.
2. Em cada tela, alterne entre Verde, Rosa e Preto; confira que conteúdo principal/secundário, bordas, superfícies, ações e estados semânticos são distinguíveis e que o foco não depende de cor isolada.
3. Verifique o favicon no login e em uma rota protegida em Chromium e Firefox; valide o atalho Apple em WebKit/iOS compatível quando disponível. Confira legibilidade do símbolo em 16, 32, 48 e 180 px, em fundos claros e escuros.
4. Repita uma ação de cada fluxo existente: entrar, navegar, registrar/editar lançamento, criar/editar meta, criar/confirmar conta fixa, abrir conta e convite. O resultado funcional deve ser idêntico ao anterior.

## Resultado esperado

O acabamento visual é mais consistente e moderno, o favicon identifica o Cadence, as três preferências permanecem íntegras e não há mudança observável em dados, autenticação, permissões, rotas ou operações financeiras.
