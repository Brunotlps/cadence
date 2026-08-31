import { expect, test } from "@playwright/test";

test("publica os ícones institucionais do Cadence", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel~="icon"]').first()).toBeAttached();

  for (const asset of ["/icon.svg", "/favicon.ico", "/apple-icon.png"]) {
    const response = await page.request.get(asset);
    expect(response.ok(), `${asset} deve estar disponível`).toBe(true);
  }
});
