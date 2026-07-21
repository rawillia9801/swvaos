import { getCallerCrmProfile, logCallerEvent } from "../../../../db/caller-crm";
import { incomingVoiceResponse, isPupLiftLine, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || new URL(request.url).searchParams.get("line") || "";
    const profile = await getCallerCrmProfile(phone);
    if (new URL(request.url).searchParams.get("repeat") !== "1") {
      const pupLift = isPupLiftLine(calledNumber);
      try {
        const event = await logCallerEvent({ phone, callSid: form.CallSid, buyerId: profile.buyer?.id, title: pupLift ? `Pup-Lift inbound call${profile.recognized ? ` - ${profile.buyer?.name}` : ""}` : profile.recognized ? `Inbound call - ${profile.buyer?.name}` : "Inbound call - unrecognized caller", status: "Completed", details: `${pupLift ? "Line: Pup-Lift Support\n" : "Line: SWVAOS Main\n"}${profile.recognized ? "Caller matched to family account." : "Caller was not matched to a family account."}` });
        console.info("[voice/incoming] Caller CRM event stored", { eventId: event?.id, callSid: form.CallSid, recognized: profile.recognized, line: pupLift ? "pup-lift" : "main" });
      } catch (eventError) {
        console.error("[voice/incoming] Caller CRM event failed", { callSid: form.CallSid, recognized: profile.recognized, error: eventError instanceof Error ? eventError.message : String(eventError) });
      }
    }
    return voiceXml(incomingVoiceResponse(profile, calledNumber));
  } catch {
    return voiceXml(unavailableVoiceResponse());
  }
}
