import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  primaryKey,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Espelho mínimo de auth.users — id compartilha o mesmo uuid, nunca duplica
// dados de autenticação. Populada por trigger (ver migration de RLS).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PK composta (workspace_id, user_id): a spec ilustrativa original não definia
// PK nesta tabela — sem isso nada impede duplicar o mesmo vínculo nem garante
// limpeza determinística via ON DELETE CASCADE de workspaces.
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

// Definida antes de transactions porque transactions.goalId a referencia.
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

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    kind: text("kind").notNull(), // 'expense' | 'income' | 'contribution'
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category"),
    description: text("description"),
    paymentMethod: text("payment_method"),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "transactions_kind_check",
      sql`${table.kind} in ('expense', 'income', 'contribution')`,
    ),
    check(
      "transactions_amount_positive_check",
      sql`${table.amount} > 0 and ${table.amount} <> 'NaN'::numeric`,
    ),
    check(
      "transactions_kind_category_check",
      sql`(
        (${table.kind} = 'expense' and ${table.category} in (
          'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
          'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
        ))
        or (${table.kind} = 'income' and ${table.category} = 'renda')
        or (${table.kind} = 'contribution' and ${table.category} is null)
      ) is true`,
    ),
    check(
      "transactions_payment_method_check",
      sql`${table.paymentMethod} is null or ${table.paymentMethod} in (
        'pix', 'credit_card', 'debit_card', 'cash', 'boleto',
        'bank_transfer', 'other'
      )`,
    ),
    check(
      "transactions_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 200`,
    ),
    index("transactions_workspace_occurred_created_idx").on(
      table.workspaceId,
      table.occurredOn.desc(),
      table.createdAt.desc(),
    ),
  ],
);

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
