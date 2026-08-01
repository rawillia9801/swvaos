import { uploadBuyerDocumentToSupabase } from "../../../../../../db/supabase-documents";
import { sendOwnerNotification } from "../../../../../../lib/email-service";
import { verifyPortalToken } from "../../../../../../lib/portal-token";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const claims = await verifyPortalToken(token);
    if (!claims) return Response.json({ error: "Your Puppy Portal session is invalid or has expired." }, { status: 401 });

    const incoming = await request.formData();
    const form = new FormData();
    const file = incoming.get("file");
    const title = String(incoming.get("title") ?? "Family document").trim().slice(0, 160) || "Family document";
    const category = String(incoming.get("category") ?? "Other").trim().slice(0, 80) || "Other";
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a document to upload." }, { status: 400 });

    form.set("buyer_id", String(claims.buyerId));
    form.set("document_type", "Other");
    form.set("title", title);
    form.set("notes", `[Family upload]\nCategory: ${category}\nSubmitted through Puppy Portal.`);
    form.set("file", file);

    const document = await uploadBuyerDocumentToSupabase(form);
    try {
      await sendOwnerNotification({
        category: "Document",
        subject: `Family document uploaded: ${title}`,
        buyerId: claims.buyerId,
        body: [
          "A family uploaded a document through the Puppy Portal.",
          "",
          `Title: ${title}`,
          `Category: ${category}`,
          `File name: ${String((document as Record<string, unknown>).file_name || file.name)}`,
          `Buyer ID: ${claims.buyerId}`,
          "",
          "Review it in SWVAOS:",
          "https://swvaos.site/?view=Vault",
        ].join("\n"),
      });
    } catch (emailError) {
      console.error("Owner family-document notification failed", emailError instanceof Error ? emailError.message : emailError);
    }

    return Response.json(document, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload the document." }, { status: 400 });
  }
}
