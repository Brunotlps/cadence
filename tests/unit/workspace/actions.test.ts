import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  createWorkspaceInvite: vi.fn(),
  redeemWorkspaceInvite: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/workspace/create-invite", () => ({
  createWorkspaceInvite: mocks.createWorkspaceInvite,
}));

vi.mock("@/lib/workspace/redeem-invite", () => ({
  redeemWorkspaceInvite: mocks.redeemWorkspaceInvite,
}));

import {
  createWorkspaceInviteAction,
  redeemWorkspaceInviteAction,
} from "@/lib/actions/workspace";

const FAKE_USER = { id: "user-1" };

describe("createWorkspaceInviteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER }, error: null }) },
    });
  });

  it("gera o convite para o workspace atual do usuário", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-1", name: "Casa" },
      error: null,
    });
    mocks.createWorkspaceInvite.mockResolvedValue({
      error: null,
      token: "token-1",
      expiresAt: "2026-08-21T00:00:00.000Z",
    });

    const result = await createWorkspaceInviteAction(
      { error: null, token: null, expiresAt: null },
      new FormData(),
    );

    expect(mocks.createWorkspaceInvite).toHaveBeenCalledWith(
      expect.anything(),
      "workspace-1",
    );
    expect(result).toEqual({
      error: null,
      token: "token-1",
      expiresAt: "2026-08-21T00:00:00.000Z",
    });
  });

  it("retorna erro quando o usuário ainda não tem workspace", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({ data: null, error: null });

    const result = await createWorkspaceInviteAction(
      { error: null, token: null, expiresAt: null },
      new FormData(),
    );

    expect(result.error).toBeTruthy();
    expect(mocks.createWorkspaceInvite).not.toHaveBeenCalled();
  });

  it("propaga o erro devolvido por createWorkspaceInvite", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-1", name: "Casa" },
      error: null,
    });
    mocks.createWorkspaceInvite.mockResolvedValue({
      error: "Não foi possível gerar o convite. Tente novamente.",
    });

    const result = await createWorkspaceInviteAction(
      { error: null, token: null, expiresAt: null },
      new FormData(),
    );

    expect(result.error).toBeTruthy();
    expect(result.token).toBeNull();
  });
});

describe("redeemWorkspaceInviteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER }, error: null }) },
    });
  });

  it("resgata o convite e devolve status ok", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({
      status: "ok",
      workspaceId: "workspace-1",
    });

    const result = await redeemWorkspaceInviteAction("token-1");

    expect(mocks.redeemWorkspaceInvite).toHaveBeenCalledWith(
      expect.anything(),
      "token-1",
    );
    expect(result).toEqual({ status: "ok" });
  });

  it("propaga already_has_workspace", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({ status: "already_has_workspace" });

    const result = await redeemWorkspaceInviteAction("token-1");

    expect(result).toEqual({ status: "already_has_workspace" });
  });

  it("propaga invalid_or_expired", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({ status: "invalid_or_expired" });

    const result = await redeemWorkspaceInviteAction("token-1");

    expect(result).toEqual({ status: "invalid_or_expired" });
  });

  it("retorna erro quando não há sessão", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const result = await redeemWorkspaceInviteAction("token-1");

    expect(result).toEqual({ status: "error" });
    expect(mocks.redeemWorkspaceInvite).not.toHaveBeenCalled();
  });
});
