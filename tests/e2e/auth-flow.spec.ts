import { expect, test } from "@playwright/test";
import { hasSupabaseTestEnv } from "./support";

// Etapa 16: login só com Google. O consentimento real do Google não é
// automatizável de forma confiável em E2E — este arquivo não tenta simular a
// tela de login do Google. O que cobre: a tela mostra só o botão certo, as
// rotas antigas de e-mail/senha não existem mais, e clicar no botão de fato
// inicia um redirect real até o Google (prova que a Server Action monta a
// URL certa e que a integração Google Cloud/Supabase está configurada),
// sem completar o login.
test.describe("fluxo de autenticação", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("login mostra só o botão do Google, sem campo de e-mail ou senha", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: "Continuar com Google" }),
    ).toBeVisible();
    await expect(page.locator("input")).toHaveCount(0);
  });

  test("as rotas antigas de e-mail/senha não existem mais", async ({ page }) => {
    for (const path of [
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/confirm-email",
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    }
  });

  test("o botão do Google inicia o redirect real até o Google", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await expect(page).toHaveURL(/accounts\.google\.com/, { timeout: 15_000 });
  });
});
