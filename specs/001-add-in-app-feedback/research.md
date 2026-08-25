# Research: In-App Feedback

## Server Action

**Decision**: Use a Server Action and Cadence's existing action-state result pattern.

**Rationale**: It derives the Supabase session and optional email server-side and
avoids a parallel public feedback endpoint.

**Alternatives considered**: A Route Handler adds a public request contract without
improving this form-only flow.

## Protected-area coverage

**Decision**: Mount the launcher in `app/(protected)/layout.tsx`.

**Rationale**: Route inspection shows the workspace shell excludes
`/onboarding/workspace` and `/join/[token]`; all protected route families share the
parent layout. Common-layout placement satisfies FR-001.

**Alternatives considered**: Workspace-shell placement is convenient but incomplete.

## Abuse control and cleanup

**Decision**: Use an atomic Supabase limiter with an anchored 24-hour window and
hourly `pg_cron` hard deletion.

**Rationale**: The first valid attempt starts a window of three valid attempts; slots
are acquired after validation and are never returned after downstream failure. Lazy
expiration would delete an expired row only when that user submits again, allowing
physical retention to become indefinite. Supabase Cron schedules SQL directly on the
existing database platform. [Supabase Cron](https://supabase.com/docs/guides/cron)

**Alternatives considered**: An external TTL service adds a processor, secret, and
privacy review; memory-only state fails across instances/restarts; lazy deletion fails
the lifecycle bound.

## Resend delivery and idempotency

**Decision**: Use Resend REST API with a random UUID `Idempotency-Key` per feedback
attempt; preserve the key only for ambiguous transport retries.

**Rationale**: Resend documents accepted-send IDs and 24-hour idempotency keys. The
random key has no PII or financial content. Reusing it after a lost acknowledgement
prevents a duplicate administrative email only while the canonical provider payload
is unchanged. The dialog holds an in-memory payload snapshot; any payload change gets
a new random key. Each retry still obtains and consumes a new abuse-control slot; no
key is persisted and no consumed slot is restored. A provider idempotency conflict is
an opaque generic delivery failure. [Send Email](https://resend.com/docs/api-reference/emails/send-email)

**Alternatives considered**: No key allows duplicate mail after timeout; deriving a
key from user or feedback content violates minimization; persistent feedback keys
would create unnecessary history.

## Provider lifecycle and tracking

**Decision**: Select Resend subject to release review; disable open/click tracking
for the sending domain and send plaintext only.

**Rationale**: Resend provides server-side acceptance semantics and a small-MVP tier.
Its product retention is not the full lifecycle. Human review must cover product and
dashboard retention, DPA, subprocessors, usage/account data, deletion after account
termination, international processing/transfers, and the administrative inbox.

**Alternatives considered**: Postmark still retains message content/activity; SES
adds AWS IAM and operational setup. Neither removes lifecycle review.

## Cron job history

**Decision**: Treat `cron.job_run_details` inspection/pruning as non-blocking
operational maintenance.

**Rationale**: The limiter cleanup job has static SQL and stores no user content in
its run history, but `pg_cron` does not automatically delete its own execution history.

**Alternatives considered**: Ignoring job history risks unnecessary database growth.
