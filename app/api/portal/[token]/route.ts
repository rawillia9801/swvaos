import { getPuppyPortal } from "../../../../db/contracts";
import { syncPuppyJourneyMilestones } from "../../../../lib/puppy-journey";

export const dynamic = "force-dynamic";

const milestoneNames: Record<string, string> = {
  "eyes-opening": "Eyes beginning to open",
  "eyes-open": "Eyes open and adjusting",
  "early-socialization": "Early socialization begins",
  exploration: "Exploration and confidence milestone",
  "social-skills": "Social skills are developing",
  "go-home-foundation": "Go-home foundation work",
};

function cleanUpdateTitle(value: string) {
  const match = value.match(/^\[Automatic milestone:([^\]]+)\]\s*(.*)$/i);
  if (!match) return value;
  const key = match[1].trim().toLowerCase();
  const puppyName = match[2].trim();
  if (key.startsWith("deworm")) return "Dewormed";
  const friendly = milestoneNames[key] || "Puppy milestone";
  return puppyName ? `${friendly} — ${puppyName}` : friendly;
}

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
        title: cleanUpdateTitle(update.title),
      })),
    };

    return Response.json(cleanedPortal, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the puppy portal." }, { status: 500 });
  }
}
