import { getCallerCrmProfile, logCallerEvent } from "../../../../db/caller-crm";
import { incomingVoiceResponse, isPupLiftLine, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, twilio, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

const voice = { voice: "Polly.Joanna" as const, language: "en-US" as const };

function routeWithLine(path: string, calledNumber: string) {
  const url = new URL(path, "https://voice.swvaos.local");
  if (calledNumber) url.searchParams.set("line", calledNumber);
  return `${url.pathname}${url.search}`;
}

function privateSafeMainMenu(recognized: boolean, calledNumber: string) {
  const response = new twilio.twiml.VoiceResponse();
  const gather = response.gather({
    action: routeWithLine("/api/voice/menu", calledNumber),
    method: "POST",
    input: ["dtmf"],
    numDigits: 1,
    timeout: 8,
    actionOnEmptyResult: true,
  });

  if (recognized) {
    gather.say(
      voice,
      "Thank you for calling Southwest Virginia Chihuahua. We found a family account associated with the phone number you are calling from. Press 1 to verify the account using the ZIP code on file and hear private puppy, application, payment, document, and transportation information. Press 2 for current puppy availability and the application process. Press 3 for general pickup, delivery, and transportation information. Press 4 for general payment and financing information. Press 5 for Pup-Lift information. Press 6 to leave a message. Press 7 to speak with our team. Press 9 to repeat this menu.",
    );
  } else {
    gather.say(
      voice,
      "Thank you for calling Southwest Virginia Chihuahua. Press 1 if you are an existing applicant or buyer and need account help. Press 2 for current puppy availability and the application process. Press 3 for general pickup, delivery, and transportation information. Press 4 for general payment and financing information. Press 5 for Pup-Lift information. Press 6 to leave a message. Press 7 to speak with our team. Press 9 to repeat this menu.",
    );
  }

  response.say(voice, "We did not receive a selection.");
  response.redirect(routeWithLine("/api/voice/incoming?repeat=1", calledNumber));
  return response;
}

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || new URL(request.url).searchParams.get("line") || "";
    const profile = await getCallerCrmProfile(phone);
    const pupLift = isPupLiftLine(calledNumber);

    if (new URL(request.url).searchParams.get("repeat") !== "1") {
      try {
        const event = await logCallerEvent({
          phone,
          callSid: form.CallSid,
          buyerId: profile.buyer?.id,
          title: pupLift ? `Pup-Lift inbound call${profile.recognized ? ` - ${profile.buyer?.name}` : ""}` : profile.recognized ? `Inbound call - ${profile.buyer?.name}` : "Inbound call - unrecognized caller",
          status: "Completed",
          details: `${pupLift ? "Line: Pup-Lift Support\n" : "Line: SWVAOS Main\n"}${profile.recognized ? "Caller matched to family account." : "Caller was not matched to a family account."}`,
        });
        console.info("[voice/incoming] Caller CRM event stored", { eventId: event?.id, callSid: form.CallSid, recognized: profile.recognized, line: pupLift ? "pup-lift" : "main" });
      } catch (eventError) {
        console.error("[voice/incoming] Caller CRM event failed", { callSid: form.CallSid, recognized: profile.recognized, error: eventError instanceof Error ? eventError.message : String(eventError) });
      }
    }

    return voiceXml(pupLift ? incomingVoiceResponse(profile, calledNumber) : privateSafeMainMenu(profile.recognized, calledNumber));
  } catch {
    return voiceXml(unavailableVoiceResponse());
  }
}
