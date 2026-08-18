import { expect, test, type Page } from "@playwright/test";
import {
  authenticateBrowser,
  createConfirmedTestUser,
  createDashboardTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

async function login(page: Page, email: string, password: string) {
  await authenticateBrowser(page, email, password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("convite de workspace", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("dono gera um link e uma segunda conta entra no mesmo espaço", async ({
    page,
    browser,
  }) => {
    const owner = await createDashboardTestUser("invite-e2e-owner", "Bruno & Alyne");
    const invitee = await createConfirmedTestUser("invite-e2e-invitee");

    try {
      await login(page, owner.email, owner.password);
      await page.getByRole("link", { name: "Convidar alguém" }).click();
      await expect(page).toHaveURL(/\/workspace\/invite/);

      await page.getByRole("button", { name: "Gerar link de convite" }).click();
      const linkInput = page.locator("#invite-link");
      await expect(linkInput).toBeVisible();
      const link = await linkInput.inputValue();
      const token = new URL(link).pathname.split("/join/")[1];
      expect(token).toBeTruthy();

      const inviteeContext = await browser.newContext();
      const inviteePage = await inviteeContext.newPage();
      await authenticateBrowser(inviteePage, invitee.email, invitee.password);
      await inviteePage.goto(`/join/${token}`);
      await expect(
        inviteePage.getByRole("heading", { name: "Confirmar convite" }),
      ).toBeVisible();
      await inviteePage.getByRole("button", { name: "Confirmar convite" }).click();

      await expect(inviteePage).toHaveURL(/\/dashboard/);
      await expect(inviteePage.getByText("Bruno & Alyne")).toBeVisible();

      await inviteeContext.close();
    } finally {
      await deleteTestAccount(owner.id);
      await deleteTestAccount(invitee.id);
    }
  });

  test("convite inválido mostra mensagem clara e um caminho de volta", async ({
    page,
  }) => {
    const invitee = await createConfirmedTestUser("invite-e2e-invalid");

    try {
      // authenticateBrowser em vez de login(): navegar antes pro /dashboard
      // hidratado e só depois pro /join, na mesma page, dispara um
      // net::ERR_ABORTED específico do test runner do Playwright (confirmado
      // via curl direto que o servidor responde 200 normalmente) — evitado
      // indo direto pro /join, que é tudo que este teste precisa.
      await authenticateBrowser(page, invitee.email, invitee.password);
      await page.goto("/join/00000000-0000-0000-0000-000000000000");

      await expect(
        page.getByRole("heading", { name: "Confirmar convite" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Confirmar convite" }).click();
      await expect(
        page.getByText("Convite inválido ou expirado.", { exact: false }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Ir para o Dashboard" }).click();
      await expect(page).toHaveURL(/\/onboarding\/workspace/);
    } finally {
      await deleteTestAccount(invitee.id);
    }
  });
});
