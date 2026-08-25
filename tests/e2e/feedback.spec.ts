import { expect, test } from "@playwright/test";
import { authenticateBrowser, createDashboardTestUser, deleteTestAccount, hasSupabaseTestEnv } from "./support";

test.describe("feedback", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");
  test("abre em rotas protegidas e valida o relato de problema sem entrega externa", async ({ page }) => {
    const user = await createDashboardTestUser("feedback-e2e", "Feedback");
    try {
      await authenticateBrowser(page, user.email, user.password);
      for (const path of ["/dashboard", "/onboarding/workspace", "/join/test-token"]) {
        await page.goto(path);
        await page.getByRole("button", { name: "Enviar feedback" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByText(/o que aconteceu e o que você esperava/i)).toBeVisible();
        await page.getByRole("button", { name: "Cancelar" }).click();
      }
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Enviar feedback" }).click();
      await page.getByRole("radio", { name: "Problema" }).check();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Enviar feedback" }).click();
      await expect(page.getByLabel("Mensagem")).toBeFocused();
      await expect(page).toHaveURL(/\/dashboard/);
    } finally { await deleteTestAccount(user.id); }
  });

  test("usa diálogo nativo acessível e restaura o foco sem enviar feedback", async ({ page }) => {
    const user = await createDashboardTestUser("feedback-dialog-e2e", "Feedback dialog");
    try {
      await authenticateBrowser(page, user.email, user.password);
      await page.goto("/dashboard");
      const launcher = page.getByRole("button", { name: "Enviar feedback" });
      await launcher.focus();
      await launcher.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Enviar feedback" });
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel("Mensagem")).toBeFocused();
      await expect(page.getByRole("radio", { name: "Problema" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Sugestão" })).toBeVisible();
      await expect(page.getByText(/Não inclua senhas, dados bancários/i)).toBeVisible();
      await page.getByRole("radio", { name: "Problema" }).check();
      await dialog.locator("form").evaluate((form) => { (form as HTMLFormElement).noValidate = true; });
      await dialog.getByRole("button", { name: "Enviar feedback" }).click();
      const message = page.getByLabel("Mensagem");
      const messageError = dialog.getByText("Descreva seu feedback.", { exact: true });
      await expect(messageError).toHaveAttribute("role", "alert");
      await expect(message).toHaveAttribute("aria-invalid", "true");
      await expect(message).toHaveAttribute("aria-describedby", "feedback-message-error");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(launcher).toBeFocused();
    } finally { await deleteTestAccount(user.id); }
  });

  test("mostra a orientação específica para sugestão sem uma segunda interface", async ({ page }) => {
    const user = await createDashboardTestUser("feedback-suggestion-e2e", "Feedback suggestion");
    try {
      await authenticateBrowser(page, user.email, user.password);
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Enviar feedback" }).click();
      const dialog = page.getByRole("dialog");
      await page.getByRole("radio", { name: "Sugestão" }).check();
      await expect(page.getByText("Conte o que você gostaria que melhorasse.")).toBeVisible();
      await expect(dialog).toHaveCount(1);
      await dialog.getByRole("button", { name: "Enviar feedback" }).click();
      await expect(page.getByLabel("Mensagem")).toBeFocused();
    } finally { await deleteTestAccount(user.id); }
  });

  test("mantém o lançador e o diálogo utilizáveis em 320px", async ({ page }) => {
    const user = await createDashboardTestUser("feedback-mobile-e2e", "Feedback mobile");
    try {
      await page.setViewportSize({ width: 320, height: 720 });
      await authenticateBrowser(page, user.email, user.password);
      await page.goto("/dashboard");

      const launcher = page.getByRole("button", { name: "Enviar feedback" });
      await expect(launcher).toBeVisible();
      await expect(launcher).toHaveCSS("min-height", "44px");
      await launcher.click();

      const dialog = page.getByRole("dialog", { name: "Enviar feedback" });
      await expect(dialog).toBeVisible();
      const doesNotOverflow = await page.locator("html").evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(doesNotOverflow).toBe(true);
      await dialog.getByRole("button", { name: "Cancelar" }).click();
    } finally { await deleteTestAccount(user.id); }
  });
});
