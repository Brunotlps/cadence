import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAccentColor,
  type AccentColor,
} from "@/lib/profiles/accent-colors";

export type ProfileAccentResult = {
  data: AccentColor | null;
  error: "query_failed" | null;
};

type ProfileAccentRow = {
  accent_color: unknown;
};

function normalizeResult(
  data: ProfileAccentRow | null,
  error: unknown,
): ProfileAccentResult {
  if (error) return { data: null, error: "query_failed" };
  if (!data) return { data: null, error: null };
  if (!isAccentColor(data.accent_color)) {
    return { data: null, error: "query_failed" };
  }

  return { data: data.accent_color, error: null };
}

export async function getProfileAccentColor(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileAccentResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("accent_color")
    .eq("id", userId)
    .maybeSingle();

  return normalizeResult(data as ProfileAccentRow | null, error);
}

export async function updateProfileAccentColor(
  supabase: SupabaseClient,
  input: { userId: string; accentColor: AccentColor },
): Promise<ProfileAccentResult> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ accent_color: input.accentColor })
    .eq("id", input.userId)
    .select("accent_color")
    .maybeSingle();

  return normalizeResult(data as ProfileAccentRow | null, error);
}
