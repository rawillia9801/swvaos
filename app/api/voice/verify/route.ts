import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { supabaseRequest } from "../../../../db/supabase";
import { issueVoiceSession } from "../../../../lib/voice-session";
import { verificationFailedVoiceResponse, verificationPromptVoiceResponse, verificationSuccessVoiceResponse } from "../../../../lib/caller-voice";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
type FlatEntry = { key: string; value: unknown };

const sourceTables = ["buyers", "bp_buyers", "core_buyers", "puppy_applications", "applications"];
const missingRelation = /does not exist|schema cache|could not find the table|relation .* not found/i;

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeName = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const enteredZip = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : "";
};

function flattenEntries(value: unknown, prefix = "", depth = 0): FlatEntry[] {
  if (depth > 3 || value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenEntries(item, `${prefix}_${index}`, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
      const nextKey = prefix ? `${prefix}_${key}` : key;
      return [{ key: normalizeKey(nextKey), value: nested }, ...flattenEntries(nested, nextKey, depth + 1)];
    });
  }
  return [{ key: normalizeKey(prefix), value }];
}

function extractZipValues(value: unknown) {
  const zips = new Set<string>();
  const raw = String(value ?? "").trim();
  for (const match of raw.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)) zips.add(match[1]);
  const digits = raw.replace(/\D/g, "");
  if (!zips.size && (digits.length === 5 || digits.length === 9)) zips.add(digits.slice(0, 5));
  return zips;
}

function storedZips(row: Row) {
  const values = new Set<string>();
  for (const entry of flattenEntries(row)) {
    const key = entry.key;
    const isZipField = /(^|_)(zip|zipcode|zip_code|postal|postal_code|mailing_zip|billing_zip|shipping_zip|address_zip)(_|$)/.test(key);
    const isAddressField = /(address|mailing|billing|shipping|location|household_notes|additional_notes|notes)/.test(key);
    if (!isZipField && !isAddressField) continue;
    for (const zip of extractZipValues(entry.value)) values.add(zip);
  }
  return values;
}

function storedPhones(row: Row) {
  const phones = new Set<string>();
  for (const entry of flattenEntries(row)) {
    if (!/(^|_)(phone|telephone|phone_number|mobile|mobile_phone|cell|cell_phone|caller)(_|$)/.test(entry.key)) continue;
    const normalized = normalizeCallerPhone(String(entry.value ?? ""));
    if (normalized) phones.add(normalized);
  }
  return phones;
}

function storedEmails(row: Row) {
  const emails = new Set<string>();
  for (const entry of flattenEntries(row)) {
    if (!/(^|_)(email|email_address|contact_email|applicant_email)(_|$)/.test(entry.key)) continue;
    const value = normalizeEmail(entry.value);
    if (value.includes("@")) emails.add(value);
  }
  return emails;
}

function storedNames(row: Row) {
  const first = String(row.first_name ?? row.First_Name ?? row.firstName ?? row.applicant_first_name ?? "").trim();
  const last = String(row.last_name ?? row.Last_Name ?? row.lastName ?? row.applicant_last_name ?? "").trim();
  const values = new Set<string>();
  if (first || last) values.add(normalizeName(`${first} ${last}`));
  for (const key of ["name", "full_name", "contact_name", "applicant_name", "buyer_name"]) {
    const value = normalizeName(row[key]);
    if (value) values.add(value);
  }
  return values;
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
    const initialProfile = await getCallerCrmProfile(phone);

    if (digits.length !== 5) return voiceXml(verificationPromptVoiceResponse(initialProfile, calledNumber, attempt));

    const normalizedPhone = normalizeCallerPhone(phone);
    const profileEmail = normalizeEmail(initialProfile.buyer?.email);
    const profileName = normalizeName(`${initialProfile.buyer?.first_name || ""} ${initialProfile.buyer?.last_name || ""}`);
    const profileBuyerId = Number(initialProfile.buyer?.id) || 0;
    const sourceRows = await Promise.all(sourceTables.map(async (table) => ({ table, rows: await safeRows(table) })));

    const relatedRows = sourceRows.flatMap(({ table, rows }) => rows
      .filter((row) => {
        const phoneMatch = normalizedPhone && storedPhones(row).has(normalizedPhone);
        const emailMatch = profileEmail && storedEmails(row).has(profileEmail);
        const nameMatch = profileName && storedNames(row).has(profileName);
        const buyerIdMatch = table === "buyers" && profileBuyerId > 0 && Number(row.id) === profileBuyerId;
        return Boolean(phoneMatch || emailMatch || nameMatch || buyerIdMatch);
      })
      .map((row) => ({ table, row })));

    const zipMatchedRecord = relatedRows.find(({ row }) => storedZips(row).has(digits));
    const verified = Boolean(initialProfile.recognized && initialProfile.buyer?.id && zipMatchedRecord);
    const storedZipCount = relatedRows.reduce((count, candidate) => count + storedZips(candidate.row).size, 0);
    const sourcesWithZips = [...new Set(relatedRows.filter((candidate) => storedZips(candidate.row).size).map((candidate) => candidate.table))];

    console.info("[voice/verify] ZIP verification evaluated", {
      callSid: form.CallSid || "",
      buyerId: initialProfile.buyer?.id || null,
      relatedRecords: relatedRows.length,
      storedZipCount,
      sourcesWithZips,
      zipMatched: Boolean(zipMatchedRecord),
      matchedSource: zipMatchedRecord?.table || null,
      attempt,
    });

    if (!verified) {
      await logCallerEvent({
        phone,
        callSid: form.CallSid,
        buyerId: initialProfile.buyer?.id,
        title: "Voice account verification failed",
        status: "Failed",
        details: `Attempt: ${attempt}\nRelated family records reviewed: ${relatedRows.length}\nStored ZIP values reviewed: ${storedZipCount}\nZIP match: No\nPrivate information was not provided.`,
      }).catch(() => null);
      return voiceXml(verificationFailedVoiceResponse(calledNumber, attempt));
    }

    const verifiedProfile = await getCallerCrmProfile(phone, digits, initialProfile.buyer!.id);
    const session = issueVoiceSession({
      buyerId: verifiedProfile.buyer!.id,
      phone,
      callSid: form.CallSid || "unknown-call",
      ttlSeconds: 900,
    });
    await logCallerEvent({
      phone,
      callSid: form.CallSid,
      buyerId: verifiedProfile.buyer!.id,
      title: "Voice account verified",
      status: "Completed",
      details: `Caller phone and five-digit ZIP were verified against linked family records. Verification source: ${zipMatchedRecord!.table}. Private voice menu access granted for this call.`,
    }).catch(() => null);
    return voiceXml(verificationSuccessVoiceResponse(verifiedProfile, calledNumber, session));
  } catch (error) {
    console.error("[voice/verify] Verification failed unexpectedly", error instanceof Error ? error.message : error);
    return voiceError(error instanceof Error ? error.message : "Unable to verify the family account.", 500);
  }
}
