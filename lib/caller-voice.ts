import type { CallerCrmProfile } from "../db/caller-crm";
import { shortenSpeech, twilio } from "./voice-webhook";

const voice = { voice: "Polly.Joanna" as const, language: "en-US" as const };
const incomingPath = "/api/voice/incoming?repeat=1";

const dollars = (cents: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} dollars`;
const spokenDate = (value: string) => value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "not scheduled";

function gatherKnown(response: InstanceType<typeof twilio.twiml.VoiceResponse>, profile: CallerCrmProfile) {
  const firstName = profile.buyer?.first_name || profile.buyer?.name || "caller";
  const gather = response.gather({ action: "/api/voice/menu", method: "POST", input: ["dtmf"], numDigits: 1, timeout: 7, actionOnEmptyResult: true });
  gather.say(voice, `Hello ${firstName}. We found your records. How can we help you today? Press 1 for balance, payments, or puppy payment plan options. Press 2 for pickup or delivery, including scheduling. Press 3 for puppy reservation details and next steps. Press 4 for application or approval status. Press 5 to leave a message for our team. Press 6 to speak with someone. Press 9 to repeat this menu.`);
}

function gatherUnknown(response: InstanceType<typeof twilio.twiml.VoiceResponse>) {
  const gather = response.gather({ action: "/api/voice/menu", method: "POST", input: ["dtmf"], numDigits: 1, timeout: 7, actionOnEmptyResult: true });
  gather.say(voice, "Thank you for calling Southwest Virginia Chihuahua. We could not match this phone number to a family account. Press 1 for available puppies. Press 2 if you have already submitted an application. Press 3 if you have a puppy reserved. Press 4 for pickup or delivery questions. Press 5 to learn about Pup-Lift. Press 6 to learn about Chihuahua HQ. Press 7 to speak with someone. Press 9 to repeat this menu.");
}

export function incomingVoiceResponse(profile: CallerCrmProfile) {
  const response = new twilio.twiml.VoiceResponse();
  if (profile.recognized) gatherKnown(response, profile);
  else gatherUnknown(response);
  response.say(voice, "We did not receive a selection.");
  response.redirect(incomingPath);
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
  const parts = [
    `Your recorded outstanding balance is ${dollars(profile.account.outstanding_cents)}.`,
    `Your recorded payments total ${dollars(profile.account.paid_cents)}.`,
    profile.account.next_due_date ? `Your next recorded due date is ${spokenDate(profile.account.next_due_date)}.` : "There is no upcoming payment date recorded.",
    activePlans.length ? `You have ${activePlans.length} active payment ${activePlans.length === 1 ? "plan" : "plans"}.` : "There is no active payment plan recorded.",
    profile.account.overdue_count ? `There ${profile.account.overdue_count === 1 ? "is" : "are"} ${profile.account.overdue_count} overdue ${profile.account.overdue_count === 1 ? "item" : "items"}.` : "There are no overdue items recorded.",
  ];
  return parts.join(" ");
}

function publicPuppySpeech(profile: CallerCrmProfile) {
  const count = profile.public_information.available_puppy_count;
  if (!count) return "There are no puppies marked available in the system right now. Please leave a message for current availability.";
  const names = profile.public_information.available_puppy_names;
  return shortenSpeech(`There ${count === 1 ? "is" : "are"} ${count} ${count === 1 ? "puppy" : "puppies"} currently marked available.${names.length ? ` The names currently listed are ${names.join(", ")}.` : ""}`);
}

export function messageVoiceResponse(recognized: boolean) {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, `${recognized ? "After the tone, leave your name and message." : "After the tone, leave your name, phone number, and message."} Press pound when you are finished. Your message will be recorded for our team.`);
  response.record({ action: "/api/voice/message", method: "POST", maxLength: 120, finishOnKey: "#", playBeep: true, recordingStatusCallback: "/api/voice/recording", recordingStatusCallbackMethod: "POST", recordingStatusCallbackEvent: ["completed"] });
  response.say(voice, "We did not receive a message. Goodbye.");
  return response;
}

function connectToTeamVoiceResponse() {
  const response = new twilio.twiml.VoiceResponse();
  const numbers = (process.env.SWVAOS_CALL_TEAM_NUMBERS || "").split(",").map((number) => number.trim()).filter(Boolean);
  if (!numbers.length) {
    return messageVoiceResponse(false);
  }
  response.say(voice, "Please hold while we connect your call.");
  const dial = response.dial({ timeout: 30, answerOnBridge: true, ...(process.env.SWVAOS_CALLER_ID ? { callerId: process.env.SWVAOS_CALLER_ID } : {}) });
  numbers.forEach((number) => dial.number(number));
  return response;
}

export function unavailableVoiceResponse() {
  const response = new twilio.twiml.VoiceResponse();
  response.say(voice, "Caller information is temporarily unavailable. Please try again later.");
  response.hangup();
  return response;
}

export function menuVoiceResponse(profile: CallerCrmProfile, digit: string) {
  if (profile.recognized && digit === "5") return messageVoiceResponse(true);
  if ((profile.recognized && digit === "6") || (!profile.recognized && digit === "7")) return connectToTeamVoiceResponse();

  const response = new twilio.twiml.VoiceResponse();
  if (digit === "9" || !digit) {
    response.redirect(incomingPath);
    return response;
  }

  if (profile.recognized) {
    if (digit === "1") response.say(voice, accountSpeech(profile));
    else if (digit === "2") response.say(voice, profile.puppies.length ? `Pickup or delivery will be connected to ${profile.puppies.map((puppy) => puppy.name).join(" and ")}. No requested appointment is confirmed until our team approves it.` : "There is no assigned puppy on this account yet. Our team can still answer general pickup and delivery questions.");
    else if (digit === "3") response.say(voice, `${assignedPuppySpeech(profile)} ${latestUpdateSpeech(profile)}`);
    else if (digit === "4") response.say(voice, `Your application or approval status is ${profile.buyer?.application_status || "not recorded"}.`);
    else response.say(voice, "That selection is not available.");
  } else {
    if (digit === "1") response.say(voice, publicPuppySpeech(profile));
    else if (digit === "2") response.say(voice, "We could not match this phone number to an application. Please call from the number listed on your application or speak with our team so we can locate it.");
    else if (digit === "3") response.say(voice, "We could not match this phone number to a reserved puppy. Please call from the number on your family account or speak with our team.");
    else if (digit === "4") response.say(voice, "Pickup and delivery arrangements are confirmed individually after a puppy is assigned and account requirements are complete.");
    else if (digit === "5") response.say(voice, process.env.SWVAOS_PUP_LIFT_CALL_INFO?.trim() || "Pup-Lift information is available from our team. Please choose option 7 to speak with someone for current details.");
    else if (digit === "6") response.say(voice, process.env.SWVAOS_CHIHUAHUA_HQ_CALL_INFO?.trim() || "Chihuahua HQ information is available from our team. Please choose option 7 to speak with someone for current details.");
    else response.say(voice, "That selection is not available.");
  }
  response.pause({ length: 1 });
  response.redirect(incomingPath);
  return response;
}
