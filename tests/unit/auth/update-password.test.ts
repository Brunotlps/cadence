import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updatePassword } from "@/lib/auth/update-password";

describe("updatePassword", () => {
  it("chama supabase.auth.updateUser com a nova senha", async () => {
    const updateUserMock = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { auth: { updateUser: updateUserMock } } as unknown as SupabaseClient;

    const result = await updatePassword(client, "senha-nova-forte");

    expect(updateUserMock).toHaveBeenCalledWith({ password: "senha-nova-forte" });
    expect(result).toEqual({ error: null });
  });

  it("retorna erro genérico quando o Supabase rejeita a troca", async () => {
    const client = {
      auth: {
        updateUser: vi
          .fn()
          .mockResolvedValue({ data: {}, error: { message: "Weak password" } }),
      },
    } as unknown as SupabaseClient;

    const result = await updatePassword(client, "123");

    expect(result.error).toBeTruthy();
  });
});
