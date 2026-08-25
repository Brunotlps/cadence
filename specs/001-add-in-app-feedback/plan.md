# Implementation Plan: In-App Feedback

**Branch**: `feat/in-app-feedback` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

## Summary

Add one authenticated feedback dialog, mounted by the common protected layout so it
is available in every protected route. Submit via a Server Action, use a bounded
per-user database limiter, and send accepted reports through Resend's server-side
email API. Cadence does not persist feedback content.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 16 App Router

**Primary Dependencies**: Next Server Actions, `@supabase/ssr`, Supabase/Postgres,
Drizzle, native `fetch`; no Resend SDK

**Storage**: Existing Supabase/Postgres for a short-lived limiter only; Resend and a
trusted administrative inbox receive delivered feedback

**Testing**: Vitest unit tests, hosted Supabase compliance tests, Playwright E2E

**Target Platform**: Vercel-hosted web application; Supabase-hosted PostgreSQL

**Project Type**: Server-first web application

**Constraints**: Authenticated users only; message limit 5,000 characters; no
feedback content in Cadence logs; no external provider call in automated tests;
feedback payload is minimized and plaintext only.

**Scale/Scope**: MVP administrative feedback for normal authenticated use; three
valid attempts per user in an anchored 24-hour window.

## Constitution Check

### I. Database-Enforced Tenant Isolation — affected

The limiter is personal security metadata, not workspace data and contains no
feedback or financial content. It has RLS enabled, no direct authenticated-table
permissions, and an atomic function deriving `auth.uid()`. Hosted compliance tests
must prove direct access is denied, the function cannot consume another user's slot,
and concurrent calls cannot exceed three slots. Update the data-model/deletion
contract to document this narrow non-workspace exception.

### II. Authenticated and Least-Privilege Data Access — affected

The Server Action derives the user and optional email from the authenticated Supabase
session. The database function derives the limiter identity internally. Resend and
cron credentials remain server/database-only; no service-role credential reaches the
client. Focused unit and compliance evidence is required for all authorization and
grant boundaries.

### III. Privacy by Default and Data Minimization — affected

Only type, trimmed message, optional normalized pathname, and explicitly opted-in
reply-to email leave Cadence. The limiter retains only opaque authenticated user ID,
anchored window start, count, and expiry. No tracking, telemetry, tags, logs,
financial data, or client email are used. Durable policy and LGPD mapping updates,
plus human privacy/security review, are release gates.

### IV. Real and Explicit Data Lifecycle Guarantees — affected

Cadence never stores feedback content. Limiter rows are hard-deleted hourly after
expiry and when the account is deleted. Resend and the administrative inbox are
third-party processing boundaries whose full retention/deletion lifecycle requires
documented human review before release.

### V. Regression Proof for Critical Invariants — affected

Unit tests cover pure validation, payload construction, action state, and provider
mapping. Hosted compliance tests prove RLS, atomic limiting, expiry deletion, and
account deletion. Playwright proves protected-route reachability and accessible UI.

**Gate status**: Passes only when the migration, tests, documentation, and human
review gates in this plan are complete. No constitutional exception is introduced.

## Design Decisions

### Protected-area placement

Mount the feedback launcher once in `app/(protected)/layout.tsx`, not only in
`app/(protected)/(workspace)/layout.tsx`. The common layout wraps all protected
pages: workspace routes (`/account`, `/dashboard`, `/goals`, `/fixed-bills`, their
edit routes, and `/workspace/invite`), `/onboarding/workspace`, and `/join/[token]`.
The workspace shell alone excludes onboarding and join, so it would violate FR-001.

The launcher is a fixed protected-layout utility: desktop bottom-right and mobile
above the workspace bottom navigation/safe area. It reuses the existing native-dialog,
form-control, focus, status, error, and responsive CSS conventions. This deliberate
placement deviation is necessary to satisfy complete protected-route coverage.

### Submission boundary and validation

Use one Server Action with the existing `{ error, fieldErrors, success }` action-state
pattern. It derives the session identity before delivery and never trusts a submitted
email. A pure validator trims and validates the closed feedback type set, required
message, 5,000-character maximum, opt-in value, opaque submission key, and an allowed
protected pathname. Dynamic paths are reduced to route templates; URLs, query strings,
fragments, identifiers, and arbitrary paths are dropped rather than delivered.

### Abuse-control semantics and cleanup

Create one `feedback_submission_limits` row per user with `user_id`,
`window_started_at`, `submission_count`, and `expires_at`. This is an **anchored
24-hour window**: the first valid attempt creates the window, then up to two further
valid attempts are allowed before its expiry.

- Invalid or validation-failed requests do not consume a slot.
- After validation succeeds and the atomic database function acquires a slot, that
  slot remains consumed even if delivery fails or is ambiguous; no compensating
  decrement exists.
- The row never includes feedback text, email, pathname, workspace ID, IP, or
  financial data.

