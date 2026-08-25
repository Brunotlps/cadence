# Quickstart Validation: In-App Feedback

## Prerequisites

- Run the approved database migration in a non-production Supabase environment.
- Configure server-only Resend sender, recipient, and API key outside source control.
- Enable and verify the hourly Supabase Cron cleanup job.
- Do not use a real Resend account in automated unit or Playwright tests.

## Validation scenarios

1. Visit every protected route family: workspace, onboarding, and join. Confirm the
   launcher is visible, opens the same dialog, supports keyboard close/focus return,
   and reflows at 320px.
2. Submit invalid type/message/path input. Confirm field errors and no limiter row
   mutation.
3. Submit three valid attempts with one authenticated test user; confirm the fourth
   is rejected. Cause a provider failure after slot acquisition and confirm the slot
   remains consumed.
4. Verify direct table access is denied, the limiter function derives the caller,
   expiry cleanup hard-deletes rows, and account deletion removes the row.
5. Mock Resend acceptance, rejection, timeout, and idempotency conflict. Confirm the
   exact minimized payload, opt-in-only `reply_to`, generic failures, same-key/same-
   payload retry, changed-payload/new-key resubmission, and a consumed limiter slot
   for the same-key retry.
6. Before release, verify Resend sender-domain open/click tracking is disabled and
   complete the required provider/inbox privacy and lifecycle review.

## Commands

Run local deterministic checks with `npm run lint` and `npm run test:unit`.
Run hosted compliance and Playwright suites only with the existing approved test
environment and authorization; they must not contact Resend.
