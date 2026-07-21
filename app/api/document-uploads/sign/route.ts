import { createSignedDocumentUpload } from "../../../../db/supabase-documents";
import { requireAdminSession } from "../../../../lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = body.kind === "buyer" ? "buyer" : body.kind === "dog" ? "dog" : null;
    if (!kind) return Response.json({ error: "Choose a valid document owner." }, { status: 400 });
    return Response.json(await createSignedDocumentUpload({ kind, ownerId: Number(body.ownerId), fileName: String(body.fileName ?? ""), contentType: String(body.contentType ?? ""), sizeBytes: Number(body.sizeBytes) }), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to prepare the document upload." }, { status: 400 });
  }
}
