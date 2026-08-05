import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resendConfirmation } from "@/lib/auth/resend-confirmation";

describe("resendConfirmation", () => {
  it("chama supabase.auth.resend com type signup e retorna mensagem fixa", async () => {
    const resendMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { auth: { resend: resendMock } } as unknown as SupabaseClient;

    const result = await resendConfirmation(client, "a@example.com", {
      emailRedirectTo: "https://cadence.example/onboarding/workspace",
    });

    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "a@example.com",
      options: { emailRedirectTo: "https://cadence.example/onboarding/workspace" },
    });
    expect(result.message).toBeTruthy();
  });

  it("mesma mensagem independente do Supabase reportar erro (ex: e-mail já confirmado)", async () => {
    const client = {
      auth: {
        resend: vi
          .fn()
          .mockResolvedValue({ data: {}, error: { message: "Email already confirmed" } }),
      },
    } as unknown as SupabaseClient;

    const withError = await resendConfirmation(client, "a@example.com", {
      emailRedirectTo: "https://cadence.example/onboarding/workspace",
    });

    const okClient = {
      auth: { resend: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    } as unknown as SupabaseClient;
    const withoutError = await resendConfirmation(okClient, "b@example.com", {
      emailRedirectTo: "https://cadence.example/onboarding/workspace",
    });

    expect(withError.message).toBe(withoutError.message);
  });
});
