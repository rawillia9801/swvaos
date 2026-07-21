import { getCallerCrmProfile } from "../../../../db/caller-crm";
import { menuVoiceResponse, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const profile = await getCallerCrmProfile(form.From || form.Caller || "");
    const calledNumber = form.To || form.Called || new URL(request.url).searchParams.get("line") || "";
    return voiceXml(menuVoiceResponse(profile, form.Digits || "", calledNumber));
  } catch {
    return voiceXml(unavailableVoiceResponse());
  }
}
