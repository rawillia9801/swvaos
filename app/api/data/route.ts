import { isResource, type ResourceInput } from "../../../db/resources";
import { createSupabaseResource, deleteSupabaseResource, getKennelDataFromSupabase, updateSupabaseResource } from "../../../db/supabase-kennel";

export async function GET() {
  try {
    return Response.json(await getKennelDataFromSupabase());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load kennel data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { resource?: unknown; data?: ResourceInput };
    if (!isResource(body.resource) || !body.data) return Response.json({ error: "A valid resource and data are required." }, { status: 400 });
    return Response.json(await createSupabaseResource(body.resource, body.data), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save the record." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { resource?: unknown; id?: unknown; data?: ResourceInput };
    const id = Number(body.id);
    if (!isResource(body.resource) || !Number.isInteger(id) || !body.data) return Response.json({ error: "A valid resource, id, and data are required." }, { status: 400 });
    return Response.json(await updateSupabaseResource(body.resource, id, body.data));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update the record." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
