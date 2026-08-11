import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  const submit = page.getByRole("button", { name: "Entrar" });
  await submit.click();
  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
  } catch {
    await submit.click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}

async function expectFieldErrorAssociation(page: Page, field: Locator) {
  const descriptionId = await field.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  await expect(page.locator(`#${descriptionId}`)).toBeVisible();
}

async function submitAndExpectFieldError(
  page: Page,
  submit: Locator,
  field: Locator,
) {
  await submit.click();
  if (!(await field.getAttribute("aria-describedby"))) {
    // Sessões recém-emitidas no Supabase podem atravessar a diferença transitória
    // de relógio já documentada nos outros E2E. Uma segunda action deve então
    // alcançar a validação pura sem afrouxar a asserção do campo.
    await submit.click();
  }
  await expectFieldErrorAssociation(page, field);
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

async function expectMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe("polimento visual por tela", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("alinha hierarquia, microcopy e feedback dos três destinos", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "polish-language",
      "Casa em equilíbrio",
    );

    try {
      await login(page, fixture.email, fixture.password);

      await expect(page).toHaveTitle("Dashboard | Cadence");
      await expect(
        page.getByText(
          "Registre o que entrou e saiu e acompanhe o resultado do mês.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Registrar lançamento" }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Metas" }).click();
      await expect(page).toHaveTitle("Metas | Cadence");
      await expect(
        page.getByText(
          "O ritmo é uma referência: aporte quando puder, no valor que fizer sentido.",
        ),
      ).toBeVisible();
      await expect(page.getByText("Nenhuma meta ainda.")).toBeVisible();

      const createGoal = page.getByRole("button", { name: "Criar meta" });
      await expect(createGoal).toHaveAttribute("aria-controls");
      await createGoal.focus();
      await page.keyboard.press("Enter");
      await expect(createGoal).toHaveAttribute("aria-expanded", "true");
      await page.getByLabel("Nome da meta").fill("Reserva");
      await page.getByLabel("Valor-alvo").fill("inválido");
      await submitAndExpectFieldError(
        page,
        page.getByRole("button", { name: "Salvar meta" }),
        page.getByLabel("Valor-alvo"),
      );

      await page.getByRole("link", { name: "Fixas" }).click();
      await expect(page).toHaveTitle("Contas fixas | Cadence");
      await expect(
        page.getByText("Compare o previsto com o que foi pago em cada mês."),
      ).toBeVisible();
      await expect(page.getByText("Nenhuma conta fixa ainda.")).toBeVisible();

      const createBill = page.getByRole("button", {
        name: "Nova conta fixa",
      });
      await expect(createBill).toHaveAttribute("aria-controls");
      await createBill.click();
      await page.getByLabel("Nome da conta").fill("Internet");
      await page.getByLabel("Dia do vencimento").fill("15");
      await page.getByLabel("Categoria").selectOption("internet");
      await page.getByLabel("Valor previsto").fill("inválido");
      await submitAndExpectFieldError(
        page,
        page.getByRole("button", { name: "Salvar conta fixa" }),
        page.getByLabel("Valor previsto"),
      );
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém texto semântico e reflow em 320 px", async ({ page }) => {
    const fixture = await createDashboardTestUser(
      "polish-reflow",
      "Casa com um nome deliberadamente longo para validar o reflow",
    );

    try {
      const today = todayInSaoPaulo();
      const { data: bill, error: billError } = await retryAfterJwtClockSkew(() =>
        fixture.client
          .from("fixed_bills")
          .insert({
            workspace_id: fixture.workspaceId,
            name: "Conta de energia com identificação residencial extensa",
            due_day: 15,
            category: "luz",
            estimated_amount: "350.00",
          })
          .select("id")
          .single(),
      );
      if (billError) throw billError;

      const { error: paymentError } = await retryAfterJwtClockSkew(() =>
        fixture.client.from("transactions").insert({
          workspace_id: fixture.workspaceId,
          created_by: fixture.id,
          kind: "expense",
          amount: "347.89",
          category: "luz",
          fixed_bill_id: bill.id,
          occurred_on: today,
        }),
      );
      if (paymentError) throw paymentError;

      await page.setViewportSize({ width: 320, height: 720 });
      await login(page, fixture.email, fixture.password);
      await expectNoHorizontalOverflow(page);

      const navigation = page.getByRole("navigation", {
        name: "Navegação principal",
      });
      await expectMinimumTarget(
        navigation.getByRole("link", { name: "Dashboard" }),
      );

      await page.getByRole("link", { name: "Metas" }).click();
      await expectNoHorizontalOverflow(page);
      await expectMinimumTarget(
        page.getByRole("button", { name: "Criar meta" }),
      );

      await page.getByRole("link", { name: "Fixas" }).click();
      await expectNoHorizontalOverflow(page);
      const paidBadge = page.locator('[data-status="paid"]');
      await expect(paidBadge).toHaveText("Pago");
      await expectMinimumTarget(
        page.getByRole("button", { name: "Nova conta fixa" }),
      );
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("preserva teclado, foco e alternativa textual no gráfico e diálogo", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "polish-keyboard",
      "Casa acessível",
    );

    try {
      const { error } = await retryAfterJwtClockSkew(() =>
        fixture.client.from("transactions").insert({
          workspace_id: fixture.workspaceId,
          created_by: fixture.id,
          kind: "expense",
          amount: "89.90",
          category: "alimentacao",
          description: "Compra acessível",
          occurred_on: todayInSaoPaulo(),
        }),
      );
      if (error) throw error;

      await login(page, fixture.email, fixture.password);

      const chart = page.getByRole("figure", {
        name: "Distribuição de gastos por categoria",
      });
      const chartSlice = chart.locator("path[tabindex='0']").first();
      await chartSlice.focus();
      await expect(chart.getByRole("status")).toContainText(
        "Alimentação: R$ 89,90",
      );

      const transaction = page.getByRole("listitem").filter({
        hasText: "Compra acessível",
      });
      const deleteTrigger = transaction.getByRole("button", { name: "Excluir" });
      await deleteTrigger.focus();
      await page.keyboard.press("Enter");

      const dialog = page.getByRole("dialog", { name: "Excluir lançamento?" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(deleteTrigger).toBeFocused();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });
});
