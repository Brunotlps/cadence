import { test, expect } from "@playwright/test";

// Cobre a parte de "redirect de rota protegida sem sessão" da decisão 10
// (etapa 05): middleware.ts + lib/supabase/middleware.ts devem redirecionar
// para /login antes de qualquer HTML da rota protegida ser servido.
test("acessar rota protegida sem sessão redireciona para /login", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Que bom ter você de volta." }),
  ).toBeVisible();
});
