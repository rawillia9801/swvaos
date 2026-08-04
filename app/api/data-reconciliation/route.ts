import { requireAdminSession } from "../../../lib/admin-session";
import { reconcileSupabaseData } from "../../../lib/data-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const summary = await reconcileSupabaseData({ apply: false });
    return Response.json(summary, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to review the connected records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const summary = await reconcileSupabaseData({ apply: true });
    return Response.json(summary, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to reconcile the connected records." }, { status: 500 });
  }
}
