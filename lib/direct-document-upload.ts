export type DirectDocumentKind = "dog" | "buyer";

type SignedUpload = {
  objectKey: string;
  signedUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

async function responseError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return payload.error || payload.message || fallback;
  } catch {
    return response.status === 413 ? "This file is too large for the upload service." : fallback;
  }
}

export async function uploadDocumentDirect(form: FormData, kind: DirectDocumentKind) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a document to upload.");
  const ownerField = kind === "dog" ? "dog_id" : "buyer_id";
  const ownerId = Number(form.get(ownerField));
  if (!Number.isInteger(ownerId) || ownerId <= 0) throw new Error(kind === "dog" ? "Choose a breeding dog." : "Choose a buyer.");

  const signResponse = await fetch("/api/document-uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, ownerId, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  if (!signResponse.ok) throw new Error(await responseError(signResponse, "Unable to prepare the document upload."));
  const signed = await signResponse.json() as SignedUpload;

  const uploadBody = new FormData();
  uploadBody.append("cacheControl", "3600");
  uploadBody.append("", file);
  const storageResponse = await fetch(signed.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: uploadBody });
  if (!storageResponse.ok) throw new Error(await responseError(storageResponse, "Unable to store the document."));

  const metadata: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key !== "file") metadata[key] = value;
  }
  if (kind === "buyer") metadata.puppy_ids = form.getAll("puppy_ids").map(String);
  Object.assign(metadata, { object_key: signed.objectKey, file_name: signed.fileName, content_type: signed.contentType, size_bytes: signed.sizeBytes });

  const endpoint = kind === "dog" ? "/api/dog-documents" : "/api/documents";
  const finalizeResponse = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metadata) });
  if (!finalizeResponse.ok) throw new Error(await responseError(finalizeResponse, "Unable to save the document record."));
  return finalizeResponse.json();
}
