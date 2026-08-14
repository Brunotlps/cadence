import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test.describe("experiência de login", () => {
  test("apresenta marca, hierarquia e o botão do Google", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle("Entrar | Cadence");
    await expect(page.getByText("Seu dinheiro, no seu ritmo.")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Que bom ter você de volta.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Entre com sua conta Google para continuar acompanhando seu espaço.",
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Continuar com Google" }),
    ).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveCount(0);
    await expect(page.getByLabel("Senha")).toHaveCount(0);
  });

  test("mantém reflow e alvo acessível no viewport de 320 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/login");

    await expectNoHorizontalOverflow(page);
    const button = page.getByRole("button", { name: "Continuar com Google" });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
