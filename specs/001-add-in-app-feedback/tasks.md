---
description: "Implementation tasks for authenticated in-app feedback"
---

# Tasks: In-App Feedback

**Input**: Design documents from `/specs/001-add-in-app-feedback/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/feedback-submission.md`, `quickstart.md`, and checked requirements-quality
checklists.

**Tests**: Unit, hosted Supabase compliance, and Playwright coverage are required by
the approved plan. Automated tests must never contact Resend; provider behavior is
represented by deterministic fakes/mocks.

**Organization**: Tasks are grouped by user story after shared documentation,
database, validation, delivery, and action foundations are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with tasks in the same phase when their prerequisite
  files are complete.
- **[Story]**: User story served by the task.
- **Release-only**: Human/operational task required before production release, not an
  implementation prerequisite for local development.

## Phase 1: Setup and durable contracts

**Purpose**: Establish the committed configuration and durable-contract baseline for
the selected, already-approved architecture.

- [ ] T001 Update `.env.example` with valueless server-only `RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL`, and `FEEDBACK_RECIPIENT_EMAIL` entries and explanatory safe-use comments.
- [ ] T002 Verify that the committed `.cadence/policies/data-handling.md`, `docs/specs/data-model-and-deletion.md`, `docs/specs/data-portability.md`, and `CLAUDE.md` correctly establish the approved narrow account-level security/control-metadata exception without weakening the workspace-domain rule.
- [ ] T003 [P] Update `docs/compliance/lgpd-mapping.md` with Resend and the administrative inbox as third-party processing boundaries, retaining `[REVISAR JURÍDICO]` for roles, legal basis, DPA, subprocessors, transfers, retention, and deletion.

---

## Phase 2: Foundational database, validation, and delivery boundaries

**Purpose**: Build the shared security, lifecycle, and server-only boundaries that
block all feedback stories.

**⚠️ CRITICAL**: Complete this phase before mounting the feedback flow in protected
routes.

- [ ] T004 Create database-invariant coverage in `tests/compliance/feedback-submission-limits.test.ts` for RLS/direct-access denial, caller-derived identity, atomic three-slot maximum under concurrency, anchored-window reset, expiry hard deletion, and account-deletion cleanup.
- [ ] T005 Add the `feedbackSubmissionLimits` Drizzle declaration with only `user_id`, `window_started_at`, `submission_count`, and `expires_at` plus the required checks/indexes in `db/schema.ts`.
- [ ] T006 Create `db/migrations/0015_feedback_submission_limits.sql` and corresponding Drizzle metadata in `db/migrations/meta/` to create the limiter; enable RLS with no direct user-table access; install fixed-search-path atomic allow/reject and scheduler-only cleanup functions; schedule idempotent hourly `pg_cron` hard deletion; and integrate hard deletion into account deletion.
- [ ] T007 Write pure validation and pathname-policy cases in `tests/unit/feedback/validate-feedback.test.ts` for closed type values, trimmed non-empty messages, 5,000-character boundary, explicit follow-up boolean, UUID submission key, and safe route-template normalization/drop behavior.
- [ ] T008 Implement pure feedback input validation and protected-pathname normalization in `lib/feedback/validate-feedback.ts` and `lib/feedback/normalize-feedback-pathname.ts` without accepting email, user ID, workspace ID, URL queries/fragments, or telemetry.
- [ ] T009 Write deterministic Resend request and result-mapping coverage in `tests/unit/feedback/resend-delivery.test.ts` for plaintext minimized payloads, opt-in-only server-derived `reply_to`, accepted-send success, definitive rejection, ambiguous transport failure, and idempotency conflict.
- [ ] T010 Implement the server-only native-fetch Resend boundary in `lib/feedback/resend-delivery.ts` with configured sender/recipient, plaintext-only payload construction, no tracking/tags/attachments, opaque `Idempotency-Key`, and safe provider-result classification without logging feedback or email.
- [ ] T011 Write Server Action cases in `tests/unit/feedback/actions.test.ts` for authenticated-session enforcement, server-derived optional email, validation-before-limit acquisition, limiter result mapping, one slot per valid invocation including same-key retry, and generic safe delivery failures.
- [ ] T012 Implement `lib/actions/feedback.ts` using the existing action-state pattern: derive the session/email server-side, validate first, acquire one atomic limiter slot, call the delivery boundary, and return only safe success/field/error state without logging feedback or opted-in email.