Lazy expiration was considered: the submission function could delete only its own
expired row on a later request. It is rejected because an inactive user would leave
their identifier physically retained indefinitely, violating the explicit lifecycle
requirement. Use Supabase `pg_cron` instead: an hourly database job hard-deletes every
expired limiter row, keeping physical retention below 25 hours. The migration must
enable/configure `pg_cron`, install an idempotently named cleanup job, and restrict
the cleanup function to the database scheduler/service boundary. Operations must
verify the job after deployment and monitor failed runs in Supabase Cron; job SQL and
run diagnostics contain no user identifiers or feedback content. The deployment
runbook must include repair/re-enable instructions after a database upgrade, because
cron jobs require operational monitoring. `pg_cron` does not automatically prune
`cron.job_run_details`; include periodic inspection and pruning of that job history
as a non-blocking operational maintenance item.

### Resend delivery and idempotency

Use Resend's REST API through a small server-only delivery module and native `fetch`.
The only success result is a successful API acceptance response containing its email
ID; inbox delivery and human acknowledgement are not awaited.

Each newly opened feedback dialog creates an opaque random UUID submission key. It is
not derived from the user, email, pathname, message, financial data, or any other PII.
The Server Action validates it as a UUID and passes it to Resend as `Idempotency-Key`.
Resend documents this header as duplicate prevention with a 24-hour lifetime. If a
transport timeout/network failure makes provider acceptance ambiguous, the retained
form retries with the same key; this prevents a second administrative email when the
first request was accepted but its acknowledgement was lost. The dialog retains a
transient canonical payload snapshot and may reuse that key only while the normalized
provider payload is unchanged. Changing type, trimmed message, normalized pathname,
follow-up choice, or another provider-request value generates a new random key before
resubmission. A definitive provider rejection also generates a new key for a later
edited resubmission. No idempotency key is persisted in Cadence.

Every action invocation that validates and acquires an abuse-control slot consumes
one valid attempt, including a same-key retry after an ambiguous delivery failure.
The action therefore acquires a new slot before each provider call and never decrements
one. If Resend reports an idempotency conflict, map it to the generic safe failure
state without provider details. The idempotency key is delivery metadata only, never
logged or displayed, and is not a feedback identifier or user history.

The provider payload is exactly: configured sender, configured administrative
recipient, static subject with feedback type, plain-text body with type, optional
normalized pathname, and message; `reply_to` is the server-derived authenticated email
only when the per-report opt-in is true. It has no attachments, tags, tracking,
cookies, full URL, query, workspace/user identifier, financial data, page state, or
telemetry. Release verification must confirm that Resend open and click tracking are
disabled for the sending domain in addition to using plaintext-only content.

### Failure semantics

Validation failures return field errors and retain form content without consuming a
slot. Abuse-limit rejections return a generic, non-evasive message after validation
and before delivery. Definitive provider rejection, ambiguous transport failure, and
unexpected internal failure return the same generic delivery-failure message without
provider detail, form content, or opted-in email in diagnostics. Only provider
acceptance returns success.

## Project Structure

```text
app/(protected)/layout.tsx                 # common protected launcher mount
components/app-shell/                      # feedback dialog and responsive styling
lib/actions/feedback.ts                    # Server Action and action-state contract
lib/feedback/                              # validation, pathname policy, delivery client
db/schema.ts                               # limiter schema declaration
db/migrations/                             # RLS, atomic limiter, pg_cron, deletion update
tests/unit/                                # validator, action, delivery tests
tests/compliance/                          # RLS, atomicity, deletion tests
tests/e2e/                                 # protected UI/reachability tests
```

**Structure Decision**: Reuse the existing App Router, `lib/actions`, pure domain
validator, Supabase client, Drizzle migration, and test-taxonomy structure. No public
feedback API, external rate-limit provider, or parallel form abstraction is added.

## Release Configuration and Documentation

- Add server-only `RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL`, and
  `FEEDBACK_RECIPIENT_EMAIL` to `.env.example` with no values. Verify sender-domain
  DNS, recipient access restriction, and disabled Resend open/click tracking before
  release.
- Update `.cadence/policies/data-handling.md` with the exact external payload,
  limiter lifecycle, no-log rule, and third-party processing boundary.
- Update `docs/specs/data-model-and-deletion.md` with limiter RLS/functions,
  anchored-window rule, hourly hard deletion, and account-deletion cleanup.
- Update `docs/specs/data-portability.md` with the short-lived limiter's treatment
  and the human review needed for access/portability rights.
- Update `docs/compliance/lgpd-mapping.md` to describe Resend and the administrative
  inbox as third-party processing boundaries. Keep controller/operator/processor
  classification, legal basis, subprocessors, DPA, transfers, and retention marked
  `[REVISAR JURÍDICO]`.
- Human privacy/security review must cover provider product/dashboard retention, DPA,
  subprocessors, usage/account data, deletion after account termination,
  international processing/transfers, Resend access controls, and administrative
  inbox retention, access, and deletion. The public 30-day product-retention setting
  is not treated as the complete provider lifecycle.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Atomic limiter + pg_cron | Reliable authenticated abuse control with hard lifecycle bound | In-memory state is not reliable across instances; lazy expiry can retain data indefinitely |
| Server-only delivery module | Deterministic payload and failure tests without real email | Calling a provider directly from the form exposes secrets and defeats test isolation |
