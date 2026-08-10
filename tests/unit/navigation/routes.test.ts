import { describe, expect, it } from "vitest";
import {
  APP_DESTINATIONS,
  getActiveAppDestination,
} from "@/lib/navigation/routes";

describe("destinos da navegação persistente", () => {
  it("mantém exatamente as três rotas aprovadas", () => {
    expect(APP_DESTINATIONS).toEqual([
      { id: "dashboard", href: "/dashboard", label: "Dashboard" },
      { id: "goals", href: "/goals", label: "Metas" },
      { id: "fixed-bills", href: "/fixed-bills", label: "Fixas" },
    ]);
    expect(APP_DESTINATIONS).toHaveLength(3);
    expect(APP_DESTINATIONS.map(({ href }) => href)).not.toContain(
      "/transactions",
    );
  });

  it.each([
    ["/dashboard", "dashboard"],
    ["/transactions/11111111-1111-4111-8111-111111111111/edit", "dashboard"],
    ["/goals", "goals"],
    ["/goals/11111111-1111-4111-8111-111111111111/edit", "goals"],
    ["/contributions/11111111-1111-4111-8111-111111111111/edit", "goals"],
    ["/fixed-bills", "fixed-bills"],
    [
      "/fixed-bills/11111111-1111-4111-8111-111111111111/edit",
      "fixed-bills",
    ],
    [
      "/bill-payments/11111111-1111-4111-8111-111111111111/edit",
      "fixed-bills",
    ],
  ])("mapeia %s para %s", (pathname, destination) => {
    expect(getActiveAppDestination(pathname)).toBe(destination);
  });

  it.each([
    "/",
    "/login",
    "/onboarding/workspace",
    "/goals-archive",
    "/fixed-bills-preview",
    "/transactions",
  ])("não ativa destino fora do shell: %s", (pathname) => {
    expect(getActiveAppDestination(pathname)).toBeNull();
  });
});
