import { requireAdminSession } from "../../../lib/admin-session";
import { saveProfileImage, uploadProfileImage, type ProfileImageKind } from "../../../lib/profile-images";

export const runtime = "nodejs";
export const maxDuration = 60;

function kindOf(value: unknown): ProfileImageKind {
  if (value === "dog" || value === "puppy") return value;
  throw new Error("Choose a dog or puppy profile.");
}

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const kind = kindOf(form.get("kind"));
    const recordId = Number(form.get("recordId"));
    const file = form.get("file");
    if (!Number.isInteger(recordId) || recordId <= 0) throw new Error("A valid profile record is required.");
    if (!(file instanceof File)) throw new Error("Choose an image to upload.");
    const url = await uploadProfileImage(kind, recordId, file);
    await saveProfileImage(kind, recordId, url);
    return Response.json({ ok: true, url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload the profile image." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { kind?: unknown; recordId?: unknown };
    const kind = kindOf(body.kind);
    const recordId = Number(body.recordId);
    if (!Number.isInteger(recordId) || recordId <= 0) throw new Error("A valid profile record is required.");
    await saveProfileImage(kind, recordId, null);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to remove the profile image." }, { status: 400 });
  }
}
