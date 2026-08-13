import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInWithGoogle } from "@/lib/auth/sign-in-with-google";

function fakeClient(signInImpl: (...args: unknown[]) => unknown) {
  return {
    auth: { signInWithOAuth: vi.fn(signInImpl) },
  } as unknown as SupabaseClient;
}

describe("signInWithGoogle", () => {
  it("pede o provedor google com a redirectTo informada", async () => {
    const signInWithOAuth = vi.fn(() =>
      Promise.resolve({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." }, error: null }),
    );
    const client = { auth: { signInWithOAuth } } as unknown as SupabaseClient;

    await signInWithGoogle(client, {
      redirectTo: "https://cadence.example.com/auth/callback?next=/dashboard",
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://cadence.example.com/auth/callback?next=/dashboard",
      },
    });
  });

  it("retorna a URL do Google quando a chamada tem sucesso", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc" },
        error: null,
      }),
    );

    const result = await signInWithGoogle(client, {
      redirectTo: "https://cadence.example.com/auth/callback",
    });

    expect(result).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
      error: null,
    });
  });

  it("retorna erro genérico quando o Supabase falha", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: { url: null },
        error: { message: "provider not configured" },
      }),
    );

    const result = await signInWithGoogle(client, {
      redirectTo: "https://cadence.example.com/auth/callback",
    });

    expect(result.url).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("retorna erro se a chamada não tem erro mas também não devolve URL", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: { url: null }, error: null }),
    );

    const result = await signInWithGoogle(client, {
      redirectTo: "https://cadence.example.com/auth/callback",
    });

    expect(result.url).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
