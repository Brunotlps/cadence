# Exceções de segurança aceitas

Registro de vulnerabilidades de dependências conhecidas e aceitas conscientemente,
com a condição que deve disparar reavaliação. Atualizar este arquivo sempre que uma
exceção for aceita, resolvida ou expirar.

## esbuild (via drizzle-kit) — moderate

- **Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
  — o dev server do esbuild aceita requisições e responde a qualquer origem.
- **Caminho:** `drizzle-kit` (devDependency direta) → `@esbuild-kit/esm-loader` →
  `@esbuild-kit/core-utils` → `esbuild`.
- **Por que aceitamos:** só afeta devDependencies. `esbuild` é usado internamente pelo
  `drizzle-kit` para rodar `db:generate`/`db:migrate` localmente; não entra no bundle
  de produção nem roda em ambiente exposto (Vercel). O fix automático (`npm audit fix
  --force`) rebaixaria `drizzle-kit` de `0.31.10` para `0.18.1`, uma regressão maior
  que o risco atual.
- **Gatilho para reavaliar:** se `drizzle-kit db:generate`/`db:migrate` passar a rodar
  em CI/CD ou em qualquer ambiente acessível pela rede (hoje só roda localmente), ou
  quando uma versão do `drizzle-kit` atualizar sua dependência de `esbuild` sem exigir
  downgrade.

## brace-expansion (via eslint / eslint-config-next) — high

- **Advisory:** [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg)
  — DoS por expansão de padrão sem limite, causando estouro de memória.
- **Caminho:** `eslint` e `eslint-config-next` (devDependencies diretas) →
  `eslint-plugin-import`/`jsx-a11y`/`react` → `minimatch` → `brace-expansion`.
- **Por que aceitamos:** só devDependency, roda apenas durante `npm run lint` em
  ambiente controlado (máquina de dev e CI), nunca em produção. O fix automático
  forçaria `eslint@10.8.0`, um major bump não testado com `eslint-config-next`
  atual.
- **Gatilho para reavaliar:** quando `eslint-config-next` publicar uma versão
  compatível com `eslint` 10.x, ou se o comando de lint passar a rodar sobre input
  não confiável (não é o caso).

## postcss e sharp (via next) — resolvidos via override, não são mais exceções ativas

- Ambos eram dependências transitivas de `next` (`postcss@8.4.31` e `sharp@0.34.5`),
  em `dependencies` de produção — `sharp` é usado pelo otimizador de imagem do Next.
- Fixamos via `overrides` no `package.json`: `postcss` em `8.5.25` e `sharp` em
  `0.35.3` (primeira versão estável fora da faixa vulnerável `<0.35.0`).
- Validado com `npm install && npm run build` — build de produção completo sem
  erros.
- **Gatilho para reavaliar:** antes de implementar qualquer feature de upload/
  processamento de imagem (hoje fora de escopo do MVP), confirmar que `sharp@0.35.3`
  segue compatível com o uso do Next. Remover o override quando uma versão do `next`
  atualizar essas dependências internamente para versões não vulneráveis.
