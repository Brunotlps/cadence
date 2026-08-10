import { config } from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

describe.skipIf(!hasSupabaseTestEnv())("Preferência pessoal de destaque", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string | null;
  let userBId: string | null;

  beforeAll(async () => {
    const userA = await createConfirmedTestUser("accent-a");
    const userB = await createConfirmedTestUser("accent-b");
    userAId = userA.id;
    userBId = userB.id;

    clientA = createAnonTestClient();
    clientB = createAnonTestClient();

    const { error: signInAError } = await clientA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    if (signInAError) throw signInAError;

    const { error: signInBError } = await clientB.auth.signInWithPassword({
      email: userB.email,
      password: userB.password,
    });
    if (signInBError) throw signInBError;
  }, 20000);

  afterAll(async () => {
    if (userAId) await deleteTestAccount(userAId);
    if (userBId) await deleteTestAccount(userBId);
  }, 20000);

  it("cria perfil novo com verde como default", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("id, accent_color")
      .eq("id", userAId!)
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({ id: userAId, accent_color: "verde" });
  });

  it("permite preferências independentes por pessoa", async () => {
    const { error: updateAError } = await clientA
      .from("profiles")
      .update({ accent_color: "rosa" })
      .eq("id", userAId!);
    expect(updateAError).toBeNull();

    const { error: updateBError } = await clientB
      .from("profiles")
      .update({ accent_color: "preto" })
      .eq("id", userBId!);
    expect(updateBError).toBeNull();

    const [{ data: profileA }, { data: profileB }] = await Promise.all([
      clientA.from("profiles").select("accent_color").eq("id", userAId!).single(),
      clientB.from("profiles").select("accent_color").eq("id", userBId!).single(),
    ]);

    expect(profileA?.accent_color).toBe("rosa");
    expect(profileB?.accent_color).toBe("preto");
  });

  it("não permite ler nem atualizar a preferência de outra pessoa", async () => {
    const { data: crossRead, error: crossReadError } = await clientB
      .from("profiles")
      .select("accent_color")
      .eq("id", userAId!);

    expect(crossReadError).toBeNull();
    expect(crossRead).toEqual([]);

    const { data: crossUpdate, error: crossUpdateError } = await clientB
      .from("profiles")
      .update({ accent_color: "verde" })
      .eq("id", userAId!)
      .select("accent_color");

    expect(crossUpdateError).toBeNull();
    expect(crossUpdate).toEqual([]);

    const { data: ownProfile, error: ownError } = await clientA
      .from("profiles")
      .select("accent_color")
      .eq("id", userAId!)
      .single();

    expect(ownError).toBeNull();
    expect(ownProfile?.accent_color).toBe("rosa");
  });

  it("rejeita código fora das três opções fixas", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ accent_color: "azul" })
      .eq("id", userAId!);

    expect(error).not.toBeNull();

    const { data } = await clientA
      .from("profiles")
      .select("accent_color")
      .eq("id", userAId!)
      .single();
    expect(data?.accent_color).toBe("rosa");
  });

  it("apagar a conta remove o perfil e sua preferência", async () => {
    const admin = createTestAdminClient();
    const deletedUserId = userAId!;

    await deleteTestAccount(deletedUserId);
    userAId = null;

    const { data, error } = await admin
      .from("profiles")
      .select("id, accent_color")
      .eq("id", deletedUserId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
