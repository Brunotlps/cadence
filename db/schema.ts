import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  integer,
  primaryKey,
  check,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Espelho mínimo de auth.users — id compartilha o mesmo uuid, nunca duplica
// dados de autenticação. Populada por trigger (ver migration de RLS).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    displayName: text("display_name"),
    accentColor: text("accent_color").default("verde").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "profiles_accent_color_check",
      sql`${table.accentColor} in ('preto', 'rosa', 'verde')`,
    ),
  ],
);

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
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    unique("workspace_members_user_id_unique").on(table.userId),
  ],
);

// Convite de workspace: token opaco, uso único, sem dado da pessoa
// convidada — ela só existe aqui depois de resgatar com a própria conta
// Google (etapa 17). created_by/used_by seguem o mesmo padrão de
// workspace_members.user_id: uuid solto, sem FK para auth.users.
export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    token: uuid("token").notNull().defaultRandom().unique(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    usedBy: uuid("used_by"),
  },
  (table) => [
    index("workspace_invites_workspace_idx").on(table.workspaceId),
  ],
);

// Definida antes de transactions porque transactions.goalId a referencia.
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: numeric("target_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    suggestedMonthly: numeric("suggested_monthly", {
      precision: 12,
      scale: 2,
    }),
    startedOn: date("started_on")
      .default(sql`(timezone('America/Sao_Paulo', now()))::date`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "goals_name_check",
      sql`btrim(${table.name}) <> '' and char_length(${table.name}) <= 100`,
    ),
    check(
      "goals_target_amount_positive_check",
      sql`${table.targetAmount} > 0 and ${table.targetAmount} <> 'NaN'::numeric`,
    ),
    check(
      "goals_suggested_monthly_positive_check",
      sql`${table.suggestedMonthly} is null or (
        ${table.suggestedMonthly} > 0
        and ${table.suggestedMonthly} <> 'NaN'::numeric
      )`,
    ),
    index("goals_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt.desc(),
    ),
  ],
);

// Definida antes de transactions porque transactions.fixedBillId a referencia.
// `category` é obrigatória porque pagar gera uma despesa, e o CHECK de
// transactions exige categoria válida para kind='expense'.
export const fixedBills = pgTable(
  "fixed_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueDay: integer("due_day").notNull(),
    category: text("category").notNull(),
    autopay: boolean("autopay").notNull().default(false),
    variableAmount: boolean("variable_amount").notNull().default(false),
    estimatedAmount: numeric("estimated_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    startedOn: date("started_on")
      .default(sql`(timezone('America/Sao_Paulo', now()))::date`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "fixed_bills_name_check",
      sql`btrim(${table.name}) <> '' and char_length(${table.name}) <= 100`,
    ),
    check(
      "fixed_bills_due_day_check",
      sql`${table.dueDay} between 1 and 31`,
    ),
    check(
      "fixed_bills_estimated_amount_positive_check",
      sql`${table.estimatedAmount} > 0 and ${table.estimatedAmount} <> 'NaN'::numeric`,
    ),
    check(
      "fixed_bills_category_check",
      sql`${table.category} in (
        'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
        'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
      )`,
    ),
    index("fixed_bills_workspace_name_idx").on(table.workspaceId, table.name),
  ],
);

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
    fixedBillId: uuid("fixed_bill_id").references(() => fixedBills.id, {
      onDelete: "set null",
    }),
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
    check(
      "transactions_goal_kind_check",
      sql`${table.goalId} is null or ${table.kind} = 'contribution'`,
    ),
    check(
      "transactions_fixed_bill_kind_check",
      sql`${table.fixedBillId} is null or ${table.kind} = 'expense'`,
    ),
    check(
      "transactions_single_link_check",
      sql`not (${table.goalId} is not null and ${table.fixedBillId} is not null)`,
    ),
    index("transactions_workspace_occurred_created_idx").on(
      table.workspaceId,
      table.occurredOn.desc(),
      table.createdAt.desc(),
    ),
    index("transactions_contribution_goal_idx")
      .on(
        table.workspaceId,
        table.goalId,
        table.occurredOn.desc(),
        table.createdAt.desc(),
      )
      .where(sql`${table.kind} = 'contribution' and ${table.goalId} is not null`),
    index("transactions_fixed_bill_idx")
      .on(table.workspaceId, table.fixedBillId, table.occurredOn.desc())
      .where(sql`${table.fixedBillId} is not null`),
  ],
);
