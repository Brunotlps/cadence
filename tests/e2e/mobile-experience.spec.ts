import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createConfirmedTestUser,
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
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  const submit = page.getByRole("button", { name: "Entrar" });
  await submit.click();
  try {
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 5_000 });
  } catch {
    await submit.click();
  }
}

async function expectMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function seedMobileContent(
  fixture: Awaited<ReturnType<typeof createDashboardTestUser>>,
) {
  const today = todayInSaoPaulo();
  const { error: transactionError } = await retryAfterJwtClockSkew(() =>
    fixture.client.from("transactions").insert({
      workspace_id: fixture.workspaceId,
      created_by: fixture.id,
      kind: "expense",
      amount: "438.72",
      category: "alimentacao",
      description:
        "Compra grande de supermercado para abastecer a casa durante a semana",
      payment_method: "credit_card",
      occurred_on: today,
    }),
  );
  if (transactionError) throw transactionError;

  const { data: goal, error: goalError } = await retryAfterJwtClockSkew(() =>
    fixture.client
      .from("goals")
      .insert({
        workspace_id: fixture.workspaceId,
        name: "Reserva de emergência para manter doze meses de tranquilidade",
        target_amount: "40000.00",
        suggested_monthly: "1500.00",
      })
      .select("id")
      .single(),
  );
  if (goalError) throw goalError;

  const { error: contributionError } = await retryAfterJwtClockSkew(() =>
    fixture.client.from("transactions").insert({
      workspace_id: fixture.workspaceId,
      created_by: fixture.id,
      kind: "contribution",
      amount: "2350.00",
      category: null,
      goal_id: goal.id,
      occurred_on: today,
    }),
  );
  if (contributionError) throw contributionError;

  const { error: billError } = await retryAfterJwtClockSkew(() =>
    fixture.client.from("fixed_bills").insert({
      workspace_id: fixture.workspaceId,
      name: "Plano completo de internet residencial e serviços adicionais",
      due_day: 18,
      category: "internet",
      estimated_amount: "219.90",
      autopay: true,
      variable_amount: false,
    }),
  );
  if (billError) throw billError;
}

