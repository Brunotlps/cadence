import { exportUserData } from "@/lib/portability/export";
import { createClient } from "@/lib/supabase/server";

const EXPORT_FILENAME = "cadence-data-export.json";

export async function GET(_request?: Request) {
  void _request;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const result = await exportUserData(supabase, user.id);
  if (result.error) {
    return Response.json({ error: "export_unavailable" }, { status: 500 });
  }

  return new Response(JSON.stringify(result.data), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
