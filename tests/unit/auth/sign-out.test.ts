import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signOut } from "@/lib/auth/sign-out";

describe("signOut", () => {
  it("chama supabase.auth.signOut", async () => {
    const signOutMock = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signOut: signOutMock } } as unknown as SupabaseClient;

    await signOut(client);

    expect(signOutMock).toHaveBeenCalled();
  });
});
