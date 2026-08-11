import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDashboardTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
  retryAfterJwtClockSkew,
} from "./support";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00.000Z`));
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function seedTransaction(
  client: SupabaseClient,
  transaction: {
    workspaceId: string;
    userId: string;
    kind: "expense" | "income" | "contribution";
    amount: string;
    category: string | null;
    description?: string;
    goalId?: string;
    occurredOn: string;
  },
) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("transactions")
      .insert({
        workspace_id: transaction.workspaceId,
        created_by: transaction.userId,
        kind: transaction.kind,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
        goal_id: transaction.goalId,
        occurred_on: transaction.occurredOn,
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

async function seedGoal(client: SupabaseClient, workspaceId: string) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("goals")
      .insert({
        workspace_id: workspaceId,
        name: "Reserva do resumo",
        target_amount: "1000.00",
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

test.describe("lançamentos e Dashboard", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("exibe estado vazio e o formulário no mês atual", async ({ page }) => {
    const fixture = await createDashboardTestUser(
      "dashboard-empty",
      "Casa vazia",
    );

    try {
      await login(page, fixture.email, fixture.password);

      await expect(page.getByRole("heading", { name: "Casa vazia" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Novo lançamento" }),
      ).toBeVisible();
      await expect(page.getByLabel("Valor")).toBeVisible();
      await expect(page.getByLabel("Categoria")).toBeVisible();
      await expect(page.getByLabel("Data")).toHaveValue(todayInSaoPaulo());
      await expect(page.getByLabel("Descrição")).toBeHidden();
      await expect(page.getByLabel("Forma de pagamento")).toBeHidden();
      await expect(
        page.getByText(
          "Registre sua primeira receita ou despesa para começar a acompanhar o mês.",
        ),
      ).toBeVisible();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém o Dashboard utilizável sem overflow em viewport móvel", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "dashboard-mobile",
      "Casa responsiva",
    );

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, fixture.email, fixture.password);

      await expect(page.getByRole("heading", { name: "Casa responsiva" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toBeVisible();
      await expect(
        page.getByRole("figure", {
          name: "Distribuição de gastos por categoria",
        }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("cria despesa e receita, deriva Renda e revalida o saldo", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "dashboard-create",
      "Casa criação",
    );

    try {
      await login(page, fixture.email, fixture.password);

      await expect(page.getByLabel("Valor")).toBeVisible();
      await page.getByLabel("Valor").fill("123,45");
      await page.getByLabel("Categoria").selectOption({ label: "Alimentação" });
      await page.getByRole("button", { name: "+ mais detalhes" }).click();
      await page.getByLabel("Descrição").fill("Mercado do mês");
      await page.getByLabel("Forma de pagamento").selectOption({ label: "Pix" });
      await page.getByRole("button", { name: "Registrar lançamento" }).click();

      const expense = page.getByRole("listitem").filter({
        hasText: "Mercado do mês",
      });
      await expect(expense).toContainText("Alimentação");
      await expect(expense).toContainText("R$ 123,45");
      await expect(expense).toContainText("Pix");
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("-R$ 123,45");

      await page.getByLabel("Valor").fill("500,00");
      await page.getByLabel("Categoria").selectOption({ label: "Renda" });
      await page.getByLabel("Descrição").fill("Reembolso de viagem");
      await page
        .getByLabel("Forma de pagamento")
        .selectOption({ label: "Transferência" });
      await page.getByRole("button", { name: "Registrar lançamento" }).click();

      await expect(page.getByText("Reembolso de viagem")).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("R$ 376,55");
      await expect(
        page.getByRole("figure", {
          name: "Distribuição de gastos por categoria",
        }),
      ).toContainText("Alimentação");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("resume o mês, exclui aportes do donut e navega entre meses", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "dashboard-summary",
      "Casa resumo",
    );
    const today = todayInSaoPaulo();
    const currentMonth = today.slice(0, 7);
    const previousMonth = shiftMonth(currentMonth, -1);

    try {
      const goalId = await seedGoal(fixture.client, fixture.workspaceId);
      await seedTransaction(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        kind: "income",
        amount: "500.00",
        category: "renda",
        description: "Salário",
        occurredOn: today,
      });
      await seedTransaction(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        kind: "expense",
        amount: "100.00",
        category: "alimentacao",
        description: "Mercado",
        occurredOn: today,
      });
      await seedTransaction(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        kind: "expense",
        amount: "50.00",
        category: "lazer",
        description: "Cinema",
        occurredOn: today,
      });
      await seedTransaction(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        kind: "contribution",
        amount: "25.00",
        category: null,
        description: "Aporte",
        goalId,
        occurredOn: today,
      });

      await login(page, fixture.email, fixture.password);

      const summary = page.getByRole("region", { name: "Resumo do mês" });
      await expect(summary).toContainText("R$ 325,00");

      const chart = page.getByRole("figure", {
        name: "Distribuição de gastos por categoria",
      });
      await expect(chart).toContainText("Alimentação");
      await expect(chart).toContainText("R$ 100,00");
      await expect(chart).toContainText("Lazer");
      await expect(chart).toContainText("R$ 50,00");
      await expect(chart).not.toContainText("Renda");
      await expect(chart).not.toContainText("Aporte");

      await page.getByRole("link", { name: "Mês anterior" }).click();
      await expect(page).toHaveURL(new RegExp(`month=${previousMonth}`));
      await expect(page.getByText(monthLabel(previousMonth))).toBeVisible();
      await expect(page.getByText("Nenhum lançamento neste mês.")).toBeVisible();

      await page.getByRole("link", { name: "Próximo mês" }).click();
      await expect(page).toHaveURL(new RegExp(`month=${currentMonth}`));
      await expect(page.getByText("Salário")).toBeVisible();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("edita e faz hard-delete somente depois de confirmação", async ({ page }) => {
    const fixture = await createDashboardTestUser(
      "dashboard-edit-delete",
      "Casa edição",
    );
    const today = todayInSaoPaulo();

    try {
      await seedTransaction(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        kind: "expense",
        amount: "100.00",
        category: "alimentacao",
        description: "Mercado original",
        occurredOn: today,
      });

      await login(page, fixture.email, fixture.password);

      let item = page.getByRole("listitem").filter({
        hasText: "Mercado original",
      });
      await expect(item).toBeVisible();
      await item.getByRole("link", { name: "Editar" }).click();
      await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+\/edit/);

      await page.getByLabel("Valor").fill("80,00");
      await page.getByLabel("Categoria").selectOption({ label: "Lazer" });
      await page.getByLabel("Descrição").fill("Cinema");
      await page.getByRole("button", { name: "Salvar alterações" }).click();

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText("Cinema")).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("-R$ 80,00");

      item = page.getByRole("listitem").filter({ hasText: "Cinema" });
      await item.getByRole("button", { name: "Excluir" }).click();
      const dialog = page.getByRole("dialog", { name: "Excluir lançamento?" });
      await expect(dialog).toContainText("Esta ação não pode ser desfeita.");
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByText("Cinema")).toBeVisible();

      await item.getByRole("button", { name: "Excluir" }).click();
      await page
        .getByRole("dialog", { name: "Excluir lançamento?" })
        .getByRole("button", { name: "Excluir definitivamente" })
        .click();

      await expect(page.getByText("Cinema")).toHaveCount(0);
      await expect(page.getByText("Nenhum lançamento neste mês.")).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("R$ 0,00");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });
});
