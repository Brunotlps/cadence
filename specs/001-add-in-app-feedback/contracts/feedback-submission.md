# Feedback Submission Contract

## Client form to Server Action

| Field | Required | Contract |
|-------|----------|----------|
| `type` | Yes | `bug` or `suggestion` |
| `message` | Yes | Free text, trimmed, 1–5,000 characters |
| `pathname` | No | Candidate application path only; server normalizes or drops it |
| `allowFollowUp` | Yes | Explicit `on` or absent/off |
| `submissionKey` | Yes | Random UUID, no PII/financial data |

The client never sends email, user ID, workspace ID, full URL, query, fragment,
cookies, request diagnostics, page state, or financial data.

## Server Action result

```ts
type FeedbackActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
  retrySubmissionKey?: string;
};
```

`retrySubmissionKey` is returned only for ambiguous transport failure. The dialog
retains it only when its canonical provider payload snapshot is unchanged; a changed
type, trimmed message, normalized pathname, follow-up choice, or other provider
request value generates a new random key. No provider details appear in the result.

## External delivery request

The server-only Resend request includes configured sender and recipient, static
subject/type, plaintext message body, optional normalized pathname, optional
server-derived `reply_to`, and the opaque `Idempotency-Key`. No other application or
identity context is sent.
