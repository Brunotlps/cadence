import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

async function postTestSession(body: unknown) {
  const { POST } = await import("@/app/auth/test-session/route");

  return POST(
    new Request("http://localhost/auth/test-session", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /auth/test-session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 in production without creating a Supabase client", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await postTestSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns 400 outside production when tokens are missing", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await postTestSession({});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "missing_tokens" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("sets a test session outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.setSession.mockResolvedValueOnce({ error: null });
    mocks.createClient.mockResolvedValueOnce({
      auth: { setSession: mocks.setSession },
    });

    const response = await postTestSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
  });

  it("returns 401 when Supabase rejects the session", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.setSession.mockResolvedValueOnce({ error: new Error("invalid") });
    mocks.createClient.mockResolvedValueOnce({
      auth: { setSession: mocks.setSession },
    });

    const response = await postTestSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_session" });
  });
});
