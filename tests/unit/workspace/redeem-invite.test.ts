import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redeemWorkspaceInvite } from "@/lib/workspace/redeem-invite";

function fakeClient(rpcImpl: (...args: unknown[]) => unknown) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient;
}

describe("redeemWorkspaceInvite", () => {
  it("chama a RPC redeem_workspace_invite com o token informado", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: "11111111-1111-1111-1111-111111111111",
      error: null,
    });
    const client = fakeClient(rpcMock);

    await redeemWorkspaceInvite(client, "22222222-2222-2222-2222-222222222222");

    expect(rpcMock).toHaveBeenCalledWith("redeem_workspace_invite", {
      invite_token: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("retorna o workspaceId quando o resgate é aceito", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: "11111111-1111-1111-1111-111111111111", error: null }),
    );

    const result = await redeemWorkspaceInvite(client, "22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({
      status: "ok",
      workspaceId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("identifica quando quem resgata já tem workspace", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: null, error: { message: "already_has_workspace" } }),
    );

    const result = await redeemWorkspaceInvite(client, "22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({ status: "already_has_workspace" });
  });

  it("identifica token inválido ou expirado", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: null, error: { message: "invalid_or_expired" } }),
    );

    const result = await redeemWorkspaceInvite(client, "22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({ status: "invalid_or_expired" });
  });

  it("retorna erro genérico para qualquer outra falha", async () => {
    const client = fakeClient(() =>
      Promise.resolve({ data: null, error: { message: "permission denied" } }),
    );

    const result = await redeemWorkspaceInvite(client, "22222222-2222-2222-2222-222222222222");

    expect(result).toEqual({ status: "error" });
  });
});
