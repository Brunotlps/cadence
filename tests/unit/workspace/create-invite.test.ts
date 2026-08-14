import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkspaceInvite } from "@/lib/workspace/create-invite";

function fakeClient(rpcImpl: (...args: unknown[]) => unknown) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient;
}

describe("createWorkspaceInvite", () => {
  it("chama a RPC create_workspace_invite com o workspace informado", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ token: "22222222-2222-2222-2222-222222222222", expires_at: "2026-08-21T00:00:00.000Z" }],
      error: null,
    });
    const client = fakeClient(rpcMock);

    await createWorkspaceInvite(client, "11111111-1111-1111-1111-111111111111");

    expect(rpcMock).toHaveBeenCalledWith("create_workspace_invite", {
      target_workspace_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("retorna token e validade quando a criação é aceita", async () => {
    const client = fakeClient(() =>
      Promise.resolve({
        data: [{ token: "22222222-2222-2222-2222-222222222222", expires_at: "2026-08-21T00:00:00.000Z" }],
        error: null,
      }),
    );

    const result = await createWorkspaceInvite(client, "11111111-1111-1111-1111-111111111111");

    expect(result).toEqual({
      error: null,
      token: "22222222-2222-2222-2222-222222222222",
      expiresAt: "2026-08-21T00:00:00.000Z",
    });
  });

  it("retorna erro genérico quando o Supabase rejeita a criação", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: null, error: { message: "not_a_member" } }),
    );

    const result = await createWorkspaceInvite(client, "11111111-1111-1111-1111-111111111111");

    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("not_a_member");
  });
});
