import { getPortalDocument } from "../../../../../../db/contracts";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) return Response.json({ error: "A valid document is required." }, { status: 400 });
  const result = await getPortalDocument(token, documentId);
  if (!result) return Response.json({ error: "Document not found." }, { status: 404 });
  const headers = new Headers({
    "content-type": result.document.content_type,
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(result.document.file_name)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(result.object.body, { headers });
}
