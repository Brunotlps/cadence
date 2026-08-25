import { describe, expect, it, vi } from "vitest";
import { clearSubmissionKeyState, createSubmissionKeyState, keyForSubmission, retainAmbiguousRetry, transitionSubmissionKeyState } from "@/lib/feedback/submission-key-state";

const payload = { type: "bug" as const, message: " Mensagem ", pathname: "/dashboard", allowFollowUp: false };
describe("submission key state", () => {
  it("reuses only an unchanged ambiguous payload key", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("key-a").mockReturnValueOnce("key-b");
    const state = createSubmissionKeyState(payload)!;
    expect(keyForSubmission(retainAmbiguousRetry(state, payload, "key-a"), { ...payload, message: "Mensagem" })?.key).toBe("key-a");
    expect(keyForSubmission(retainAmbiguousRetry(state, payload, "key-a"), { ...payload, allowFollowUp: true })?.key).toBe("key-b");
  });
  it("normalizes dynamic pathnames and clears retry eligibility after definitive outcomes", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("key-path").mockReturnValueOnce("key-new");
    const state = createSubmissionKeyState({ ...payload, pathname: "/goals/secret-id/edit" })!;
    const retry = retainAmbiguousRetry(state, { ...payload, pathname: "/goals/another-id/edit" }, "key-path");
    expect(keyForSubmission(retry, { ...payload, pathname: "/goals/third-id/edit" })?.key).toBe("key-path");
    expect(keyForSubmission(clearSubmissionKeyState(), payload)?.key).toBe("key-new");
  });
  it("rotates after definitive rejection or conflict and clears after success or close", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b").mockReturnValueOnce("uuid-c");
    const submitted = createSubmissionKeyState(payload);
    const ambiguous = retainAmbiguousRetry(submitted, payload, "uuid-a");
    expect(keyForSubmission(ambiguous, payload).key).toBe("uuid-a");
    const afterRejection = clearSubmissionKeyState();
    expect(keyForSubmission(afterRejection, payload).key).toBe("uuid-b");
    expect(keyForSubmission(clearSubmissionKeyState(), payload).key).toBe("uuid-c");
  });
  it("maps submitted outcomes without consulting later form edits", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");
    const a = createSubmissionKeyState(payload);
    const ambiguous = transitionSubmissionKeyState(a, payload, "ambiguous", "uuid-a");
    expect(keyForSubmission(ambiguous, payload).key).toBe("uuid-a");
    expect(transitionSubmissionKeyState(a, payload, "validation")?.retryable).toBe(false);
    expect(keyForSubmission(transitionSubmissionKeyState(a, payload, "rejected"), payload).key).toBe("uuid-b");
    expect(transitionSubmissionKeyState(a, payload, "idempotency-conflict")).toBeNull();
    expect(transitionSubmissionKeyState(a, payload, "success")).toBeNull();
  });
  it("uses UUID-A only for the unchanged ambiguous retry, then rotates to UUID-B", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("uuid-a").mockReturnValueOnce("uuid-b");
    const a = createSubmissionKeyState(payload);
    const retryA = transitionSubmissionKeyState(a, payload, "ambiguous", "uuid-a");
    expect(keyForSubmission(retryA, payload).key).toBe("uuid-a");
    const afterDefinitiveRejection = transitionSubmissionKeyState(retryA!, payload, "rejected");
    expect(keyForSubmission(afterDefinitiveRejection, payload).key).toBe("uuid-b");
  });
  it("clears state for definitive rejection, close, discard, and success", () => {
    expect(clearSubmissionKeyState()).toBeNull();
    expect(retainAmbiguousRetry(createSubmissionKeyState(payload), payload, "other")).toBeNull();
  });
});
