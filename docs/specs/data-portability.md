# Spec: portabilidade e exportação de dados

Atende ao direito de portabilidade (art. 18, V) e ao livre acesso (art. 6º, IV).

## Requisito

O usuário pode exportar, a qualquer momento e sem custo, todos os dados do
workspace de que participa, em formato aberto e legível por máquina.

O produto vigente assume um workspace por pessoa. Por isso, o pacote de
exportação representa coleções por entidade, mas hoje contém no máximo um
workspace por usuário.

## Formato

- JSON (estruturado, para reimportação) e/ou CSV (por entidade, para planilha).
- Sem campos internos irrelevantes (chaves técnicas podem ser mantidas, mas o foco é
  o dado do usuário: lançamentos, metas, contas fixas, membros do workspace).
- Códigos persistidos são o contrato portável. Rótulos traduzidos podem ser incluídos
  em campos adicionais, mas nunca substituir o código original.
- Valores `numeric(12,2)` saem como string decimal, preservando centavos sem
  arredondamento de ponto flutuante; datas usam ISO (`YYYY-MM-DD`) e timestamps ISO
  8601.

## Contrato de exportação do perfil

O pacote inclui o perfil da própria pessoa autenticada:

| Campo          | Representação                                      |
| -------------- | -------------------------------------------------- |
| `id`           | UUID da própria pessoa                             |
| `display_name` | nome de exibição opcional                          |
| `accent_color` | `preto`, `rosa` ou `verde`                         |
| `created_at`   | timestamp ISO 8601                                 |

A preferência é exportada como código persistido, não como valor hexadecimal. O
perfil de outro membro do workspace não entra no pacote: `profiles` é isolado por
`id = auth.uid()`, independentemente da membership compartilhada.

## Contrato de exportação de lançamentos

Cada lançamento exportado inclui:

| Campo            | Representação                                      |
| ---------------- | --------------------------------------------------- |
| `id`             | UUID do lançamento                                  |
| `workspace_id`   | UUID do workspace                                   |
| `created_by`     | UUID do membro que lançou                          |
| `kind`           | `expense`, `income` ou `contribution`               |
| `amount`         | string decimal positiva com duas casas              |
| `category`       | código estável ou `null` para aporte              |
| `description`    | texto opcional, com até 200 caracteres             |
| `payment_method` | código estável opcional                          |
| `goal_id`        | UUID da meta associada ou `null`                    |
| `fixed_bill_id`  | UUID da conta fixa associada ou `null`               |
| `occurred_on`    | data civil `YYYY-MM-DD`                             |
| `created_at`     | timestamp ISO 8601                                  |

Categorias persistidas: `alimentacao`, `aluguel`, `assinaturas`, `automoveis`,
`combustivel`, `condominio`, `internet`, `lazer`, `luz`, `renda`, `saude`.

Formas de pagamento persistidas: `pix`, `credit_card`, `debit_card`, `cash`,
`boleto`, `bank_transfer`, `other`. Ausência de forma de pagamento é `null` no
JSON e campo vazio no CSV.

O JSON pode acrescentar `category_label`, `payment_method_label` ou equivalentes
para leitura humana, desde que preserve os campos de código acima. No CSV, cada
entidade usa arquivo separado e cabeçalho estável.

## Contrato de exportação de metas

Cada meta existente no momento da exportação inclui:

| Campo               | Representação                                  |
| ------------------- | ---------------------------------------------- |
| `id`                | UUID da meta                                   |
| `workspace_id`      | UUID do workspace                              |
| `name`              | nome normalizado, com até 100 caracteres       |
| `target_amount`     | string decimal positiva com duas casas         |
| `suggested_monthly` | string decimal positiva ou `null`              |
| `started_on`        | data civil `YYYY-MM-DD` em `America/Sao_Paulo` |
| `created_at`        | timestamp ISO 8601                             |

Metas excluídas por hard-delete não aparecem em exportações posteriores. Seus
aportes, porém, continuam no contrato de lançamentos com `kind=contribution` e
`goal_id=null`: eles preservam o histórico financeiro sem reter ou duplicar o nome
da meta apagada.

## Contrato de exportação de contas fixas

Cada conta fixa existente no momento da exportação inclui:

| Campo              | Representação                                               |
| ------------------ | ----------------------------------------------------------- |
| `id`               | UUID da conta fixa                                          |
| `workspace_id`     | UUID do workspace                                           |
| `name`             | nome normalizado, com até 100 caracteres                    |
| `due_day`          | inteiro entre 1 e 31                                        |
| `category`         | código estável de categoria de despesa                      |
| `autopay`          | booleano de débito automático                               |
| `variable_amount`  | booleano que identifica estimativa variável                 |
| `estimated_amount` | string decimal positiva com duas casas                      |
| `started_on`       | data civil `YYYY-MM-DD` em `America/Sao_Paulo`              |
| `created_at`       | timestamp ISO 8601                                          |

Status mensal, data de vencimento ajustada, total realizado e quantidade de
pagamentos não são exportados como campos da conta: são projeções recalculáveis a
partir de `due_day`, mês de referência e lançamentos vinculados.

Contas encerradas por hard-delete não aparecem em exportações posteriores. Os
pagamentos já feitos continuam no contrato de lançamentos como despesas, com
`fixed_bill_id=null`, categoria, valor e data preservados. O nome da conta apagada
não é duplicado no lançamento nem mantido como tombstone.

## Escopo

- Exporta apenas dados do workspace do qual o solicitante é membro (respeita RLS).
- Não inclui hash de senha nem tokens (dados de autenticação não são exportáveis).

## Fluxo

1. Usuário aciona "Exportar meus dados" nas configurações.
2. Backend gera o pacote lendo com a sessão do próprio usuário (RLS ativo).
3. Entrega como download direto (sem envio por e-mail que exponha dados).

## Guardrail

A geração da exportação NUNCA usa a service-role key (que ignora RLS). Deve rodar no
contexto autenticado do usuário, garantindo que ninguém exporte dado alheio.

Lançamentos excluídos individualmente usam hard-delete imediato e, portanto, não
fazem parte de exportações posteriores. Não há tombstone ou cópia residual a incluir.
