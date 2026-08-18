import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redeemWorkspaceInviteAction: vi.fn(),
}));

vi.mock("@/lib/actions/workspace", () => ({
  redeemWorkspaceInviteAction: mocks.redeemWorkspaceInviteAction,
}));

import JoinPage from "@/app/(protected)/join/[token]/page";

describe("GET /join/[token]", () => {
  it("renderiza confirmação sem resgatar o convite", async () => {
    const token = "22222222-2222-2222-2222-222222222222";
    const page = await JoinPage({
      params: Promise.resolve({ token }),
    });

    const html = renderToStaticMarkup(page);

    expect(mocks.redeemWorkspaceInviteAction).not.toHaveBeenCalled();
    expect(html).toContain("Confirmar convite");
    expect(html).toContain("O convite só será resgatado depois deste envio.");
    expect(html).toContain('name="token"');
    expect(html).toContain(`value="${token}"`);
  });
});
