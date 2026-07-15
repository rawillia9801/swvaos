type SupabaseConfig = {
  url: string;
  anonKey: string;
};

function runtimeValue(key: "SUPABASE_URL" | "SUPABASE_ANON_KEY") {
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() || undefined;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = runtimeValue("SUPABASE_URL");
  const anonKey = runtimeValue("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Supabase must use an HTTPS URL.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("authorization", `Bearer ${anonKey}`);

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
