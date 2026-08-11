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

function lastDayOfCurrentMonth() {
  const [year, month] = todayInSaoPaulo().split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Um vencimento entre hoje e hoje+2 cai sempre dentro da janela de aviso de 5 dias
// da decisão 8, em qualquer dia do mês — inclusive nos últimos, porque o clamp
// prende no último dia. Os demais estados dependem da posição de hoje no mês e
// ficam cobertos pelos testes unitários, onde a data de referência é parâmetro.
function dueSoonDay() {
  const day = Number(todayInSaoPaulo().slice(8, 10));
  return Math.min(day + 2, lastDayOfCurrentMonth());
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function seedFixedBill(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    name: string;
    dueDay: number;
    category?: string;
    estimatedAmount?: string;
    autopay?: boolean;
    variableAmount?: boolean;
  },
) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("fixed_bills")
      .insert({
        workspace_id: input.workspaceId,
        name: input.name,
        due_day: input.dueDay,
        category: input.category ?? "luz",
        estimated_amount: input.estimatedAmount ?? "180.00",
        autopay: input.autopay ?? false,
        variable_amount: input.variableAmount ?? false,
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

async function seedBillPayment(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    userId: string;
    fixedBillId: string;
    amount: string;
    category?: string;
    occurredOn?: string;
  },
) {
  const { data, error } = await retryAfterJwtClockSkew(() =>
    client
      .from("transactions")
      .insert({
        workspace_id: input.workspaceId,
        created_by: input.userId,
        kind: "expense",
        amount: input.amount,
        category: input.category ?? "luz",
        fixed_bill_id: input.fixedBillId,
        occurred_on: input.occurredOn ?? todayInSaoPaulo(),
      })
      .select("id")
      .single(),
  );
  if (error) throw error;
  return data.id as string;
}

test.describe("contas fixas", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("exibe estado vazio e cria uma conta fixa com previsto e vencimento", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "bills-empty-create",
      "Casa com contas",
    );

    try {
      await login(page, fixture.email, fixture.password);
      await page.getByRole("link", { name: "Fixas" }).click();

      await expect(page).toHaveURL(/\/fixed-bills/);
      await expect(
        page.getByRole("heading", { name: "Contas fixas" }),
      ).toBeVisible();
      await expect(page.getByText("Nenhuma conta fixa ainda.")).toBeVisible();

      await page.getByRole("button", { name: "Nova conta fixa" }).click();
      await page.getByLabel("Nome da conta").fill("Conta de luz");
      await page.getByLabel("Dia do vencimento").fill("15");
      await page.getByLabel("Categoria").selectOption({ label: "Luz" });
      await page.getByLabel("Valor previsto").fill("180,00");
      await page.getByLabel("Valor variável").check();
      await page.getByRole("button", { name: "Salvar conta fixa" }).click();

      const bill = page.getByRole("article", { name: "Conta de luz" });
      await expect(bill).toContainText("Vence dia 15");
      await expect(bill).toContainText("≈ R$ 180,00 previsto");
      await expect(bill).not.toContainText("pago");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("destaca vencimento próximo e some com o aviso depois do pagamento", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "bills-due-soon",
      "Casa aviso",
    );

    try {
      await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Internet",
        dueDay: dueSoonDay(),
        category: "internet",
        estimatedAmount: "120.00",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      const bill = page.getByRole("article", { name: "Internet" });
      await expect(bill.getByText("Vence em breve")).toBeVisible();
      await expect(bill).toContainText("R$ 120,00 previsto");

      await bill.getByRole("button", { name: "Confirmar pagamento" }).click();
      await expect(page.getByLabel("Valor do pagamento")).toHaveValue("120,00");
      await expect(page.getByLabel("Data do pagamento")).toHaveValue(
        todayInSaoPaulo(),
      );
      await page.getByLabel("Valor do pagamento").fill("134,90");
      await page
        .getByLabel("Forma de pagamento")
        .selectOption({ label: "Pix" });
      await page.getByRole("button", { name: "Salvar pagamento" }).click();

      await expect(bill.getByText("Vence em breve")).toHaveCount(0);
      await expect(bill.getByText("Pago", { exact: true })).toBeVisible();
      await expect(bill).toContainText("R$ 134,90 pago");
      await expect(bill).toContainText("R$ 120,00 previsto");

      await page.getByRole("link", { name: "Dashboard" }).click();
      await expect(
        page.getByRole("region", { name: "Resumo do mês" }),
      ).toContainText("R$ 134,90");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém o status relativo ao mês exibido ao navegar", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser("bills-month", "Casa meses");

    try {
      const billId = await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Aluguel",
        dueDay: dueSoonDay(),
        category: "aluguel",
        estimatedAmount: "2500.00",
      });
      await seedBillPayment(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        fixedBillId: billId,
        amount: "2500.00",
        category: "aluguel",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      const bill = page.getByRole("article", { name: "Aluguel" });
      await expect(bill.getByText("Pago", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Próximo mês" }).click();
      await expect(bill.getByText("Não registrado")).toBeVisible();
      await expect(bill.getByText("Pago", { exact: true })).toHaveCount(0);
      await expect(bill.getByText("Vence em breve")).toHaveCount(0);
      await expect(bill.getByText("Em atraso")).toHaveCount(0);

      await page.getByRole("link", { name: "Mês anterior" }).click();
      await expect(bill.getByText("Pago", { exact: true })).toBeVisible();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("filtra por situação sem perder o mês selecionado", async ({ page }) => {
    const fixture = await createDashboardTestUser("bills-filter", "Casa filtro");

    try {
      const paidBillId = await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Condomínio",
        dueDay: dueSoonDay(),
        category: "condominio",
        estimatedAmount: "700.00",
      });
      await seedBillPayment(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        fixedBillId: paidBillId,
        amount: "700.00",
        category: "condominio",
      });
      await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Streaming",
        dueDay: dueSoonDay(),
        category: "assinaturas",
        estimatedAmount: "39.90",
        autopay: true,
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      await page.getByRole("link", { name: "Pagas" }).click();
      await expect(
        page.getByRole("article", { name: "Condomínio" }),
      ).toBeVisible();
      await expect(
        page.getByRole("article", { name: "Streaming" }),
      ).toHaveCount(0);

      await page.getByRole("link", { name: "Pendentes" }).click();
      await expect(
        page.getByRole("article", { name: "Streaming" }),
      ).toBeVisible();
      await expect(
        page.getByRole("article", { name: "Condomínio" }),
      ).toHaveCount(0);

      await page.getByRole("link", { name: "Automáticas" }).click();
      const autopayBill = page.getByRole("article", { name: "Streaming" });
      await expect(autopayBill).toBeVisible();
      await expect(autopayBill).toContainText("Débito automático");
      await expect(
        page.getByRole("article", { name: "Condomínio" }),
      ).toHaveCount(0);
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("recalcula previsto e vencimento ao editar sem tocar no pagamento feito", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser("bills-edit", "Casa edição");

    try {
      const billId = await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Água",
        dueDay: dueSoonDay(),
        category: "condominio",
        estimatedAmount: "90.00",
      });
      await seedBillPayment(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        fixedBillId: billId,
        amount: "112.45",
        category: "condominio",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      let bill = page.getByRole("article", { name: "Água" });
      await expect(bill).toContainText("R$ 112,45 pago");

      await bill.getByRole("link", { name: "Editar conta" }).click();
      await expect(page).toHaveURL(/\/fixed-bills\/[0-9a-f-]+\/edit/);
      await page.getByLabel("Valor previsto").fill("130,00");
      await page.getByLabel("Dia do vencimento").fill("28");
      await page.getByRole("button", { name: "Salvar alterações" }).click();

      await expect(page).toHaveURL(/\/fixed-bills/);
      bill = page.getByRole("article", { name: "Água" });
      await expect(bill).toContainText("Vence dia 28");
      await expect(bill).toContainText("R$ 130,00 previsto");
      await expect(bill).toContainText("R$ 112,45 pago");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("edita, reatribui e desfaz o pagamento, devolvendo a conta a pendente", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "bills-payment-lifecycle",
      "Casa pagamento",
    );

    try {
      const sourceBillId = await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Energia",
        dueDay: dueSoonDay(),
        estimatedAmount: "200.00",
      });
      await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Gás",
        dueDay: dueSoonDay(),
        estimatedAmount: "100.00",
      });
      await seedBillPayment(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        fixedBillId: sourceBillId,
        amount: "210.00",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      const energia = page.getByRole("article", { name: "Energia" });
      const gas = page.getByRole("article", { name: "Gás" });
      await expect(energia).toContainText("R$ 210,00 pago");

      await energia.getByRole("link", { name: "Editar pagamento" }).click();
      await expect(page).toHaveURL(/\/bill-payments\/[0-9a-f-]+\/edit/);
      await page.getByLabel("Valor do pagamento").fill("95,00");
      await page.getByLabel("Conta fixa").selectOption({ label: "Gás" });
      await page.getByRole("button", { name: "Salvar alterações" }).click();

      await expect(page).toHaveURL(/\/fixed-bills/);
      await expect(energia.getByText("Vence em breve")).toBeVisible();
      await expect(gas).toContainText("R$ 95,00 pago");

      await gas.getByRole("button", { name: "Excluir pagamento" }).click();
      const dialog = page.getByRole("dialog", { name: "Excluir pagamento?" });
      await expect(dialog).toContainText("Esta ação não pode ser desfeita.");
      await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();

      await expect(gas.getByText("Vence em breve")).toBeVisible();
      await expect(gas).not.toContainText("pago");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("encerra a recorrência e preserva o pagamento como despesa comum", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "bills-end-recurrence",
      "Casa encerramento",
    );

    try {
      const billId = await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Academia",
        dueDay: dueSoonDay(),
        category: "saude",
        estimatedAmount: "150.00",
      });
      await seedBillPayment(fixture.client, {
        workspaceId: fixture.workspaceId,
        userId: fixture.id,
        fixedBillId: billId,
        amount: "150.00",
        category: "saude",
      });

      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      const bill = page.getByRole("article", { name: "Academia" });
      await bill.getByRole("button", { name: "Encerrar recorrência" }).click();
      const dialog = page.getByRole("dialog", { name: "Encerrar recorrência?" });
      await expect(dialog).toContainText("1 pagamento ficará desvinculado");
      await dialog.getByRole("button", { name: "Encerrar definitivamente" }).click();

      await expect(page.getByRole("article", { name: "Academia" })).toHaveCount(
        0,
      );
      await expect(page.getByText("Nenhuma conta fixa ainda.")).toBeVisible();

      await page.getByRole("link", { name: "Dashboard" }).click();
      const preserved = page.getByRole("listitem").filter({ hasText: "Saúde" });
      await expect(preserved).toContainText("-R$ 150,00");
      await expect(preserved.getByRole("link", { name: "Editar" })).toBeVisible();
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém a página de contas fixas utilizável em viewport móvel", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser(
      "bills-mobile",
      "Casa contas responsivas",
    );

    try {
      await seedFixedBill(fixture.client, {
        workspaceId: fixture.workspaceId,
        name: "Conta responsiva",
        dueDay: dueSoonDay(),
        estimatedAmount: "1250.00",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, fixture.email, fixture.password);
      await page.goto("/fixed-bills");

      await expect(
        page.getByRole("heading", { name: "Contas fixas" }),
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
