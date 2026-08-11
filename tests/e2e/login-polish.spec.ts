import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function expectMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe("experiência de login", () => {
  test("apresenta marca, hierarquia e inspeção acessível da senha", async ({
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
      page.getByText("Entre para continuar acompanhando seu espaço."),
    ).toBeVisible();

    const email = page.getByLabel("E-mail");
    const password = page.getByLabel("Senha");
    const visibility = page.getByRole("button", { name: "Mostrar senha" });

    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await expect(visibility).toHaveAttribute("aria-pressed", "false");

    await password.fill("segredo temporário");
    await visibility.focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("segredo temporário");
    await expect(
      page.getByRole("button", { name: "Ocultar senha" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await expect(
      page.getByRole("link", { name: "Esqueci minha senha" }),
    ).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("mantém reflow e alvos acessíveis no viewport de 320 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/login");

    await expectNoHorizontalOverflow(page);
    await expectMinimumTarget(page.getByLabel("E-mail"));
    await expectMinimumTarget(page.getByLabel("Senha"));
    await expectMinimumTarget(
      page.getByRole("button", { name: "Mostrar senha" }),
    );
    await expectMinimumTarget(page.getByRole("button", { name: "Entrar" }));
    await expectMinimumTarget(
      page.getByRole("link", { name: "Esqueci minha senha" }),
    );
  });
});
