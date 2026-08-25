import { describe, expect, it } from "vitest";
import { normalizeFeedbackPathname } from "@/lib/feedback/normalize-feedback-pathname";
import { validateFeedbackInput } from "@/lib/feedback/validate-feedback";

const submissionKey = "b7e9f814-5d91-49b7-92b8-80d6523fc4e1";

describe("validateFeedbackInput", () => {
  it("accepts the closed type set and trims a valid message", () => {
    expect(
      validateFeedbackInput({
        type: "bug",
        message: "  O saldo não atualiza.  ",
        pathname: "/goals/0e5d0a94-b7d9-4f25-a2f6-3c76b8784c27/edit",
        allowFollowUp: "on",
        submissionKey,
      }),
    ).toEqual({
      success: true,
      data: {
        type: "bug",
        message: "O saldo não atualiza.",
        pathname: "/goals/[id]/edit",
        allowFollowUp: true,
        submissionKey,
      },
    });
  });

  it("rejects unknown types, whitespace messages, non-UUID keys, and implicit follow-up", () => {
    expect(
      validateFeedbackInput({
        type: "other",
        message: "   ",
        pathname: "/dashboard",
        allowFollowUp: "yes",
        submissionKey: "not-a-uuid",
      }),
    ).toEqual({
      success: false,
      fieldErrors: {
        type: "Selecione um tipo de feedback válido.",
        message: "Descreva seu feedback.",
        allowFollowUp: "Escolha de contato inválida.",
        submissionKey: "Não foi possível preparar o envio. Tente novamente.",
      },
    });
  });

  it("accepts exactly 5,000 characters and rejects longer messages", () => {
    const base = {
      type: "suggestion",
      pathname: "/dashboard",
      allowFollowUp: null,
      submissionKey,
    };

    expect(
      validateFeedbackInput({ ...base, message: "a".repeat(5000) }).success,
    ).toBe(true);
    expect(
      validateFeedbackInput({ ...base, message: "a".repeat(5001) }),
    ).toEqual({
      success: false,
      fieldErrors: { message: "Use no máximo 5.000 caracteres." },
    });
  });
});

describe("normalizeFeedbackPathname", () => {
  it("reduces approved dynamic protected routes to templates", () => {
    expect(normalizeFeedbackPathname("/transactions/abc/edit")).toBe(
      "/transactions/[id]/edit",
    );
    expect(normalizeFeedbackPathname("/join/opaque-token")).toBe(
      "/join/[token]",
    );
  });

  it("drops URLs, query strings, fragments, and arbitrary paths", () => {
    expect(normalizeFeedbackPathname("https://example.test/dashboard")).toBeNull();
    expect(normalizeFeedbackPathname("/dashboard?month=2026-08")).toBeNull();
    expect(normalizeFeedbackPathname("/dashboard#summary")).toBeNull();
    expect(normalizeFeedbackPathname("/not-a-route")).toBeNull();
  });
});
