import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  createWorkspaceInvite: vi.fn(),
  redeemWorkspaceInvite: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
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

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createWorkspaceInviteAction,
  redeemWorkspaceInviteAction,
  type RedeemWorkspaceInviteActionResult,
} from "@/lib/actions/workspace";

const FAKE_USER = { id: "user-1" };
const INVITE_TOKEN = "22222222-2222-2222-2222-222222222222";
const initialRedeemState: RedeemWorkspaceInviteActionResult = { status: "idle" };

function inviteForm(token: string) {
  const formData = new FormData();
  formData.set("token", token);
  return formData;
}

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

  it("resgata o convite via FormData e redireciona no sucesso", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({
      status: "ok",
      workspaceId: "workspace-1",
    });

    await expect(
      redeemWorkspaceInviteAction(initialRedeemState, inviteForm(INVITE_TOKEN)),
    ).rejects.toThrow("redirect:/dashboard");

    expect(mocks.redeemWorkspaceInvite).toHaveBeenCalledWith(
      expect.anything(),
      INVITE_TOKEN,
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("propaga already_has_workspace", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({ status: "already_has_workspace" });

    const result = await redeemWorkspaceInviteAction(
      initialRedeemState,
      inviteForm(INVITE_TOKEN),
    );

    expect(result).toEqual({ status: "already_has_workspace" });
  });

  it("propaga invalid_or_expired", async () => {
    mocks.redeemWorkspaceInvite.mockResolvedValue({ status: "invalid_or_expired" });

    const result = await redeemWorkspaceInviteAction(
      initialRedeemState,
      inviteForm(INVITE_TOKEN),
    );

    expect(result).toEqual({ status: "invalid_or_expired" });
  });

  it("trata segundo submit conforme o repositório, sem inventar novo sucesso", async () => {
    mocks.redeemWorkspaceInvite
      .mockResolvedValueOnce({ status: "ok", workspaceId: "workspace-1" })
      .mockResolvedValueOnce({ status: "already_has_workspace" });

    await expect(
      redeemWorkspaceInviteAction(initialRedeemState, inviteForm(INVITE_TOKEN)),
    ).rejects.toThrow("redirect:/dashboard");

    const secondResult = await redeemWorkspaceInviteAction(
      initialRedeemState,
      inviteForm(INVITE_TOKEN),
    );

    expect(secondResult).toEqual({ status: "already_has_workspace" });
    expect(mocks.redeemWorkspaceInvite).toHaveBeenCalledTimes(2);
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });

  it("recusa submit sem token ou com token malformado antes de chamar o repositório", async () => {
    const missingTokenResult = await redeemWorkspaceInviteAction(
      initialRedeemState,
      new FormData(),
    );
    const malformedTokenResult = await redeemWorkspaceInviteAction(
      initialRedeemState,
      inviteForm("token-1"),
    );

    expect(missingTokenResult).toEqual({ status: "invalid_or_expired" });
    expect(malformedTokenResult).toEqual({ status: "invalid_or_expired" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.redeemWorkspaceInvite).not.toHaveBeenCalled();
  });

  it("retorna erro quando não há sessão", async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const result = await redeemWorkspaceInviteAction(
      initialRedeemState,
      inviteForm(INVITE_TOKEN),
    );

    expect(result).toEqual({ status: "error" });
    expect(mocks.redeemWorkspaceInvite).not.toHaveBeenCalled();
  });
});
