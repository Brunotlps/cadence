export const APP_DESTINATIONS = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "goals", href: "/goals", label: "Metas" },
  { id: "fixed-bills", href: "/fixed-bills", label: "Fixas" },
] as const;

export type AppDestination = (typeof APP_DESTINATIONS)[number]["id"];

function isRouteOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function getActiveAppDestination(
  pathname: string,
): AppDestination | null {
  if (pathname === "/dashboard" || pathname.startsWith("/transactions/")) {
    return "dashboard";
  }

  if (
    isRouteOrChild(pathname, "/goals") ||
    pathname.startsWith("/contributions/")
  ) {
    return "goals";
  }

  if (
    isRouteOrChild(pathname, "/fixed-bills") ||
    pathname.startsWith("/bill-payments/")
  ) {
    return "fixed-bills";
  }

  return null;
}
