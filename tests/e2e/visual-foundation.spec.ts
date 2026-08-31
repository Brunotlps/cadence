import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  authenticateBrowser,
  createDashboardTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EDIT_ID = "11111111-1111-4111-8111-111111111111";
type StorageState = Awaited<
  ReturnType<ReturnType<Page["context"]>["storageState"]>
>;

async function login(page: Page, email: string, password: string) {
  await authenticateBrowser(page, email, password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

async function chooseAccent(page: Page, label: "Preto" | "Rosa" | "Verde") {
  const trigger = page.getByRole("button", { name: /Aparência/ });
  await trigger.click();
  const group = page.getByRole("group", { name: "Cor de destaque" });
  await group.getByLabel(label).check();
  await expect(page.locator("[data-accent]")).toHaveAttribute(
    "data-accent",
    label.toLocaleLowerCase("pt-BR"),
  );
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

async function expectThemeAliases(page: Page) {
  const aliases = await page.locator("[data-accent]").evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      "--brand-subtle",
      "--brand-border",
      "--brand-detail",
      "--surface-raised",
    ].map((name) => style.getPropertyValue(name).trim());
  });

  for (const alias of aliases) expect(alias).not.toBe("");
}

async function expectActiveDestination(page: Page, label: string) {
  const navigation = page.getByRole("navigation", {
    name: "Navegação principal",
  });
  await expect(navigation.getByRole("link", { name: label })).toHaveAttribute(
    "aria-current",
    "page",
  );
}

async function openWithoutJavaScript(
  browser: Browser,
  storageState: StorageState,
) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    javaScriptEnabled: false,
    storageState,
  });
  const page = await context.newPage();
  const response = await page.goto("/dashboard");
  return { context, page, response };
}

test.describe("fundação visual compartilhada", () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("mantém três destinos, estado ativo nas edições e logout persistente", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser("shell-nav", "Casa navegação");

    try {
      await test.step("autentica e valida os três destinos", async () => {
        await login(page, fixture.email, fixture.password);

        const navigation = page.getByRole("navigation", {
          name: "Navegação principal",
        });
        await expect(navigation.getByRole("link")).toHaveCount(3);
        await expect(
          navigation.getByRole("link", { name: "Dashboard" }),
        ).toBeVisible();
        await expect(
          navigation.getByRole("link", { name: "Metas" }),
        ).toBeVisible();
        await expect(
          navigation.getByRole("link", { name: "Fixas" }),
        ).toBeVisible();
        await expect(navigation.getByText("Lançamentos")).toHaveCount(0);
        await expectActiveDestination(page, "Dashboard");
      });

      await test.step("mantém Metas ativa na rota e edição", async () => {
        await page.getByRole("link", { name: "Metas" }).click();
        await expect(page).toHaveURL(/\/goals$/);
        await expectActiveDestination(page, "Metas");
        await page.goto(`/contributions/${EDIT_ID}/edit`);
        await expectActiveDestination(page, "Metas");
      });

      await test.step("mantém Fixas ativa na rota e edição", async () => {
        await page.getByRole("link", { name: "Fixas" }).click();
        await expect(page).toHaveURL(/\/fixed-bills/);
        await expectActiveDestination(page, "Fixas");
        await page.goto(`/bill-payments/${EDIT_ID}/edit`);
        await expectActiveDestination(page, "Fixas");
      });

      await test.step("mantém Dashboard ativo no editor de lançamento", async () => {
        await page.goto(`/transactions/${EDIT_ID}/edit`);
        await expectActiveDestination(page, "Dashboard");
      });

      await test.step("encerra a sessão pelo shell", async () => {
        await page.getByRole("button", { name: "Sair" }).click();
        await expect(page).toHaveURL(/\/login$/);
      });
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("persiste a preferência por pessoa e a entrega no HTML sem JavaScript", async ({
    browser,
    page,
  }) => {
    const personA = await createDashboardTestUser("accent-person-a", "Casa A");
    const personB = await createDashboardTestUser("accent-person-b", "Casa B");

    try {
      await login(page, personA.email, personA.password);
      await chooseAccent(page, "Rosa");
      await expectThemeAliases(page);
      await page.reload();
      await expect(page.locator("[data-accent]")).toHaveAttribute(
        "data-accent",
        "rosa",
      );

      const storageState = await page.context().storageState();
      const noJs = await openWithoutJavaScript(browser, storageState);
      try {
        expect(noJs.response).not.toBeNull();
        expect(await noJs.response!.text()).toContain('data-accent="rosa"');
        await expect(noJs.page.locator("[data-accent]")).toHaveAttribute(
          "data-accent",
          "rosa",
        );
      } finally {
        await noJs.context.close();
      }

      await page.getByRole("button", { name: "Sair" }).click();
      await login(page, personB.email, personB.password);
      await expect(page.locator("[data-accent]")).toHaveAttribute(
        "data-accent",
        "verde",
      );
      await chooseAccent(page, "Preto");
      await expectThemeAliases(page);
      await page.getByRole("button", { name: "Sair" }).click();

      await login(page, personA.email, personA.password);
      await expect(page.locator("[data-accent]")).toHaveAttribute(
        "data-accent",
        "rosa",
      );
    } finally {
      await deleteTestAccount(personA.id);
      await deleteTestAccount(personB.id);
    }
  });

  test("navega o seletor de cor por teclado sem fechar o painel a cada passo", async ({
    page,
  }) => {
    const fixture = await createDashboardTestUser("accent-keyboard", "Casa teclado");

    try {
      await login(page, fixture.email, fixture.password);
      await chooseAccent(page, "Preto");

      const trigger = page.getByRole("button", { name: /Aparência/ });
      await trigger.click();
      const group = page.getByRole("group", { name: "Cor de destaque" });

      // Conta quantas Server Actions o formulário dispara. Duas teclas de
      // seta em sequência rápida (preto -> rosa -> verde) devem gerar uma
      // única submissão, com o valor final — não uma submissão por passo.
      let submissionCount = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.headers()["next-action"] !== undefined
        ) {
          submissionCount += 1;
        }
      });

      await group.getByLabel("Preto").focus();
      await page.keyboard.press("ArrowDown"); // -> Rosa
      await page.keyboard.press("ArrowDown"); // -> Verde, logo em seguida

      await expect(trigger).toHaveAttribute("aria-expanded", "false", {
        timeout: 5_000,
      });
      expect(submissionCount).toBe(1);

      const persisted = await fixture.client
        .from("profiles")
        .select("accent_color")
        .eq("id", fixture.id)
        .single();
      expect(persisted.data?.accent_color).toBe("verde");
    } finally {
      await deleteTestAccount(fixture.id);
    }
  });

  test("mantém o shell utilizável sem overflow no viewport móvel", async ({ page }) => {
    const fixture = await createDashboardTestUser("shell-mobile", "Casa móvel");

    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, fixture.email, fixture.password);

      const navigation = page.getByRole("navigation", {
        name: "Navegação principal",
      });
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("link")).toHaveCount(3);
      const appearance = page.getByRole("button", { name: /Aparência/ });
      await expect(appearance).toBeVisible();
      await expect(page.getByRole("group", { name: "Cor de destaque" })).toBeHidden();
      await appearance.click();
      await expect(page.getByRole("group", { name: "Cor de destaque" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Salvar cor" })).toHaveCount(0);
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
