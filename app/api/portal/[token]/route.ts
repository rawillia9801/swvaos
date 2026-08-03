import { getPuppyPortal } from "../../../../db/contracts";
import { cleanManagedMilestoneTitle, syncPuppyJourneyMilestones } from "../../../../lib/puppy-journey";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    let portal = await getPuppyPortal(token);
    if (!portal) return Response.json({ error: "This puppy portal link is invalid or has expired." }, { status: 404 });

    await syncPuppyJourneyMilestones(Number(portal.buyer.id));
    portal = await getPuppyPortal(token);

    if (!portal) return Response.json({ error: "This puppy portal link is invalid or has expired." }, { status: 404 });

    const cleanedPortal = {
      ...portal,
      updates: portal.updates.map((update) => ({
        ...update,
        title: cleanManagedMilestoneTitle(update.title),
      })),
    };

    return Response.json(cleanedPortal, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the puppy portal." }, { status: 500 });
  }
}
