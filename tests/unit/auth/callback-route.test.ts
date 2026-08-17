import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET } from "@/app/auth/callback/route";

function callback(url: string) {
  return GET(new Request(url));
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        verifyOtp: mocks.verifyOtp,
      },
    });
  });

  it("troca um code OAuth/PKCE bem-sucedido e redireciona para next seguro", async () => {
    const response = await callback(
      "https://cadence.example.com/auth/callback?code=oauth-code&next=/join/token-1",
    );

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cadence.example.com/join/token-1",
    );
  });

  it("derruba next inseguro para /dashboard no fluxo com code", async () => {
    const response = await callback(
      "https://cadence.example.com/auth/callback?code=oauth-code&next=https://evil.example",
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cadence.example.com/dashboard",
    );
  });

  it("redireciona para login quando a troca do code falha", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("invalid code"),
    });

    const response = await callback(
      "https://cadence.example.com/auth/callback?code=invalid-code&next=/dashboard",
    );

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cadence.example.com/login",
    );
  });

  it("rejeita token_hash/type sem criar sessão", async () => {
    const response = await callback(
      "https://cadence.example.com/auth/callback?token_hash=legacy-token&type=signup",
    );

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cadence.example.com/login",
    );
  });

  it("com code e parâmetros OTP legados chama somente exchangeCodeForSession", async () => {
    const response = await callback(
      "https://cadence.example.com/auth/callback?code=oauth-code&token_hash=legacy-token&type=signup&next=/dashboard",
    );

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cadence.example.com/dashboard",
    );
  });
});
