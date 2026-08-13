import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithGoogle: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  headers: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/sign-in-with-google", () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { signInWithGoogleAction } from "@/lib/actions/auth";

describe("signInWithGoogleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({});
    mocks.headers.mockResolvedValue(
      new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
    );
  });

  it("redireciona para a URL do Google quando a chamada tem sucesso", async () => {
    mocks.signInWithGoogle.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
      error: null,
    });

    await expect(
      signInWithGoogleAction({ error: null }, new FormData()),
    ).rejects.toThrow(
      "redirect:https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
    );

    expect(mocks.signInWithGoogle).toHaveBeenCalledWith(
      {},
      {
        redirectTo: "http://localhost:3000/auth/callback?next=/dashboard",
      },
    );
  });

  it("retorna erro em vez de redirecionar quando a chamada falha", async () => {
    mocks.signInWithGoogle.mockResolvedValue({
      url: null,
      error: "Não foi possível iniciar o login com o Google. Tente novamente.",
    });

    const result = await signInWithGoogleAction({ error: null }, new FormData());

    expect(result.error).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
