# Spec: modelo de dados e apagamento em cascata

## Princípio

Todo dado de domínio ou financeiro vinculado a usuário pertence a um `workspace`. O
apagamento segue as chaves estrangeiras com `ON DELETE CASCADE`, de modo que remover
um workspace remove automaticamente tudo que depende dele. Remover um usuário remove
suas participações; quando um workspace fica sem membros, ele é removido (ver rotina
abaixo).

Metadado de segurança/controle inerentemente de conta pode ser exceção somente quando
não contiver dado de domínio, financeiro ou de workspace; tiver finalidade limitada,
fronteiras explícitas de acesso com menor privilégio, retenção/hard-delete definidos e
remoção na exclusão da conta. A exceção não autoriza armazenar dados de domínio fora de
`workspace_id` nem reduz as garantias de RLS para dados de workspace.

## Entidades

- **users** — gerenciada pelo Supabase Auth (`auth.users`). Não duplicar dados de
  autenticação. Um espelho mínimo em `public.profiles` guarda nome de exibição e a
  preferência funcional de cor de destaque.
- **workspaces** — o espaço financeiro compartilhado.
- **workspace_members** — vínculo N:N entre usuários e workspaces, com papel.
- **workspace_invites** — convite de uso único e token opaco para entrar num
  workspace existente (etapa 17). Não guarda dado da pessoa convidada — ela só
  passa a existir no vínculo depois de resgatar o convite com a própria conta
  Google.
- **transactions** — lançamentos (despesa/receita/aporte).
- **fixed_bills** — contas fixas recorrentes.
- **goals** — metas financeiras.

## Regras de cascata

- Apagar `workspaces` → apaga `workspace_members`, `workspace_invites`,
  `transactions`, `fixed_bills`, `goals`.
- Apagar usuário (`auth.users`) → apaga `profiles` e `workspace_members` daquele usuário.
- Apagar usuário (`auth.users`) → apaga também qualquer metadado de controle em nível
  de conta que tenha exceção documentada, incluindo `feedback_submission_limits`.
- Workspace sem membros → apagado por rotina transacional (trigger ou função no
  apagamento de conta).

## Schema (Drizzle, ilustrativo)

