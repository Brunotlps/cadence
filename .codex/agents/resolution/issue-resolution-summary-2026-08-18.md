# Cadence issue resolution summary - 2026-08-18

## Executive summary

This document records the operational closure of Cadence issues #17 through #25.
All target issues were resolved through small scoped pull requests, validated with
local checks, reviewer agents, and GitHub CI before merge.

Final repository state observed on 2026-08-18:

- Branch: `main`
- Worktree: clean
- Current commit: `954589f Merge pull request #34 from Brunotlps/fix/data-portability-export`
- Target issues #17-#25: all `CLOSED`
- Resolution PRs #27-#34: all `MERGED`
- Last PR CI (#34): production build, lint, E2E, unit tests, Vercel, and Vercel
  preview comments all passed

No secrets, `.env.local`, credential values, production deploys, or database
migrations were read or executed as part of the orchestration record.

## Validation evidence

Final local validation:

- `git branch --show-current`: `main`
- `git status --short`: clean output
- `git log -1 --oneline`: `954589f Merge pull request #34 from Brunotlps/fix/data-portability-export`

Final GitHub issue validation:

| Issue | Status | Closed at (UTC) | Resolution |
| --- | --- | --- | --- |
| #17 Implement data portability export under the user session | `CLOSED` | 2026-08-18T17:15:48Z | PR #34 |
| #18 Add an account deletion flow owned by the authenticated user | `CLOSED` | 2026-08-18T16:07:24Z | PR #33 |
| #19 Prevent users from creating multiple workspaces through create_workspace_with_owner | `CLOSED` | 2026-08-18T13:18:04Z | PR #30 |
| #20 Block generic transaction edits for linked fixed-bill payments | `CLOSED` | 2026-08-18T13:46:39Z | PR #31 |
| #21 Do not redeem workspace invites during GET render | `CLOSED` | 2026-08-18T12:25:06Z | PR #29 |
| #22 Fail CI when required Supabase test secrets are missing | `CLOSED` | 2026-08-17T23:19:36Z | PR #27 |
| #23 Add production build validation to CI | `CLOSED` | 2026-08-17T23:19:36Z | PR #27 |
| #24 Redirect or show success after deleting payments from edit pages | `CLOSED` | 2026-08-18T14:09:09Z | PR #32 |
| #25 Remove legacy email OTP handling from the auth callback | `CLOSED` | 2026-08-17T23:54:14Z | PR #28 |

Final GitHub PR validation:

| PR | Status | Merged at (UTC) | Scope |
| --- | --- | --- | --- |
| #27 | `MERGED` | 2026-08-17T23:19:34Z | Required Supabase test secret checks and production build validation |
| #28 | `MERGED` | 2026-08-17T23:54:13Z | Removed legacy email OTP handling from auth callback |
| #29 | `MERGED` | 2026-08-18T12:25:05Z | Required explicit workspace invite redemption |
| #30 | `MERGED` | 2026-08-18T13:18:03Z | Enforced one workspace per user |
| #31 | `MERGED` | 2026-08-18T13:46:37Z | Blocked generic edits for linked fixed-bill payments |
| #32 | `MERGED` | 2026-08-18T14:09:07Z | Redirected after deleting payments from edit pages |
| #33 | `MERGED` | 2026-08-18T16:07:22Z | Added authenticated account deletion flow |
| #34 | `MERGED` | 2026-08-18T17:15:47Z | Added authenticated data portability export |

Last PR CI evidence for #34:

- Build de produção: `pass`
- Lint: `pass`
- Testes E2E: `pass`
- Testes unitários: `pass`
- Vercel: `pass`
- Vercel Preview Comments: `pass`

## Resolution details

### #22 and #23 - CI reliability

PR: #27, `Require Supabase test secrets and build validation`

Outcome:

- CI now fails when required Supabase test secrets are missing.
- CI now runs production build validation.
- Secret checks report missing variable names only, not values.

Validation:

- Unit coverage for workflow assertions.
- GitHub CI green before merge.

Residual risk:

- CI relies on GitHub secret configuration being maintained for future protected
  checks.

### #25 - Auth callback hardening

PR: #28, `Remove legacy OTP auth callback`

Outcome:

- Auth callback no longer accepts legacy email OTP parameters.
- Google OAuth code exchange remains the active callback path.

Validation:

- Auth callback unit coverage.
- GitHub CI green before merge.

Residual risk:

- No residual product risk recorded for the closed scope.

### #21 - Invite redemption side effect removal

PR: #29, `Require explicit workspace invite redemption`

Outcome:

- GET render no longer redeems workspace invites.
- Invite redemption is explicit and user-triggered.

Validation:

- Join page and invite action regression tests.
- GitHub CI green before merge.

Residual risk:

- No residual product risk recorded for the closed scope.

### #19 - Workspace singleton enforcement

PR: #30, `fix: prevent multiple workspaces per user`

Outcome:

- Added database-level singleton enforcement for `workspace_members.user_id`.
- Hardened workspace creation and invite redemption paths against multiple
  workspace membership.

Validation:

- Migration-level/compliance coverage for singleton behavior.
- GitHub CI green before merge.

Residual risk:

- Product contract is now one workspace per user. Older portability wording still
  uses plural workspaces, but executable behavior is the source of truth.

### #20 - Financial integrity for linked fixed-bill payments

PR: #31, `fix: block generic fixed-bill payment edits`

Outcome:

- Generic transaction update path no longer edits fixed-bill-linked payments.
- Linked payments remain owned by the fixed-bill payment flow.

Validation:

- Repository/action regression tests for linked payment edit blocking.
- GitHub CI green before merge.

Residual risk:

- No residual product risk recorded for the closed scope.

### #24 - Delete navigation reliability

PR: #32, `fix: redirect after edit-page deletes`

Outcome:

- Delete actions from edit pages now redirect after successful deletion.
- Prevents users from remaining on stale edit URLs after the underlying payment
  no longer exists.

Validation:

- Web runtime regression coverage.
- GitHub CI green before merge.

Residual risk:

- No residual product risk recorded for the closed scope.

### #18 - Account deletion flow

PR: #33, `fix: add authenticated account deletion flow`

Outcome:

- Added protected account deletion UI and Server Action.
- Deletion target is derived exclusively from `auth.getUser()` session identity.
- Browser-supplied `target` or `userId` values are ignored.
- Existing server-only admin helper remains the only service-role path.

Validation:

- Unit tests for session-derived identity, destructive confirmation, no-session
  behavior, sanitized admin errors, and absence of hidden target fields.
- `finding_closure_validator`: `ready_to_close`.
- GitHub CI green before merge.

Residual risk:

- Existing cross-service deletion can partially complete if the database RPC
  succeeds and Supabase Auth admin deletion later fails. This was an existing
  architectural limitation, not introduced by the PR.

### #17 - Data portability export

PR: #34, `fix: add authenticated data export`

Outcome:

- Added authenticated JSON export endpoint at `/account/export`.
- Export uses the normal user-scoped Supabase server client with RLS active.
- Export target is derived from `auth.getUser()`, not request parameters.
- Profile export is filtered to the authenticated profile.
- Workspace data is read through RLS-visible queries.
- Numeric values are serialized as decimal strings with two places.
- Hard-deleted records are absent; linked historical records keep nullified
  references where required by existing cascade/set-null behavior.

Validation:

- Hosted compliance test: `tests/compliance/data-portability.test.ts`
  - Two users and two workspaces.
  - No cross-workspace or cross-user leakage.
  - Hard-deleted transaction absent.
  - Deleted goal and fixed bill absent.
  - Historical contribution/payment records retained with `goal_id` and
    `fixed_bill_id` null.
- Unit tests:
  - Export contract fields.
  - Decimal string serialization.
  - Route authentication and download headers.
  - Guardrail against admin/service-role imports.
- `finding_closure_validator`: initially `needs_human_validation`; after hosted
  compliance passed, final classification `ready_to_close`.
- GitHub CI green before merge.

Residual risk:

- The hosted compliance test exercises the exporter with authenticated Supabase
  clients, not the Route Handler through browser cookies. Route behavior is
  covered by unit tests and CI E2E passed.

## Agents used

Implementation agents:

- `ci_reliability_implementer`
- `auth_workspace_implementer`
- `financial_integrity_implementer`
- `web_runtime_implementer`
- `privacy_lifecycle_implementer`

Reviewer agents:

- `regression_test_designer`
- `finding_closure_validator`

Operational pattern:

1. Read issue and relevant repository contracts.
2. Ask regression designer for minimum test plan.
3. Use domain implementer for scoped patch.
4. Review diff locally.
5. Run safe local validation proportional to risk.
6. Use closure validator to attempt refutation.
7. Commit only after validator readiness.
8. Push/open PR only after explicit approval.
9. Merge only after CI green and explicit approval.

## Notes for future work

- For privacy, RLS, deletion, export, auth, and finance changes, continue to
  require executable proof at the correct layer. Planning docs alone are not
  sufficient evidence.
- Hosted compliance tests are required when the invariant depends on real RLS,
  grants, cascade, or Supabase Auth behavior.
- Do not use service-role for portability/export flows. Service-role remains
  limited to explicit audited admin routines such as account deletion.
- Keep future PRs small and issue-scoped. The #17-#25 cycle benefited from one
  defensible PR per domain or invariant.
