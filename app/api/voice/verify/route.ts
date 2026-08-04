import { getCallerCrmProfile, logCallerEvent } from "../../../../db/caller-crm";
import { issueVoiceSession } from "../../../../lib/voice-session";
import { verificationFailedVoiceResponse, verificationPromptVoiceResponse, verificationSuccessVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

const fiveDigits = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "").slice(-5);

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const attempt = Math.max(1, Math.min(3, Number(url.searchParams.get("attempt")) || 1));
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || url.searchParams.get("line") || "";
    const profile = await getCallerCrmProfile(phone);
    const digits = fiveDigits(form.Digits);

    if (!digits) return voiceXml(verificationPromptVoiceResponse(profile, calledNumber, attempt));

    const expectedZip = fiveDigits(profile.buyer?.postal_code);
    const verified = Boolean(profile.recognized && profile.buyer?.id && expectedZip && digits === expectedZip);
    if (!verified) {
      await logCallerEvent({
        phone,
        callSid: form.CallSid,
        buyerId: profile.buyer?.id,
        title: "Voice account verification failed",
        status: "Failed",
        details: `Attempt: ${attempt}\nZIP match: No\nPrivate information was not provided.`,
      }).catch(() => null);
      return voiceXml(verificationFailedVoiceResponse(calledNumber, attempt));
    }

    const session = issueVoiceSession({ buyerId: profile.buyer!.id, phone, callSid: form.CallSid || "unknown-call", ttlSeconds: 900 });
    await logCallerEvent({
      phone,
      callSid: form.CallSid,
      buyerId: profile.buyer!.id,
      title: "Voice account verified",
      status: "Completed",
      details: "Caller phone matched and the five-digit account ZIP code was verified. Private voice menu access granted for this call.",
    }).catch(() => null);
    return voiceXml(verificationSuccessVoiceResponse(profile, calledNumber, session));
  } catch (error) {
    return voiceError(error instanceof Error ? error.message : "Unable to verify the family account.", 500);
  }
}
