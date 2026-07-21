import { createPortalToken, verifyPortalToken } from "./portal-token";

export const PORTAL_SESSION_COOKIE = "swvaos_portal_session";

export function portalSessionTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== PORTAL_SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

export async function portalSessionFromRequest(request: Request) {
  const token = portalSessionTokenFromRequest(request);
  return token ? verifyPortalToken(token) : null;
}

export async function createPortalSession(buyerId: number) {
  return createPortalToken(buyerId, 30);
}
