import { requireAdminSession } from "../../../../lib/admin-session";
import { getBuyerMilestoneConfig, saveBuyerMilestoneConfig } from "../../../../lib/milestone-config";

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await getBuyerMilestoneConfig(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load buyer milestones." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await saveBuyerMilestoneConfig(await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save buyer milestones." }, { status: 400 });
  }
}
