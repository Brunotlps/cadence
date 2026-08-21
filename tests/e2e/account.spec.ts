import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  authenticateBrowser,
  createDashboardTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

async function login(page: Page, email: string, password: string) {
  await authenticateBrowser(page, email, password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("conta", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("exporta os dados do usuário autenticado em JSON", async ({ page }) => {
    const user = await createDashboardTestUser(
      "account-export-e2e",
      "Conta Export",
    );

    try {
      await login(page, user.email, user.password);
      await page.goto("/account");

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Baixar meus dados" }).click(),
      ]);

      expect(download.suggestedFilename()).toBe("cadence-data-export.json");

      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      const body = JSON.parse(readFileSync(downloadPath!, "utf-8"));

      expect(body.workspaces.some((w: { id: string }) => w.id === user.workspaceId))
        .toBe(true);
      expect(body.profile.id).toBe(user.id);
    } finally {
      await deleteTestAccount(user.id);
    }
  });

  test("bloqueia exclusão quando a confirmação não é EXCLUIR", async ({
    page,
  }) => {
    const user = await createDashboardTestUser(
      "account-delete-invalid-e2e",
      "Conta Delete Invalida",
    );

    try {
      await login(page, user.email, user.password);
      await page.goto("/account");

      await page
        .getByLabel("Confirmação")
        .fill("apagar");
      await page.getByRole("button", { name: "Excluir minha conta" }).click();

      await expect(page.getByText("Digite EXCLUIR para confirmar.")).toBeVisible();
      await expect(page).toHaveURL(/\/account/);
    } finally {
      await deleteTestAccount(user.id);
    }
  });

  test("exclui a própria conta e redireciona para o login", async ({
    page,
  }) => {
    const user = await createDashboardTestUser(
      "account-delete-e2e",
      "Conta Delete",
    );
    let deleted = false;

    try {
      await login(page, user.email, user.password);
      await page.goto("/account");

      await page.getByLabel("Confirmação").fill("EXCLUIR");
      await page.getByRole("button", { name: "Excluir minha conta" }).click();

      await expect(page).toHaveURL(/\/login/);
      deleted = true;
    } finally {
      if (!deleted) await deleteTestAccount(user.id);
    }
  });
});
