import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "swvaos_admin_session";

const PASSWORD_SALT = "swvaos-admin-v1";
const DEFAULT_PASSWORD_HASH = "bee1b53ba8656ea414c35a9eed94d527d210348a1c9084f2e925785c288e388f2d1a97cd834427ca804af1ab50666b325341c65e394a62ddfd6c4d567940d7d7";
const SESSION_MESSAGE = "swvaos-admin-session-v1";

function passwordHash(password: string) {
  return scryptSync(password, PASSWORD_SALT, 64);
}

function expectedPasswordHash() {
  const configuredPassword = process.env.SWVAOS_ADMIN_PASSWORD?.trim();
  return configuredPassword ? passwordHash(configuredPassword) : Buffer.from(DEFAULT_PASSWORD_HASH, "hex");
}

function sessionSecret() {
  return process.env.SWVAOS_SESSION_SECRET?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim() || "";
}

function secureEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isValidAdminPassword(password: string) {
  if (!password || password.length > 256) return false;
  return secureEqual(passwordHash(password), expectedPasswordHash());
}

export function createAdminSessionToken() {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(SESSION_MESSAGE).digest("hex");
}

export function isValidAdminSessionToken(token: string | null | undefined) {
  const expected = createAdminSessionToken();
  if (!expected || !token) return false;
  return secureEqual(Buffer.from(token), Buffer.from(expected));
}

export function adminSessionTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== ADMIN_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

export function requireAdminSession(request: Request) {
  if (isValidAdminSessionToken(adminSessionTokenFromRequest(request))) return null;
  return Response.json({ error: "Your SWVAOS session is locked. Sign in again." }, { status: 401, headers: { "cache-control": "no-store" } });
}
