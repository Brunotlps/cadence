# Data Model: In-App Feedback

## Feedback submission

Feedback content is transient in Cadence. It is validated, passed to the delivery
provider after a limiter slot is acquired, and is never persisted in Cadence.

| Field | Source | Rule |
|-------|--------|------|
| type | User input | `bug` or `suggestion` |
| message | User input | Trimmed, non-empty, maximum 5,000 characters |
| pathname | Client, server-normalized | Optional approved route template only |
| follow-up | User input | Explicit boolean, off by default |
| reply-to email | Authenticated server session | Included only when follow-up is true |
| submission key | Client-generated random UUID | Delivery idempotency only; no PII/finance data |

## Feedback submission limit

| Field | Rule |
|-------|------|
| user_id | Primary key; authenticated identity; never sent to the provider |
| window_started_at | First valid attempt in the current anchored window |
| submission_count | Integer from 1 through 3 |
| expires_at | `window_started_at + 24 hours`; hard-delete cutoff |

State transition: invalid input → no row change; each valid action invocation →
atomically create or increment the active row; fourth valid invocation → rejected;
provider outcome, including same-key retry, → does not alter the consumed slot;
expiry/account deletion → hard delete.

The table has RLS and no direct user policies. An authenticated, fixed-search-path
database function derives `auth.uid()` and returns only allow/reject. A scheduler-only
function deletes expired rows hourly. Account deletion explicitly deletes the row.
