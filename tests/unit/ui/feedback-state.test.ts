import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WorkspaceError from "@/app/(protected)/(workspace)/error";
import WorkspaceLoading from "@/app/(protected)/(workspace)/loading";
import { FeedbackState } from "@/components/ui/feedback-state";

describe("workspace feedback states", () => {
  it("renders an empty state with a specific title and description", () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackState, {
        kind: "empty",
        title: "Nenhuma meta ainda.",
        description: "Crie uma meta para acompanhar seu progresso.",
      }),
    );

    expect(html).toContain("Nenhuma meta ainda.");
    expect(html).toContain("Crie uma meta para acompanhar seu progresso.");
    expect(html).toContain('data-feedback="empty"');
    expect(html).not.toContain('role="alert"');
  });

  it("announces the loading state without inventing financial values", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceLoading));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Carregando esta área…");
    expect(html).not.toMatch(/R\$|saldo|valor/i);
  });

  it("keeps unexpected errors generic and offers recovery", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceError, {
        error: new Error("Saldo privado R$ 9.999,99"),
        reset: vi.fn(),
      }),
    );

    expect(html).toContain("Não foi possível carregar esta área.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("Saldo privado");
    expect(html).not.toContain("9.999,99");
  });
});
