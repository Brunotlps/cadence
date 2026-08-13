import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticateBrowser,
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

async function login(page: Page, email: string, password: string) {
  await authenticateBrowser(page, email, password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

async function seedGoal(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    name: string;
    targetAmount: string;
    suggestedMonthly?: string | null;
  },
) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("goals")
      .insert({
        workspace_id: input.workspaceId,
        name: input.name,
        target_amount: input.targetAmount,
        suggested_monthly: input.suggestedMonthly ?? null,
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

async function seedContribution(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    userId: string;
    goalId: string;
    amount: string;
    occurredOn?: string;
  },
) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("transactions")
      .insert({
        workspace_id: input.workspaceId,
        created_by: input.userId,
        kind: "contribution",
        amount: input.amount,
        category: null,
        goal_id: input.goalId,
        occurred_on: input.occurredOn ?? todayInSaoPaulo(),
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

async function seedIncome(
  client: SupabaseClient,
  input: { workspaceId: string; userId: string; amount: string },
) {
  const { error } = await retryAfterJwtClockSkew(() =>
    client.from("transactions").insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      kind: "income",
      amount: input.amount,
      category: "renda",
      occurred_on: todayInSaoPaulo(),
    }),
  );
  if (error) throw error;
}

test.describe("metas financeiras", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("exibe estado vazio e cria uma meta sem marcá-la como atrasada", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "goals-empty-create",
      "Casa com metas",
    );

    try {
      await login(page, fixture.email, fixture.password);
      await page.getByRole("link", { name: "Metas" }).click();

      await expect(page).toHaveURL(/\/goals/);
      await expect(
        page.getByRole("heading", { name: "Metas", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Nenhuma meta ainda.")).toBeVisible();

      await page.getByRole("button", { name: "Criar meta" }).click();
      await page.getByLabel("Nome da meta").fill("Reserva de emergência");
      await page.getByLabel("Valor-alvo").fill("5.000,00");
      await page.getByLabel("Ritmo mensal sugerido").fill("500,00");
      await page.getByRole("button", { name: "Salvar meta" }).click();

      const goal = page.getByRole("article", {
        name: "Reserva de emergência",
      });
      await expect(goal).toContainText("R$ 0,00 de R$ 5.000,00");
      await expect(goal).toContainText("0%");
      await expect(goal).toContainText("Em dia com o ritmo");
      await expect(goal).not.toContainText(/atrás do ritmo/i);
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("registra aporte livre, atualiza o progresso e desconta do saldo", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "goals-contribution",
      "Casa aporte",
    );

    try {
      const goalId = await seedGoal(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Viagem",
        targetAmount: "2000.00",
        suggestedMonthly: "250.00",
      });
      await seedIncome(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        amount: "1000.00",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/goals");

      const goal = page.getByRole("article", { name: "Viagem" });
      await goal.getByRole("button", { name: "Aportar" }).click();
      await page.getByLabel("Valor do aporte").fill("250,00");
      await expect(page.getByLabel("Data do aporte")).toHaveValue(
        todayInSaoPaulo(),
      );
      await page.getByRole("button", { name: "Salvar aporte" }).click();

      await expect(goal).toContainText("R$ 250,00 de R$ 2.000,00");
      await expect(goal).toContainText("13%");
      await expect(goal.getByText("R$ 250,00", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Dashboard" }).click();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("R$ 750,00");
      await expect(
        page.getByRole("heading", { name: "Aporte", exact: true }),
      ).toBeVisible();

      const { data } = await fixture.client
        .from("transactions")
        .select("goal_id")
        .eq("kind", "contribution")
        .single();
      expect(data?.goal_id).toBe(goalId);
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("edita e reatribui aporte entre metas e permite hard-delete", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "goals-reassign",
      "Casa reatribuição",
    );

    try {
      const sourceGoalId = await seedGoal(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Notebook",
        targetAmount: "5000.00",
      });
      await seedGoal(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Curso",
        targetAmount: "3000.00",
      });
      await seedContribution(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        goalId: sourceGoalId,
        amount: "400.00",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/goals");

      const notebook = page.getByRole("article", { name: "Notebook" });
      await notebook.getByRole("link", { name: "Editar aporte" }).click();
      await expect(page).toHaveURL(/\/contributions\/[0-9a-f-]+\/edit/);
      await page.getByLabel("Valor do aporte").fill("600,00");
      await page.getByLabel("Meta").selectOption({ label: "Curso" });
      await page.getByRole("button", { name: "Salvar alterações" }).click();

      await expect(page).toHaveURL(/\/goals/);
      await expect(notebook).toContainText("R$ 0,00 de R$ 5.000,00");
      const course = page.getByRole("article", { name: "Curso" });
      await expect(course).toContainText("R$ 600,00 de R$ 3.000,00");

      await course.getByRole("button", { name: "Excluir aporte" }).click();
      const dialog = page.getByRole("dialog", { name: "Excluir aporte?" });
      await expect(dialog).toContainText("Esta ação não pode ser desfeita.");
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(course).toContainText("R$ 600,00");

      await course.getByRole("button", { name: "Excluir aporte" }).click();
      await page
        .getByRole("dialog", { name: "Excluir aporte?" })
        .getByRole("button", { name: "Excluir definitivamente" })
        .click();
      await expect(course).toContainText("R$ 0,00 de R$ 3.000,00");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("recalcula conclusão ao editar alvo e preserva aporte ao excluir meta", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "goals-complete-delete",
      "Casa conclusão",
    );

    try {
      const goalId = await seedGoal(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Celular",
        targetAmount: "1000.00",
        suggestedMonthly: "200.00",
      });
      await seedContribution(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        goalId,
        amount: "1200.00",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/goals");

      let goal = page.getByRole("article", { name: "Celular" });
      await expect(goal.getByText("Meta concluída")).toBeVisible();
      await expect(goal).toContainText("120%");

      await goal.getByRole("link", { name: "Editar meta" }).click();
      await page.getByLabel("Valor-alvo").fill("2.000,00");
      await page.getByRole("button", { name: "Salvar alterações" }).click();

      goal = page.getByRole("article", { name: "Celular" });
      await expect(goal.getByText("Meta concluída")).toHaveCount(0);
      await expect(goal).toContainText("60%");

      await goal.getByRole("button", { name: "Excluir meta" }).click();
      const dialog = page.getByRole("dialog", { name: "Excluir meta?" });
      await expect(dialog).toContainText("1 aporte ficará desvinculado");
      await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();

      await expect(page.getByRole("article", { name: "Celular" })).toHaveCount(0);
      await page.getByRole("link", { name: "Dashboard" }).click();
      const orphan = page.getByRole("listitem").filter({
        hasText: "Aporte de meta excluída",
      });
      await expect(orphan).toContainText("-R$ 1.200,00");
      await expect(orphan.getByRole("link", { name: "Editar" })).toBeVisible();
      await expect(
        orphan.getByRole("button", { name: "Excluir" }),
      ).toBeVisible();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém a página de metas utilizável sem overflow em viewport móvel", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "goals-mobile",
      "Casa metas responsivas",
    );

    try {
      await seedGoal(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Reserva responsiva",
        targetAmount: "10000.00",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, fixture.email, fixture.password);
      await page.goto("/goals");

      await expect(
        page.getByRole("heading", { name: "Metas", exact: true }),
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
});
