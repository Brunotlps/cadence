type SupabaseProjectIdentity =
  | { kind: "hosted"; projectRef: string }
  | { kind: "local" };

type SupabaseProjectEnvironment = {
  supabaseUrl?: string;
  directUrl?: string;
  databaseUrl?: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function parseUrl(value: string, variableName: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(
      `Cannot validate ${variableName}: expected a valid URL.`,
    );
  }
}

function normalizedHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

function hostedIdentity(projectRef: string): SupabaseProjectIdentity {
  if (!/^[a-z0-9]+$/i.test(projectRef)) {
    throw new Error("Invalid Supabase project reference.");
  }

  return { kind: "hosted", projectRef: projectRef.toLowerCase() };
}

function unsupportedUrl(variableName: string): never {
  throw new Error(
    `Cannot determine the Supabase project from ${variableName}. ` +
      "Use an official Supabase hosted URL or a local loopback URL.",
  );
}

export function getSupabaseApiIdentity(
  value: string,
  variableName = "NEXT_PUBLIC_SUPABASE_URL",
): SupabaseProjectIdentity {
  const url = parseUrl(value, variableName);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return unsupportedUrl(variableName);
  }

  const hostname = normalizedHostname(url);
  if (isLocalHost(hostname)) return { kind: "local" };

  const match = hostname.match(/^([^.]+)\.supabase\.co$/);
  if (!match) return unsupportedUrl(variableName);

  return hostedIdentity(match[1]);
}

export function getSupabaseDatabaseIdentity(
  value: string,
  variableName: string,
): SupabaseProjectIdentity {
  const url = parseUrl(value, variableName);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return unsupportedUrl(variableName);
  }

  const hostname = normalizedHostname(url);
  if (isLocalHost(hostname)) return { kind: "local" };

  const directMatch = hostname.match(/^db\.([^.]+)\.supabase\.co$/);
  if (directMatch) return hostedIdentity(directMatch[1]);

  if (hostname.endsWith(".pooler.supabase.com")) {
    let username: string;
    try {
      username = decodeURIComponent(url.username);
    } catch {
      return unsupportedUrl(variableName);
    }

    const separatorIndex = username.lastIndexOf(".");
    if (separatorIndex <= 0 || separatorIndex === username.length - 1) {
      return unsupportedUrl(variableName);
    }

    return hostedIdentity(username.slice(separatorIndex + 1));
  }

  return unsupportedUrl(variableName);
}

function identityLabel(identity: SupabaseProjectIdentity): string {
  return identity.kind === "local"
    ? "local Supabase"
    : `project ${identity.projectRef}`;
}

function identitiesMatch(
  left: SupabaseProjectIdentity,
  right: SupabaseProjectIdentity,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "local" && right.kind === "local") return true;
  return (
    left.kind === "hosted" &&
    right.kind === "hosted" &&
    left.projectRef === right.projectRef
  );
}

export function assertSupabaseProjectConsistency({
  supabaseUrl,
  directUrl,
  databaseUrl,
}: SupabaseProjectEnvironment): void {
  const databaseUrls = [
    ["DIRECT_URL", directUrl],
    ["DATABASE_URL", databaseUrl],
  ] as const;
  const configuredDatabaseUrls = databaseUrls.filter(([, value]) =>
    Boolean(value?.trim()),
  );

  if (configuredDatabaseUrls.length === 0) return;
  if (!supabaseUrl?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required to verify the Supabase project " +
        "used by database connections.",
    );
  }

  const apiIdentity = getSupabaseApiIdentity(supabaseUrl);
  for (const [variableName, value] of configuredDatabaseUrls) {
    const databaseIdentity = getSupabaseDatabaseIdentity(value!, variableName);
    if (!identitiesMatch(apiIdentity, databaseIdentity)) {
      throw new Error(
        `Supabase project mismatch: NEXT_PUBLIC_SUPABASE_URL targets ${identityLabel(apiIdentity)}, ` +
          `but ${variableName} targets ${identityLabel(databaseIdentity)}.`,
      );
    }
  }
}
