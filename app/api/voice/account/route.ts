import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { getTransportationEligibility } from "../../../../db/transportation-voice";
import { accountVoiceResponse, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { verifyVoiceSession } from "../../../../lib/voice-session";
import { readVoiceForm, twilio, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

const voice = { voice: "Polly.Joanna" as const, language: "en-US" as const };

function accountRoute(session: string, calledNumber: string) {
  const params = new URLSearchParams({ session });
  if (calledNumber) params.set("line", calledNumber);
  return `/api/voice/account?${params.toString()}`;
}

function transportationRedirect(session: string, calledNumber: string) {
  const response = new twilio.twiml.VoiceResponse();
  const params = new URLSearchParams({ session });
  if (calledNumber) params.set("line", calledNumber);
  response.redirect(`/api/voice/transportation?${params.toString()}`);
  return response;
}

function documentStatusResponse(input: { documentsReady: boolean; missingDocuments: string[]; hasPaymentPlan: boolean }, session: string, calledNumber: string) {
  const response = new twilio.twiml.VoiceResponse();
  if (input.documentsReady) {
    response.say(voice, `All required buyer forms are marked complete${input.hasPaymentPlan ? ", including the puppy payment financing agreement" : ""}. Continue checking the Puppy Portal for any new document requests before your meeting.`);
  } else {
    response.say(voice, `The following forms still need to be completed: ${input.missingDocuments.join(", ")}. These forms must be completed before a transportation meeting or puppy release can take place. You can review and sign them in the Puppy Portal.`);
  }
  response.pause({ length: 1 });
  response.redirect(accountRoute(session, calledNumber));
  return response;
}

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("session") || "";
    const session = verifyVoiceSession(sessionToken);
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || url.searchParams.get("line") || "";
    const callSid = form.CallSid || "";

    if (!session || normalizeCallerPhone(session.phone) !== normalizeCallerPhone(phone) || (session.callSid !== "unknown-call" && callSid && session.callSid !== callSid)) {
      await logCallerEvent({ phone, callSid, title: "Voice account session rejected", status: "Failed", details: "The secure voice session was missing, expired, or did not match the current call." }).catch(() => null);
      return voiceXml(unavailableVoiceResponse());
    }

    const profile = await getCallerCrmProfile(phone, undefined, session.buyerId);
    if (!profile.recognized || profile.buyer?.id !== session.buyerId) {
      await logCallerEvent({ phone, callSid, buyerId: session.buyerId, title: "Voice account identity mismatch", status: "Failed", details: "The verified buyer no longer matched the calling number." }).catch(() => null);
      return voiceXml(unavailableVoiceResponse());
    }

    if (form.Digits === "4") return voiceXml(transportationRedirect(sessionToken, calledNumber));
    if (form.Digits === "5") {
      const eligibility = await getTransportationEligibility(session.buyerId);
      return voiceXml(documentStatusResponse(eligibility, sessionToken, calledNumber));
    }
    return voiceXml(accountVoiceResponse(profile, form.Digits || "", calledNumber, sessionToken));
  } catch (error) {
    console.error("Verified voice account menu failed", error instanceof Error ? error.message : error);
    return voiceXml(unavailableVoiceResponse());
  }
}
