import { getBuyerDocumentFromSupabase } from "../../../../db/supabase-documents";

export async function GET(request: Request) {
  const documentId = Number(new URL(request.url).pathname.split("/").filter(Boolean).pop());
  if (!Number.isInteger(documentId) || documentId <= 0) return Response.json({ error: "A valid document is required." }, { status: 400 });

  const result = await getBuyerDocumentFromSupabase(documentId);
  if (!result) return Response.json({ error: "Document not found." }, { status: 404 });

  const headers = new Headers();
  headers.set("content-type", result.document.content_type);
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(result.document.file_name)}`);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(result.object.body, { headers });
}
