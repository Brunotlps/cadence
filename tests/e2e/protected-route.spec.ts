import { test, expect } from "@playwright/test";

// Cobre a parte de "redirect de rota protegida sem sessão" da decisão 10
// (etapa 05): proxy.ts + lib/supabase/middleware.ts devem redirecionar para
// /login antes de qualquer HTML da rota protegida ser servido. Desde a etapa
// 17, o redirect preserva o caminho original em ?next=, para o convite de
// workspace conseguir mandar de volta pra /join/<token> depois do login.
test("acessar rota protegida sem sessão redireciona para /login preservando o destino", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Que bom ter você de volta." }),
  ).toBeVisible();
});
