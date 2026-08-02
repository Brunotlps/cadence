import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

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

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(),
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
