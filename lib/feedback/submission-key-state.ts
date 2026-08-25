import type { FeedbackType } from "./validate-feedback";
import { normalizeFeedbackPathname } from "./normalize-feedback-pathname";

export type CanonicalFeedbackPayload = { type: FeedbackType | null; message: string; pathname: string | null; allowFollowUp: boolean };
export type SubmissionKeyState = { key: string; snapshot: string; retryable: boolean } | null;

function snapshot(payload: CanonicalFeedbackPayload) {
  return JSON.stringify({
    type: payload.type,
    message: payload.message.trim(),
    pathname: normalizeFeedbackPathname(payload.pathname),
    allowFollowUp: payload.allowFollowUp,
  });
}

export function createSubmissionKeyState(payload: CanonicalFeedbackPayload): Exclude<SubmissionKeyState, null> {
  return { key: crypto.randomUUID(), snapshot: snapshot(payload), retryable: false };
}

export function keyForSubmission(state: SubmissionKeyState, payload: CanonicalFeedbackPayload): Exclude<SubmissionKeyState, null> {
  if (state && state.retryable && state.snapshot === snapshot(payload)) return state;
  return createSubmissionKeyState(payload);
}

export function retainAmbiguousRetry(state: SubmissionKeyState, payload: CanonicalFeedbackPayload, retryKey: string): SubmissionKeyState {
  return state?.key === retryKey && state.snapshot === snapshot(payload)
    ? { ...state, retryable: true }
    : null;
}

export function clearSubmissionKeyState(): SubmissionKeyState { return null; }

export function transitionSubmissionKeyState(
  submittedState: Exclude<SubmissionKeyState, null>,
  submittedPayload: CanonicalFeedbackPayload,
  outcome: "validation" | "ambiguous" | "rejected" | "idempotency-conflict" | "success",
  retryKey?: string,
): SubmissionKeyState {
  if (outcome === "ambiguous") {
    return retryKey
      ? retainAmbiguousRetry(submittedState, submittedPayload, retryKey)
      : null;
  }
  // Validation keeps the key available for the visible form, but never makes it retryable.
  if (outcome === "validation") return { ...submittedState, retryable: false };
  return null;
}
