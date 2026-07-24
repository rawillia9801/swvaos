import { getSupabaseConfig, supabaseRequest } from "../../../../db/supabase";
import { isAllowedWebsiteOrigin, publicPuppy, websiteCorsHeaders } from "../../../../lib/website-integration";

function response(origin: string | null, payload: Record<string, unknown>, status = 200) {
  const headers = websiteCorsHeaders(origin);
  headers.set("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
  return Response.json(payload, { status, headers });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: isAllowedWebsiteOrigin(origin) ? 204 : 403,
    headers: websiteCorsHeaders(origin),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedWebsiteOrigin(origin)) {
    return response(origin, { error: "This request source is not allowed." }, 403);
  }

  try {
    if (!getSupabaseConfig().serviceRoleKey) {
      return response(origin, { error: "Puppy listings are temporarily unavailable." }, 503);
    }
    const params = new URLSearchParams({
      select: "*",
      buyer_id: "is.null",
      order: "created_at.desc",
    });
    const result = await supabaseRequest(`rest/v1/puppies?${params}`, { cache: "no-store" });
    if (!result.ok) throw new Error("Unable to load puppy listings.");
    const rows = await result.json() as Record<string, unknown>[];
    return response(origin, { puppies: rows.map(publicPuppy).filter(Boolean) });
  } catch (error) {
    console.error("Public puppy feed failed", error instanceof Error ? error.message : error);
    return response(origin, { error: "Unable to load puppy listings right now." }, 500);
  }
}
