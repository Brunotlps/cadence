import { test, expect } from "@playwright/test";

// Etapa 13, decisão 6: a homepage deixa de ser um beco sem saída e passa a
// levar para o fluxo de acesso. Sem fixture de Supabase — rota pública, sem
// autenticação e sem dado nenhum envolvido.
test.describe("landing page", () => {
  test("leva ao login sem coletar dado nenhum", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Cadence/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Cadence" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Entrar/ })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator("input")).toHaveCount(0);
  });

  test("navega para o login pelo link principal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("não tem overflow horizontal em 320 ou 1440 px", async ({ page }) => {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
  });
});
