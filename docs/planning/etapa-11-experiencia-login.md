# Etapa 11 — Experiência de login

**Status:** em andamento
**Aberto em:** 11/08/2026
**Plano aprovado em:** 11/08/2026
**Depende de:** Etapa 10 (fundação e polimento visual concluídos)

## Objetivo

Levar a tela `/login` ao mesmo nível visual, responsivo e acessível das áreas
financeiras, preservando integralmente o fluxo de autenticação por e-mail/senha já
auditado na Etapa 05.

Esta etapa não altera Supabase Auth, sessão, cookies, redirects, rate limiting,
Server Actions, mensagens de segurança ou regras de onboarding. Também não amplia os
métodos de autenticação do MVP.

## Diagnóstico atual

O login está funcional e coberto pelo E2E de autenticação, mas ainda renderiza HTML
sem CSS específico:

- não possui título de documento próprio;
- não apresenta marca, contexto do produto ou hierarquia entre introdução e ação;
- formulário, links, erro e pending não consomem os padrões visuais consolidados;
- senha não pode ser inspecionada antes do envio;
- não há contrato específico de reflow em 320 px, conteúdo longo ou alvos de 44 px;
- cadastro, recuperação e login têm navegação funcional, porém o login não comunica
  visualmente qual é a ação principal.

## Decisões fechadas

### 1. Escopo exato

Entra somente `/login`, incluindo os links existentes para `/forgot-password` e
`/signup`. Cadastro, confirmação, recuperação, redefinição e onboarding mantêm
comportamento e apresentação atuais; poderão reutilizar o padrão em uma etapa futura,
mas não serão refatorados silenciosamente agora.

Não entram OAuth, magic link, login social, biometria, “lembrar de mim”, captcha,
analytics ou nova coleta. A sessão já é persistente por decisão da Etapa 05.

### 2. Composição visual

Em desktop, a página terá duas áreas dentro de uma composição única:

- painel de marca com Cadence, a frase “Seu dinheiro, no seu ritmo.”, contexto curto
  das três áreas do produto e nota de privacidade por padrão;
- painel de acesso com eyebrow, título de boas-vindas, formulário, recuperação de
  senha e link de cadastro.

Em telas estreitas, o painel de marca vira uma introdução compacta e o formulário
ocupa a largura disponível. A composição usa apenas CSS, tokens existentes e formas
geométricas da identidade; não haverá imagem externa, fonte, pacote de ícones ou
dependência runtime nova.

### 3. Formulário e estados

O contrato de campos permanece `email` + `password`, com os mesmos `name`,
`autocomplete`, `required` e Server Action. O botão passa a exibir “Entrando…”
durante o pending.

A senha recebe um controle local “Mostrar senha” / “Ocultar senha”. Ele altera
somente o `type` do input, usa `aria-pressed`, mantém o valor e não persiste nem
registra conteúdo.

O erro genérico existente continua sendo a única resposta visível a falhas de login.
Quando presente, será associado ao par de credenciais por `aria-describedby` e
anunciado com `role="alert"`. Não haverá distinção visual ou textual entre conta
inexistente, não confirmada e senha incorreta.

### 4. Metadados, acessibilidade e responsividade

- título do documento: `Entrar | Cadence`;
- um único `h1`, landmarks coerentes e texto de apoio curto;
- labels sempre visíveis e foco compatível com os três temas;
- controles próprios com alvo mínimo de 44 px;
- ordem de teclado: e-mail, senha, visibilidade, recuperação, entrar e cadastro;
- reflow sem scroll horizontal em 320, 390 e desktop;
- painel decorativo fora da árvore semântica quando não comunicar conteúdo;
- transições decorativas respeitam `prefers-reduced-motion`.

### 5. Segurança e privacidade

`signInAction` e `lib/auth/sign-in.ts` não serão alterados. Não haverá log, telemetria,
armazenamento local, novo cookie ou exposição do e-mail na URL. A nota visual de
privacidade descreve apenas os guardrails já vigentes: ausência de rastreamento
comportamental e privacidade por padrão.

O conflito documental identificado durante a auditoria será corrigido na fonte:
`CLAUDE.md` ainda dizia que signup público e onboarding estavam fora do MVP, embora
ambos tenham sido entregues e validados na Etapa 05. O documento passará a reconhecer
o cadastro por e-mail/senha e o onboarding inicial existentes; métodos adicionais e
convites continuam fora do escopo.

### 6. Estrutura de arquivos

```text
app/login/
├── layout.tsx          # metadata específica
├── page.tsx            # composição e estado do formulário
└── login.module.css    # apresentação isolada da rota
```

A tela continuará como Client Component por usar `useActionState` e o estado local
de visibilidade da senha. Um layout mínimo fornece metadata sem criar abstração
compartilhada usada por uma única rota.

### 7. Cobertura de testes

Um E2E focal, escrito antes da implementação, cobrirá:

- título de documento, marca, título e texto principal;
- campos, links e ausência de “lembrar de mim”;
- alternância de senha por clique e teclado;
- pending e erro continuam cobertos pelo fluxo real da Etapa 05;
- alvos mínimos e ausência de overflow em 320/390 px;
- regressão do cadastro, confirmação, login, logout e recuperação existentes.

Os testes unitários de autenticação e compliance não devem mudar de resultado. Como
não há alteração de lógica, schema ou dado, nenhum teste de compliance novo é
necessário.

## Subtarefas

- [x] 1. Registrar o plano aprovado, atualizar o índice e corrigir o escopo obsoleto
      no `CLAUDE.md`
- [ ] 2. Escrever o contrato E2E do login e confirmar o vermelho
- [ ] 3. Implementar metadata e composição visual responsiva
- [ ] 4. Refinar campos, links, pending, erro e visibilidade da senha
- [ ] 5. Validar teclado, foco, alvos e reflow em 320/390 px
- [ ] 6. Revisar segurança, privacidade e documentação aplicável
- [ ] 7. Validação final: unitários, compliance, E2E sem skips, lint, TypeScript e
      build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo e sem referência a IA. Plano e correção
documental entram primeiro; o contrato E2E é registrado em vermelho; implementação e
conclusão documental ficam em commits lógicos separados.

## Notas

- O protótipo original não define uma tela de login. A direção visual vem dos tokens,
  marca e densidade aprovados nas Etapas 09–10, sem importar funcionalidades do
  protótipo.
- Nenhuma decisão da Etapa 05 foi reaberta.
