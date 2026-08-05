import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUp } from "@/lib/auth/sign-up";

function fakeClient(signUpImpl: (...args: unknown[]) => unknown) {
  return {
    auth: { signUp: vi.fn(signUpImpl) },
  } as unknown as SupabaseClient;
}

describe("signUp", () => {
  it("chama supabase.auth.signUp com email/senha e o redirect informado", async () => {
    const signUpMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = fakeClient(signUpMock);

    await signUp(
      client,
      { email: "a@example.com", password: "senha-forte" },
      { emailRedirectTo: "https://cadence.example/onboarding/workspace" },
    );

    expect(signUpMock).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "senha-forte",
      options: { emailRedirectTo: "https://cadence.example/onboarding/workspace" },
    });
  });

  it("retorna sem erro quando o cadastro é aceito", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: {}, error: null }),
    );

    const result = await signUp(
      client,
      { email: "a@example.com", password: "senha-forte" },
      { emailRedirectTo: "https://cadence.example/onboarding/workspace" },
    );

    expect(result).toEqual({ error: null });
  });

  it("retorna erro genérico quando o Supabase rejeita o cadastro", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: {},
        error: { message: "Password should be at least 6 characters" },
      }),
    );

    const result = await signUp(
      client,
      { email: "a@example.com", password: "123" },
      { emailRedirectTo: "https://cadence.example/onboarding/workspace" },
    );

    expect(result.error).toBeTruthy();
    // Não repassa a mensagem crua do Supabase — mantém controle sobre o que
    // é exposto na UI.
    expect(result.error).not.toContain("Password should be");
  });
});
