# Cadence

App de controle financeiro, construído com privacidade por padrão e em conformidade com a LGPD.

Este repositório começa pelo harness: as regras, specs, políticas e testes que
definem como o produto deve ser construído — antes do código de aplicação. Qualquer
pessoa (ou agente de IA) que trabalhe no projeto encontra aqui os limites e o contrato
do que pode e não pode ser feito.

## Stack

- Frontend + API: Next.js (App Router) no Vercel
- Dados + Auth: Supabase (Postgres + Auth), isolamento por Row-Level Security
- Schema + migrations: Drizzle ORM
- Modelo de dados: multi-tenant desde o dia 1, via `workspace_id`

## Princípios inegociáveis

1. Minimização — não coletamos o que não é necessário. IPs não são armazenados. Sem analytics no MVP.
2. Isolamento por workspace — nenhum dado cruza a fronteira. RLS é a última linha de defesa, não a aplicação.
3. Direito ao apagamento real — deletar conta apaga dados em cascata, de verdade.
4. Consentimento informado — nada de coleta silenciosa.

## Aviso

Os documentos em `docs/legal/` são rascunhos técnicos, não aconselhamento jurídico.
Devem ser revisados por um advogado antes de qualquer uso em produção.
