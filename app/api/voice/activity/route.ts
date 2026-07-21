import { getCallerActivityFromSupabase } from "../../../../db/supabase-kennel";
import { requireAdminSession } from "../../../../lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const events = await getCallerActivityFromSupabase();
    return Response.json(
      { events, synced_at: new Date().toISOString() },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[voice/activity] Unable to load live caller activity", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to refresh live call activity." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
