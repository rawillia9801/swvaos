import { isResource, ResourceValidationError, type ResourceInput } from "../../../db/resources";
import { createSupabaseResource, deleteSupabaseResource, getKennelDataFromSupabase, updateSupabaseResource } from "../../../db/supabase-kennel";
import { requireAdminSession } from "../../../lib/admin-session";
import { sendBuyerAutomation, sendPublishedUpdate, sendTransactionReceipt } from "../../../lib/automation-email";
import { canonicalizeKennelData } from "../../../lib/canonical-display-data";
import { enrichProfileImages } from "../../../lib/profile-images";
import { syncPuppyJourneyMilestones } from "../../../lib/puppy-journey";
import { recordWeeklyPuppyWeight } from "../../../lib/puppy-weight-log";
import { repairStrictBuyerDuplicatesOnce } from "../../../lib/strict-data-repair";

function writeError(error: unknown, fallback: string) {
  return Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: error instanceof ResourceValidationError ? 400 : 500 },
  );
}

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const strictRepair = await repairStrictBuyerDuplicatesOnce();
    try {
      await syncPuppyJourneyMilestones();
    } catch (milestoneError) {
      console.error("Puppy milestone synchronization failed", milestoneError instanceof Error ? milestoneError.message : milestoneError);
    }
    const rawData = await getKennelDataFromSupabase();
    const data = canonicalizeKennelData(rawData);
    return Response.json({
      ...data,
      dogs: enrichProfileImages(data.dogs),
      puppies: enrichProfileImages(data.puppies),
      reconciliation: null,
      strictRepair,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load kennel data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { resource?: unknown; data?: ResourceInput };
    if (!isResource(body.resource) || !body.data) return Response.json({ error: "A valid resource and data are required." }, { status: 400 });
    const created = await createSupabaseResource(body.resource, body.data);
    try {
      if (body.resource === "buyers" && Number(created.id) > 0) await sendBuyerAutomation("application_received", Number(created.id), { dedupeKey: `buyer-${Number(created.id)}` });
      if (body.resource === "transactions") await sendTransactionReceipt(created);
      if (body.resource === "updates") await sendPublishedUpdate(created, new URL(request.url).origin);
      if (body.resource === "puppies") {
        const weightUpdate = await recordWeeklyPuppyWeight(created);
        if (weightUpdate) await sendPublishedUpdate(weightUpdate, new URL(request.url).origin);
        await syncPuppyJourneyMilestones(Number(created.buyer_id) || null);
      }
    } catch (automationError) {
      console.error("Workflow failed after record creation", automationError instanceof Error ? automationError.message : automationError);
    }
    return Response.json(created, { status: 201 });
  } catch (error) {
    return writeError(error, "Unable to save the record.");
  }
}

export async function PUT(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { resource?: unknown; id?: unknown; data?: ResourceInput };
    const id = Number(body.id);
    if (!isResource(body.resource) || !Number.isInteger(id) || !body.data) return Response.json({ error: "A valid resource, id, and data are required." }, { status: 400 });
    const updated = await updateSupabaseResource(body.resource, id, body.data);
    try {
      if (body.resource === "transactions") await sendTransactionReceipt(updated);
      if (body.resource === "updates") await sendPublishedUpdate(updated, new URL(request.url).origin);
      if (body.resource === "puppies") {
        const weightUpdate = await recordWeeklyPuppyWeight(updated);
        if (weightUpdate) await sendPublishedUpdate(weightUpdate, new URL(request.url).origin);
        await syncPuppyJourneyMilestones(Number(updated.buyer_id) || null);
      }
      if (body.resource === "events" && /deworm|health|care/i.test(`${String(updated.title || "")} ${String(updated.event_type || "")}`)) {
        await syncPuppyJourneyMilestones();
      }
    } catch (automationError) {
      console.error("Workflow failed after record update", automationError instanceof Error ? automationError.message : automationError);
    }
    return Response.json(updated);
  } catch (error) {
    return writeError(error, "Unable to update the record.");
  }
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    const id = Number(url.searchParams.get("id"));
    if (!isResource(resource) || !Number.isInteger(id)) return Response.json({ error: "A valid resource and id are required." }, { status: 400 });
    await deleteSupabaseResource(resource, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete the record." }, { status: 500 });
  }
}
