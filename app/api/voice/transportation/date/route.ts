import { getCallerCrmProfile, normalizeCallerPhone } from "../../../../../db/caller-crm";
import { getTransportationEligibility, parseTransportationDate } from "../../../../../db/transportation-voice";
import { getKennelDataFromSupabase } from "../../../../../db/supabase-kennel";
import { transportationInvalidDateResponse, transportationTimeResponse, transportationUnavailableResponse } from "../../../../../lib/transportation-voice";
import { verifyVoiceSession } from "../../../../../lib/voice-session";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../../lib/voice-webhook";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
const text = (row: Row, key: string) => String(row[key] ?? "").trim();
const activeReservation = (row: Row) => !["cancelled", "canceled", "denied", "rejected", "void"].includes(text(row, "status").toLowerCase());

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("session") || "";
    const session = verifyVoiceSession(sessionToken);
    const phone = form.From || form.Caller || "";
    const line = form.To || form.Called || url.searchParams.get("line") || "";
    const callSid = form.CallSid || "";
    const attempt = Math.max(1, Math.min(3, Number(url.searchParams.get("attempt")) || 1));

    if (!session || normalizeCallerPhone(session.phone) !== normalizeCallerPhone(phone) || (callSid && session.callSid !== "unknown-call" && session.callSid !== callSid)) {
      return voiceError("The verified voice session is missing or expired.", 403);
    }

    const profile = await getCallerCrmProfile(phone, undefined, session.buyerId);
    if (!profile.recognized || profile.buyer?.id !== session.buyerId) return voiceError("The verified family account no longer matches this call.", 403);

    const eligibility = await getTransportationEligibility(session.buyerId);
    if (!eligibility.canReserve && !eligibility.existingReservation) return voiceError("The family account is no longer eligible to reserve transportation.", 409);

    const date = parseTransportationDate(form.Digits || "");
    if (!date) return voiceXml(transportationInvalidDateResponse(sessionToken, line, attempt));

    const data = await getKennelDataFromSupabase();
    const occupied = (data.events as Row[]).some((event) => text(event, "event_type") === "Transportation" && text(event, "event_date") === date && activeReservation(event));
    if (occupied) return voiceXml(transportationUnavailableResponse(sessionToken, line, date));

    return voiceXml(transportationTimeResponse(date, sessionToken, line));
  } catch (error) {
    return voiceError(error instanceof Error ? error.message : "Unable to check the transportation date.", 500);
  }
}
