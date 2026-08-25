"use server";

import { deliverFeedback } from "@/lib/feedback/resend-delivery";
import { validateFeedbackInput } from "@/lib/feedback/validate-feedback";
import { createClient } from "@/lib/supabase/server";

const SUBMISSION_ERROR = "Não foi possível enviar o feedback agora.";

export type FeedbackActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
  retrySubmissionKey?: string;
};

function failure(
  error: string,
  fieldErrors: Record<string, string> = {},
  retrySubmissionKey?: string,
): FeedbackActionState {
  return { error, fieldErrors, success: false, ...(retrySubmissionKey && { retrySubmissionKey }) };
}

function formValue(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" ? value : null;
}

export async function submitFeedbackAction(
  _previousState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  void _previousState;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return failure(SUBMISSION_ERROR);

  const validation = validateFeedbackInput({
    type: formValue(formData, "type"),
    message: formValue(formData, "message"),
    pathname: formValue(formData, "pathname"),
    allowFollowUp: formValue(formData, "allowFollowUp"),
    submissionKey: formValue(formData, "submissionKey"),
  });
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const { data: allowed, error: limitError } = await supabase.rpc(
    "consume_feedback_submission_limit",
  );
  if (limitError || !allowed) return failure(SUBMISSION_ERROR);

  const { allowFollowUp, ...deliveryInput } = validation.data;
  const delivery = await deliverFeedback({
    ...deliveryInput,
    replyTo: allowFollowUp ? user.email ?? null : null,
  });
  if (delivery.kind === "accepted") {
    return { error: null, fieldErrors: {}, success: true };
  }
  if (delivery.kind === "ambiguous") {
    return failure(SUBMISSION_ERROR, {}, validation.data.submissionKey);
  }
  return failure(SUBMISSION_ERROR);
}
