import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deliverFeedback: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/feedback/resend-delivery", () => ({
  deliverFeedback: mocks.deliverFeedback,
}));

import {
  submitFeedbackAction,
  type FeedbackActionState,
} from "@/lib/actions/feedback";

const initialState: FeedbackActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function feedbackForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    type: "bug",
    message: "O total não atualiza.",
    pathname: "/dashboard",
    allowFollowUp: "on",
    submissionKey: "4c75ce75-48d4-4f7b-a9f0-b2772a4f5219",
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

describe("submitFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
    } as unknown as SupabaseClient);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id", email: "person@example.test" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.deliverFeedback.mockResolvedValue({ kind: "accepted" });
  });

  it("requires an authenticated server session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await submitFeedbackAction(initialState, feedbackForm());

    expect(result).toEqual({
      error: "Não foi possível enviar o feedback agora.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deliverFeedback).not.toHaveBeenCalled();
  });

  it("validates before acquiring a limiter slot", async () => {
    const result = await submitFeedbackAction(
      initialState,
      feedbackForm({ message: "  " }),
    );

    expect(result).toEqual({
      error: "Revise os campos destacados.",
      fieldErrors: { message: "Descreva seu feedback." },
      success: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the server-derived opted-in email and no client identity fields", async () => {
    const form = feedbackForm();
    form.set("email", "attacker@example.test");
    form.set("userId", "attacker-id");
    form.set("workspaceId", "attacker-workspace");

    await expect(submitFeedbackAction(initialState, form)).resolves.toEqual({
      error: null,
      fieldErrors: {},
      success: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_feedback_submission_limit");
    expect(mocks.deliverFeedback).toHaveBeenCalledWith({
      type: "bug",
      message: "O total não atualiza.",
      pathname: "/dashboard",
      replyTo: "person@example.test",
      submissionKey: "4c75ce75-48d4-4f7b-a9f0-b2772a4f5219",
    });
  });

  it("omits unavailable or non-opted-in email", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id", email: undefined } },
      error: null,
    });

    const form = feedbackForm();
    form.delete("allowFollowUp");
    await submitFeedbackAction(initialState, form);

    expect(mocks.deliverFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: null }),
    );
  });

  it("does not attach email when follow-up is opted in but the server session has none", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id", email: undefined } },
      error: null,
    });

    await submitFeedbackAction(initialState, feedbackForm());

    expect(mocks.deliverFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: null }),
    );
  });

  it("maps limiter and definitive provider failures to safe generic errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(submitFeedbackAction(initialState, feedbackForm())).resolves.toEqual({
      error: "Não foi possível enviar o feedback agora.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.deliverFeedback).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    mocks.deliverFeedback.mockResolvedValueOnce({ kind: "rejected" });
    await expect(submitFeedbackAction(initialState, feedbackForm())).resolves.toEqual({
      error: "Não foi possível enviar o feedback agora.",
      fieldErrors: {},
      success: false,
    });
  });

  it("consumes one slot for each same-key retry and returns that key only after ambiguity", async () => {
    mocks.deliverFeedback.mockResolvedValueOnce({ kind: "ambiguous" });
    const first = await submitFeedbackAction(initialState, feedbackForm());
    const second = await submitFeedbackAction(initialState, feedbackForm());

    expect(first).toEqual({
      error: "Não foi possível enviar o feedback agora.",
      fieldErrors: {},
      success: false,
      retrySubmissionKey: "4c75ce75-48d4-4f7b-a9f0-b2772a4f5219",
    });
    expect(second.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("maps fourth-attempt and idempotency-conflict outcomes to the same safe failure", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await submitFeedbackAction(initialState, feedbackForm());
    expect(mocks.deliverFeedback).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    mocks.deliverFeedback.mockResolvedValueOnce({ kind: "idempotency-conflict" });
    const result = await submitFeedbackAction(initialState, feedbackForm());
    expect(result).toEqual({ error: "Não foi possível enviar o feedback agora.", fieldErrors: {}, success: false });
    expect(JSON.stringify(result)).not.toContain("idempotency");
  });
});