**Checkpoint**: The database and server boundary can safely accept a minimized valid
submission, with no UI or external provider required for automated tests.

---

## Phase 3: User Story 1 — Submit a bug report (Priority: P1) 🎯 MVP

**Goal**: An authenticated user can open one protected-app feedback dialog, choose a
bug/problem, receive observed/expected guidance, submit a valid message, and see
success only after delivery acceptance.

**Independent Test**: In an authenticated test session on every protected route family,
open the dialog, select bug/problem, exercise client validation, and confirm the
accessible dialog behavior without leaving Cadence. Deterministic delivery acceptance
and success-boundary coverage belongs to the Server Action/delivery unit tests.

- [ ] T013 [P] [US1] Add authenticated protected-route and bug-flow coverage to `tests/e2e/feedback.spec.ts` for workspace, onboarding, and join routes; dialog open/close; bug guidance; client validation; and the no-leave-Cadence UI path, without invoking external delivery.
- [ ] T014 [US1] Create the shared feedback dialog, launcher, warning, bug guidance, required type/message controls, and action-state wiring in `components/app-shell/feedback-dialog.tsx`.
- [ ] T015 [US1] Add responsive protected-layout feedback styling in `components/app-shell/feedback-dialog.module.css` for desktop placement and mobile safe-area/workspace-navigation clearance.
- [ ] T016 [US1] Mount the shared dialog/launcher exactly once in `app/(protected)/layout.tsx` and add any protected-layout positioning support in `app/(protected)/layout.module.css` so workspace, onboarding, and join inherit it.
- [ ] T017 [US1] Extend `tests/e2e/feedback.spec.ts` with native dialog/modal semantics, associated labels, keyboard operation/dismissal, focus-on-open, focus restoration, and accessible field-error/status markup assertions that are exercisable without invoking external delivery.

**Checkpoint**: Bug reports are reachable from every protected route family and are
independently testable with the selected acceptance boundary.

---

## Phase 4: User Story 2 — Submit an improvement suggestion (Priority: P1)

**Goal**: The same flow classifies a report as a suggestion and gives desired-
improvement guidance without adding a second feedback mechanism.

**Independent Test**: In an authenticated session, select improvement suggestion and
exercise its distinct guidance and client validation without external delivery. Shared
delivery acceptance and immediate-success semantics remain deterministic unit coverage.

- [ ] T018 [P] [US2] Add improvement-suggestion guidance and client-validation coverage to `tests/e2e/feedback.spec.ts` without invoking external delivery.
- [ ] T019 [US2] Extend type-specific guidance and labels in `components/app-shell/feedback-dialog.tsx` so suggestion guidance asks what the user would like improved while preserving the shared form and action contract.

**Checkpoint**: Bug and suggestion reports share one accessible flow with distinct,
clear guidance.

---

## Phase 5: User Story 3 — Control contact and contextual data (Priority: P1)

**Goal**: Reports exclude identity by default, attach only server-derived authenticated
email after explicit follow-up opt-in, and use only optional normalized pathname context.

**Independent Test**: Submit reports with and without follow-up opt-in through a fake
delivery boundary and inspect the constructed request: only the opted-in report has
`reply_to`; neither includes prohibited automatic context.

- [ ] T020 [P] [US3] Expand `tests/unit/feedback/resend-delivery.test.ts` and `tests/unit/feedback/actions.test.ts` with opt-in/off, unavailable authenticated email, server-derived-email, exact payload, and prohibited-context exclusion cases.
- [ ] T021 [US3] Add the explicit unselected follow-up-contact choice and optional safe pathname capture to `components/app-shell/feedback-dialog.tsx`; do not add client email, identity, workspace, full URL, query, fragment, or telemetry fields.
- [ ] T022 [US3] Complete payload assembly across `lib/actions/feedback.ts` and `lib/feedback/resend-delivery.ts` so the only external values are configured sender/recipient, static subject/type, plaintext type/message, optional normalized pathname, opt-in-only server-derived `reply_to`, and opaque key.

