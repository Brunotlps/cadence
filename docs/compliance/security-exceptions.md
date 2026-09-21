# Exceções de segurança aceitas

Registro de vulnerabilidades de dependências conhecidas e aceitas conscientemente,
com a condição que deve disparar reavaliação. Atualizar este arquivo sempre que uma
exceção for aceita, resolvida ou expirar.

## esbuild (via drizzle-kit) — moderate

- **Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
  — o dev server do esbuild aceita requisições e responde a qualquer origem.
- **Caminho:** `drizzle-kit` (devDependency direta) → `@esbuild-kit/esm-loader` →
  `@esbuild-kit/core-utils` → `esbuild`.
- **Por que aceitamos:** só afeta devDependencies. `drizzle-kit` permanece restrito a
  `db:generate` local; desde a correção da issue #39, `db:migrate` usa diretamente o
  migrador do `drizzle-orm` por um runner `tsx` próprio e não carrega o CLI do
  `drizzle-kit`. Nenhum desses caminhos entra no bundle de produção ou roda em
  ambiente exposto (Vercel). O fix automático (`npm audit fix --force`) rebaixaria
  `drizzle-kit` de `0.31.10` para `0.18.1`, uma regressão maior que o risco atual.
- **Gatilho para reavaliar:** se `drizzle-kit db:generate` passar a rodar em CI/CD ou
  em qualquer ambiente acessível pela rede (hoje só roda localmente), ou quando uma
  versão do `drizzle-kit` atualizar sua dependência de `esbuild` sem exigir downgrade.

## brace-expansion (via eslint / eslint-config-next) — RESOLVIDA

- **Advisory:** [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)
  — DoS por expansão de padrão sem limite, causando estouro de memória.
- **Resolução (21/09/2026):** o lockfile resolve `brace-expansion@1.1.18` e
  `brace-expansion@5.0.9`, acima das primeiras versões corrigidas `1.1.17` e
  `5.0.8`. `npm audit --json` não reporta mais o advisory. A exceção deixa de ser
  ativa e permanece aqui somente como histórico.

## Retenção indefinida de conta não confirmada (etapa 05 — autenticação) — RESOLVIDA na Etapa 16

- **Resolução (13/08/2026):** a Etapa 16 substituiu e-mail/senha por login somente
  com Google. Contas OAuth chegam com e-mail já verificado pelo próprio Google —
  não existe mais o estado "cadastrado, nunca confirmado" que originava esta
  exceção, porque não há mais uma etapa de confirmação de e-mail separada do login.
  O reset do banco de teste (subtarefa 7 da Etapa 16) remove as linhas
  remanescentes desse estado antigo. Nenhum job de limpeza automática foi
  necessário — a causa raiz deixou de existir.
- O texto original abaixo é preservado como histórico da etapa 05.

- **O que é:** `handle_new_user()` dispara em `AFTER INSERT on auth.users`, ou seja,
  roda no momento do cadastro, antes de qualquer confirmação de e-mail. Um usuário
  que se cadastra e nunca confirma o e-mail deixa uma linha em `auth.users` (não
  confirmada) e uma linha correspondente em `public.profiles` no banco
  indefinidamente, sem workspace associado (a criação do workspace só acontece
  depois da confirmação, por decisão de produto da etapa 05).
- **Por que aceitamos:** os dados retidos são mínimos (e-mail, hash de senha gerido
  pelo Supabase Auth, nome de exibição opcional) — já o mínimo necessário por design,
  não há dado financeiro nem dado sensível envolvido. Implementar um job de limpeza
  automática (cron/Edge Function) é a primeira peça de infraestrutura agendada do
  projeto; fora do escopo da etapa 05, que foca no fluxo síncrono de auth.
- **Tensão reconhecida:** retenção indefinida de conta não confirmada tensiona o
  princípio de minimização/necessidade (LGPD art. 6º). Não é uma vulnerabilidade de
  segurança — é uma lacuna de storage limitation, registrada aqui pelo mesmo padrão
  usado para riscos aceitos conscientemente.
- **Gatilho para reavaliar:** o cadastro público por e-mail/senha faz parte do produto
  desde a Etapa 05, portanto o primeiro gatilho documental já foi atingido. A exceção
  permanece ativa até uma decisão específica sobre a rotina de limpeza; também deve
  ser reavaliada se o volume de contas não confirmadas se tornar operacionalmente
  relevante. Follow-up rastreado na issue do GitHub referenciada em
  `docs/planning/etapa-05-autenticacao.md`.

## postcss e sharp (via next) — RESOLVIDOS

- Ambos eram dependências transitivas de `next` (`postcss@8.4.31` e `sharp@0.34.5`),
  em `dependencies` de produção — `sharp` é usado pelo otimizador de imagem do Next.
- A correção original usava overrides para `postcss@8.5.25` e `sharp@0.35.3`.
  Um advisory posterior de `sharp` tornou vulnerável toda versão `<0.35.4`,
  invalidando a afirmação anterior de que `0.35.3` estava resolvida.
- **Resolução atual (21/09/2026):** `next@16.3.5` declara `sharp@^0.35.4`, o
  lockfile resolve `sharp@0.35.4` e o override de Sharp foi removido. O override
  de `postcss@8.5.25` permanece; sua dependência resolve `nanoid@3.3.19`, fora da
  faixa vulnerável `<3.3.18`.
- **Gatilho para reavaliar:** antes de implementar qualquer feature de upload/
  processamento de imagem (hoje fora de escopo do MVP), confirmar que a versão de
  Sharp resolvida segue corrigida e compatível com o uso do Next. Remover o override
  de PostCSS quando o Next resolver diretamente uma versão igualmente validada.
