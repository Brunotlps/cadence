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

  it("sinaliza needsConfirmation quando o e-mail não foi confirmado", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: {},
        error: { code: "email_not_confirmed", message: "Email not confirmed" },
      }),
    );

    const result = await signIn(client, {
      email: "a@example.com",
      password: "senha-forte",
    });

    expect(result.needsConfirmation).toBe(true);
    expect(result.error).toBeTruthy();
  });

  it("retorna erro genérico para credenciais inválidas, sem indicar o motivo", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: {},
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
      }),
    );

    const result = await signIn(client, {
      email: "a@example.com",
      password: "senha-errada",
    });

    expect(result.needsConfirmation).toBeFalsy();
    expect(result.error).toBeTruthy();
  });
});
