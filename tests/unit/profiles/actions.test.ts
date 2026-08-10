import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateProfileAccentColor: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/profiles/repository", () => ({
  updateProfileAccentColor: mocks.updateProfileAccentColor,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  updateAccentColorAction,
  type AccentColorActionState,
} from "@/lib/actions/profile";

const initialState: AccentColorActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function accentColorForm(value: string) {
  const formData = new FormData();
  formData.set("accentColor", value);
  return formData;
}

describe("Server Action da preferência de perfil", () => {
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
    mocks.updateProfileAccentColor.mockResolvedValue({
      data: "rosa",
      error: null,
    });
  });

  it("deriva o id da sessão, ignora id do formulário e revalida o layout", async () => {
    const formData = accentColorForm("rosa");
    formData.set("profileId", "foreign-user-id");

    const result = await updateAccentColorAction(initialState, formData);

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.updateProfileAccentColor).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: "server-user-id",
        accentColor: "rosa",
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result).toEqual({ error: null, fieldErrors: {}, success: true });
  });

  it("rejeita código fora do domínio antes de atualizar", async () => {
    const result = await updateAccentColorAction(
      initialState,
      accentColorForm("azul"),
    );

    expect(result).toEqual({
      error: "Revise os campos destacados.",
      fieldErrors: {
        accentColor: "Selecione uma cor de destaque válida.",
      },
      success: false,
    });
    expect(mocks.updateProfileAccentColor).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("torna perfil ausente, invisível ou rejeitado indistinguível", async () => {
    mocks.updateProfileAccentColor
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await updateAccentColorAction(
      initialState,
      accentColorForm("preto"),
    );
    const invisible = await updateAccentColorAction(
      initialState,
      accentColorForm("preto"),
    );

    expect(missing).toEqual(invisible);
    expect(missing).toEqual({
      error: "Não foi possível salvar a cor de destaque.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falha genericamente quando a sessão não é válida", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired JWT for user@example.com" },
    });

    const result = await updateAccentColorAction(
      initialState,
      accentColorForm("verde"),
    );

    expect(result.error).toBe("Não foi possível salvar a cor de destaque.");
    expect(JSON.stringify(result)).not.toContain("user@example.com");
    expect(JSON.stringify(result)).not.toContain("expired JWT");
    expect(mocks.updateProfileAccentColor).not.toHaveBeenCalled();
  });
});
