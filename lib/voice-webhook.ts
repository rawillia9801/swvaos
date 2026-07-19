import twilio from "twilio";

export type VoiceForm = Record<string, string>;

export async function readVoiceForm(request: Request) {
  const formData = await request.formData();
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as VoiceForm;
}

function validationUrl(request: Request) {
  const incoming = new URL(request.url);
  const configuredBase = process.env.TWILIO_WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  if (configuredBase) return `${configuredBase}${incoming.pathname}${incoming.search}`;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? incoming.protocol.replace(":", "") ?? "https";
  return host ? `${protocol}://${host}${incoming.pathname}${incoming.search}` : request.url;
}

export function validateVoiceRequest(request: Request, form: VoiceForm) {
  if (process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true") return { valid: true as const };
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) return { valid: false as const, status: 503, error: "Voice request authentication is not configured." };
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!signature || !twilio.validateRequest(authToken, signature, validationUrl(request), form)) {
    return { valid: false as const, status: 403, error: "Voice request signature is invalid." };
  }
  return { valid: true as const };
}

export function voiceXml(response: InstanceType<typeof twilio.twiml.VoiceResponse>) {
  return new Response(response.toString(), {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });
}

export function voiceError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export function shortenSpeech(value: string, maxLength = 420) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trimEnd()}.`;
}

export function isAuthorizedCallerLookup(request: Request) {
  const expected = process.env.SWVAOS_CRM_API_KEY?.trim();
  if (!expected) return { authorized: false as const, status: 503, error: "Caller lookup authentication is not configured." };
  const authorization = request.headers.get("authorization") ?? "";
  const bearerAuthorized = authorization === `Bearer ${expected}`;
  let basicAuthorized = false;
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const username = separator >= 0 ? decoded.slice(0, separator) : "";
      const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      basicAuthorized = username === "swvaos" && password === expected;
    } catch {
      basicAuthorized = false;
    }
  }
  if (!bearerAuthorized && !basicAuthorized) return { authorized: false as const, status: 401, error: "Caller lookup authorization failed." };
  return { authorized: true as const };
}

export { twilio };
