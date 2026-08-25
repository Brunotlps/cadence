import { config } from "dotenv";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthenticatedTestClient,
  createConfirmedTestUser,
  createDirectComplianceClient,
  deleteTestAccount,
  hasDirectDatabaseTestEnv,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

const hasHostedComplianceEnv =
  hasSupabaseTestEnv() && hasDirectDatabaseTestEnv();

describe.skipIf(!hasHostedComplianceEnv)("Limite de submissões de feedback", () => {
  const createdUserIds = new Set<string>();

  afterEach(async () => {
    for (const userId of createdUserIds) await deleteTestAccount(userId);
    createdUserIds.clear();
  }, 20000);

  async function authenticatedUser(prefix: string) {
    const user = await createConfirmedTestUser(prefix);
    createdUserIds.add(user.id);
    const client = await createAuthenticatedTestClient(user);
    return { user, client };
  }

  it("denies normal direct access and derives the limiter identity from auth.uid()", async () => {
    const { user, client } = await authenticatedUser("feedback-limit-identity");

    const { data: directRows, error: directError } = await client
      .from("feedback_submission_limits")
      .select("*");
    expect(directRows).toBeNull();
    expect(directError?.code).toBe("42501");

    const { data: allowed, error: consumeError } = await client.rpc(
      "consume_feedback_submission_limit",
    );
    expect(consumeError).toBeNull();
    expect(allowed).toBe(true);

    const sql = createDirectComplianceClient();
    try {
      const rows = await sql<{ user_id: string; submission_count: number }[]>`
        select user_id, submission_count
        from public.feedback_submission_limits
        where user_id = ${user.id}
      `;
      expect(rows).toEqual([{ user_id: user.id, submission_count: 1 }]);
    } finally {
      await sql.end();
    }
  }, 20_000);

  it("allows at most three concurrent valid attempts in one anchored window", async () => {
    const { user, client } = await authenticatedUser("feedback-limit-concurrent");

    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        client.rpc("consume_feedback_submission_limit"),
      ),
    );
    expect(attempts.filter((attempt) => attempt.data === true && !attempt.error)).toHaveLength(3);
    expect(attempts.filter((attempt) => attempt.data === false && !attempt.error)).toHaveLength(1);

    const sql = createDirectComplianceClient();
    try {
      const rows = await sql<{ submission_count: number }[]>`
        select submission_count
        from public.feedback_submission_limits
        where user_id = ${user.id}
      `;
      expect(rows).toEqual([{ submission_count: 3 }]);
    } finally {
      await sql.end();
    }
  }, 20_000);

  it("resets an expired anchored window on the next valid attempt", async () => {
    const { user, client } = await authenticatedUser("feedback-limit-window");
    const sql = createDirectComplianceClient();
    try {
      await sql`
        insert into public.feedback_submission_limits (
          user_id, window_started_at, submission_count, expires_at
        ) values (
          ${user.id}, now() - interval '25 hours', 3, now() - interval '1 hour'
        )
      `;

      const { data, error } = await client.rpc("consume_feedback_submission_limit");
      expect(error).toBeNull();
      expect(data).toBe(true);

      const rows = await sql<{
        submission_count: number;
        window_seconds: number;
      }[]>`
        select
          submission_count,
          extract(epoch from (expires_at - window_started_at))::int as window_seconds
        from public.feedback_submission_limits
        where user_id = ${user.id}
      `;
      expect(rows).toEqual([{ submission_count: 1, window_seconds: 86400 }]);
    } finally {
      await sql.end();
    }
  }, 20_000);

  it("hard-deletes expired rows through the scheduler-only cleanup function", async () => {
    const { user, client } = await authenticatedUser("feedback-limit-cleanup");
    const sql = createDirectComplianceClient();
    try {
      await sql`
        insert into public.feedback_submission_limits (
          user_id, window_started_at, submission_count, expires_at
        ) values (
          ${user.id}, now() - interval '25 hours', 1, now() - interval '1 hour'
        )
      `;

      const { error: rpcError } = await client.rpc(
        "cleanup_expired_feedback_submission_limits",
      );
      expect(rpcError?.code).toBe("42501");

      await sql`select public.cleanup_expired_feedback_submission_limits()`;
      const rows = await sql<{ user_id: string }[]>`
        select user_id from public.feedback_submission_limits where user_id = ${user.id}
      `;
      expect(rows).toEqual([]);
    } finally {
      await sql.end();
    }
  }, 20_000);

  it("hard-deletes the limiter row during account deletion", async () => {
    const { user } = await authenticatedUser("feedback-limit-account-deletion");
    const sql = createDirectComplianceClient();
    try {
      await sql`
        insert into public.feedback_submission_limits (
          user_id, window_started_at, submission_count, expires_at
        ) values (${user.id}, now(), 1, now() + interval '24 hours')
      `;
    } finally {
      await sql.end();
    }

    await deleteTestAccount(user.id);
    createdUserIds.delete(user.id);

    const verificationSql = createDirectComplianceClient();
    try {
      const rows = await verificationSql<{ user_id: string }[]>`
        select user_id from public.feedback_submission_limits where user_id = ${user.id}
      `;
      expect(rows).toEqual([]);
    } finally {
      await verificationSql.end();
    }
  }, 20_000);
});
