import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { getTransportationEligibility } from "../../../../db/transportation-voice";
import { transportationStartResponse } from "../../../../lib/transportation-voice";
import { verifyVoiceSession } from "../../../../lib/voice-session";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

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
    if (!session || normalizeCallerPhone(session.phone) !== normalizeCallerPhone(phone) || (callSid && session.callSid !== "unknown-call" && session.callSid !== callSid)) {
      return voiceError("The verified voice session is missing or expired.", 403);
    }

    const profile = await getCallerCrmProfile(phone, undefined, session.buyerId);
    if (!profile.recognized || profile.buyer?.id !== session.buyerId) return voiceError("The verified family account no longer matches this call.", 403);
    const eligibility = await getTransportationEligibility(session.buyerId);
    await logCallerEvent({
      phone,
      callSid,
      buyerId: session.buyerId,
      title: "Transportation eligibility reviewed by phone",
      status: eligibility.canReserve ? "Eligible" : "Needs Attention",
      details: [
        `Puppy assigned: ${eligibility.puppyNames.length ? "Yes" : "No"}`,
        `Paid: ${eligibility.paidPercent}%`,
        `Payment plan: ${eligibility.hasPaymentPlan ? "Yes" : "No"}`,
        `Payment requirement met: ${eligibility.paymentReady ? "Yes" : "No"}`,
        `Documents complete: ${eligibility.documentsReady ? "Yes" : "No"}`,
        eligibility.missingDocuments.length ? `Missing documents: ${eligibility.missingDocuments.join(", ")}` : "",
      ].filter(Boolean).join("\n"),
    }).catch(() => null);
    return voiceXml(transportationStartResponse(eligibility, sessionToken, line));
  } catch (error) {
    return voiceError(error instanceof Error ? error.message : "Unable to review transportation eligibility.", 500);
  }
}