test.describe("experiência mobile completa", () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  let fixture: Awaited<ReturnType<typeof createDashboardTestUser>>;

  test.beforeAll(async () => {
    fixture = await createDashboardTestUser(
      "mobile-experience",
      "Casa com um nome extenso para testar a hierarquia no celular",
    );
    await seedMobileContent(fixture);
  });

  test.afterAll(async () => {
    await deleteTestAccount(fixture.id);
  });

  test("compacta o shell e mantém os controles móveis previsíveis", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await login(page, fixture.email, fixture.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const shellHeader = page.locator("aside");
    const headerBox = await shellHeader.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeLessThanOrEqual(72);

    const appearance = page.getByRole("button", {
      name: "Aparência: Verde",
    });
    await expectMinimumTarget(appearance);
    await appearance.click();
    await expect(
      page.getByRole("group", { name: "Cor de destaque" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("group", { name: "Cor de destaque" }),
    ).toBeHidden();
    await expect(appearance).toBeFocused();

    await appearance.click();
    await page.mouse.click(310, 300);
    await expect(
      page.getByRole("group", { name: "Cor de destaque" }),
    ).toBeHidden();

    const navigation = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    await expect(navigation.getByRole("link")).toHaveCount(3);
    for (const label of ["Dashboard", "Metas", "Fixas"]) {
      await expectMinimumTarget(
        navigation.getByRole("link", { name: label }),
      );
    }

    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    const intermediateHeader = await shellHeader.boundingBox();
    expect(intermediateHeader!.height).toBeLessThanOrEqual(72);

    await page.setViewportSize({ width: 667, height: 375 });
    await expectNoHorizontalOverflow(page);
    const landscapeHeader = await shellHeader.boundingBox();
    expect(landscapeHeader!.height).toBeLessThanOrEqual(72);
  });

  test("organiza conteúdo financeiro longo em 320 e 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await login(page, fixture.email, fixture.password);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Mês anterior" }),
    ).toHaveText("Anterior");
    await expect(
      page.getByRole("link", { name: "Próximo mês" }),
    ).toHaveText("Próximo");

    const longTransaction = page.getByRole("heading", {
      level: 3,
      name: /Compra grande de supermercado/,
    });
    const transactionWhiteSpace = await longTransaction.evaluate(
      (element) => getComputedStyle(element).whiteSpace,
    );
    expect(transactionWhiteSpace).not.toBe("nowrap");

    await page.setViewportSize({ width: 390, height: 844 });
    const amount = await page.getByLabel("Valor").boundingBox();
    const category = await page.getByLabel("Categoria").boundingBox();
    const date = await page.getByLabel("Data").boundingBox();
    expect(amount).not.toBeNull();
    expect(category).not.toBeNull();
    expect(date).not.toBeNull();
    expect(Math.abs(amount!.y - category!.y)).toBeLessThanOrEqual(2);
    expect(date!.width).toBeGreaterThan(amount!.width * 1.8);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/goals");
    const goal = page.getByRole("article", {
      name: /Reserva de emergência/,
    });
    const editGoal = await goal
      .getByRole("link", { name: "Editar meta" })
      .boundingBox();
    const deleteGoal = await goal
      .getByRole("button", { name: "Excluir meta" })
      .boundingBox();
    expect(editGoal).not.toBeNull();
    expect(deleteGoal).not.toBeNull();
    expect(Math.abs(editGoal!.y - deleteGoal!.y)).toBeLessThanOrEqual(2);

    await page.goto("/fixed-bills");
    const filters = await Promise.all(
      ["Todas", "Pendentes", "Pagas", "Automáticas"].map((label) =>
        page.getByRole("link", { name: label }).boundingBox(),
      ),
    );
    const filterRows = new Set(filters.map((box) => Math.round(box!.y)));
    expect(filterRows.size).toBe(2);
    expect(
      filters.filter((box) => Math.round(box!.y) === Math.min(...filterRows))
        .length,
    ).toBe(2);

    const bill = page.getByRole("article", {
      name: /Plano completo de internet/,
    });
    const editBill = await bill
      .getByRole("link", { name: "Editar conta" })
      .boundingBox();
    const deleteBill = await bill
      .getByRole("button", { name: "Encerrar recorrência" })
      .boundingBox();
    expect(editBill).not.toBeNull();
    expect(deleteBill).not.toBeNull();
    expect(Math.abs(editBill!.y - deleteBill!.y)).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
  });

  test("uniformiza páginas de conta e onboarding em 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const routes = [
      { path: "/signup", field: "E-mail", action: "Criar conta" },
      { path: "/forgot-password", field: "E-mail", action: "Enviar" },
      {
        path: "/confirm-email",
        field: "E-mail",
        action: "Reenviar e-mail",
      },
      {
        path: "/reset-password",
        field: "Nova senha",
        action: "Redefinir senha",
      },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(
        page.getByRole("main").getByText("Cadence", { exact: true }),
      ).toBeVisible();
      const field = page.locator("form").getByLabel(route.field);
      const action = page.getByRole("button", { name: route.action });
      await expectMinimumTarget(field);
      await expectMinimumTarget(action);
      const controlBox = await field.locator("..").boundingBox();
      expect(controlBox!.width).toBeGreaterThanOrEqual(250);
      await expectNoHorizontalOverflow(page);
    }

    const onboardingUser = await createConfirmedTestUser("mobile-onboarding");
    try {
      await login(page, onboardingUser.email, onboardingUser.password);
      await expect(page).toHaveURL(/\/onboarding\/workspace/);
      await expect(
        page.getByRole("main").getByText("Cadence", { exact: true }),
      ).toBeVisible();
      await expectMinimumTarget(page.getByLabel("Nome do espaço"));
      await expectMinimumTarget(
        page.getByRole("button", { name: "Criar espaço" }),
      );
      await expectNoHorizontalOverflow(page);
    } finally {
      await deleteTestAccount(onboardingUser.id);
    }
  });
});
