import { config } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

// Localmente, roda só quando as credenciais Supabase estão disponíveis. No CI,
// credenciais ausentes falham antes do skip para não mascarar cobertura crítica.
describe.skipIf(!hasSupabaseTestEnv())(
  "Visibilidade de profiles entre membros do mesmo workspace (RLS)",
  () => {
    let clientA: SupabaseClient; // dono do workspace A
    let clientB: SupabaseClient; // membro convidado do workspace A
    let clientC: SupabaseClient; // membro de um workspace separado
    let userAId: string;
    let userBId: string;
    let userCId: string;

    beforeAll(async () => {
      const userA = await createConfirmedTestUser("profile-vis-a", {
        full_name: "Ana Teste",
      });
      const userB = await createConfirmedTestUser("profile-vis-b", {
        full_name: "Bruno Teste",
      });
      const userC = await createConfirmedTestUser("profile-vis-c", {
        full_name: "Carla Teste",
      });
      userAId = userA.id;
      userBId = userB.id;
      userCId = userC.id;

      clientA = createAnonTestClient();
      clientB = createAnonTestClient();
      clientC = createAnonTestClient();

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

      const { error: signInCError } = await clientC.auth.signInWithPassword({
        email: userC.email,
        password: userC.password,
      });
      if (signInCError) throw signInCError;

      // Workspace A: dono = usuário A.
      const { data: workspaceAId, error: workspaceAError } = await clientA.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Profile visibility test workspace A" },
      );
      if (workspaceAError) throw workspaceAError;

      // Usuário B entra no workspace A via convite (mesmo fluxo da etapa 17).
      const { data: inviteRows, error: inviteError } = await clientA.rpc(
        "create_workspace_invite",
        { target_workspace_id: workspaceAId as string },
      );
      if (inviteError) throw inviteError;
      const invite = (inviteRows as Array<{ token: string }>)[0];
      if (!invite) throw new Error("create_workspace_invite returned no row");

      const { error: redeemError } = await clientB.rpc(
        "redeem_workspace_invite",
        { invite_token: invite.token },
      );
      if (redeemError) throw redeemError;

      // Workspace C: dono = usuário C, sem relação com A/B.
      const { error: workspaceCError } = await clientC.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Profile visibility test workspace C" },
      );
      if (workspaceCError) throw workspaceCError;
    }, 20000);

    afterAll(async () => {
      await deleteTestAccount(userAId);
      await deleteTestAccount(userBId);
      await deleteTestAccount(userCId);
    }, 20000);

    it("membro A lê o profile de membro B do mesmo workspace", async () => {
      const { data, error } = await clientA
        .from("profiles")
        .select("id, display_name, accent_color")
        .eq("id", userBId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Bruno Teste");
    });

    it("membro B lê o profile de membro A do mesmo workspace", async () => {
      const { data, error } = await clientB
        .from("profiles")
        .select("id, display_name, accent_color")
        .eq("id", userAId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Ana Teste");
    });

    it("usuário C, de outro workspace, NÃO lê o profile de A", async () => {
      const { data, error } = await clientC
        .from("profiles")
        .select("id, display_name, accent_color")
        .eq("id", userAId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeNull(); // RLS filtra: nada retorna
    });

    it("usuário C, de outro workspace, NÃO lê o profile de B", async () => {
      const { data, error } = await clientC
        .from("profiles")
        .select("id, display_name, accent_color")
        .eq("id", userBId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("cada usuário continua lendo o próprio profile (profiles_select_own intacta)", async () => {
      const { data, error } = await clientA
        .from("profiles")
        .select("id, display_name, accent_color")
        .eq("id", userAId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Ana Teste");
    });
  },
);
