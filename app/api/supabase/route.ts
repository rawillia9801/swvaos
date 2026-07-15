import { checkSupabaseConnection } from "../../../db/supabase";

export async function GET() {
  try {
    const result = await checkSupabaseConnection();
    return Response.json(result, { status: result.connected ? 200 : 502 });
  } catch (error) {
    return Response.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unable to check Supabase.",
      },
      { status: 503 },
    );
  }
}
