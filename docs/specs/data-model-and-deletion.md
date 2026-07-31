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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

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
  with check ( public.is_workspace_member(workspace_id) );

create policy "membros atualizam no seu workspace"
  on public.transactions for update
  using ( public.is_workspace_member(workspace_id) );

create policy "membros apagam no seu workspace"
  on public.transactions for delete
  using ( public.is_workspace_member(workspace_id) );

-- Repetir o mesmo padrão para fixed_bills, goals e workspace_members.
```

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
