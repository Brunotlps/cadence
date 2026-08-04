# Etapa 05 — Autenticação (email/senha)

**Status:** em andamento
**Aberto em:** 2026-08-04
**Depende de:** Etapa 04 (schema, RLS, trigger `handle_new_user`, `create_workspace_with_owner`)

## Objetivo

Implementar o fluxo de autenticação por e-mail/senha via Supabase Auth: cadastro,
confirmação de e-mail, login, recuperação de senha, sessão persistente e criação
guiada do primeiro workspace. É a dependência de toda tela subsequente.

## Decisões fechadas (spec original)

1. **Método:** e-mail/senha (sem magic link, sem OAuth social, no MVP).
2. **Confirmação de e-mail:** obrigatória antes do primeiro login. Usuário se cadastra,
   recebe e-mail de confirmação, só consegue entrar depois de confirmar.
3. **Recuperação de senha:** incluída nesta etapa (fluxo completo: solicitar → e-mail
   → redefinir).
4. **Criação do workspace:** tela explícita pós-cadastro, pedindo o nome do espaço
   (ex: "Nosso espaço" / "Bruno & Alyne"). Chama `create_workspace_with_owner` no
   submit — não é automático e silencioso.
5. **Duração de sessão:** persistente por padrão (refresh token de vida longa,
   renovação automática em background). Sem toggle de "lembrar de mim" na UI.
   Logout continua explícito.
6. **Mensagens de erro (cadastro e recuperação de senha):** genéricas, sem revelar se
   um e-mail já está cadastrado. Mitigação de enumeração de conta.
7. **URLs de redirect do Supabase Auth:** restritas a produção + `localhost`. Sem
   suporte a preview deploys nesta etapa — confirmação de e-mail e reset de senha só
   são testáveis em produção ou localmente. Mais simples de configurar e mais estrito
   por padrão; revisitar se o fluxo de PR/preview passar a exigir testar isso
   isoladamente.
8. **Templates de e-mail:** os padrões do Supabase por enquanto, sem customização
   visual. Fica registrado como possível item de polimento futuro (fora do MVP).

## Gaps identificados na spec e decisões técnicas propostas

A spec fechada deixou 4 pontos deliberadamente em aberto para este plano. Resolvidos
a seguir, com o código existente das etapas 01–04 verificado antes de decidir (não é
suposição):

### 9. Rate limiting (login e recuperação de senha)

Sem rate limiting customizado na aplicação. Supabase Auth (GoTrue) já aplica rate
limits nativos por IP/e-mail em nível de infraestrutura, configuráveis em
Dashboard → Authentication → Rate Limits. Implementar algo próprio exigiria guardar
IP ou algum identificador de tentativa na nossa base — conflita com
`data-handling.md` §1 ("Endereços IP... nem em logs de aplicação, nem em tabelas").
O controle nativo roda na infra do Supabase, coberta pelo DPA do fornecedor — mesmo
raciocínio já usado para outros dados operacionais de terceiros.

Os campos reais do dashboard (verificados na tela, diferentes do que havíamos
suposto inicialmente — não existe um campo separado de "password recovery"; entra
junto de "sending emails") e os valores **efetivamente configurados**:

| Campo (Dashboard → Authentication → Rate Limits) | Valor configurado | Racional |
| --- | --- | --- |
| Rate limit for sign-ups and sign-ins (por IP)     | 30 req/5min (360/h) — default | Cobre tentativas de login/cadastro; default já adequado, sem necessidade de apertar mais para o volume do projeto |
| Rate limit for sending emails (projeto inteiro)   | **15/h** | Cobre confirmação de cadastro + recuperação de senha juntos. O default de 2/h é o teto do SMTP compartilhado do Supabase (best-effort, não recomendado além de teste) — resolvido migrando para SMTP customizado (ver decisão 14 abaixo), o que liberou o campo para um valor deliberado |
| Rate limit for token refreshes                    | 150 req/5min (default) | Não é superfície de ataque de credencial |
| Rate limit for token verifications                | 30 req/5min (default) | Só relevante para OTP/magic link — não usado (decisão 1: só email/senha) |
| Rate limit for anonymous users / SMS / Web3        | defaults, sem alteração | Recursos não usados no projeto |

### 14. SMTP customizado (Resend) — decisão adicional, não prevista nos 4 gaps originais

