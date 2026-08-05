import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signIn } from "@/lib/auth/sign-in";

function fakeClient(signInImpl: (...args: unknown[]) => unknown) {
  return {
    auth: { signInWithPassword: vi.fn(signInImpl) },
  } as unknown as SupabaseClient;
}

describe("signIn", () => {
  it("retorna sem erro quando as credenciais são válidas", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: {}, error: null }),
    );

    const result = await signIn(client, {
      email: "a@example.com",
      password: "senha-forte",
    });

    expect(result).toEqual({ error: null });
  });

  it("retorna a MESMA mensagem para e-mail não confirmado e credenciais erradas", async () => {
    // Diferenciar esses dois casos vira um oráculo de enumeração pelo
    // próprio formulário de login (descobre se um e-mail existe sem
    // acertar a senha) — precisam ser indistinguíveis.
    const unconfirmedClient = fakeClient(() =>
      Promise.resolve({
        data: {},
        error: { code: "email_not_confirmed", message: "Email not confirmed" },
      }),
    );
    const wrongPasswordClient = fakeClient(() =>
      Promise.resolve({
        data: {},
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
      }),
    );

    const unconfirmedResult = await signIn(unconfirmedClient, {
      email: "a@example.com",
      password: "senha-forte",
    });
    const wrongPasswordResult = await signIn(wrongPasswordClient, {
      email: "b@example.com",
      password: "senha-errada",
    });

    expect(unconfirmedResult.error).toBeTruthy();
    expect(unconfirmedResult.error).toBe(wrongPasswordResult.error);
  });
});