**Checkpoint**: The privacy-default submission contract is independently provable with
deterministic unit tests and no real Resend request.

---

## Phase 6: User Story 4 — Receive a safe failure outcome (Priority: P2)

**Goal**: Users receive non-evasive, non-success failure feedback, have transient form
state while the dialog stays open, and use idempotent retry rules without persistent
drafts or limiter-slot compensation.

**Independent Test**: Deterministically produce validation, abuse-limit, definitive-
provider, ambiguous-transport, idempotency-conflict, and unexpected failures in unit
coverage; independently prove the client-side key/state rules without provider calls;
and ensure browser coverage remains limited to safely exercisable dialog UI states.

- [ ] T023 [P] [US4] Add Server Action failure/retry coverage in `tests/unit/feedback/actions.test.ts` for validation/non-consumption, fourth-valid-attempt rejection, provider failure/consumed slot, same-key retry acquiring and consuming another slot, ambiguous failure returning the current `retrySubmissionKey`, and idempotency-conflict generic failure; do not assert client key rotation in this server suite.
- [ ] T024 [P] [US4] Add deterministic client submission-key-state coverage in `tests/unit/feedback/submission-key-state.test.ts` for an unchanged canonical payload reusing the returned key, a changed payload generating a new random key, definitive-rejection resubmission using a new key, and close/discard/success clearing transient state without persistence or provider calls.
- [ ] T025 [US4] Implement the client-owned transient canonical-payload snapshot and submission-key state in `lib/feedback/submission-key-state.ts`, then use it from `components/app-shell/feedback-dialog.tsx` for pending/safe error state, unchanged-payload retry, changed-payload new-key generation, success reset, and close/discard reset without persistent draft storage.
- [ ] T026 [US4] Refine `lib/actions/feedback.ts` and `lib/feedback/resend-delivery.ts` so an ambiguous transport failure returns the current retry key without server-side payload history, every validation-passing invocation that acquires a slot—including a same-key retry—remains consumed with no decrement, and provider/internal details never reach UI or ordinary diagnostics.

**Checkpoint**: All failure/retry paths remain truthful, private, and bounded by the
anchored limiter semantics.

---

## Phase 7: Cross-cutting verification and release preparation

**Purpose**: Prove constitutional invariants at the right layer and separate human
release obligations from deterministic implementation work.

- [ ] T027 Run and resolve the new local deterministic feedback unit coverage in `tests/unit/feedback/` without contacting Resend.
- [ ] T028 Run the approved hosted compliance environment for `tests/compliance/feedback-submission-limits.test.ts` and record evidence for RLS, atomicity, expiry hard deletion, and account deletion; do not run migrations or hosted tests without the required authorization.
- [ ] T029 Run the approved authenticated Playwright environment for `tests/e2e/feedback.spec.ts` and record protected-route reachability, dialog behavior, responsive layout, accessibility, client validation, and safely exercisable UI-state evidence; do not contact Resend or assume a provider-result browser seam.
- [ ] T030 Reconcile final migration/function names and test evidence in `.cadence/policies/data-handling.md`, `docs/specs/data-model-and-deletion.md`, `docs/specs/data-portability.md`, and `docs/compliance/lgpd-mapping.md` before release.
- [ ] T031 Create the feedback operational runbook in `docs/operations/in-app-feedback-release.md` covering sender-domain DNS, restricted recipient access, plaintext sending, disabled Resend open/click tracking, cron deployment verification, repair/re-enable after upgrades, failed-job monitoring, and periodic inspection/pruning of `cron.job_run_details`.

### Release-only human gates

