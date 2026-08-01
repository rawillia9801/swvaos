import "server-only";

import { getSupabaseConfig } from "../db/supabase";

type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type AuthErrorPayload = {
  message?: string;
  error_description?: string;
  msg?: string;
  code?: string;
};

function authUrl(path: string) {
  const { url } = getSupabaseConfig();
  return new URL(path.replace(/^\//, ""), `${url}/`).toString();
}

async function authJson<T>(path: string, init: RequestInit, mode: "anon" | "admin") {
  const { anonKey, serviceRoleKey } = getSupabaseConfig();
  const key = mode === "admin" ? serviceRoleKey : (anonKey ?? serviceRoleKey);
  if (!key) throw new Error(mode === "admin" ? "Portal account administration is not configured." : "Portal password sign-in is not configured.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${key}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(authUrl(path), { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null) as T & AuthErrorPayload | null;
  if (!response.ok) {
    const message = payload?.message || payload?.error_description || payload?.msg || "Authentication request failed.";
    throw new Error(message);
  }
  return payload as T;
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const payload = await authJson<{ users?: AuthUser[]; next_page?: number | null }>(`auth/v1/admin/users?page=${page}&per_page=1000`, { method: "GET" }, "admin");
    const users = Array.isArray(payload.users) ? payload.users : [];
    const found = users.find((user) => String(user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < 1000 && !payload.next_page) break;
  }
  return null;
}

export async function createOrUpdatePortalAuthUser(input: { email: string; password: string; buyerId: number; name: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(email);
  const appMetadata = { ...(existing?.app_metadata || {}), portal_buyer_id: input.buyerId, portal_account: true };
  const userMetadata = { ...(existing?.user_metadata || {}), full_name: input.name, portal_buyer_id: input.buyerId };
  const body = JSON.stringify({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });

  if (existing) {
    return authJson<AuthUser>(`auth/v1/admin/users/${encodeURIComponent(existing.id)}`, { method: "PUT", body }, "admin");
  }
  return authJson<AuthUser>("auth/v1/admin/users", { method: "POST", body }, "admin");
}

export async function signInPortalPassword(emailValue: string, password: string) {
  const email = emailValue.trim().toLowerCase();
  const payload = await authJson<{ access_token?: string; user?: AuthUser }>(
    "auth/v1/token?grant_type=password",
    { method: "POST", body: JSON.stringify({ email, password }) },
    "anon",
  );
  if (!payload.user?.id || !payload.access_token) throw new Error("The email address or password is incorrect.");
  return payload.user;
}

export function portalBuyerIdFromAuthUser(user: AuthUser) {
  const candidate = Number(user.app_metadata?.portal_buyer_id ?? user.user_metadata?.portal_buyer_id);
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}
