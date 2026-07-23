import { isResource, ResourceValidationError, type ResourceInput } from "../../../db/resources";
import { createSupabaseResource, deleteSupabaseResource, getKennelDataFromSupabase, updateSupabaseResource } from "../../../db/supabase-kennel";
import { requireAdminSession } from "../../../lib/admin-session";
import { sendBuyerAutomation, sendPublishedUpdate, sendTransactionReceipt } from "../../../lib/automation-email";

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
    return Response.json(await getKennelDataFromSupabase());
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
    } catch (emailError) {
      console.error("Automatic email failed after record creation", emailError instanceof Error ? emailError.message : emailError);
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
    } catch (emailError) {
      console.error("Automatic email failed after record update", emailError instanceof Error ? emailError.message : emailError);
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