Ao configurar o rate limit de e-mail (item 9), identificamos que o campo
"Rate limit for sending emails" com valor default (2/h) não era uma escolha de
segurança calibrada — é o teto do serviço de SMTP compartilhado do próprio
Supabase, explicitamente marcado na documentação deles como "best-effort, não
recomendado além de testes", e vale para o projeto inteiro (não por usuário).

Decisão: configurar SMTP customizado via **Resend**, usando um subdomínio dedicado
(`mail.nousflow.com.br`, sob o domínio `nousflow.com.br` — já registrado e livre de
uso ativo, DNS gerenciado via Cloudflare) para isolar a configuração de envio do
domínio raiz, sem tocar nos registros SPF (`v=spf1 -all`) e DMARC (`p=reject`)
deixados por um projeto anterior nesse domínio. Registros DNS (MX, SPF, DKIM)
criados sob `send.mail.nousflow.com.br`, verificados e propagados. Testado
ponta a ponta: autenticação SMTP direta (`235 Authentication successful`) e disparo
real de e-mail de confirmação via `POST /auth/v1/signup` do Supabase (HTTP 200,
e-mail recebido).

A API key do Resend usada para o SMTP passou pela conversa de configuração (visível
via seleção no editor) antes de ser rotacionada — por higiene, foi revogada e
substituída por uma nova antes de considerar o setup concluído. Key vive em
`RESEND_API_KEY` no `.env.local` (gitignored) só para o teste manual via curl feito
durante esta configuração; não é uma variável de ambiente usada pela aplicação (o
envio de e-mail é feito pelo GoTrue do Supabase, não pelo nosso código).

### 10. Sessão e proteção de rota — middleware + defesa em profundidade

`middleware.ts` na raiz, usando `@supabase/ssr`, como fonte de verdade para refresh
de cookie de sessão e redirect de rotas não autenticadas tentando acessar áreas
protegidas. Cada layout de rota protegida (`app/(protected)/layout.tsx` ou
equivalente) também chama `supabase.auth.getUser()` antes de renderizar dado
sensível — checagem redundante, mesmo princípio de "RLS não substitui filtro de
app" já aplicado no projeto (etapa 04), agora estendido a autorização de rota: o
middleware sozinho não é a única linha de defesa.

Trade-off descartado: depender só de checagem em Server Component, sem middleware.
Problema — Server Components não podem escrever cookies (restrição do Next.js), então
o refresh proativo do token de sessão (necessário para a "sessão persistente" da
decisão 5) não teria onde acontecer de forma centralizada; cada página precisaria
reimplementar a checagem, com risco de esquecimento.

**Nota de execução:** o Next.js 16 (versão já usada no projeto) renomeou a convenção
de `middleware.ts`/`export function middleware` para `proxy.ts`/`export function
proxy` — mesma funcionalidade, nome novo. Não estava previsto no plano original;
usar `middleware.ts` gerava aviso de depreciação no build. Implementado direto como
`proxy.ts`, sem passar pelo nome antigo.

### 11. Usuário que nunca confirma o e-mail

Sem purge automático nesta etapa. `handle_new_user` dispara em
`AFTER INSERT on auth.users`, ou seja, roda no cadastro, antes da confirmação —
um usuário que nunca confirma deixa `auth.users` (não confirmado) + `profiles` no
banco indefinidamente, sem workspace associado. Isso tensiona o princípio de
minimização/necessidade (LGPD art. 6º), mas implementar um job de limpeza (cron/Edge
Function) é infraestrutura nova, fora do escopo desta etapa.

Registrado como risco aceito conscientemente em
`docs/compliance/security-exceptions.md` (mesmo padrão usado para as exceções de
`npm audit`), com gatilho de reavaliação explícito. Issue de follow-up aberta no
GitHub para o job de limpeza futuro (ver link na seção de notas).

### 12. Cobertura de banco — `handle_new_user` / `create_workspace_with_owner`

RLS de `workspaces` e `workspace_members` já cobre a tela de nomear workspace
(migration `0001_rls-and-security-definer-functions.sql`, já fechada na etapa 04:
`workspaces_select_member`, `workspaces_update_member`,
`workspace_members_select_member`) — **não é preciso reabrir essa decisão nem criar
policy nova**. A tela só chama a função `create_workspace_with_owner`, que deriva o
owner de `auth.uid()` internamente.

