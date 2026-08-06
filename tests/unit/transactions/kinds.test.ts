import { describe, expect, it } from "vitest";
import { TRANSACTION_KINDS } from "@/lib/transactions/kinds";

describe("tipos de lançamento", () => {
  it("espelha exatamente o domínio protegido pela constraint do banco", () => {
    expect(TRANSACTION_KINDS).toEqual([
      "expense",
      "income",
      "contribution",
    ]);
  });
});
