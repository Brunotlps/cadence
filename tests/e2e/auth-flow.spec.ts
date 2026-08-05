import { test, expect } from "@playwright/test";
import {
  createConfirmedTestUser,
  deleteTestAccount,
  deleteTestAccountByEmail,
  generateRecoveryLink,
  generateSignupConfirmationLink,
  hasSupabaseTestEnv,
} from "./support";

// Fluxo completo de autenticação (etapa 05, subtarefa 5). Escrito antes da
// implementação (subtarefas 6-8) — fica vermelho até lib/auth, as Server
// Actions e as telas existirem. A confirmação de e-mail usa
// admin.generateLink em vez de e-mail de verdade: sem infra de leitura de
// caixa de entrada no teste, mas ainda exercitando a rota real de
// confirmação que o link do Supabase aponta.
test.describe.serial("fluxo de autenticação", () => {
  test.skip(!hasSupabaseTestEnv(), "sem credenciais de teste do Supabase");

  test("cadastro, confirmação, criação de workspace, login e logout", async ({
    page,
  }) => {
    // O cadastro passa pelo formulário real (/signup), então dispara um
    // envio de e-mail de verdade via signUp() — diferente do link de
    // confirmação abaixo, que usa admin.generateLink e não envia nada. Conta
    // Resend ainda em modo de teste (decisão 14): só aceita esse endereço
    // dedicado como destinatário; um e-mail @example.com qualquer é
    // rejeitado com 550 antes de chegar no GoTrue.
    const email = "delivered@resend.dev";
    const password = crypto.randomUUID();

    try {
      await page.goto("/signup");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Criar conta" }).click();

      // Tela de espera — sem login automático antes da confirmação.
      await expect(page).toHaveURL(/\/confirm-email/);
      await expect(
        page.getByText(/confirme seu e-mail/i),
      ).toBeVisible();

      // Login antes de confirmar não deve funcionar — erro genérico, igual
      // ao de credenciais erradas (diferenciar aqui seria um oráculo de
      // enumeração pelo próprio formulário de login).
      await page.goto("/login");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      // Escopado a <main>: o App Router injeta seu próprio elemento
      // role="alert" (route announcer de acessibilidade) fora do <main> em
      // toda navegação, que não tem relação com erro nenhum da aplicação.
      const loginAlert = page.locator("main").getByRole("alert");
      await expect(loginAlert).toBeVisible();
      await expect(loginAlert).not.toContainText(/confirme/i);

      // Simula o clique no link de confirmação do e-mail.
      const confirmationLink = await generateSignupConfirmationLink(
        email,
        password,
      );
      await page.goto(confirmationLink);

      // Pós-confirmação: tela explícita de criar workspace (decisão 4 — não
      // é automático).
      await expect(page).toHaveURL(/\/onboarding\/workspace/);
      await page.getByLabel("Nome do espaço").fill("Bruno & Alyne");
      await page.getByRole("button", { name: "Criar espaço" }).click();

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText("Bruno & Alyne")).toBeVisible();

      // Logout explícito.
      await page.getByRole("button", { name: "Sair" }).click();
      await expect(page).toHaveURL(/\/login/);

      // Login com a conta já confirmada.
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    } finally {
      await deleteTestAccountByEmail(email);
    }
  });

  test("cadastro com e-mail já confirmado é indistinguível de um cadastro novo", async ({
    page,
  }) => {
    // O Supabase já trata isso sem erro por padrão (retorna sucesso com
    // identities: [], sem reenviar confirmação) — a tela precisa refletir
    // esse comportamento e não introduzir um sinal diferenciável próprio
    // (ex: um erro visível só nesse caso). Um alerta de erro aqui já seria
    // enumeração, mesmo que o texto do erro não mencione o motivo.
    const existing = await createConfirmedTestUser("signup-dup");

    try {
      await page.goto("/signup");
      await page.getByLabel("E-mail").fill(existing.email);
      await page.getByLabel("Senha").fill(crypto.randomUUID());
      await page.getByRole("button", { name: "Criar conta" }).click();

      await expect(page).toHaveURL(/\/confirm-email/);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      await expect(
        page.getByText(/confirme seu e-mail/i),
      ).toBeVisible();
    } finally {
      await deleteTestAccount(existing.id);
    }
  });

  test("recuperação de senha mostra a mesma mensagem para e-mail cadastrado ou não", async ({
    page,
  }) => {
    const existing = await createConfirmedTestUser("recovery-known");

    try {
      await page.goto("/forgot-password");
      await page.getByLabel("E-mail").fill(existing.email);
      await page.getByRole("button", { name: "Enviar" }).click();
      const knownEmailMessage = await page
        .getByRole("status")
        .textContent();

      await page.goto("/forgot-password");
      await page
        .getByLabel("E-mail")
        .fill(`nao-existe-${crypto.randomUUID()}@example.com`);
      await page.getByRole("button", { name: "Enviar" }).click();
      const unknownEmailMessage = await page
        .getByRole("status")
        .textContent();

      expect(knownEmailMessage).toBe(unknownEmailMessage);
    } finally {
      await deleteTestAccount(existing.id);
    }
  });

  test("redefinir senha via link de recuperação permite login com a senha nova", async ({
    page,
  }) => {
    const user = await createConfirmedTestUser("recovery-flow");
    const newPassword = crypto.randomUUID();

    try {
      const recoveryLink = await generateRecoveryLink(user.email);
      await page.goto(recoveryLink);

      await expect(page).toHaveURL(/\/reset-password/);
      await page.getByLabel("Nova senha").fill(newPassword);
      await page.getByRole("button", { name: "Redefinir senha" }).click();

      await expect(page).toHaveURL(/\/login/);
      await page.getByLabel("E-mail").fill(user.email);
      await page.getByLabel("Senha").fill(newPassword);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    } finally {
      await deleteTestAccount(user.id);
    }
  });
});