```ts
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name"),
  accentColor: text("accent_color").default("verde").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), // referencia auth.users.id
  role: text("role").notNull().default("member"), // 'owner' | 'member'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(), // auth.users.id de quem lançou
  kind: text("kind").notNull(), // 'expense' | 'income' | 'contribution'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category"),
  description: text("description"),
  paymentMethod: text("payment_method"),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  fixedBillId: uuid("fixed_bill_id").references(() => fixedBills.id, {
    onDelete: "set null",
  }),
  occurredOn: date("occurred_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fixedBills = pgTable("fixed_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dueDay: integer("due_day").notNull(),
  category: text("category").notNull(),
  autopay: boolean("autopay").notNull().default(false),
  variableAmount: boolean("variable_amount").notNull().default(false),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull(),
  startedOn: date("started_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  suggestedMonthly: numeric("suggested_monthly", { precision: 12, scale: 2 }),
  startedOn: date("started_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## Integridade do perfil e da preferência visual

`profiles` é a entidade pessoal mínima do usuário e, por decisão da Etapa 04, não
pertence a um workspace. A RLS permite `SELECT` e `UPDATE` somente quando
`profiles.id = auth.uid()`; a aplicação repete o filtro explícito por esse mesmo id.

`accent_color` aceita somente os códigos persistidos `preto`, `rosa` e `verde`, com
`verde` como default para perfis existentes e novos. É uma preferência editável, por
isso não recebe trigger de imutabilidade. A atualização aceita somente essa coluna e
deriva o id da sessão, sem aceitar id de perfil do navegador.

O layout autenticado lê a preferência no servidor e a inclui no HTML inicial. Perfil
ausente ou falha de consulta usa verde como fallback e registra apenas o evento
sanitizado `profile_missing` ou `query_failed`, sem UUID, e-mail, cor ou erro bruto.

Apagar a conta remove a linha inteira de `profiles` pela rotina já documentada; a
preferência não deixa tombstone, histórico ou cópia separada.

## Metadado de controle em nível de conta: limite de feedback

`feedback_submission_limits` é uma exceção específica à regra de domínio por
workspace. Sua única finalidade é limitar abuso de submissões autenticadas de feedback.
Ela contém somente `user_id`, `window_started_at`, `submission_count` e `expires_at`:
não guarda feedback, e-mail, pathname, IP, identificador de workspace, dado financeiro
ou analytics. Cadence não persiste conteúdo de feedback, e-mail ou pathname no banco.
O primeiro envio que passa na validação e adquire uma vaga inicia uma janela ancorada
de 24 horas; no máximo três invocações válidas que adquiriram vaga consomem o contador.
Falhas de validação não o consomem. Toda invocação que adquire vaga a consome,
independentemente do resultado do provedor: inclusive um retry ambíguo que reutiliza a
mesma chave de idempotência. Não há decremento compensatório.

A tabela tem RLS habilitada e não concede acesso direto a usuários. Uma função atômica
`public.consume_feedback_submission_limit()` com `search_path` fixo deriva
`auth.uid()` e retorna somente permitir/rejeitar; a limpeza
`public.cleanup_expired_feedback_submission_limits()` é restrita ao scheduler do
banco. Linhas expiradas são sujeitas a hard-delete físico pelo job horário; quando ele
está implantado e operando corretamente, a remoção ocorre em aproximadamente uma hora
de `expires_at`. `public.handle_account_deletion(uuid)` as hard-deleta por uma via
independente na exclusão da conta. Esta
exceção não cria uma categoria geral de dados sem `workspace_id`.

O limite e a entrega são fronteiras separadas: somente tipo, mensagem, pathname
normalizado opcional e, com opt-in explícito, e-mail derivado no servidor podem sair
para o provedor. URL completa, query, fragmento, dados financeiros, identificadores de
usuário/workspace internos, cookies, telemetria, logs e estado de página não fazem parte do
payload. Aceitação pelo provedor é o limite de sucesso; não é confirmação de
recebimento, leitura ou resposta na caixa administrativa.

## Domínio e integridade de `transactions`

Os valores abaixo são códigos persistidos e formam contrato de dado. A interface
traduz os códigos para português, mas rótulos visíveis não substituem esses valores no
banco nem em exportações.

### Tipos

- `expense` — despesa;
- `income` — receita;
- `contribution` — aporte vinculado a uma meta pelo fluxo de Metas.

### Categorias

| Código persistido | Rótulo               |
| ----------------- | -------------------- |
| `alimentacao`     | Alimentação          |
| `aluguel`         | Aluguel              |
| `assinaturas`     | Assinaturas          |
| `automoveis`      | Automóveis           |
| `combustivel`     | Combustível          |
| `condominio`      | Condomínio           |
| `internet`        | Internet             |
| `lazer`           | Lazer                |
| `luz`             | Luz                  |
| `renda`           | Renda                |
| `saude`           | Saúde                |

`income` exige categoria `renda`; `expense` exige uma das demais categorias;
`contribution` exige categoria `NULL`. O formulário da Etapa 06 deriva `income`
somente de `renda` e deriva `expense` das demais categorias, sem aceitar `kind` do
navegador.

### Formas de pagamento

`payment_method` é opcional (`NULL`) e, quando informado, aceita somente:

| Código persistido | Rótulo              |
| ----------------- | ------------------- |
| `pix`             | Pix                 |
| `credit_card`     | Cartão de crédito   |
| `debit_card`      | Cartão de débito    |
| `cash`            | Dinheiro            |
| `boleto`          | Boleto              |
| `bank_transfer`   | Transferência       |
| `other`           | Outro               |

### Outras garantias

- `amount` deve ser positivo, diferente de `NaN` e caber em `numeric(12,2)`;
- `description` é opcional e limitada a 200 caracteres;
- `workspace_id`, `created_by` e `created_at` são imutáveis depois do insert;
- a policy de insert exige `created_by = auth.uid()` além da membership;
- o índice `(workspace_id, occurred_on desc, created_at desc)` sustenta a leitura
  mensal;
- migrations fazem preflight e falham diante de dado antigo incompatível, sem
  reclassificar ou apagar lançamentos silenciosamente.

## Integridade de metas e aportes

- o nome da meta é normalizado sem espaços nas pontas, não pode ficar vazio e aceita
  no máximo 100 caracteres;
- `target_amount` deve ser positivo e caber em `numeric(12,2)`;
  `suggested_monthly` pode ser `NULL`, mas, quando informado, também deve ser
  positivo e caber no mesmo tipo;
- `started_on` é uma data civil em `America/Sao_Paulo`, derivada pelo banco na
  criação; `workspace_id`, `created_at` e `started_on` são imutáveis, enquanto nome,
  alvo e ritmo continuam editáveis;
- somente transações `contribution` podem ter `goal_id`;
- ao inserir um aporte, uma trigger exclusivamente `BEFORE INSERT` exige `goal_id`
  e confirma que transação e meta pertencem ao mesmo workspace;
- ao reatribuir um aporte, uma segunda trigger `BEFORE UPDATE OF goal_id` repete a
  validação de workspace somente quando `NEW.goal_id IS NOT NULL`. O FK pode executar
  `ON DELETE SET NULL` quando a meta é apagada porque esse valor não satisfaz a
  condição da trigger;
- editar alvo ou ritmo recalcula progresso, conclusão e comparação de ritmo desde o
  `started_on` original; esses resultados não são snapshots persistidos;
- aportes individuais podem ser editados, reatribuídos a outra meta do mesmo
  workspace ou removidos por hard-delete.

Apagar uma meta é hard-delete, mas não apaga seus lançamentos. Os aportes vinculados
permanecem como `contribution`, passam a ter `goal_id=NULL` e continuam compondo
histórico, saldo e exportação. A interface os identifica como “Aporte de meta
excluída”; o nome apagado não é duplicado na transação nem mantido como tombstone.

## Integridade de contas fixas e pagamentos

- o nome da conta é normalizado sem espaços nas pontas, não pode ficar vazio e aceita
  no máximo 100 caracteres;
- `due_day` é inteiro entre 1 e 31. No cálculo mensal, dias inexistentes são presos
  ao último dia do mês, sem armazenar uma competência separada;
- `category` é obrigatória e aceita somente os dez códigos de despesa. `renda` é
  rejeitada porque todo pagamento de conta fixa é `kind='expense'`;
- `estimated_amount` é obrigatório, positivo, diferente de `NaN` e limitado a
  `numeric(12,2)`, inclusive quando `variable_amount=true`. Nesse modo o valor é uma
  estimativa manual, não uma média materializada do histórico;
- `autopay` e `variable_amount` são booleanos obrigatórios com padrão `false`;
- `started_on` é uma data civil em `America/Sao_Paulo`, derivada pelo banco na
  criação. `workspace_id`, `created_at` e `started_on` são imutáveis; nome,
  vencimento, categoria, estimativa e os dois booleanos continuam editáveis;
- `transactions.fixed_bill_id` é anulável, referencia `fixed_bills(id)` com
  `ON DELETE SET NULL` e só pode estar preenchido quando `kind='expense'`;
- `goal_id` e `fixed_bill_id` são mutuamente exclusivos: um lançamento nunca é ao
  mesmo tempo aporte e pagamento de conta fixa;
- a trigger `validate_fixed_bill_link_on_insert`, em `BEFORE INSERT`, valida que a
  conta referenciada e a transação pertencem ao mesmo workspace;
- a trigger `validate_fixed_bill_link_on_update`, em
  `BEFORE UPDATE OF fixed_bill_id`, repete a validação durante reatribuições. Ambas
  executam somente quando `NEW.fixed_bill_id IS NOT NULL`, de modo que o FK consegue
  aplicar `ON DELETE SET NULL` ao encerrar a recorrência;
- as funções de imutabilidade e validação são `SECURITY INVOKER`, têm `search_path`
  fixo e não concedem `EXECUTE` a `PUBLIC`, `anon` ou `authenticated`;
- o índice parcial `(workspace_id, fixed_bill_id, occurred_on desc)` para vínculos
  não nulos sustenta a leitura mensal dos pagamentos.

Status, vencimento do mês, previsto e realizado são recalculados na leitura; não há
snapshot mensal. Editar estimativa, dia ou nome muda a apresentação histórica, mas
não reescreve lançamentos. Alterar categoria afeta somente pagamentos futuros. Pelo
contrato de mês civil, um pagamento é atribuído ao mês de `occurred_on`: pagar em
agosto uma conta de julho marca agosto como pago e mantém julho como não registrada.

Encerrar uma recorrência é hard-delete. Os pagamentos permanecem como despesas
completas, recebem `fixed_bill_id=NULL` e voltam ao editor genérico; não existe
tombstone nem cópia do nome apagado. Excluir um pagamento individual também é
hard-delete imediato.

## Convite de workspace

- `token` é um `uuid` gerado pelo banco (`default gen_random_uuid()`), nunca
  recebido do cliente — evita token previsível.
- `expires_at` é fixado em `now() + interval '7 days'` no momento da criação,
  dentro da função `create_workspace_invite`; a aplicação não pode estender a
  validade de um convite existente.
- Um convite só pode ser resgatado uma vez: `redeem_workspace_invite` exige
  `used_at is null and expires_at > now()` e marca `used_at`/`used_by` na
  mesma transação que insere o novo membro.
- Resgate é recusado se quem chama já participa de qualquer workspace — o
  produto assume um workspace por pessoa (`getCurrentWorkspace` busca a
  membership mais antiga); não há fluxo de múltiplos workspaces nem de trocar
  de workspace.
- Sem policy de `insert`/`update`/`delete` para usuário comum: criação e
  resgate passam só pelas funções `SECURITY DEFINER` acima, mesmo padrão de
  `create_workspace_with_owner` (etapa 05).
- Convites vencidos ou já usados não são limpos automaticamente — ficam na
  tabela até o workspace ser apagado (cascata) ou até uma rotina de limpeza
  ser implementada, se algum dia fizer sentido. Não guardam dado pessoal da
  pessoa convidada, só `created_by`/`used_by` (uuid solto, mesmo padrão de
  `workspace_members.user_id`).

## Row-Level Security (SQL)

Habilitar RLS em toda tabela com dado de usuário e criar policies baseadas na
participação no workspace. Função auxiliar evita repetição:

```sql
-- Função: o usuário autenticado participa deste workspace?
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

