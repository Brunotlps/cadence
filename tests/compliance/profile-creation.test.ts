import { config } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";
import {
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

// Etapa 16: login só Google, sem cadastro por e-mail/senha. O Google
// preenche raw_user_meta_data com full_name (padrão) ou name (fallback
// de alguns fluxos), nunca display_name — só o formulário de senha
// (removido) preenchia esse campo.
describe.skipIf(!hasSupabaseTestEnv())(
  "criação de profile a partir do login com Google",
  () => {
    let userId: string | null = null;

    afterEach(async () => {
      if (userId) {
        await deleteTestAccount(userId);
        userId = null;
      }
    });

    it("usa full_name como nome de exibição", async () => {
      const user = await createConfirmedTestUser("profile-full-name", {
        full_name: "Bruno Teixeira",
      });
      userId = user.id;

      const admin = createTestAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Bruno Teixeira");
    });

    it("usa name como alternativa quando full_name não vem", async () => {
      const user = await createConfirmedTestUser("profile-name-fallback", {
        name: "Alyne",
      });
      userId = user.id;

      const admin = createTestAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Alyne");
    });

    it("prefere full_name quando os dois vêm preenchidos", async () => {
      const user = await createConfirmedTestUser("profile-both", {
        full_name: "Bruno Teixeira",
        name: "Bruno",
      });
      userId = user.id;

      const admin = createTestAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(data?.display_name).toBe("Bruno Teixeira");
    });

    it("fica nulo quando nenhum dos dois vem preenchido", async () => {
      const user = await createConfirmedTestUser("profile-empty");
      userId = user.id;

      const admin = createTestAdminClient();
      const { data, error } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(data?.display_name).toBeNull();
    });
  },
);
