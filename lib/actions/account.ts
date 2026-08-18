"use server";

import { redirect } from "next/navigation";
import { deleteAccount } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DELETE_ACCOUNT_ERROR = "Não foi possível excluir sua conta.";
const CONFIRMATION_TEXT = "EXCLUIR";

export type DeleteOwnAccountActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
};

function failure(
  error: string,
  fieldErrors: Record<string, string> = {},
): DeleteOwnAccountActionState {
  return { error, fieldErrors, success: false };
}

export async function deleteOwnAccountAction(
  _prevState: DeleteOwnAccountActionState,
  formData: FormData,
): Promise<DeleteOwnAccountActionState> {
  void _prevState;

  if (formData.get("confirmation")?.toString() !== CONFIRMATION_TEXT) {
    return failure("Revise os campos destacados.", {
      confirmation: "Digite EXCLUIR para confirmar.",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return failure(DELETE_ACCOUNT_ERROR);

  try {
    await deleteAccount(user.id);
  } catch {
    return failure(DELETE_ACCOUNT_ERROR);
  }

  redirect("/login");
}
