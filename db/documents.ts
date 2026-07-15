import { env } from "cloudflare:workers";
import { ensureDatabase } from "./kennel";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const documentTypes = new Set(["Bill of Sale", "Health Guarantee", "Payment Plan Agreement", "Other"]);
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type DocumentRecord = {
  id: number;
  buyer_id: number;
  payment_plan_id: number | null;
  document_type: string;
  title: string;
  object_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const positiveId = (value: FormDataEntryValue | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

function selectedPuppyIds(form: FormData) {
  return [...new Set(form.getAll("puppy_ids").flatMap((value) => String(value).split(",")).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150) || "scanned-document";
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

async function validateLinks(buyerId: number, paymentPlanId: number | null, puppyIds: number[]) {
  const buyer = await env.DB.prepare("SELECT id FROM buyers WHERE id = ?").bind(buyerId).first();
  if (!buyer) throw new Error("Buyer not found.");

  if (paymentPlanId) {
    const plan = await env.DB.prepare("SELECT id FROM payment_plans WHERE id = ? AND buyer_id = ?").bind(paymentPlanId, buyerId).first();
    if (!plan) throw new Error("The selected payment plan does not belong to this buyer.");
  }

  if (puppyIds.length) {
    const placeholders = puppyIds.map(() => "?").join(",");
    const puppies = await env.DB.prepare(`SELECT id FROM puppies WHERE buyer_id = ? AND id IN (${placeholders})`).bind(buyerId, ...puppyIds).all();
    if (puppies.results.length !== puppyIds.length) throw new Error("Every selected puppy must be assigned to this buyer.");
  }
}

export async function uploadBuyerDocument(form: FormData) {
  await ensureDatabase();
  const buyerId = positiveId(form.get("buyer_id"));
  const paymentPlanId = positiveId(form.get("payment_plan_id"));
  const puppyIds = selectedPuppyIds(form);
  const documentType = String(form.get("document_type") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  const file = form.get("file");

  if (!buyerId) throw new Error("A buyer is required.");
  if (!documentTypes.has(documentType)) throw new Error("Choose a valid document type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a scanned document to upload.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Documents must be 20 MB or smaller.");

  const contentType = contentTypeFor(file);
  const fileName = safeFileName(file.name);
  const title = (String(form.get("title") ?? "").trim() || documentType).slice(0, 160);
  await validateLinks(buyerId, paymentPlanId, puppyIds);

  const objectKey = `buyers/${buyerId}/${crypto.randomUUID()}-${fileName}`;
  const now = new Date().toISOString();
  await env.DOCUMENTS.put(objectKey, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { buyerId: String(buyerId), originalName: fileName },
  });

  try {
    const document = await env.DB.prepare("INSERT INTO buyer_documents (buyer_id, payment_plan_id, document_type, title, object_key, file_name, content_type, size_bytes, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(buyerId, paymentPlanId, documentType, title, objectKey, fileName, contentType, file.size, notes, now, now).first<DocumentRecord>();
    if (!document) throw new Error("Unable to save document details.");
    if (puppyIds.length) {
      await env.DB.batch(puppyIds.map((puppyId) => env.DB.prepare("INSERT INTO buyer_document_puppies (document_id, puppy_id) VALUES (?, ?)").bind(document.id, puppyId)));
    }
    return { ...document, puppy_ids: puppyIds };
  } catch (error) {
    await env.DOCUMENTS.delete(objectKey);
    throw error;
  }
}

export async function deleteBuyerDocument(documentId: number) {
  await ensureDatabase();
  const document = await env.DB.prepare("SELECT * FROM buyer_documents WHERE id = ?").bind(documentId).first<DocumentRecord>();
  if (!document) throw new Error("Document not found.");
  await env.DB.prepare("DELETE FROM buyer_documents WHERE id = ?").bind(documentId).run();
  await env.DOCUMENTS.delete(document.object_key);
}

export async function getBuyerDocument(documentId: number) {
  await ensureDatabase();
  const document = await env.DB.prepare("SELECT * FROM buyer_documents WHERE id = ?").bind(documentId).first<DocumentRecord>();
  if (!document) return null;
  const object = await env.DOCUMENTS.get(document.object_key);
  return object ? { document, object } : null;
}
