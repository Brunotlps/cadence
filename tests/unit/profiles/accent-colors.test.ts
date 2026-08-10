import { describe, expect, it } from "vitest";
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  isAccentColor,
  validateAccentColor,
} from "@/lib/profiles/accent-colors";

describe("domínio da cor de destaque", () => {
  it("mantém somente as três opções fechadas com rótulos em português", () => {
    expect(ACCENT_COLORS).toEqual([
      { value: "preto", label: "Preto" },
      { value: "rosa", label: "Rosa" },
      { value: "verde", label: "Verde" },
    ]);
  });

  it("usa verde como default para perfis existentes e novos", () => {
    expect(DEFAULT_ACCENT_COLOR).toBe("verde");
  });

  it.each(["preto", "rosa", "verde"])(
    "reconhece %s como código persistido",
    (value) => {
      expect(isAccentColor(value)).toBe(true);
      expect(validateAccentColor(value)).toEqual({
        success: true,
        data: value,
      });
    },
  );

  it.each([null, undefined, "", "azul", 42])(
    "rejeita valor fora do domínio sem ecoar o input: %s",
    (value) => {
      const result = validateAccentColor(value);

      expect(result).toEqual({
        success: false,
        fieldErrors: {
          accentColor: "Selecione uma cor de destaque válida.",
        },
      });
      if (String(value).length > 0) {
        expect(JSON.stringify(result)).not.toContain(String(value));
      }
    },
  );
});
