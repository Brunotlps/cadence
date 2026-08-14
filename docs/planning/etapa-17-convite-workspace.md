# Etapa 17 — Convite de workspace

**Status:** concluído
**Aberto em:** 14/08/2026
**Implementação concluída em:** 14/08/2026
**Depende de:** Etapa 04 (schema + RLS), Etapa 05 (`create_workspace_with_owner`,
`/onboarding/workspace`), Etapa 16 (login só Google, base para o convite ser
resgatado por uma segunda conta Google)

## Objetivo

Permitir que uma segunda pessoa entre no mesmo workspace de quem já usa o
Cadence — hoje isso é impossível pela interface. Decisão de produto do
usuário, confirmada em 14/08/2026 após análise da codebase.

Reverte, para este caso específico, a linha "Convites de workspace... fora de
escopo no MVP" de `CLAUDE.md`. `CLAUDE.md` é atualizado na implementação, não
nesta etapa de registro.

## Diagnóstico confirmado

- `workspace_members` tem RLS habilitado com só a policy `select` para membros
  (`is_workspace_member(workspace_id)`). Não existe policy de `insert` para
  usuário comum — o único caminho de insert é `create_workspace_with_owner`,
  que sempre cria um workspace **novo** com o chamador como dono
  (`db/migrations/0001_rls-and-security-definer-functions.sql:120-141`).
- Todo o app assume **um workspace por pessoa**: `getCurrentWorkspace`
  (`lib/workspace/repository.ts`) busca a membership mais antiga do usuário,
  `order by created_at asc limit 1`. Nenhuma tela lista ou troca entre vários
  workspaces. Um convite que criasse uma segunda participação sem tratar esse
  caso quebraria essa suposição silenciosamente.
- Não existe infraestrutura de envio de e-mail no fluxo de auth — foi
  removida na Etapa 16 junto com e-mail/senha. `RESEND_API_KEY` segue no
  `.env.example` mas não é usado por nenhum código hoje.
- `app/auth/callback/route.ts` já valida e usa um `next` relativo seguro
  (`safeNextPath`), mas `signInWithGoogleAction`
  (`lib/actions/auth.ts`) ignora o `formData` recebido e sempre monta
  `redirectTo` fixo em `/dashboard` — precisa ler um `next` opcional para a
  segunda pessoa continuar para `/join/<token>` depois de logar pela primeira
  vez.
- `.cadence/policies/data-handling.md` §1/§2 estabelece minimização de dados:
  coletar o e-mail de um terceiro que ainda não autenticou, só para convidá-lo,
  seria dado pessoal de terceiro coletado sem ação dele — e exigiria
  reintroduzir envio de e-mail. Optamos por convite via link com token opaco:
  nenhum dado novo é armazenado sobre a pessoa convidada antes dela mesma
  autenticar com o Google.

## Decisões fechadas

### 1. Escopo exato

Entram: tabela `workspace_invites`, RLS e duas funções `SECURITY DEFINER`
(`create_workspace_invite`, `redeem_workspace_invite`), Server Actions e
telas para gerar e resgatar convite, suporte a `next` opcional no login.

Não entram: revogar convite antes de usado, múltiplos workspaces por pessoa,
remover ou trocar papel de um membro existente, convite por e-mail. Continuam
fora de escopo do MVP como um todo.

### 2. Convite via link com token opaco, não por e-mail

O dono do workspace gera um link (`/join/<token>`) e o compartilha pelo canal
que quiser (WhatsApp, etc.), fora do produto. `workspace_invites.token` é um
`uuid` aleatório (`default gen_random_uuid()`), com validade de 7 dias e uso
único. Não guardamos e-mail nem qualquer outro dado da pessoa convidada antes
dela autenticar — o token funciona como credencial de posse, não como
identidade.

### 3. Resgate exige não ter workspace ainda

`redeem_workspace_invite(token)` recusa com erro tipado se quem chama já é
membro de qualquer workspace (`already_has_workspace`), preservando a
suposição de um workspace por pessoa em todo o resto do app. Recusa também
com `invalid_or_expired` se o token não existe, já foi usado ou expirou.

### 4. Funções `SECURITY DEFINER`, mesmo padrão de `create_workspace_with_owner`

- `create_workspace_invite(workspace_id uuid)` — exige
  `is_workspace_member(workspace_id)`, insere o convite com
  `expires_at = now() + interval '7 days'`, devolve `token` e `expires_at`.
- `redeem_workspace_invite(invite_token uuid)` — roda como o dono da função
  (contorna RLS de propósito, igual ao bootstrap de workspace) porque quem
  resgata ainda não é membro do workspace e não teria `select` em
  `workspace_invites` daquele workspace. Insere o membro e marca o convite
  como usado atomicamente.
- Ambas seguem o grant explícito já usado em
  `0004_restrict-create-workspace-grant.sql`: `revoke execute ... from
  public, anon` / `grant execute ... to authenticated`.

### 5. RLS de `workspace_invites`

RLS habilitado, `workspace_id` obrigatório (convenção do projeto para toda
tabela com dado de usuário). Só policy de `select`, restrita a membros do
workspace (`is_workspace_member(workspace_id)`) — serve para listar convites
pendentes no futuro, se necessário. Sem policy de `insert`/`update`/`delete`
para usuário comum: tudo passa pelas duas funções acima. `workspace_id` tem
`on delete cascade` de `workspaces` — convites de um workspace apagado somem
junto, mesmo padrão de `goals`/`fixed_bills`/`transactions`.

### 6. `next` opcional no login

