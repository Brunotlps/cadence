# Spec: modelo de dados e apagamento em cascata

## Princípio

Todo dado de usuário pertence a um `workspace`. O apagamento segue as chaves
estrangeiras com `ON DELETE CASCADE`, de modo que remover um workspace remove
automaticamente tudo que depende dele. Remover um usuário remove suas participações;
quando um workspace fica sem membros, ele é removido (ver rotina abaixo).

## Entidades

- **users** — gerenciada pelo Supabase Auth (`auth.users`). Não duplicar dados de
  autenticação. Um espelho mínimo em `public.profiles` guarda apenas nome de exibição.
- **workspaces** — o espaço financeiro compartilhado.
- **workspace_members** — vínculo N:N entre usuários e workspaces, com papel.
- **transactions** — lançamentos (despesa/receita/aporte).
- **fixed_bills** — contas fixas recorrentes.
- **goals** — metas financeiras.

## Regras de cascata

- Apagar `workspaces` → apaga `workspace_members`, `transactions`, `fixed_bills`, `goals`.
- Apagar usuário (`auth.users`) → apaga `profiles` e `workspace_members` daquele usuário.
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
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name"),
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
  occurredOn: date("occurred_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fixedBills = pgTable("fixed_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dueDay: numeric("due_day").notNull(),
  autopay: boolean("autopay").notNull().default(false),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }),
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
