export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    voice_webhook_configured: Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()),
    caller_lookup_configured: Boolean(process.env.SWVAOS_CRM_API_KEY?.trim()),
    incoming_voice_path: "/api/voice/incoming",
    caller_lookup_path: "/api/caller-crm/lookup",
  }, { headers: { "cache-control": "no-store" } });
}
