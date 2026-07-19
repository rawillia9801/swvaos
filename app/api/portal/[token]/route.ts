import { getPuppyPortal } from "../../../../db/contracts";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const portal = await getPuppyPortal(token);
    if (!portal) return Response.json({ error: "This puppy portal link is invalid or has expired." }, { status: 404 });
    return Response.json(portal, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the puppy portal." }, { status: 500 });
  }
}