alter table public.transactions enable row level security;

create policy "membros leem transações do seu workspace"
  on public.transactions for select
  using ( public.is_workspace_member(workspace_id) );

create policy "membros inserem no seu workspace"
  on public.transactions for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "membros atualizam no seu workspace"
  on public.transactions for update
  using ( public.is_workspace_member(workspace_id) );

create policy "membros apagam no seu workspace"
  on public.transactions for delete
  using ( public.is_workspace_member(workspace_id) );

-- Repetir o mesmo padrão para fixed_bills, goals e workspace_members.
```

## Exclusão de um lançamento

A exclusão individual de `transactions` é hard-delete imediato, executado com o
cliente Supabase autenticado e sujeito à policy `DELETE` do workspace. A interface
confirma que a ação é irreversível antes de chamar o banco.

Não existe coluna de soft-delete, lixeira, cópia de auditoria com conteúdo financeiro
ou service-role nesse fluxo. Depois do delete, o registro deixa de existir e não
aparece em leitura ou exportação. Isso evita retenção indefinida de dado pessoal
oculto e não altera a cascata de workspace/conta descrita abaixo.

## Rotina de apagamento de conta

Executada de forma transacional (função no Postgres, chamada por rota admin auditada
com service-role, ou trigger em `auth.users`):

```sql
create or replace function public.handle_account_deletion(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove participações do usuário
  delete from public.workspace_members where user_id = target;

  -- Remove workspaces que ficaram sem nenhum membro (cascata apaga os dados)
  delete from public.workspaces w
  where not exists (
    select 1 from public.workspace_members m where m.workspace_id = w.id
  );

  -- Remove o espelho de perfil
  delete from public.profiles where id = target;
end;
$$;
```

> Nota: o apagamento do próprio registro em `auth.users` é feito via API admin do
> Supabase. A ordem importa — apagar participações e workspaces órfãos antes de
> encerrar o usuário garante que nada fique órfão nem preservado indevidamente.
