# Etapa 16 — Login somente com Google, remoção de e-mail/senha

**Status:** em andamento (implementação concluída; subtarefa 7 depende do usuário)
**Aberto em:** 13/08/2026
**Implementação concluída em:** 13/08/2026
**Depende de:** Etapa 05 (autenticação e-mail/senha, decisão revisada por esta
etapa), Etapas 09–15 (fundação visual e refinamentos, preservados)

## Objetivo

Substituir e-mail/senha por Google como único método de autenticação,
removendo de verdade o código de cadastro/login/recuperação de senha — não
mantê-lo desativado ou atrás de flag. Cadence deixa de armazenar ou gerenciar
senha de usuário. Decisão de produto do usuário, confirmada em 13/08/2026 após
análise da codebase.

Reverte a decisão 1 da Etapa 05 (*"e-mail/senha, sem magic link, sem OAuth
social, no MVP"*) e a linha correspondente de `CLAUDE.md` ("Fora de escopo no
MVP"). Ambas ficam desatualizadas em relação a este documento a partir daqui —
`CLAUDE.md` é atualizado na implementação (subtarefa 1), não nesta etapa de
registro.

## Diagnóstico confirmado

- Autenticação hoje é 100% e-mail/senha via Supabase Auth: Server Actions em
  `lib/actions/auth.ts` sobre `lib/auth/{sign-up,sign-in,sign-out,
  request-password-reset,update-password,resend-confirmation}.ts`; telas
  `/login`, `/signup`, `/confirm-email`, `/forgot-password`, `/reset-password`;
  `handle_new_user()` (`db/migrations/0001_rls-and-security-definer-functions.sql:147-160`)
  espelha `auth.users` → `public.profiles` lendo
  `raw_user_meta_data ->> 'display_name'`.
- `app/auth/callback/route.ts:44-49` já tem o branch `code` +
  `exchangeCodeForSession`, com comentário explícito no próprio código: *"fica
  como caminho alternativo pra fluxos OAuth/SSO, que usam PKCE de verdade
  (fora de escopo nesta etapa, mas sem custo manter)"*. O callback que recebe
  a volta do Google já existe e já funciona — não é preciso criar rota nova
  para isso.
- **Correção (13/08/2026, durante a implementação):** o diagnóstico original
  desta linha estava errado. `createDashboardTestUser`/`createConfirmedTestUser`
  autenticam um *cliente Node* via `signInWithPassword` — isso só afeta as
  escritas de seed feitas por esse cliente, não a sessão do navegador. Todo
  spec E2E (8 arquivos: `goals`, `fixed-bills`, `transactions-dashboard`,
  `visual-foundation`, `visual-polish`, `mobile-experience`, `login-polish`,
  `auth-flow`) tem um helper local `login(page, email, password)` que
  autentica o **navegador** preenchendo de verdade o formulário HTML de
  `/login` (`page.getByLabel("E-mail")`/`"Senha"` + clique em "Entrar").
  Remover o formulário quebra esse helper em todos os oito arquivos, não só
  nos que testam a UI de senha diretamente. Resolvido com uma rota de bypass
  de sessão só para teste (`app/auth/test-session/route.ts`, subtarefa 6) —
  ver decisão 6 revisada abaixo.
- `docs/compliance/security-exceptions.md` tem uma exceção ativa: contas não
  confirmadas ficam retidas indefinidamente porque `handle_new_user` roda em
  `AFTER INSERT on auth.users`, antes da confirmação de e-mail. Login só-Google
  elimina essa exceção por design — contas OAuth chegam já verificadas pelo
  próprio Google, não existe mais o estado "cadastrado, nunca confirmado".
- `.cadence/policies/data-handling.md` §2 lista "e-mail e senha" como dado
  mínimo coletado para autenticação. Trocar para Google introduz um novo
  operador de dados (Google) e um novo dado de perfil de terceiro
  (`full_name`), que hoje não consta em `docs/compliance/lgpd-mapping.md`
  (só lista Vercel e Supabase como operadores).
- Confirmado com o usuário (13/08/2026): não há contas reais hoje, só
  fixtures de teste. A intenção é zerar o banco antes do uso real com a
  esposa dele — não é necessário caminho de migração de contas existentes.

## Decisões fechadas

### 1. Escopo exato

Entram: `/login` (reescrita), remoção de `/signup`, `/confirm-email`,
`/forgot-password`, `/reset-password` e todo código associado; ajuste em
`handle_new_user()`; `CLAUDE.md`, `.cadence/policies/data-handling.md`,
`docs/compliance/lgpd-mapping.md`, `docs/compliance/security-exceptions.md`,
nota de decisão revisada na Etapa 05; testes.

Não entram: schema financeiro, RLS, `create_workspace_with_owner`,
`handle_account_deletion`, `/onboarding/workspace` — nada disso depende do
provedor de autenticação, só de `auth.uid()`. Convites de workspace e outros
métodos de login continuam fora de escopo.

### 2. Remoção real, não desativação

E-mail/senha é removido do código, não escondido atrás de flag. Cadence deixa
de gerenciar senha de usuário. `components/auth/password-field.tsx` e as
Server Actions/lib de cadastro, login por senha, recuperação e reenvio de
confirmação são apagados, não mantidos mortos no repositório.

### 3. Login com Google — arquitetura

Uma Server Action (`signInWithGoogleAction`) chama
`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo }
})` no servidor — que não redireciona sozinho (sem `window` no servidor), só
devolve uma URL — e a action faz `redirect(url)`. Mantém o padrão já adotado
desde a Etapa 05 (Server Actions para mutação de autenticação), sem precisar
de um Client Component chamando `supabase-js` direto no navegador. O retorno
do Google usa o branch `code` já existente em `app/auth/callback/route.ts`,
sem mudança nessa rota.

`/login` passa a ter só um botão "Continuar com Google", cobrindo cadastro e
login no mesmo fluxo (usuário novo ou existente cai no mesmo botão — é o
comportamento nativo de login só-OAuth). Onboarding de workspace continua
igual: quem loga sem workspace cai em `/onboarding/workspace`.

### 4. Perfil — dado que vem do Google

`handle_new_user()` passa a ler `full_name`/`name` de
`raw_user_meta_data` (formato que o Google preenche) em vez de
`display_name` (formato do cadastro por senha, que deixa de existir). Nenhuma
coluna nova — `profiles.display_name` continua a mesma. Não importar
`avatar_url` nem qualquer outro campo do Google além do nome — mantém o
princípio de minimização já em vigor.

### 5. Pré-requisito fora do repositório

Antes da implementação começar, é necessário: criar credenciais OAuth no
Google Cloud Console (tela de consentimento + Client ID/Secret) e configurar
esse Client ID/Secret em Supabase Dashboard → Authentication → Providers →
Google, usando a redirect URI que o próprio Supabase informa nessa tela. Nada
disso mora neste repositório — é a parte do usuário, orientada por mim quando
ele estiver pronto para fazer.

### 6. Testes — limite reconhecido, mais bypass de sessão para o navegador

O consentimento do Google não é automatizável em E2E de forma confiável (não
é prática recomendada nem estável simular o login do Google via Playwright).
Cobertura prevista:
- Unitário: `signInWithGoogleAction` monta a URL certa e chama `redirect`.
- Unitário/compliance: `handle_new_user()` valida o mapeamento `full_name`/
  `name` → `display_name` (`tests/compliance/profile-creation.test.ts`).
- `app/auth/callback/route.ts` mantém sua cobertura atual (branch
  `exchangeCodeForSession` já existe, não é tocado nesta etapa).
- `auth-flow.spec.ts`: os testes que exercitam formulário de e-mail/senha são
  removidos; um teste novo confirma que `/login` mostra só o botão do Google
  e que as rotas removidas (`/signup`, `/forgot-password`, `/reset-password`,
  `/confirm-email`) não existem mais.
- **Nova rota `app/auth/test-session/route.ts`** (só para teste): recebe
  `accessToken`/`refreshToken` de uma sessão já emitida (o harness de teste
  continua autenticando via `signInWithPassword` — a API do Supabase, não a
  nossa UI, continua aceitando senha; só paramos de expor isso na interface)
  e escreve os cookies de sessão reais via `supabase.auth.setSession(...)`,
  reaproveitando a serialização de cookie do próprio SDK em vez de montá-los
  à mão. Bloqueada por `NODE_ENV === "production"` — `next dev` (usado tanto
  localmente quanto pelo `webServer` do Playwright em CI) sempre resolve para
  `"development"`; qualquer deploy real usa `next build`/`next start`
  (`"production"`) e recebe 404. Sem segredo adicional: o token só é útil
  para quem já tem uma sessão válida emitida pelo próprio Supabase, então o
  bypass não abre um caminho de autenticação novo, só evita repetir a UI.
- `tests/e2e/support.ts` ganha `authenticateBrowser(page, email, password)`,
  que assina a sessão via `signInWithPassword` e chama a rota acima. Os oito
  specs afetados trocam o corpo do `login()` local (preencher formulário) por
  essa chamada — assinatura e todos os call sites ficam iguais.
- Resto da suíte E2E: sem mudança de comportamento esperada além da troca de
  mecanismo de login, valida-se rodando a suíte inteira ao final.
- O fluxo real de consentimento do Google fica fora da cobertura automatizada
  — validação final é manual, feita por mim junto com o usuário depois que
  as credenciais do Google/Supabase estiverem configuradas.

### 7. Documentação — atualizada como parte da implementação, não depois

`CLAUDE.md`: remove "OAuth" de "Fora de escopo no MVP"; registra Google como
único método de autenticação. `.cadence/policies/data-handling.md` §2: troca
"e-mail e senha" por "identidade do Google (e-mail, nome)". `lgpd-mapping.md`:
adiciona Google à lista de operadores e ajusta a base legal da linha
"Autenticar o usuário". `security-exceptions.md`: fecha a exceção de retenção
de conta não confirmada, registrando que ela deixou de se aplicar a partir
desta etapa (contas antigas dessa exceção não existem mais após o reset do
banco). `docs/planning/etapa-05-autenticacao.md`: recebe uma nota de decisão
revisada com data, sem reescrever a decisão original (convenção do índice de
planejamento).

## Estrutura prevista

```text
app/
├── login/page.tsx                        (reescrita — só botão Google)
├── signup/                                (removido)
├── confirm-email/                         (removido)
├── forgot-password/                       (removido)
└── reset-password/                        (removido)

lib/
├── actions/auth.ts                        (só signInWithGoogleAction + signOutAction)
└── auth/
    ├── sign-in.ts                         (removido — signInWithPassword não é mais usado na UI)
    ├── sign-up.ts                         (removido)
    ├── request-password-reset.ts          (removido)
    ├── update-password.ts                 (removido)
    ├── resend-confirmation.ts             (removido)
    └── sign-out.ts                        (mantido)

components/auth/
├── password-field.tsx                     (removido)
├── auth-shell.tsx                         (avaliar se ainda é usado — só onboarding/workspace ficaria)
└── auth-shell.module.css

db/migrations/
└── (nova) — ajusta handle_new_user() para ler full_name/name

app/auth/test-session/route.ts             (novo — bypass de sessão só para E2E, bloqueado fora de dev)

tests/e2e/
├── support.ts                             (novo authenticateBrowser())
├── auth-flow.spec.ts                      (reduzido: sem formulário de senha, com checagem de rotas removidas)
├── homepage.spec.ts                       (sem link "Criar conta")
└── (goals|fixed-bills|transactions-dashboard|visual-foundation|visual-polish|
    mobile-experience|login-polish).spec.ts (login() local troca formulário por authenticateBrowser())
```

## Subtarefas

- [x] 1. Atualizar `CLAUDE.md`, `data-handling.md`, `lgpd-mapping.md`,
      `security-exceptions.md` e a nota de decisão da Etapa 05
- [x] 2. Confirmar credenciais Google/Supabase configuradas pelo usuário
      (pré-requisito bloqueante para os próximos passos)
- [x] 3. Migration ajustando `handle_new_user()` para `full_name`/`name`
- [x] 4. `signInWithGoogleAction` + teste unitário (vermelho antes)
- [x] 5. Reescrever `/login`; remover `/signup`, `/confirm-email`,
      `/forgot-password`, `/reset-password` e código associado
- [x] 6. Criar `app/auth/test-session/route.ts` e `authenticateBrowser()` em
      `tests/e2e/support.ts`; atualizar o `login()` local dos oito specs
      afetados; reescrever `auth-flow.spec.ts`; ajustar `homepage.spec.ts`
      (sem link "Criar conta")
- [ ] 7. Reset do banco de teste — **fica com o usuário**, ele quer fazer
      isso no momento de começar o uso real com a esposa, não como parte
      automática desta etapa
- [x] 8. Validação final: unitários, compliance, E2E sem skips, lint,
      TypeScript, build verdes. Verificação manual extra: `/auth/test-session`
      confirmado 404 sob `next start` (produção) e `/login` 200 no mesmo
      build. Consentimento real do Google verificado ponta a ponta pelo teste
      E2E "o botão do Google inicia o redirect real até o Google" (chega em
      `accounts.google.com`, não completa o login) — clique manual completo
      com uma conta Google real fica para o usuário experimentar.

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Documentação
primeiro; migration e Server Action de Google em commits próprios; remoção da
UI e das rotas antigas em commit(s) próprio(s); ajuste de testes junto da
mudança que os motiva; conclusão documental por último.

## Notas

- Plano registrado a pedido do usuário após análise da codebase (chain of
  thought apresentado antes deste registro). Implementação aguarda a
  subtarefa 2 — usuário está preparando as credenciais Google/Supabase e vai
  pedir orientação para esse passo.
- As três confirmações levantadas na análise (remoção real de e-mail/senha,
  aceitar a lacuna de cobertura E2E do consentimento do Google, e puxar
  `full_name` do Google para `display_name`) foram aceitas implicitamente ao
  autorizar o registro deste plano — sem objeção do usuário a nenhuma delas.
- Validação final: 459/459 testes Vitest verdes em 47 arquivos (incluindo
  compliance); 40/40 E2E aprovados sem skips; lint sem avisos, TypeScript sem
  erros, build de produção verde. Rota table do build confirma `/signup`,
  `/confirm-email`, `/forgot-password`, `/reset-password` ausentes e
  `/auth/test-session` presente como rota dinâmica.
- Único item em aberto: subtarefa 7 (reset do banco de teste) fica por conta
  do usuário, no momento em que ele decidir começar o uso real — não faz
  parte do "pronto" desta etapa por decisão dele, registrada na conversa.
