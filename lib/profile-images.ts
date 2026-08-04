import "server-only";

import { getSupabaseConfig, supabaseRequest } from "../db/supabase";

export type ProfileImageKind = "dog" | "puppy";

const markerPattern = /\n?\[\[SWVAOS_PROFILE_IMAGE:([^\]]+)\]\]\s*/gi;
const bucket = "profile-images";

export function extractProfileImage(row: Record<string, unknown> | null | undefined) {
  const direct = [row?.photo_url, row?.image_url, row?.profile_photo_url]
    .map((value) => String(value ?? "").trim())
    .find(Boolean);
  if (direct) return direct;
  const notes = String(row?.notes ?? "");
  const match = [...notes.matchAll(markerPattern)][0];
  return match?.[1]?.trim() || null;
}

export function stripProfileImageMarker(value: unknown) {
  return String(value ?? "").replace(markerPattern, "").trim();
}

export function notesWithProfileImage(value: unknown, url: string | null) {
  const notes = stripProfileImageMarker(value);
  return [notes, url ? `[[SWVAOS_PROFILE_IMAGE:${url}]]` : ""].filter(Boolean).join("\n");
}

export function enrichProfileImages<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    photo_url: extractProfileImage(row),
    notes: stripProfileImageMarker(row.notes),
  }));
}

function safeExtension(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
}

async function ensureBucket() {
  const existing = await supabaseRequest(`storage/v1/bucket/${bucket}`, { cache: "no-store" });
  if (existing.ok) return;
  if (existing.status !== 404 && existing.status !== 400) throw new Error((await existing.text()) || "Unable to check profile-image storage.");
  const created = await supabaseRequest("storage/v1/bucket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 8 * 1024 * 1024, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif"] }),
  });
  if (!created.ok && created.status !== 409) throw new Error((await created.text()) || "Unable to create profile-image storage.");
}

export async function uploadProfileImage(kind: ProfileImageKind, recordId: number, file: File) {
  if (!Number.isInteger(recordId) || recordId <= 0) throw new Error("A valid dog or puppy record is required.");
  if (file.size <= 0) throw new Error("Choose an image to upload.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Profile images must be 8 MB or smaller.");
  const extension = safeExtension(file);
  await ensureBucket();
  const objectPath = `${kind}s/${recordId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploaded = await supabaseRequest(`storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { "content-type": file.type, "x-upsert": "true", "cache-control": "3600" },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!uploaded.ok) throw new Error((await uploaded.text()) || "Unable to upload the profile image.");
  const { url } = getSupabaseConfig();
  return `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export async function saveProfileImage(kind: ProfileImageKind, recordId: number, url: string | null) {
  const table = kind === "dog" ? "dogs" : "puppies";
  const currentResponse = await supabaseRequest(`rest/v1/${table}?select=id,notes&id=eq.${recordId}&limit=1`, { cache: "no-store" });
  if (!currentResponse.ok) throw new Error((await currentResponse.text()) || "Unable to open the selected record.");
  const current = ((await currentResponse.json()) as Array<Record<string, unknown>>)[0];
  if (!current) throw new Error("The selected record no longer exists.");
  const response = await supabaseRequest(`rest/v1/${table}?id=eq.${recordId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({ notes: notesWithProfileImage(current.notes, url), updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to save the profile image.");
  return ((await response.json()) as Array<Record<string, unknown>>)[0] || null;
}