`app/login/page.tsx` lê `searchParams.next`, renderiza um `<input
type="hidden" name="next">` no form quando presente. `signInWithGoogleAction`
lê `formData.get("next")`, valida com a mesma lógica de caminho relativo
seguro já usada em `safeNextPath` (`app/auth/callback/route.ts`) e usa esse
valor (ou `/dashboard` como padrão) ao montar `redirectTo`. Sem isso, alguém
clicando num link de convite sem estar logado perderia o token no meio do
fluxo OAuth.

### 7. Testes — mesmo limite de E2E reconhecido na Etapa 16

Consentimento real do Google não é automatizável. Cobertura prevista:
- Compliance: convite não visível para quem não é membro do workspace;
  resgate recusa token expirado/já usado; resgate recusa quem já tem
  workspace.
- Unitário: `create-invite.ts`, `redeem-invite.ts`,
  `createWorkspaceInviteAction`, `redeemWorkspaceInviteAction`.
- E2E: fluxo feliz completo — conta A cria workspace e gera convite, conta B
  (autenticada via `authenticateBrowser`, o mesmo bypass da Etapa 16) resgata
  e enxerga os mesmos dados do workspace.

### 8. Documentação

`CLAUDE.md`: remove "convites de workspace" de "Fora de escopo no MVP"; passa
a mencionar a existência do convite por link. `docs/specs/data-model-and-deletion.md`:
adiciona `workspace_invites` como entidade, com sua regra de cascata.

## Estrutura prevista

```text
db/
├── schema.ts                              (+ workspaceInvites)
└── migrations/
    └── (nova) — workspace_invites, RLS, create_workspace_invite,
        redeem_workspace_invite, grants

lib/
├── workspace/
│   ├── create-invite.ts                   (novo)
│   └── redeem-invite.ts                   (novo)
└── actions/workspace.ts                   (+ createWorkspaceInviteAction,
                                              redeemWorkspaceInviteAction)

lib/actions/auth.ts                        (signInWithGoogleAction lê next)
app/login/page.tsx                         (hidden input next)

app/(protected)/
├── workspace/invite/page.tsx              (novo — gerar link)
└── join/[token]/page.tsx                  (novo — resgatar)

tests/
├── compliance/workspace-invites.test.ts   (novo)
├── unit/workspace/{create-invite,redeem-invite}.test.ts (novos)
├── unit/actions/workspace.test.ts         (+ casos de convite)
└── e2e/workspace-invite.spec.ts           (novo)
```

## Subtarefas

- [x] 1. Schema (`workspaceInvites`) + migration custom SQL (RLS, as duas
      funções, grants)
- [x] 2. `lib/workspace/{create-invite,redeem-invite}.ts` + Server Actions em
      `lib/actions/workspace.ts`
- [x] 3. `next` opcional em `/login` e `signInWithGoogleAction` — incluiu
      extrair `safeNextPath` para `lib/navigation/safe-next-path.ts` e
      corrigir `lib/supabase/middleware.ts` (proxy) para preservar `next` no
      redirect de rota protegida sem sessão, não só o `/login`/callback
      (achado durante a implementação: sem isso, o próprio middleware perdia
      o destino antes da página de convite sequer rodar)
- [x] 4. UI: tela de gerar link + `app/(protected)/join/[token]/page.tsx`
- [x] 5. Testes: compliance, unit, E2E
- [x] 6. Atualizar `CLAUDE.md` e `docs/specs/data-model-and-deletion.md`
- [x] 7. Validação final: unitários, compliance, E2E sem skips, lint,
      TypeScript, build verdes

## Estratégia de commits

Conventional Commits em inglês, imperativo, sem referência a IA. Schema e
migration primeiro; lib/Server Actions em commit próprio; `next` no login em
commit próprio; UI em commit(s) próprio(s); testes junto da mudança que os
motiva; documentação e fechamento por último.

## Notas

- Plano registrado a pedido do usuário após análise da codebase (chain of
  thought apresentado antes deste registro).
- Durante a subtarefa 3, achei que `lib/supabase/middleware.ts` (rodado pelo
  `proxy.ts`) é o primeiro ponto que intercepta uma visita não autenticada a
  `/join/[token]` ou `/workspace/invite` — e seu redirect pra `/login` não
  preservava o destino. Corrigido junto: `PROTECTED_PATHS` ganhou `/join` e
  `/workspace`, e o redirect passou a anexar `?next=<pathname+search>`. Isso
  também melhorou o comportamento pré-existente de `/dashboard`/`/onboarding`
  sem sessão (antes sempre voltava pro dashboard depois do login, agora volta
  pro destino original) — mudança pequena e no mesmo arquivo que eu já
  precisava tocar, não uma etapa separada.
- Validação final: 492/492 testes Vitest verdes em 52 arquivos (unit +
  compliance, incluindo os 11 novos casos de `workspace-invites.test.ts`);
  42/42 E2E aprovados sem skips (incluindo os 2 novos casos de
  `workspace-invite.spec.ts`); lint sem avisos, TypeScript sem erros, build
  de produção verde com `/join/[token]` e `/workspace/invite` na rota table.
- Achado incidental durante a escrita do E2E: navegar de `/dashboard`
  (hidratado) direto para `/join/[token]` na mesma `page` do Playwright
  produzia `net::ERR_ABORTED` de forma consistente — confirmado via curl e
  via script Playwright avulso que o servidor sempre respondia 200
  corretamente, então é uma particularidade do test runner nesse cenário
  específico de dev server, não um bug do app. O teste em questão não
  precisava mesmo passar por `/dashboard` antes, então a causa raiz não
  importa para o produto — só documentando caso reapareça em outro spec.
