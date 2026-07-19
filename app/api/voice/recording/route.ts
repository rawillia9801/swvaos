import { getCallerCrmProfile, logCallerEvent } from "../../../../db/caller-crm";
import { readVoiceForm, validateVoiceRequest, voiceError } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const phone = form.From || form.Caller || "";
    const profile = await getCallerCrmProfile(phone);
    await logCallerEvent({
      phone,
      callSid: form.CallSid,
      buyerId: profile.buyer?.id,
      title: profile.recognized ? `Caller message - ${profile.buyer?.name}` : "Caller message - unrecognized caller",
      status: form.RecordingStatus === "completed" ? "New" : "Failed",
      details: [`Recording: ${form.RecordingUrl || "Unavailable"}`, `Recording ID: ${form.RecordingSid || "Unavailable"}`, `Duration: ${form.RecordingDuration || "0"} seconds`, `Status: ${form.RecordingStatus || "unknown"}`].join("\n"),
    });
    return new Response(null, { status: 204 });
  } catch {
    return voiceError("Unable to save the caller message.", 500);
  }
}
