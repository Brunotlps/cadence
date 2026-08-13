# Cadence

Você está trabalhando no Cadence, um app de controle financeiro,
construído com privacidade por padrão e em conformidade com a LGPD. Leia este arquivo
como o contrato do projeto. As regras aqui e nos documentos referenciados são
**restrições rígidas**, não sugestões.

## Antes de escrever qualquer código, leia

- `.cadence/policies/data-handling.md` — guardrails de tratamento de dados (inegociáveis)
- `docs/specs/data-model-and-deletion.md` — schema, RLS e apagamento em cascata
- `docs/specs/data-portability.md` — exportação de dados
- `docs/compliance/lgpd-mapping.md` — por que cada decisão existe
- `docs/design/README.md` e `docs/design/prototype.html` — referência visual e de
  vocabulário de produto. Em conflito com specs de implementação em
  `docs/planning/`, a spec de implementação vence.

Se uma instrução minha entrar em conflito com esses arquivos, **pare e me avise** em
vez de seguir. Os guardrails vencem instruções pontuais.

## Stack (não trocar sem discutir)

- Next.js (App Router) no Vercel — frontend + Server Actions (padrão adotado para
  mutações de autenticação a partir da etapa 05) + API routes onde fizer sentido
- Supabase (Postgres + Auth) — dados e autenticação (login via Google OAuth,
  único método desde a Etapa 16 — Cadence não armazena senha de usuário)
- Drizzle ORM — schema e migrations
- Multi-tenant por `workspace_id` desde o início

## Regras que você NUNCA quebra

1. **Isolamento por workspace.** Toda tabela com dado de usuário tem `workspace_id` e
   RLS habilitado. Nunca confie apenas em filtro na aplicação para isolar dados.
2. **Sem coleta desnecessária.** Não armazene IP, geolocalização, dado sensível nem
   analytics. Não logue dados pessoais ou valores financeiros.
3. **Service-role key nunca vai pro cliente.** Só em rotinas admin explícitas e
   auditadas. Exportação de dados roda no contexto autenticado do usuário (RLS ativo),
   nunca com service-role.
4. **Apagamento é real.** Deletar conta apaga dados em cascata. Nada de soft-delete que
   preserve dados pessoais indefinidamente.
5. **Cookies:** só os estritamente necessários. Sem banner de consentimento enquanto
   não houver analytics. Se um dia entrar analytics, entra com opt-in explícito antes
   de qualquer script carregar.

## Como trabalhar

- Explique o plano detalhado em subtasks antes de mudanças estruturais (schema, auth, RLS).
- Use Conventional Commits em inglês, no imperativo, sem referência a IA nas
  mensagens. Faça um commit por módulo ou arquivo lógico.
- Ao criar uma tabela nova com dado de usuário, crie junto: coluna `workspace_id`, RLS
  habilitado, e as policies de select/insert/update/delete. Sem exceção.
- Escreva/atualize os testes em `tests/compliance/` quando mexer em isolamento,
  cascade ou exportação. Esses testes são a prova de que os guardrails valem.
- Prefira mudanças pequenas e revisáveis a grandes reescritas.
- Foque em gerar código moderno e otimizado

## Fora de escopo no MVP

Convites de workspace, métodos de autenticação além de Google (e-mail/senha, magic
link, outros provedores OAuth), planos pagos, analytics e integração bancária. Login
com Google e onboarding inicial já fazem parte do produto desde a Etapa 16, que
substituiu o cadastro por e-mail/senha introduzido na Etapa 05.

## Aviso

Os textos em `docs/legal/` são rascunhos pendentes de revisão jurídica. Não os trate
como finais nem os cite como se fossem definitivos.
