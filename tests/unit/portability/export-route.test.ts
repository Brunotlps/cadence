import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exportUserData: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/portability/export", () => ({
  exportUserData: mocks.exportUserData,
}));

import { GET } from "@/app/(protected)/(workspace)/account/export/route";

const sessionUserId = "11111111-1111-4111-8111-111111111111";

const exportData = {
  profile: {
    id: sessionUserId,
    display_name: "Pessoa solicitante",
    accent_color: "verde",
    created_at: "2026-08-01T12:00:00.000Z",
  },
  workspaces: [],
  workspace_members: [],
  transactions: [],
  goals: [],
  fixed_bills: [],
};

describe("GET /account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
    } as unknown as SupabaseClient);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: sessionUserId } },
      error: null,
    });
    mocks.exportUserData.mockResolvedValue({ data: exportData, error: null });
  });

  it("retorna 401 sem sessão sem iniciar a exportação", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthenticated" });
    expect(mocks.exportUserData).not.toHaveBeenCalled();
  });

  it("deriva o alvo exclusivamente da sessão e entrega o JSON como download", async () => {
    const response = await GET(
      new Request(
        "http://localhost/account/export?userId=foreign-user-id&target=attacker-user-id",
      ),
    );

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.exportUserData).toHaveBeenCalledWith(
      expect.anything(),
      sessionUserId,
    );
    expect(mocks.exportUserData).not.toHaveBeenCalledWith(
      expect.anything(),
      "foreign-user-id",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="cadence-data-export.json"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual(exportData);
  });

  it("mantém a falha de exportação genérica", async () => {
    mocks.exportUserData.mockResolvedValue({ data: null, error: "query_failed" });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "export_unavailable" });
  });

  it("não introduz cliente administrativo no fluxo de exportação", () => {
    const files = [
      "app/(protected)/(workspace)/account/export/route.ts",
      "lib/portability/export.ts",
    ];
    const source = files
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toContain("@/lib/supabase/admin");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("service_role");
  });
});
