import { twilio, readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  const response = new twilio.twiml.VoiceResponse();
  response.say({ voice: "Polly.Joanna", language: "en-US" }, form.RecordingUrl ? "Thank you. Your message has been saved for our team. Goodbye." : "We did not receive a message. Goodbye.");
  response.hangup();
  return voiceXml(response);
}
