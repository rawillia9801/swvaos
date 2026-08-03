import { syncPuppyJourneyMilestones } from "../../../../lib/puppy-journey";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return request.headers.get("user-agent")?.startsWith("vercel-cron/") === true && request.headers.has("x-vercel-cron-schedule");
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return Response.json(await syncPuppyJourneyMilestones());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to synchronize puppy milestones." }, { status: 500 });
  }
}
