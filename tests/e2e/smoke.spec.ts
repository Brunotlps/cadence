import { test, expect } from "@playwright/test";

test("homepage carrega e exibe o nome do app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cadence" })).toBeVisible();
});
