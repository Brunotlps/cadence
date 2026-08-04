import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";

describe("requestPasswordReset", () => {
  it("retorna a mesma mensagem quando o Supabase aceita a solicitação", async () => {
    const client = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    } as unknown as SupabaseClient;

    const result = await requestPasswordReset(client, "existe@example.com", {
      redirectTo: "https://cadence.example/reset-password",
    });

    expect(result.message).toBeTruthy();
  });

  it("retorna a MESMA mensagem quando o Supabase reporta erro (ex: e-mail inexistente)", async () => {
    const client = {
      auth: {
        resetPasswordForEmail: vi
          .fn()
          .mockResolvedValue({ data: {}, error: { message: "User not found" } }),
      },
    } as unknown as SupabaseClient;

    const known = await requestPasswordReset(client, "existe@example.com", {
      redirectTo: "https://cadence.example/reset-password",
    });
    const unknown = await requestPasswordReset(client, "nao-existe@example.com", {
      redirectTo: "https://cadence.example/reset-password",
    });

    // A mensagem não pode depender do resultado real — senão vira o próprio
    // sinal de enumeração que a decisão 6 tenta evitar.
    expect(known.message).toBe(unknown.message);
  });
});
