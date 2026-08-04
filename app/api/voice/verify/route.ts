import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { getKennelDataFromSupabase } from "../../../../db/supabase-kennel";
import { issueVoiceSession } from "../../../../lib/voice-session";
import { verificationFailedVoiceResponse, verificationPromptVoiceResponse, verificationSuccessVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
const enteredZip = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "").slice(0, 5);
const zipFields = ["postal_code", "zip", "zipcode", "zip_code", "billing_zip", "shipping_zip", "address_zip", "mailing_zip"];

function storedZips(row: Row) {
  const values = new Set<string>();
  for (const key of zipFields) {
    const match = String(row[key] ?? "").match(/\b(\d{5})(?:-\d{4})?\b/);
    if (match) values.add(match[1]);
  }
  for (const key of ["address", "street_address", "mailing_address", "billing_address", "shipping_address", "household_notes", "notes"]) {
    for (const match of String(row[key] ?? "").matchAll(/\b(\d{5})(?:-\d{4})?\b/g)) values.add(match[1]);
  }
  return values;
}

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const attempt = Math.max(1, Math.min(3, Number(url.searchParams.get("attempt")) || 1));
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || url.searchParams.get("line") || "";
    const digits = enteredZip(form.Digits);
    const initialProfile = await getCallerCrmProfile(phone);

    if (digits.length !== 5) return voiceXml(verificationPromptVoiceResponse(initialProfile, calledNumber, attempt));

    const data = await getKennelDataFromSupabase();
    const normalizedPhone = normalizeCallerPhone(phone);
    const matchingBuyers = (data.buyers as Row[]).filter((buyer) => normalizeCallerPhone(String(buyer.phone ?? buyer.telephone ?? buyer.phone_number ?? "")) === normalizedPhone);
    const matchedBuyer = matchingBuyers.find((buyer) => storedZips(buyer).has(digits));
    const profile = matchedBuyer
      ? await getCallerCrmProfile(phone, digits, Number(matchedBuyer.id) || undefined)
      : await getCallerCrmProfile(phone, digits);
    const verified = Boolean(matchedBuyer && profile.recognized && profile.buyer?.id);

    if (!verified) {
      const zipCount = matchingBuyers.reduce((count, buyer) => count + storedZips(buyer).size, 0);
      await logCallerEvent({
        phone,
        callSid: form.CallSid,
        buyerId: initialProfile.buyer?.id,
        title: "Voice account verification failed",
        status: "Failed",
        details: `Attempt: ${attempt}\nZIP match: No\nStored ZIP values reviewed: ${zipCount}\nPrivate information was not provided.`,
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
      details: "Caller phone matched and a five-digit ZIP code stored on the family account was verified. Private voice menu access granted for this call.",
    }).catch(() => null);
    return voiceXml(verificationSuccessVoiceResponse(profile, calledNumber, session));
  } catch (error) {
    return voiceError(error instanceof Error ? error.message : "Unable to verify the family account.", 500);
  }
}
