import { env } from "cloudflare:workers";
import { ensureDatabase } from "./kennel";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const documentTypes = new Set(["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Other"]);
const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type DogDocumentRecord = {
  id: number;
  dog_id: number;
  document_type: string;
  registry: string | null;
  registration_number: string | null;
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

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150) || "dog-document";
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

export async function uploadDogDocument(form: FormData) {
  await ensureDatabase();
  const dogId = positiveId(form.get("dog_id"));
  const documentType = String(form.get("document_type") ?? "").trim();
  const registry = String(form.get("registry") ?? "").trim().slice(0, 100) || null;
  const registrationNumber = String(form.get("registration_number") ?? "").trim().slice(0, 100) || null;
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  const file = form.get("file");

  if (!dogId) throw new Error("A breeding dog is required.");
  if (!documentTypes.has(documentType)) throw new Error("Choose a valid document type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a scanned document to upload.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Documents must be 20 MB or smaller.");
  const dog = await env.DB.prepare("SELECT id FROM dogs WHERE id = ?").bind(dogId).first();
  if (!dog) throw new Error("Breeding dog not found.");

  const contentType = contentTypeFor(file);
  const fileName = safeFileName(file.name);
  const title = (String(form.get("title") ?? "").trim() || [registry, documentType].filter(Boolean).join(" ")).slice(0, 160);
  const objectKey = `dogs/${dogId}/${crypto.randomUUID()}-${fileName}`;
  const now = new Date().toISOString();
  await env.DOCUMENTS.put(objectKey, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { dogId: String(dogId), originalName: fileName, documentType },
  });

  try {
    const document = await env.DB.prepare("INSERT INTO dog_documents (dog_id, document_type, registry, registration_number, title, object_key, file_name, content_type, size_bytes, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
      .bind(dogId, documentType, registry, registrationNumber, title, objectKey, fileName, contentType, file.size, notes, now, now).first<DogDocumentRecord>();
    if (!document) throw new Error("Unable to save document details.");
    return document;
  } catch (error) {
    await env.DOCUMENTS.delete(objectKey);
    throw error;
  }
}

export async function deleteDogDocument(documentId: number) {
  await ensureDatabase();
  const document = await env.DB.prepare("SELECT * FROM dog_documents WHERE id = ?").bind(documentId).first<DogDocumentRecord>();
  if (!document) throw new Error("Document not found.");
  await env.DB.prepare("DELETE FROM dog_documents WHERE id = ?").bind(documentId).run();
  await env.DOCUMENTS.delete(document.object_key);
}

export async function getDogDocument(documentId: number) {
  await ensureDatabase();
  const document = await env.DB.prepare("SELECT * FROM dog_documents WHERE id = ?").bind(documentId).first<DogDocumentRecord>();
  if (!document) return null;
  const object = await env.DOCUMENTS.get(document.object_key);
  return object ? { document, object } : null;
}