O que falta: fechar uma observação de hardening já registrada (não corrigida, não
explorável até agora) no findings log da etapa 04 —
`create_workspace_with_owner`, `is_workspace_member` e `handle_new_user` ainda têm
`EXECUTE` concedido a `PUBLIC`/`anon`, mais permissivo que o necessário. A etapa 05 é
o primeiro momento em que `create_workspace_with_owner` passa a ser chamada de fato
pela aplicação em nome de um usuário real — faz sentido restringir agora:
`revoke execute ... from public, anon` / `grant execute ... to authenticated` nessa
função. (`is_workspace_member` e `handle_new_user` não são invocáveis via RPC de
forma útil — o segundo é `trigger`, o primeiro só lê — então permanecem como estavam,
sem mudança nesta etapa.)

### 13. Camada de ações — Server Actions com lógica extraída

Server Actions para os fluxos de auth (`signUp`, `signIn`, `signOut`,
`requestPasswordReset`, `updatePassword`, `resendConfirmation`), não Route Handlers.
Mais idiomático no App Router; o cliente Supabase server-side
(`lib/supabase/server.ts`) já sabe setar cookies diretamente numa Server Action.

**Condição:** a lógica de negócio de cada Server Action fica extraída em uma função
pura correspondente em `lib/auth/` (ex: `lib/auth/sign-up.ts`), testável isoladamente
sem depender do runtime do Next.js. A Server Action em si é só uma casca fina que
chama essa função e trata o retorno (redirect, erro genérico, etc). `CLAUDE.md`
atualizado para refletir Server Actions como o padrão adotado para mutações de auth.

## Subtarefas

- [x] 1. Config Supabase Auth: redirect URLs (produção + `localhost`), SMTP
      customizado via Resend (subdomínio `mail.nousflow.com.br`), rate limits
      (valores da tabela da decisão 9), templates padrão confirmados ativos
      ("Confirm sign up" e "Reset password" na seção Authentication de
      Emails → Templates — core do fluxo, sem toggle, sempre ativos; validado
      na prática recebendo o e-mail de confirmação durante o teste de SMTP)
- [x] 2. Migration: `revoke`/`grant` de `EXECUTE` em `create_workspace_with_owner`
      (restringe a `authenticated`) — `db/migrations/0004_restrict-create-workspace-grant.sql`,
      coberta por `tests/compliance/function-grants.test.ts`
- [x] 3. Nota em `docs/compliance/security-exceptions.md` sobre retenção de conta não
      confirmada + issue no GitHub com o follow-up do job de limpeza (feito junto da
      aprovação do plano — commit `9b2c76a`, issue #2)
- [x] 4. `proxy.ts` (convenção Next.js 16, substitui `middleware.ts`) + helper de
      refresh de sessão (`lib/supabase/middleware.ts`), matcher excluindo assets
      estáticos. Layout protegido mínimo (`app/(protected)/layout.tsx`) com check
      redundante de `auth.getUser()`, stub `/dashboard` e stub `/login` como alvo do
      redirect — conteúdo real das telas fica para a subtarefa 8. Coberto por
      `tests/e2e/protected-route.spec.ts`
- [ ] 5. Testes primeiro (TDD) — `tests/compliance/` e/ou E2E: fluxo completo
      (cadastro → confirmação → workspace → login → logout), mensagens de erro
      genéricas (sem enumeração de conta), redirect de rota protegida sem sessão
- [ ] 6. `lib/auth/` — funções puras: `sign-up.ts`, `sign-in.ts`, `sign-out.ts`,
      `request-password-reset.ts`, `update-password.ts`, `resend-confirmation.ts`
- [ ] 7. Server Actions finas em cima de `lib/auth/` (form actions das telas)
- [ ] 8. Telas: cadastro, espera de confirmação (+ reenvio), login, recuperação
      (solicitar + redefinir), criação de workspace, logout
- [x] 9. Layouts protegidos com check redundante de `auth.getUser()` — mecanismo já
      criado na subtarefa 4 (`app/(protected)/layout.tsx`); novas rotas protegidas só
      precisam viver sob esse grupo de rotas
- [ ] 10. Validação: lint, testes, build verdes; confirmar que RLS/isolamento da
       etapa 04 continuam intactos (rodar `tests/compliance/rls-isolation.test.ts` e
       `cascade-deletion.test.ts` sem alteração de resultado)

## Notas

- Issue de follow-up (job de limpeza de contas não confirmadas):
  https://github.com/Brunotlps/cadence/issues/2
- Valores de rate limit da subtarefa 1 são propostos por este plano; ficam pendentes
  de aplicação manual no dashboard (sem acesso de dashboard neste ambiente) e
  confirmação dos números reais configurados.