- [ ] T032 Complete and record human privacy/security review in `docs/compliance/lgpd-mapping.md` for Resend and the administrative inbox: product/dashboard retention, DPA, subprocessors, usage/account data, deletion after account termination, international transfers, and inbox access/retention/deletion; retain unresolved legal-role decisions as `[REVISAR JURÍDICO]` until approved.
- [ ] T033 Verify and record Resend sender-domain settings in `docs/operations/in-app-feedback-release.md`: open/click tracking disabled, DNS/sender verified, configured administrative recipient restricted, and plaintext-only delivery configuration.
- [ ] T034 Verify and record Supabase Cron operation in `docs/operations/in-app-feedback-release.md`: hourly hard-delete job enabled after deployment, failed-run monitoring established, and `cron.job_run_details` inspection/pruning ownership assigned.
- [ ] T035 Perform and record one manual authenticated end-to-end SC-001 acceptance run in `docs/operations/in-app-feedback-release.md` only after implementation, configured provider delivery, and the applicable privacy/security release gates are ready: start timing when the feedback flow opens; submit non-sensitive valid test feedback through the configured trusted administrative delivery mechanism; confirm UI success means provider acceptance, not final inbox delivery, human receipt, reading, or acknowledgement; compare the accepted request/evidence with the approved minimized payload boundary; confirm the user stays in Cadence; and complete the flow in under two minutes.

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1** starts immediately. T001–T003 can proceed in parallel where files do not
  overlap; T002 must precede implementation of the limiter exception.
- **Phase 2** depends on Phase 1. T004 precedes T006; T005/T006 precede hosted
  compliance execution. T007 precedes T008; T009 precedes T010; T011 precedes T012.
  T012 depends on T006, T008, and T010.
- **US1** depends on T012. T013 can be prepared after the foundational action contract;
  T014–T16 are sequential because they share dialog/layout integration; T017 follows
  the mounted dialog. Provider acceptance/success semantics remain covered by T009–T012,
  not Playwright.
- **US2** depends on US1’s shared dialog (T014) and can proceed alongside US3 after
  the relevant foundation is stable.
- **US3** depends on T010 and T012; T020 can proceed before T021/T022, which share
  the dialog/action/delivery files and therefore proceed sequentially.
- **US4** depends on US1–US3 because it completes the shared dialog/action/delivery
  recovery behavior. T023 (server) and T024 (client state) can run in parallel; T025
  implements the client-owned state before T026 finalizes server semantics. The Server
  Action never retains a canonical payload snapshot or rotates a key.
- **Phase 7** deterministic validation follows implementation. Hosted tests and
  release-only gates require their separately authorized environments and do not
  authorize real Resend calls from automated tests. T035 is the final manual release
  acceptance after T027–T034, the deployed configured delivery mechanism, and the
  applicable human privacy/security review are complete.

### User-story delivery order

`Foundation → US1 (bug MVP) → US2 (suggestion) and US3 (privacy controls) → US4
(failure/retry) → cross-cutting verification → release-only gates → T035 manual
SC-001 acceptance`.

## Parallel opportunities

- T001 and T003 can run alongside each other; T002 owns overlapping durable contracts.
- T004, T007, T009, and T011 are test-design tasks over distinct areas once their
  dependencies are understood.
- T013 can be prepared while the dialog implementation is underway; T018 and T020 can
  be prepared after their shared contracts stabilize.
- T023 and T024 are independent server and client-state unit coverage tasks.
- T028–T029 can run in parallel only in their approved hosted test environment; T032–T034 are separate release-only human/operational tracks.
- T035 runs only after the implementation is complete and the approved Resend sender, recipient, privacy/security review, and release configuration required by T032–T034 are ready. It is a manual release acceptance check and must not be automated.

## Implementation strategy

### MVP first

1. Complete Phases 1–2.
2. Deliver and validate US1 through T017.
3. Stop for independent bug-flow validation before extending the shared flow.

### Incremental delivery

1. Add US2 and US3 after the bug MVP, preserving the single dialog and payload contract.
2. Add US4 to finalize safe failure, retry, and transient-state behavior.
3. Complete automated evidence, then obtain the separate human release gates and T035
   manual SC-001 acceptance.

## Notes

- `feedback_submission_limits` is security/control metadata only; it is not feedback
  persistence or a feedback history.
- Do not add screenshots, attachments, public feedback, voting, comments, status
  tracking, an administrative dashboard, AI classification, analytics, or telemetry.
- Do not use real Resend requests in automated tests, and do not log feedback text or
  opted-in email in normal diagnostics.
