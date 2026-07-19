type PortalClaims = {
  version: 1;
  buyerId: number;
  expiresAt: number;
};

const encoder = new TextEncoder();

function portalSecret() {
  const secret = process.env.SWVAOS_PORTAL_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Puppy portal security is not configured.");
  return secret;
}

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(portalSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createPortalToken(buyerId: number, lifetimeDays = 730) {
  if (!Number.isInteger(buyerId) || buyerId <= 0) throw new Error("A valid family is required.");
  const claims: PortalClaims = {
    version: 1,
    buyerId,
    expiresAt: Math.floor(Date.now() / 1000) + lifetimeDays * 86400,
  };
  const payload = toBase64Url(JSON.stringify(claims));
  return `${payload}.${toBase64Url(await sign(payload))}`;
}

export async function verifyPortalToken(token: string) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  try {
    const expected = await sign(payload);
    const supplied = new Uint8Array(Buffer.from(suppliedSignature, "base64url"));
    if (!timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(fromBase64Url(payload)) as Partial<PortalClaims>;
    if (claims.version !== 1 || !Number.isInteger(claims.buyerId) || Number(claims.buyerId) <= 0) return null;
    if (!Number.isInteger(claims.expiresAt) || Number(claims.expiresAt) <= Math.floor(Date.now() / 1000)) return null;
    return claims as PortalClaims;
  } catch {
    return null;
  }
}
