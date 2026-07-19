import { getCallerCrmProfile, toStudioCallerLookup } from "../../../../db/caller-crm";
import { isAuthorizedCallerLookup } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

function noStoreJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: Request) {
  const authorization = isAuthorizedCallerLookup(request);
  if (!authorization.authorized) return noStoreJson({ error: authorization.error }, authorization.status);
  try {
    const phone = new URL(request.url).searchParams.get("phone") ?? "";
    return noStoreJson(toStudioCallerLookup(await getCallerCrmProfile(phone)));
  } catch {
    return noStoreJson({ error: "Unable to retrieve caller information." }, 500);
  }
}

export async function POST(request: Request) {
  const authorization = isAuthorizedCallerLookup(request);
  if (!authorization.authorized) return noStoreJson({ error: authorization.error }, authorization.status);
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const phone = contentType.includes("application/json") ? String((await request.json() as { phone?: unknown }).phone ?? "") : String((await request.formData()).get("phone") ?? "");
    return noStoreJson(toStudioCallerLookup(await getCallerCrmProfile(phone)));
  } catch {
    return noStoreJson({ error: "Unable to retrieve caller information." }, 500);
  }
}
