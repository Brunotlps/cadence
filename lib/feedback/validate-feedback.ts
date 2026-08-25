import { normalizeFeedbackPathname } from "./normalize-feedback-pathname";

export type FeedbackType = "bug" | "suggestion";

export type ValidFeedbackInput = {
  type: FeedbackType;
  message: string;
  pathname: string | null;
  allowFollowUp: boolean;
  submissionKey: string;
};

type ValidationSuccess = { success: true; data: ValidFeedbackInput };
type ValidationFailure = {
  success: false;
  fieldErrors: Record<string, string>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function validateFeedbackInput(input: Record<string, unknown>):
  | ValidationSuccess
  | ValidationFailure {
  const fieldErrors: Record<string, string> = {};
  const rawType = asString(input.type);
  const rawMessage = asString(input.message);
  const rawFollowUp = asString(input.allowFollowUp);
  const submissionKey = asString(input.submissionKey);
  const message = rawMessage?.trim() ?? "";

  if (rawType !== "bug" && rawType !== "suggestion") {
    fieldErrors.type = "Selecione um tipo de feedback válido.";
  }
  if (!message) {
    fieldErrors.message = "Descreva seu feedback.";
  } else if (message.length > 5000) {
    fieldErrors.message = "Use no máximo 5.000 caracteres.";
  }
  if (rawFollowUp !== "on" && rawFollowUp !== null) {
    fieldErrors.allowFollowUp = "Escolha de contato inválida.";
  }
  if (!submissionKey || !UUID_PATTERN.test(submissionKey)) {
    fieldErrors.submissionKey = "Não foi possível preparar o envio. Tente novamente.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      type: rawType as FeedbackType,
      message,
      pathname: normalizeFeedbackPathname(input.pathname),
      allowFollowUp: rawFollowUp === "on",
      submissionKey: submissionKey as string,
    },
  };
}
