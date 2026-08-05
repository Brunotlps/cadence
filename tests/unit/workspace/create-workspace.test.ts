import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkspace } from "@/lib/workspace/create-workspace";

function fakeClient(rpcImpl: (...args: unknown[]) => unknown) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient;
}

describe("createWorkspace", () => {
  it("chama a RPC create_workspace_with_owner com o nome informado", async () => {
    const rpcMock = vi
      .fn()
      .mockResolvedValue({ data: "11111111-1111-1111-1111-111111111111", error: null });
    const client = fakeClient(rpcMock);

    await createWorkspace(client, "Bruno & Alyne");

    expect(rpcMock).toHaveBeenCalledWith("create_workspace_with_owner", {
      workspace_name: "Bruno & Alyne",
    });
  });

  it("retorna o id do workspace quando a criação é aceita", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: "11111111-1111-1111-1111-111111111111", error: null }),
    );

    const result = await createWorkspace(client, "Bruno & Alyne");

    expect(result).toEqual({
      error: null,
      workspaceId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("retorna erro genérico quando o Supabase rejeita a criação", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: null, error: { message: "permission denied" } }),
    );

    const result = await createWorkspace(client, "");

    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("permission denied");
  });
});
