import "server-only";
import type { FeedbackType } from "./validate-feedback";

type FeedbackDeliveryInput = {
  type: FeedbackType;
  message: string;
  pathname: string | null;
  replyTo: string | null;
  submissionKey: string;
};

export type FeedbackDeliveryResult =
  | { kind: "accepted" }
  | { kind: "rejected" }
  | { kind: "ambiguous" }
  | { kind: "idempotency-conflict" };

function configuration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM_EMAIL;
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL;

  if (!apiKey || !from || !recipient) return null;
  return { apiKey, from, recipient };
}

function plaintextBody(input: FeedbackDeliveryInput): string {
  const pathname = input.pathname ? `\nCaminho: ${input.pathname}` : "";
  return `Tipo: ${input.type}${pathname}\n\n${input.message}`;
}

// Limite externo e server-only: não registra nem repassa contexto além do
// contrato aprovado. A aceitação do provedor é a única condição de sucesso.
export async function deliverFeedback(
  input: FeedbackDeliveryInput,
): Promise<FeedbackDeliveryResult> {
  const configured = configuration();
  if (!configured) return { kind: "rejected" };

  const body: Record<string, string | string[]> = {
    from: configured.from,
    to: [configured.recipient],
    subject: `Feedback: ${input.type}`,
    text: plaintextBody(input),
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configured.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.submissionKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "ambiguous" };
  }

  if (response.status === 409) return { kind: "idempotency-conflict" };
  if (!response.ok) return { kind: "rejected" };

  try {
    const payload = (await response.json()) as { id?: unknown };
    return typeof payload.id === "string" ? { kind: "accepted" } : { kind: "rejected" };
  } catch {
    return { kind: "rejected" };
  }
}
