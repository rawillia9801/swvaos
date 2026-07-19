import { getCallerCrmProfile, logCallerEvent } from "../../../../db/caller-crm";
import { incomingVoiceResponse, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const phone = form.From || form.Caller || "";
    const profile = await getCallerCrmProfile(phone);
    if (new URL(request.url).searchParams.get("repeat") !== "1") {
      await logCallerEvent({ phone, callSid: form.CallSid, buyerId: profile.buyer?.id, title: profile.recognized ? `Inbound call - ${profile.buyer?.name}` : "Inbound call - unrecognized caller", status: "Completed", details: profile.recognized ? "Caller matched to family account." : "Caller was not matched to a family account." }).catch(() => null);
    }
    return voiceXml(incomingVoiceResponse(profile));
  } catch {
    return voiceXml(unavailableVoiceResponse());
  }
}
