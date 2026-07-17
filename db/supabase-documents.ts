import { getSupabaseConfig, supabaseRequest } from "./supabase";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const buyerDocumentTypes = new Set(["Bill of Sale", "Health Guarantee", "Payment Plan Agreement", "Other"]);
const dogDocumentTypes = new Set(["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Medical Documentation", "Other"]);
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type DocumentRecord = Record<string, unknown> & {
  id: number;
  object_key: string;
  file_name: string;
  content_type: string;
};

const positiveId = (value: FormDataEntryValue | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const safeText = (value: FormDataEntryValue | null, fallback = "") =>
  String(value ?? fallback).trim();

function selectedPuppyIds(form: FormData) {
  return [...new Set(form.getAll("puppy_ids").flatMap((value) => String(value).split(",")).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function safeFileName(value: string, fallback: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150) || fallback;
}

function contentTypeFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = contentTypesByExtension[extension];
  const supplied = file.type.toLowerCase();
  if (!inferred || (supplied && supplied !== inferred && supplied !== "application/octet-stream")) {
    throw new Error("Upload a PDF, JPG, PNG, or WebP document.");
  }
  return inferred;
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const payload = await response.text();
  const json = payload ? JSON.parse(payload) : null;
  if (!response.ok) throw new Error(json?.message ?? json?.error ?? "Supabase request failed.");
  return json as T;
}

async function first<T>(table: string, query: string) {
  const rows = await jsonRequest<T[]>(`rest/v1/${table}?${query}&limit=1`);
  return rows[0] ?? null;
}

async function insertDocument(table: "buyer_documents" | "dog_documents", row: Record<string, unknown>) {
  const rows = await jsonRequest<DocumentRecord[]>(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  return rows[0];
}

async function uploadObject(objectKey: string, file: File, contentType: string) {
  const { storageBucket } = getSupabaseConfig();
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-upsert": "false",
    },
    body: file.stream(),
    // Required by Node fetch when streaming a request body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to upload the document.");
  }
}

async function deleteObject(objectKey: string) {
  const { storageBucket } = getSupabaseConfig();
  await jsonRequest(`storage/v1/object/${storageBucket}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [objectKey] }),
  });
}

async function downloadObject(objectKey: string) {
  const { storageBucket } = getSupabaseConfig();
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response;
}

async function deleteDocument(table: "buyer_documents" | "dog_documents", documentId: number) {
  const document = await first<DocumentRecord>(table, `select=*&id=eq.${documentId}`);
  if (!document) throw new Error("Document not found.");
  await jsonRequest(`rest/v1/${table}?id=eq.${documentId}`, { method: "DELETE" });
  await deleteObject(document.object_key);
}

export async function uploadBuyerDocumentToSupabase(form: FormData) {
  const buyerId = positiveId(form.get("buyer_id"));
  const paymentPlanId = positiveId(form.get("payment_plan_id"));
  const puppyIds = selectedPuppyIds(form);
  const documentType = safeText(form.get("document_type"));
  const file = form.get("file");
  if (!buyerId) throw new Error("A buyer is required.");
  if (!buyerDocumentTypes.has(documentType)) throw new Error("Choose a valid document type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a scanned document to upload.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Documents must be 20 MB or smaller.");

  const contentType = contentTypeFor(file);
  const fileName = safeFileName(file.name, "scanned-document");
  const title = (safeText(form.get("title")) || documentType).slice(0, 160);
  const notes = safeText(form.get("notes")).slice(0, 2000) || null;
  const objectKey = `buyers/${buyerId}/${crypto.randomUUID()}-${fileName}`;
  const now = new Date().toISOString();
  await uploadObject(objectKey, file, contentType);
  try {
    const document = await insertDocument("buyer_documents", { buyer_id: buyerId, payment_plan_id: paymentPlanId, document_type: documentType, title, object_key: objectKey, file_name: fileName, content_type: contentType, size_bytes: file.size, notes, created_at: now, updated_at: now });
    for (const puppyId of puppyIds) {
      await jsonRequest("rest/v1/buyer_document_puppies", {
        method: "POST",
        body: JSON.stringify({ document_id: document.id, puppy_id: puppyId }),
      });
    }
    return { ...document, puppy_ids: puppyIds };
  } catch (error) {
    await deleteObject(objectKey);
    throw error;
  }
}

export async function uploadDogDocumentToSupabase(form: FormData) {
  const dogId = positiveId(form.get("dog_id"));
  const registrationId = positiveId(form.get("registration_id"));
  const documentType = safeText(form.get("document_type"));
  const file = form.get("file");
  if (!dogId) throw new Error("A breeding dog is required.");
  if (!dogDocumentTypes.has(documentType)) throw new Error("Choose a valid document type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a scanned document to upload.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Documents must be 20 MB or smaller.");

  const contentType = contentTypeFor(file);
  const fileName = safeFileName(file.name, "dog-document");
  const registry = safeText(form.get("registry")).slice(0, 100) || null;
  const registrationNumber = safeText(form.get("registration_number")).slice(0, 100) || null;
  const title = (safeText(form.get("title")) || [registry, documentType].filter(Boolean).join(" ")).slice(0, 160);
  const notes = safeText(form.get("notes")).slice(0, 2000) || null;
  const objectKey = `dogs/${dogId}/${crypto.randomUUID()}-${fileName}`;
  const now = new Date().toISOString();
  await uploadObject(objectKey, file, contentType);
  try {
    return await insertDocument("dog_documents", { dog_id: dogId, registration_id: registrationId, document_type: documentType, registry, registration_number: registrationNumber, title, object_key: objectKey, file_name: fileName, content_type: contentType, size_bytes: file.size, notes, created_at: now, updated_at: now });
  } catch (error) {
    await deleteObject(objectKey);
    throw error;
  }
}

export const deleteBuyerDocumentFromSupabase = (documentId: number) =>
  deleteDocument("buyer_documents", documentId);

export const deleteDogDocumentFromSupabase = (documentId: number) =>
  deleteDocument("dog_documents", documentId);

export async function getBuyerDocumentFromSupabase(documentId: number) {
  const document = await first<DocumentRecord>("buyer_documents", `select=*&id=eq.${documentId}`);
  if (!document) return null;
  const object = await downloadObject(document.object_key);
  return object ? { document, object } : null;
}

export async function getDogDocumentFromSupabase(documentId: number) {
  const document = await first<DocumentRecord>("dog_documents", `select=*&id=eq.${documentId}`);
  if (!document) return null;
  const object = await downloadObject(document.object_key);
  return object ? { document, object } : null;
}
