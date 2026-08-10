export const ACCENT_COLORS = [
  { value: "preto", label: "Preto" },
  { value: "rosa", label: "Rosa" },
  { value: "verde", label: "Verde" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]["value"];

export const DEFAULT_ACCENT_COLOR: AccentColor = "verde";

export function isAccentColor(value: unknown): value is AccentColor {
  return ACCENT_COLORS.some((option) => option.value === value);
}

export type AccentColorValidationResult =
  | { success: true; data: AccentColor }
  | {
      success: false;
      fieldErrors: { accentColor: string };
    };

export function validateAccentColor(
  value: unknown,
): AccentColorValidationResult {
  if (!isAccentColor(value)) {
    return {
      success: false,
      fieldErrors: {
        accentColor: "Selecione uma cor de destaque válida.",
      },
    };
  }

  return { success: true, data: value };
}
