import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { supabaseRequest } from "../../../../db/supabase";
import { issueVoiceSession } from "../../../../lib/voice-session";
import { verificationFailedVoiceResponse, verificationPromptVoiceResponse, verificationSuccessVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

const enteredZip = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : "";
};

const zipFields = [
  "postal_code",
  "zip",
  "zipcode",
  "zip_code",
  "billing_zip",
  "shipping_zip",
  "address_zip",
  "mailing_zip",
];

const phoneFields = ["phone", "telephone", "phone_number", "mobile", "mobile_phone", "cell_phone"];
const sourceTables = ["buyers", "bp_buyers", "core_buyers", "puppy_applications", "applications"];
const missingRelation = /does not exist|schema cache|could not find the table|relation .* not found/i;

function storedZips(row: Row) {
  const values = new Set<string>();

  for (const key of zipFields) {
    const raw = String(row[key] ?? "").trim();
    const formatted = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (formatted) values.add(formatted[1]);
    else {
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 5) values.add(digits.slice(0, 5));
    }
  }

  for (const key of [
    "address",
    "street_address",
    "mailing_address",
    "billing_address",
    "shipping_address",
    "household_notes",
    "additional_notes",
    "notes",
  ]) {
    for (const match of String(row[key] ?? "").matchAll(/\b(\d{5})(?:-\d{4})?\b/g)) values.add(match[1]);
  }

  return values;
}

function storedPhone(row: Row) {
  for (const key of phoneFields) {
    const normalized = normalizeCallerPhone(String(row[key] ?? ""));
    if (normalized) return normalized;
  }
  return "";
}

async function safeRows(table: string) {
  try {
    const response = await supabaseRequest(`rest/v1/${table}?select=*&limit=10000`, { cache: "no-store" });
    const raw = await response.text();
    if (!response.ok) throw new Error(raw || `Unable to read ${table}.`);
    return raw ? JSON.parse(raw) as Row[] : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (missingRelation.test(message)) return [];
    throw error;
  }
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
    const profile = await getCallerCrmProfile(phone);

    if (digits.length !== 5) return voiceXml(verificationPromptVoiceResponse(profile, calledNumber, attempt));

    const normalizedPhone = normalizeCallerPhone(phone);
    const sourceRows = await Promise.all(sourceTables.map(async (table) => ({ table, rows: await safeRows(table) })));
    const phoneMatchedRows = sourceRows.flatMap(({ table, rows }) => rows
      .filter((row) => storedPhone(row) === normalizedPhone)
      .map((row) => ({ table, row })));
    const zipMatchedRecord = phoneMatchedRows.find(({ row }) => storedZips(row).has(digits));
    const verified = Boolean(profile.recognized && profile.buyer?.id && zipMatchedRecord);

    console.info("[voice/verify] ZIP verification evaluated", {
      callSid: form.CallSid || "",
      buyerId: profile.buyer?.id || null,
      phoneMatchedRecords: phoneMatchedRows.length,
      zipMatched: Boolean(zipMatchedRecord),
      matchedSource: zipMatchedRecord?.table || null,
      attempt,
    });

    if (!verified) {
      const zipCount = phoneMatchedRows.reduce((count, candidate) => count + storedZips(candidate.row).size, 0);
      await logCallerEvent({
        phone,
        callSid: form.CallSid,
        buyerId: profile.buyer?.id,
        title: "Voice account verification failed",
        status: "Failed",
        details: `Attempt: ${attempt}\nPhone-matched records reviewed: ${phoneMatchedRows.length}\nStored ZIP values reviewed: ${zipCount}\nZIP match: No\nPrivate information was not provided.`,
      }).catch(() => null);
      return voiceXml(verificationFailedVoiceResponse(calledNumber, attempt));
    }

    const session = issueVoiceSession({
      buyerId: profile.buyer!.id,
      phone,
      callSid: form.CallSid || "unknown-call",
      ttlSeconds: 900,
    });
    await logCallerEvent({
      phone,
      callSid: form.CallSid,
      buyerId: profile.buyer!.id,
      title: "Voice account verified",
      status: "Completed",
      details: `Caller phone and five-digit ZIP were verified against the family records. Verification source: ${zipMatchedRecord!.table}. Private voice menu access granted for this call.`,
    }).catch(() => null);
    return voiceXml(verificationSuccessVoiceResponse(profile, calledNumber, session));
  } catch (error) {
    console.error("[voice/verify] Verification failed unexpectedly", error instanceof Error ? error.message : error);
    return voiceError(error instanceof Error ? error.message : "Unable to verify the family account.", 500);
  }
}
