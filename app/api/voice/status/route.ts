export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    account_configured: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()),
    voice_webhook_configured: Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()),
    webhook_base_configured: Boolean(process.env.TWILIO_WEBHOOK_BASE_URL?.trim()),
    call_forwarding_configured: Boolean(process.env.SWVAOS_CALL_TEAM_NUMBERS?.trim()),
    caller_id_configured: Boolean(process.env.SWVAOS_CALLER_ID?.trim()),
    caller_lookup_configured: Boolean(process.env.SWVAOS_CRM_API_KEY?.trim()),
    incoming_voice_path: "/api/voice/incoming",
    caller_lookup_path: "/api/caller-crm/lookup",
  }, { headers: { "cache-control": "no-store" } });
}
