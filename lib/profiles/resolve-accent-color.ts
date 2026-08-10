import {
  DEFAULT_ACCENT_COLOR,
  type AccentColor,
} from "@/lib/profiles/accent-colors";
import type { ProfileAccentResult } from "@/lib/profiles/repository";

type AccentFallbackReason = "profile_missing" | "query_failed";

export type AccentFallbackLogger = (
  event: "profile_accent_fallback",
  context: { reason: AccentFallbackReason },
) => void;

const serverLogger: AccentFallbackLogger = (event, context) => {
  console.error(event, context);
};

export function resolveProfileAccentColor(
  result: ProfileAccentResult,
  logger: AccentFallbackLogger = serverLogger,
): AccentColor {
  if (result.data) return result.data;

  logger("profile_accent_fallback", {
    reason: result.error ?? "profile_missing",
  });
  return DEFAULT_ACCENT_COLOR;
}
