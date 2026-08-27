const FALLBACK_INITIALS = "?";

export function getMemberInitials(displayName: string | null): string {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (words.length === 0) return FALLBACK_INITIALS;

  const firstInitial = words[0]![0]!;
  const lastInitial = words[words.length - 1]![0]!;

  return `${firstInitial}${words.length > 1 ? lastInitial : ""}`.toUpperCase();
}
