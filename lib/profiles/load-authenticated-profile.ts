import "server-only";

import { cache } from "react";
import { getProfileAccentColor } from "@/lib/profiles/repository";
import { resolveProfileAccentColor } from "@/lib/profiles/resolve-accent-color";
import { createClient } from "@/lib/supabase/server";

export const loadAuthenticatedProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { status: "unauthenticated" as const };

  const accentResult = await getProfileAccentColor(supabase, user.id);
  return {
    status: "authenticated" as const,
    accentColor: resolveProfileAccentColor(accentResult),
  };
});
