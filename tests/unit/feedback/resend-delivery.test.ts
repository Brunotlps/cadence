import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalFetch = global.fetch;

function setEnvironment() {
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.FEEDBACK_FROM_EMAIL = "feedback@cadence.test";
  process.env.FEEDBACK_RECIPIENT_EMAIL = "admin@cadence.test";
}

async function loadDelivery() {
  vi.resetModules();
  return import("@/lib/feedback/resend-delivery");
}

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.FEEDBACK_FROM_EMAIL;
  delete process.env.FEEDBACK_RECIPIENT_EMAIL;
  vi.resetModules();
});

describe("deliverFeedback", () => {
  it("sends the minimized plaintext payload with opt-in-only reply_to", async () => {
    setEnvironment();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-email-id" }), { status: 200 }),
    );
    const { deliverFeedback } = await loadDelivery();

    await expect(
      deliverFeedback({
        type: "bug",
        message: "O total não atualiza.",
        pathname: "/dashboard",
        replyTo: "person@example.test",
        submissionKey: "ed0b4ac5-77ac-4ef3-8666-6b7c51217b9e",
      }),
    ).resolves.toEqual({ kind: "accepted" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-resend-key",
          "Content-Type": "application/json",
          "Idempotency-Key": "ed0b4ac5-77ac-4ef3-8666-6b7c51217b9e",
        },
        body: JSON.stringify({
          from: "feedback@cadence.test",
          to: ["admin@cadence.test"],
          subject: "Feedback: bug",
          text: "Tipo: bug\nCaminho: /dashboard\n\nO total não atualiza.",
          reply_to: "person@example.test",
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(global.fetch).mock.calls)).not.toContain(
      "workspace",
    );
    expect(JSON.parse(vi.mocked(global.fetch).mock.calls[0]![1]?.body as string)).toEqual({
      from: "feedback@cadence.test",
      to: ["admin@cadence.test"],
      subject: "Feedback: bug",
      text: "Tipo: bug\nCaminho: /dashboard\n\nO total não atualiza.",
      reply_to: "person@example.test",
    });
  });

  it("omits reply_to when follow-up is off or no authenticated email is available", async () => {
    setEnvironment();
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-email-id" }), { status: 200 }),
    );
    const { deliverFeedback } = await loadDelivery();

    await deliverFeedback({
      type: "suggestion",
      message: "Melhorar a busca.",
      pathname: null,
      replyTo: null,
      submissionKey: "0649e4d1-dbee-4a7a-a231-eeb6629a9625",
    });

    const [, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({
      from: "feedback@cadence.test",
      to: ["admin@cadence.test"],
      subject: "Feedback: suggestion",
      text: "Tipo: suggestion\n\nMelhorar a busca.",
    });
  });

  it.each([
    [400, { kind: "rejected" }],
    [409, { kind: "idempotency-conflict" }],
  ] as const)("classifies definitive provider result %i safely", async (status, expected) => {
    setEnvironment();
    global.fetch = vi.fn().mockResolvedValue(new Response("provider details", { status }));
    const { deliverFeedback } = await loadDelivery();

    await expect(
      deliverFeedback({
        type: "bug",
        message: "Mensagem",
        pathname: null,
        replyTo: null,
        submissionKey: "a4ed19f5-b612-4b8d-9cb9-b640861f6d5b",
      }),
    ).resolves.toEqual(expected);
  });

  it("classifies transport failures as ambiguous without exposing error details", async () => {
    setEnvironment();
    global.fetch = vi.fn().mockRejectedValue(new Error("socket reset with message"));
    const { deliverFeedback } = await loadDelivery();

    await expect(
      deliverFeedback({
        type: "bug",
        message: "Mensagem",
        pathname: null,
        replyTo: null,
        submissionKey: "5b812210-bc1d-4ca4-94ed-875ce297377a",
      }),
    ).resolves.toEqual({ kind: "ambiguous" });
  });
});
