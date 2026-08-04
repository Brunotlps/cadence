import { config } from "dotenv";
import { describe, it, expect, afterEach } from "vitest";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

// Cobre a restrição de EXECUTE em create_workspace_with_owner (etapa 05,
// subtarefa 2) — fecha a observação de hardening deixada pelo findings log
// da etapa 04: a função não deve ser chamável por anon/PUBLIC, só por
// usuários autenticados.
describe.skipIf(!hasSupabaseTestEnv())(
  "Grants de create_workspace_with_owner",
  () => {
    let createdUserId: string | undefined;

    afterEach(async () => {
      if (createdUserId) {
        await deleteTestAccount(createdUserId);
        createdUserId = undefined;
      }
    });

    it("anon NÃO consegue chamar create_workspace_with_owner", async () => {
      const anon = createAnonTestClient();

      const { data, error } = await anon.rpc("create_workspace_with_owner", {
        workspace_name: "tentativa anon",
      });

      expect(data).toBeNull();
      // 42501 = permission denied (EXECUTE revogado do anon). Sem a
      // restrição de grant, a chamada passaria da checagem de permissão e
      // falharia mais adiante por outro motivo (23502, user_id nulo) — o que
      // não prova que o grant está correto, só que auth.uid() é nulo pra
      // anon. É a distinção que este teste precisa fazer.
      expect(error?.code).toBe("42501");
    });

    it("usuário autenticado continua conseguindo criar seu workspace", async () => {
      const user = await createConfirmedTestUser("grants");
      createdUserId = user.id;

      const client = createAnonTestClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (signInError) throw signInError;

      const { data, error } = await client.rpc("create_workspace_with_owner", {
        workspace_name: "workspace do usuário autenticado",
      });

      expect(error).toBeNull();
      expect(typeof data).toBe("string");
    });
  },
);
