type SupabaseConfig = {
  url: string;
  anonKey?: string;
  serviceRoleKey?: string;
  storageBucket: string;
};

function runtimeValue(key: "SUPABASE_URL" | "SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_STORAGE_BUCKET") {
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() || undefined;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = runtimeValue("SUPABASE_URL");
  const anonKey = runtimeValue("SUPABASE_ANON_KEY");
  const serviceRoleKey = runtimeValue("SUPABASE_SERVICE_ROLE_KEY");
  const storageBucket = runtimeValue("SUPABASE_STORAGE_BUCKET") ?? "documents";

  if (!url || (!anonKey && !serviceRoleKey)) {
    throw new Error("Data connection is not configured.");
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Data connection must use an HTTPS URL.");
  }

  return { url: url.replace(/\/$/, ""), anonKey, serviceRoleKey, storageBucket };
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  const token = serviceRoleKey ?? anonKey;
  if (!token) throw new Error("Data connection is not configured.");
  const headers = new Headers(init.headers);
  headers.set("apikey", token);
  headers.set("authorization", `Bearer ${token}`);

  return fetch(new URL(path.replace(/^\//, ""), `${url}/`), {
    ...init,
    headers,
  });
}

export async function checkSupabaseConnection() {
  const response = await supabaseRequest(
    "rest/v1/core_dogs?select=id&limit=1",
    { cache: "no-store" },
  );

  return {
    connected: response.ok,
    status: response.status,
  };
}
