import type { CallerCrmProfile } from "../db/caller-crm";
import { shortenSpeech, twilio } from "./voice-webhook";

const voice = { voice: "Polly.Joanna" as const, language: "en-US" as const };
const incomingPath = "/api/voice/incoming?repeat=1";
export const DEFAULT_MAIN_NUMBER = "+12762761669";
export const DEFAULT_PUP_LIFT_NUMBER = "+17158889526";

function normalizePhone(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function isPupLiftLine(calledNumber: string | null | undefined) {
  return normalizePhone(calledNumber) === normalizePhone(process.env.SWVAOS_PUP_LIFT_NUMBER || DEFAULT_PUP_LIFT_NUMBER);
}

function routeWithContext(path: string, calledNumber: string | null | undefined, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(path, "https://voice.swvaos.local");
  const line = normalizePhone(calledNumber);
  if (line) url.searchParams.set("line", line);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value)) url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

const dollars = (cents: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} dollars`;
const spokenDate = (value: string) => value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "not scheduled";

function publicMenu(response: InstanceType<typeof twilio.twiml.VoiceResponse>, profile: CallerCrmProfile, calledNumber: string | null | undefined) {
  const gather = response.gather({ action: routeWithContext("/api/voice/menu", calledNumber), method: "POST", input: ["dtmf"], numDigits: 1, timeout: 8, actionOnEmptyResult: true });
  gather.say(voice, profile.recognized
    ? "Thank you for calling Southwest Virginia Chihuahua. We found a family account associated with the phone number you are calling from. Press 1 to verify the account. Press 2 for available puppies and applications. Press 3 for pickup, delivery, and transportation. Press 4 for payments and financing. Press 5 for Pup-Lift information. Press 6 to leave a message. Press 7 to speak with our team. Press 9 to repeat this menu."
    : "Thank you for calling Southwest Virginia Chihuahua. Press 1 if you are an existing applicant or buyer and need account help. Press 2 for available puppies and applications. Press 3 for pickup, delivery, and transportation. Press 4 for payments and financing. Press 5 for Pup-Lift information. Press 6 to leave a message. Press 7 to speak with our team. Press 9 to repeat this menu.");
}

function pupLiftMenu(response: InstanceType<typeof twilio.twiml.VoiceResponse>, calledNumber: string | null | undefined) {
  const gather = response.gather({ action: routeWithContext("/api/voice/menu", calledNumber), method: "POST", input: ["dtmf"], numDigits: 1, timeout: 8, actionOnEmptyResult: true });
  gather.say(voice, "Thank you for calling Pup-Lift. If a puppy is unresponsive, having a seizure, unable to swallow, or has blue or very pale gums, seek emergency veterinary care now. Press 1 for immediate hypoglycemia support steps. Press 2 for warning signs. Press 3 for how to use Pup-Lift. Press 4 for prevention and aftercare. Press 5 to leave a message. Press 6 to speak with someone. Press 9 to repeat this menu.");
}

export function incomingVoiceResponse(profile: CallerCrmProfile, calledNumber?: string | null) {
  const response = new twilio.twiml.VoiceResponse();
  if (isPupLiftLine(calledNumber)) pupLiftMenu(response, calledNumber);
  else publicMenu(response, profile, calledNumber);
  response.say(voice, "We did not receive a selection.");
  response.redirect(routeWithContext(incomingPath, calledNumber));
  return response;
}

function assignedPuppySpeech(profile: CallerCrmProfile) {
  if (!profile.puppies.length) return "There is not currently a puppy assigned to your account.";
  const details = profile.puppies.map((puppy) => [puppy.name, puppy.sex, puppy.color, puppy.status, puppy.litter ? `from ${puppy.litter}` : ""].filter(Boolean).join(", "));
  return shortenSpeech(`Your account has ${profile.puppies.length} assigned ${profile.puppies.length === 1 ? "puppy" : "puppies"}. ${details.join(". ")}.`);
}

function latestUpdateSpeech(profile: CallerCrmProfile) {
  const update = profile.updates[0];
  if (!update) return "There is not a published puppy update on your account yet.";
  const measurements = [update.week_number ? `week ${update.week_number}` : "", update.weight ? `${update.weight} pounds` : ""].filter(Boolean).join(", ");
  return shortenSpeech(`The latest update for ${update.puppy_name} is ${update.title}. ${measurements ? `${measurements}.` : ""} ${update.body}`);
}

function accountSpeech(profile: CallerCrmProfile) {
  const activePlans = profile.payment_plans.filter((plan) => plan.status === "Active");
  return [
    `Your recorded payments total ${dollars(profile.account.paid_cents)}.`,
    `Your recorded outstanding balance is ${dollars(profile.account.outstanding_cents)}.`,
    profile.account.next_due_date ? `Your next recorded due date is ${spokenDate(profile.account.next_due_date)}.` : "There is no upcoming payment date recorded.",
    activePlans.length ? `You have ${activePlans.length} active payment ${activePlans.length === 1 ? "plan" : "plans"}.` : "There is no active payment plan recorded.",
    profile.account.overdue_count ? `There ${profile.account.overdue_count === 1 ? "is" : "are"} ${profile.account.overdue_count} overdue ${profile.account.overdue_count === 1 ? "item" : "items"}.` : "There are no overdue items recorded.",
  ].join(" ");
}

function publicPuppySpeech(profile: CallerCrmProfile) {
  const count = profile.public_information.available_puppy_count;
  if (!count) return "There are no puppies marked available in the system right now. Availability can change before the website is updated, so please leave a message for current information.";
  const names = profile.public_information.available_puppy_names;
  return shortenSpeech(`There ${count === 1 ? "is" : "are"} ${count} ${count === 1 ? "puppy" : "puppies"} currently marked available.${names.length ? ` The names currently listed are ${names.join(", ")}.` : ""} Applications are reviewed before placement and may take up to 48 business hours.`);
}

export function verificationPromptVoiceResponse(profile: CallerCrmProfile, calledNumber: string | null | undefined, attempt = 1) {
  const response = new twilio.twiml.VoiceResponse();
  if (!profile.recognized || !profile.buyer) {
    response.say(voice, "We could not match the phone number you are calling from to a family account. Please call from the number listed on your application, leave a message, or speak with our team.");
    response.redirect(routeWithContext(incomingPath, calledNumber));
    return response;
  }
  const gather = response.gather({ action: routeWithContext("/api/voice/verify", calledNumber, { attempt }), method: "POST", input: ["dtmf"], numDigits: 5, timeout: 10, actionOnEmptyResult: true });
  gather.say(voice, `${attempt > 1 ? "That ZIP code did not match. " : ""}For privacy, enter the five digit ZIP code listed on your family account.`);
  response.say(voice, "We did not receive five digits.");
  response.redirect(routeWithContext("/api/voice/verify", calledNumber, { attempt: Math.min(3, attempt + 1) }));
  return response;
}

export function verificationFailedVoiceResponse(calledNumber: string | null | undefined, attempt: number) {
  const response = new twilio.twiml.VoiceResponse();
  if (attempt >= 3) {
    response.say(voice, "We could not verify the account after three attempts. No private information was provided. Please leave a message or speak with our team so the account ZIP code can be reviewed.");
    response.redirect(routeWithContext(incomingPath, calledNumber));
  } else {
    response.redirect(routeWithContext("/api/voice/verify", calledNumber, { attempt: attempt + 1 }));
  }
  return response;
}

export function verificationSuccessVoiceResponse(profile: CallerCrmProfile, calledNumber: string | null | undefined, session: string) {
  const response = new twilio.twiml.VoiceResponse();
  const firstName = profile.buyer?.first_name || profile.buyer?.name || "there";
  response.say(voice, `Thank you, ${firstName}. Your family account is verified for this call.`);
  response.redirect(routeWithContext("/api/voice/account", calledNumber, { session }));
  return response;
}

function secureMenu(response: InstanceType<typeof twilio.twiml.VoiceResponse>, profile: CallerCrmProfile, calledNumber: string | null | undefined, session: string) {
  const firstName = profile.buyer?.first_name || profile.buyer?.name || "there";
  const gather = response.gather({ action: routeWithContext("/api/voice/account", calledNumber, { session }), method: "POST", input: ["dtmf"], numDigits: 1, timeout: 9, actionOnEmptyResult: true });
  gather.say(voice, `Welcome, ${firstName}. Press 1 for your assigned puppy and latest update. Press 2 for your application or placement status. Press 3 for payments, balance, and payment-plan information. Press 4 to review transportation eligibility or reserve a meeting date. Press 5 to hear the latest puppy update. Press 6 to leave a message. Press 7 to speak with our team. Press 8 to return to the main menu. Press 9 to repeat this menu.`);
}

export function accountVoiceResponse(profile: CallerCrmProfile, digit: string, calledNumber: string | null | undefined, session: string) {
  if (digit === "6") return messageVoiceResponse(true);
  if (digit === "7") return connectToTeamVoiceResponse();
  const response = new twilio.twiml.VoiceResponse();
  if (!digit || digit === "9") {
    secureMenu(response, profile, calledNumber, session);
    response.say(voice, "We did not receive a selection.");
    response.redirect(routeWithContext("/api/voice/account", calledNumber, { session }));
    return response;
  }
  if (digit === "8") {
    response.redirect(routeWithContext(incomingPath, calledNumber));
    return response;
  }
  if (digit === "1") response.say(voice, `${assignedPuppySpeech(profile)} ${latestUpdateSpeech(profile)}`);
  else if (digit === "2") response.say(voice, `Your application or approval status is ${profile.buyer?.application_status || "not recorded"}. ${profile.puppies.length ? "A puppy is assigned to your account. Continue checking the Puppy Portal for documents, messages, and placement steps." : "No puppy is assigned yet. Continue checking the Puppy Portal for review decisions, documents, and placement updates."}`);
  else if (digit === "3") response.say(voice, accountSpeech(profile));
  else if (digit === "4") response.say(voice, "Opening transportation eligibility.");
  else if (digit === "5") response.say(voice, latestUpdateSpeech(profile));
  else response.say(voice, "That selection is not available.");
  response.pause({ length: 1 });
  response.redirect(routeWithContext("/api/voice/account", calledNumber, { session }));
  return response;
}

export function messageVoiceResponse(recognized: boolean) {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, `${recognized ? "After the tone, leave your message." : "After the tone, leave your name, phone number, and message."} Press pound when you are finished. Your recording will be saved for our team.`);
  response.record({ action: "/api/voice/message", method: "POST", maxLength: 120, finishOnKey: "#", playBeep: true, recordingStatusCallback: "/api/voice/recording", recordingStatusCallbackMethod: "POST", recordingStatusCallbackEvent: ["completed"] });
  response.say(voice, "We did not receive a message. Goodbye.");
  return response;
}

function connectToTeamVoiceResponse() {
  const response = new twilio.twiml.VoiceResponse();
  const numbers = (process.env.SWVAOS_CALL_TEAM_NUMBERS || "").split(",").map((number) => number.trim()).filter(Boolean);
  if (!numbers.length) return messageVoiceResponse(false);
  response.say(voice, "Please hold while we connect your call.");
  const callerId = process.env.SWVAOS_MAIN_NUMBER?.trim() || DEFAULT_MAIN_NUMBER;
  const dial = response.dial({ timeout: 30, answerOnBridge: true, callerId });
  numbers.forEach((number) => dial.number(number));
  return response;
}

export function unavailableVoiceResponse() {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, "Caller information is temporarily unavailable. Please try again later.");
  response.hangup();
  return response;
}

function pupLiftMenuVoiceResponse(digit: string, calledNumber: string | null | undefined) {
  if (digit === "5") return messageVoiceResponse(false);
  if (digit === "6") return connectToTeamVoiceResponse();
  const response = new twilio.twiml.VoiceResponse();
  if (digit === "9" || !digit) {
    response.redirect(routeWithContext(incomingPath, calledNumber));
    return response;
  }
  if (digit === "1") response.say(voice, "Warm the puppy gently but quickly. Place a small amount of Pup-Lift on the gums or under the tongue. Do not pour liquid into the mouth or force swallowing. Repeat tiny amounts every 3 to 5 minutes as needed. Once the puppy is alert and able to swallow, offer food. Pup-Lift is emergency support and is not a substitute for veterinary care.");
  else if (digit === "2") response.say(voice, "Possible hypoglycemia warning signs include weakness, unusual sleepiness, wobbling, trembling, glassy eyes, confusion, poor appetite, collapse, or seizures. Seek immediate veterinary care for seizures, collapse, blue or very pale gums, inability to swallow, unresponsiveness, repeated episodes, or no quick improvement.");
  else if (digit === "3") response.say(voice, "Shake gently. Place only a small amount on the gums or under the tongue, where it can absorb without forcing the puppy to swallow. Repeat tiny amounts every 3 to 5 minutes as needed. Never flood the mouth. Visit pup dash lift dot com for the emergency guide.");
  else if (digit === "4") response.say(voice, "After the puppy is alert and can swallow, offer food and keep the puppy warm. Feed tiny puppies on a consistent schedule, monitor appetite and energy, and contact your veterinarian about any episode. Repeated episodes need veterinary evaluation.");
  else response.say(voice, "That selection is not available.");
  response.pause({ length: 1 });
  response.redirect(routeWithContext(incomingPath, calledNumber));
  return response;
}

export function menuVoiceResponse(profile: CallerCrmProfile, digit: string, calledNumber?: string | null) {
  if (isPupLiftLine(calledNumber)) return pupLiftMenuVoiceResponse(digit, calledNumber);
  if (digit === "6") return messageVoiceResponse(profile.recognized);
  if (digit === "7") return connectToTeamVoiceResponse();
  const response = new twilio.twiml.VoiceResponse();
  if (digit === "9" || !digit) {
    response.redirect(routeWithContext(incomingPath, calledNumber));
    return response;
  }
  if (digit === "1") {
    if (profile.recognized) response.redirect(routeWithContext("/api/voice/verify", calledNumber));
    else {
      response.say(voice, "We could not match this calling number to an account. Call from the phone number listed on your application, or choose option 6 or 7 for help.");
      response.redirect(routeWithContext(incomingPath, calledNumber));
    }
    return response;
  }
  if (digit === "2") response.say(voice, publicPuppySpeech(profile));
  else if (digit === "3") response.say(voice, "Ground transportation is arranged after a puppy is assigned. Meeting dates are limited to one family per day across the program. Verified buyers can check eligibility and request an available date through the private account menu.");
  else if (digit === "4") response.say(voice, "Payment plans may be available for eligible puppies when approved in advance. Deposits, due dates, balances, and payment methods are documented in the buyer agreement and family account.");
  else if (digit === "5") response.say(voice, "Pup-Lift provides emergency glucose-support information for toy-breed puppies at risk of hypoglycemia. It does not replace veterinary care. For the dedicated Pup-Lift support line, call 715-888-9526.");
  else response.say(voice, "That selection is not available.");
  response.pause({ length: 1 });
  response.redirect(routeWithContext(incomingPath, calledNumber));
  return response;
}
