"use server";

import { revalidatePath } from "next/cache";
import { validateAccentColor } from "@/lib/profiles/accent-colors";
import { updateProfileAccentColor } from "@/lib/profiles/repository";
import { createClient } from "@/lib/supabase/server";

const SAVE_ACCENT_COLOR_ERROR =
  "Não foi possível salvar a cor de destaque.";

export type AccentColorActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
};

function failure(
  error: string,
  fieldErrors: Record<string, string> = {},
): AccentColorActionState {
  return { error, fieldErrors, success: false };
}

export async function updateAccentColorAction(
  _prevState: AccentColorActionState,
  formData: FormData,
): Promise<AccentColorActionState> {
  const validation = validateAccentColor(formData.get("accentColor"));
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return failure(SAVE_ACCENT_COLOR_ERROR);

  const result = await updateProfileAccentColor(supabase, {
    userId: user.id,
    accentColor: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_ACCENT_COLOR_ERROR);

  revalidatePath("/", "layout");
  return { error: null, fieldErrors: {}, success: true };
}
