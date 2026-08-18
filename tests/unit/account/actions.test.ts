import type { SupabaseClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteAccount: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  deleteAccount: mocks.deleteAccount,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  deleteOwnAccountAction,
  type DeleteOwnAccountActionState,
} from "@/lib/actions/account";
import AccountPage from "@/app/(protected)/(workspace)/account/page";

const initialState: DeleteOwnAccountActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function deleteAccountForm(confirmation = "EXCLUIR") {
  const formData = new FormData();
  formData.set("confirmation", confirmation);
  return formData;
}

describe("deleteOwnAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = {
      auth: { getUser: mocks.getUser },
    } as unknown as SupabaseClient;

    mocks.createClient.mockResolvedValue(client);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id" } },
      error: null,
    });
    mocks.deleteAccount.mockResolvedValue(undefined);
  });

  it("deriva o usuário da sessão e ignora target/userId do formulário", async () => {
    const formData = deleteAccountForm();
    formData.set("target", "foreign-user-id");
    formData.set("userId", "attacker-user-id");

    await expect(
      deleteOwnAccountAction(initialState, formData),
    ).rejects.toThrow("redirect:/login");

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.deleteAccount).toHaveBeenCalledWith("server-user-id");
    expect(mocks.deleteAccount).not.toHaveBeenCalledWith("foreign-user-id");
    expect(mocks.deleteAccount).not.toHaveBeenCalledWith("attacker-user-id");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("exige confirmação destrutiva antes de consultar a sessão", async () => {
    const result = await deleteOwnAccountAction(
      initialState,
      deleteAccountForm("excluir"),
    );

    expect(result).toEqual({
      error: "Revise os campos destacados.",
      fieldErrors: {
        confirmation: "Digite EXCLUIR para confirmar.",
      },
      success: false,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sem sessão não chama deleteAccount", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await deleteOwnAccountAction(
      initialState,
      deleteAccountForm(),
    );

    expect(result).toEqual({
      error: "Não foi possível excluir sua conta.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("não vaza erro bruto da rotina admin", async () => {
    mocks.deleteAccount.mockRejectedValue(
      new Error("service_role failed for user@example.com"),
    );

    const result = await deleteOwnAccountAction(
      initialState,
      deleteAccountForm(),
    );

    expect(result).toEqual({
      error: "Não foi possível excluir sua conta.",
      fieldErrors: {},
      success: false,
    });
    expect(JSON.stringify(result)).not.toContain("service_role");
    expect(JSON.stringify(result)).not.toContain("user@example.com");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("GET /account", () => {
  it("renderiza confirmação sem inputs de alvo ou usuário", () => {
    const html = renderToStaticMarkup(createElement(AccountPage));

    expect(html).toContain("Excluir minha conta");
    expect(html).toContain('name="confirmation"');
    expect(html).not.toContain('name="target"');
    expect(html).not.toContain('name="userId"');
    expect(html).not.toContain('type="hidden"');
  });
});
