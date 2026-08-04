import type { TransportationEligibility } from "../db/transportation-voice";
import { spokenTransportationTime, transportationTimeSlots } from "../db/transportation-voice";
import { twilio } from "./voice-webhook";

const voice = { voice: "Polly.Joanna" as const, language: "en-US" as const };

function route(path: string, session: string, line: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, "https://voice.swvaos.local");
  url.searchParams.set("session", session);
  if (line) url.searchParams.set("line", line);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value)) url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

const dollars = (cents: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} dollars`;
const spokenDate = (date: string) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function transportationStartResponse(eligibility: TransportationEligibility, session: string, line: string) {
  const response = new twilio.twiml.VoiceResponse();

  if (eligibility.existingReservation) {
    response.say(voice, `You already have a transportation meeting request for ${spokenDate(eligibility.existingReservation.date)} at ${spokenTransportationTime(eligibility.existingReservation.time)}. Its current status is ${eligibility.existingReservation.status || "requested"}. Only one active transportation meeting may be held for a family account at a time.`);
    response.redirect(route("/api/voice/account", session, line));
    return response;
  }

  if (!eligibility.puppyNames.length) {
    response.say(voice, "There is not currently a puppy assigned to your family account, so a transportation meeting cannot be reserved yet. Please check the Puppy Portal or speak with our team about your placement status.");
    response.redirect(route("/api/voice/account", session, line));
    return response;
  }

  if (!eligibility.paymentReady) {
    const plan = eligibility.hasPaymentPlan ? "Your account has an active puppy payment plan. " : "";
    response.say(voice, `${plan}At least 50 percent of the puppy price must be recorded as paid before a transportation meeting can be reserved. Your account currently shows ${dollars(eligibility.paidCents)} paid, which is ${eligibility.paidPercent} percent. The minimum required before reserving is ${dollars(eligibility.minimumPaidCents)}. Please update the payment record or complete the required payment, then try again.`);
    response.redirect(route("/api/voice/account", session, line));
    return response;
  }

  if (!eligibility.documentsReady) {
    response.say(voice, `Your payment requirement is satisfied, but the required forms must be completed before a meeting can be reserved. The missing forms are ${eligibility.missingDocuments.join(", ")}. Please sign or upload them through the Puppy Portal, then return to this menu.`);
    response.redirect(route("/api/voice/account", session, line));
    return response;
  }

  const gather = response.gather({
    action: route("/api/voice/transportation/date", session, line, { attempt: 1 }),
    method: "POST",
    input: ["dtmf"],
    numDigits: 8,
    timeout: 12,
    actionOnEmptyResult: true,
  });
  gather.say(voice, `Your account is eligible to request a transportation meeting for ${eligibility.puppyNames.join(" and ")}. Only one meeting is allowed on each date across the entire breeding program. Enter your requested date as eight digits: two digits for the month, two digits for the day, and four digits for the year. For example, August fifteenth twenty twenty six is zero eight one five two zero two six.`);
  response.say(voice, "We did not receive a complete date.");
  response.redirect(route("/api/voice/transportation", session, line));
  return response;
}

export function transportationInvalidDateResponse(session: string, line: string, attempt: number) {
  const response = new twilio.twiml.VoiceResponse();
  if (attempt >= 3) {
    response.say(voice, "We could not understand the requested date after three attempts. Dates must be between tomorrow and 180 days from now. Please try again later or speak with our team.");
    response.redirect(route("/api/voice/account", session, line));
    return response;
  }
  const gather = response.gather({
    action: route("/api/voice/transportation/date", session, line, { attempt: attempt + 1 }),
    method: "POST",
    input: ["dtmf"],
    numDigits: 8,
    timeout: 12,
    actionOnEmptyResult: true,
  });
  gather.say(voice, "That was not a valid reservation date. Enter eight digits using month, day, and four digit year. The date must be between tomorrow and 180 days from now.");
  response.redirect(route("/api/voice/transportation/date", session, line, { attempt: attempt + 1 }));
  return response;
}

export function transportationTimeResponse(date: string, session: string, line: string) {
  const response = new twilio.twiml.VoiceResponse();
  const slots = transportationTimeSlots();
  const options = slots.map((slot, index) => `Press ${index + 1} for ${spokenTransportationTime(slot)}`).join(". ");
  const gather = response.gather({
    action: route("/api/voice/transportation/time", session, line, { date }),
    method: "POST",
    input: ["dtmf"],
    numDigits: 1,
    timeout: 10,
    actionOnEmptyResult: true,
  });
  gather.say(voice, `${spokenDate(date)} is ready for a time selection. ${options}. Press 9 to choose a different date.`);
  response.redirect(route("/api/voice/transportation", session, line));
  return response;
}

export function transportationUnavailableResponse(session: string, line: string, date: string) {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, `${spokenDate(date)} is no longer available. Another family has already reserved the program's transportation meeting for that date. Please choose a different date.`);
  response.redirect(route("/api/voice/transportation", session, line));
  return response;
}

export function transportationConfirmedResponse(input: { date: string; time: string; session: string; line: string; existing?: boolean }) {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, `${input.existing ? "Your existing request is" : "Your transportation meeting request has been reserved for"} ${spokenDate(input.date)} at ${spokenTransportationTime(input.time)}. This date is now blocked from other program reservations. The meeting remains subject to breeder confirmation. Required documents must remain complete, at least 50 percent must remain paid, any transportation fee is due at least 24 hours before travel, and the remaining puppy balance must be paid before the puppy is released.`);
  response.redirect(route("/api/voice/account", input.session, input.line));
  return response;
}

export function transportationInvalidTimeResponse(session: string, line: string, date: string) {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, "That time selection is not available.");
  response.redirect(route("/api/voice/transportation/date", session, line, { date }));
  return response;
}
