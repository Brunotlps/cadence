import { describe, expect, it } from "vitest";
import {
  countCivilDaysBetween,
  DUE_SOON_WINDOW_DAYS,
  resolveDueDate,
} from "@/lib/fixed-bills/due-date";

describe("resolveDueDate", () => {
  it("mapeia o dia de vencimento para o mês civil informado", () => {
    expect(resolveDueDate(5, "2026-08")).toBe("2026-08-05");
    expect(resolveDueDate(1, "2026-08")).toBe("2026-08-01");
    expect(resolveDueDate(31, "2026-01")).toBe("2026-01-31");
  });

  it("ajusta o vencimento ao último dia de meses curtos", () => {
    expect(resolveDueDate(31, "2026-02")).toBe("2026-02-28");
    expect(resolveDueDate(31, "2024-02")).toBe("2024-02-29");
    expect(resolveDueDate(30, "2026-02")).toBe("2026-02-28");
    expect(resolveDueDate(31, "2026-04")).toBe("2026-04-30");
  });

  it.each([0, 32, 5.5, -1, Number.NaN])(
    "rejeita dia de vencimento fora da faixa 1–31 (%s)",
    (dueDay) => {
      expect(() => resolveDueDate(dueDay, "2026-08")).toThrow(RangeError);
    },
  );

  it.each(["2026-13", "2026-8", "2026-08-01", "abc", ""])(
    "rejeita mês inválido (%s)",
    (month) => {
      expect(() => resolveDueDate(5, month)).toThrow(RangeError);
    },
  );
});

describe("countCivilDaysBetween", () => {
  it("conta dias civis com sinal, sem depender de fuso", () => {
    expect(countCivilDaysBetween("2026-08-10", "2026-08-15")).toBe(5);
    expect(countCivilDaysBetween("2026-08-15", "2026-08-10")).toBe(-5);
    expect(countCivilDaysBetween("2026-08-10", "2026-08-10")).toBe(0);
  });

  it("atravessa mês, ano e dia bissexto", () => {
    expect(countCivilDaysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(countCivilDaysBetween("2024-02-27", "2024-03-01")).toBe(3);
    expect(countCivilDaysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });

  it.each(["2026-02-30", "2026-8-1", "abc", ""])(
    "rejeita data civil inválida (%s)",
    (value) => {
      expect(() => countCivilDaysBetween("2026-08-10", value)).toThrow(
        RangeError,
      );
      expect(() => countCivilDaysBetween(value, "2026-08-10")).toThrow(
        RangeError,
      );
    },
  );
});

describe("DUE_SOON_WINDOW_DAYS", () => {
  it("fixa a janela de aviso da decisão 8 em 5 dias", () => {
    expect(DUE_SOON_WINDOW_DAYS).toBe(5);
  });
});
