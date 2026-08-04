import "server-only";

import { supabaseRequest } from "../db/supabase";

export type ReconciliationSummary = {
  ranAt: string;
  mode: "preview" | "import";
  sources: Array<{ table: string; category: "buyers" | "puppies" | "payments"; rows: number }>;
  buyers: { reviewed: number; added: number; updated: number; duplicatesSkipped: number; unresolved: number };
  puppies: { reviewed: number; added: number; updated: number; duplicatesSkipped: number; unresolved: number };
  payments: { reviewed: number; added: number; duplicatesSkipped: number; unresolved: number };
  warnings: string[];
};

type Row = Record<string, unknown>;
type Category = "buyers" | "puppies" | "payments";

const buyerSources = ["buyers", "bp_buyers", "core_buyers", "puppy_applications", "applications"] as const;
const puppySources = ["puppies", "bp_puppies", "core_puppies"] as const;
const paymentSources = ["buyer_payments", "bp_payments", "payments", "buyer_ledger", "core_financial_ledger"] as const;
const missingRelation = /does not exist|schema cache|could not find the table|relation .* not found/i;
const importMarker = /\[SWVAOS import:([^\]]+)\]/i;

const stringValue = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
};
const numericValue = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const parsed = Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const integerValue = (row: Row, ...keys: string[]) => {
  const parsed = numericValue(row, ...keys);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-10);
const dateValue = (row: Row, ...keys: string[]) => {
  const raw = stringValue(row, ...keys);
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const centsValue = (row: Row) => {
  const cents = numericValue(row, "amount_cents");
  if (cents !== null) return Math.round(cents);
  const amount = numericValue(row, "amount", "payment_amount", "paid_amount", "total");
  return amount === null ? 0 : Math.round(amount * 100);
};

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;
  if (!response.ok) throw new Error(payload?.message || payload?.error || body || `Data request failed (${response.status}).`);
  return payload as T;
}

async function safeRows(table: string) {
  try {
    return await requestJson<Row[]>(`rest/v1/${table}?select=*&limit=10000`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (missingRelation.test(message)) return null;
    throw error;
  }
}

async function patch(table: string, id: number, values: Row) {
  return requestJson<Row[]>(`rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(values),
  }).then((rows) => rows[0] || null);
}

async function insert(table: string, values: Row) {
  return requestJson<Row[]>(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(values),
  }).then((rows) => rows[0] || null);
}

function splitName(row: Row) {
  const first = stringValue(row, "first_name", "firstName");
  const last = stringValue(row, "last_name", "lastName");
  if (first || last) return { first, last };
  const full = stringValue(row, "full_name", "name", "applicant_name", "buyer_name", "customer_name");
  const parts = full.split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function buyerNormalized(row: Row) {
  const name = splitName(row);
  return {
    first_name: name.first,
    last_name: name.last,
    email: normalizeEmail(stringValue(row, "email", "user_email", "applicant_email", "customer_email")),
    phone: stringValue(row, "phone", "telephone", "phone_number") || null,
    city: stringValue(row, "city") || null,
    state: stringValue(row, "state") || null,
    application_status: stringValue(row, "application_status", "status", "buyer_stage") || "Inquiry",
    preferred_sex: stringValue(row, "preferred_sex", "sex_pref") || null,
    preferred_color: stringValue(row, "preferred_color", "color_pref") || null,
    household_notes: stringValue(row, "household_notes", "household_details") || null,
    notes: stringValue(row, "notes", "additional_notes") || null,
  };
}

function buyerKeys(row: Row) {
  const normalized = buyerNormalized(row);
  const full = normalize(`${normalized.first_name} ${normalized.last_name}`);
  return [
    normalized.email ? `email:${normalized.email}` : "",
    normalizePhone(normalized.phone) ? `phone:${normalizePhone(normalized.phone)}` : "",
    full ? `name:${full}|${normalize(normalized.city)}|${normalize(normalized.state)}` : "",
  ].filter(Boolean);
}

function puppyNormalized(row: Row) {
  const directCents = numericValue(row, "price_cents");
  const price = numericValue(row, "price", "list_price", "sale_price");
  return {
    litter_id: integerValue(row, "litter_id"),
    buyer_id: integerValue(row, "buyer_id"),
    name: stringValue(row, "name", "call_name", "puppy_name", "display_name") || "Unnamed puppy",
    sex: stringValue(row, "sex", "gender") || null,
    color: stringValue(row, "color", "colour", "markings") || null,
    birth_date: dateValue(row, "birth_date", "dob", "date_of_birth"),
    birth_weight: numericValue(row, "birth_weight", "birth_weight_lbs"),
    current_weight: numericValue(row, "current_weight", "weight", "latest_weight"),
    status: stringValue(row, "status", "placement_status") || "Available",
    price_cents: directCents !== null ? Math.round(directCents) : price !== null ? Math.round(price * 100) : null,
    notes: stringValue(row, "notes", "description") || null,
    photo_url: stringValue(row, "photo_url", "image_url", "profile_photo_url") || null,
  };
}

function puppyKeys(row: Row) {
  const puppy = puppyNormalized(row);
  const name = normalize(puppy.name);
  return [
    name && puppy.birth_date ? `name-dob:${name}|${puppy.birth_date}` : "",
    name ? `name:${name}|${normalize(puppy.sex)}|${normalize(puppy.color)}` : "",
  ].filter(Boolean);
}

function fillMissing(current: Row, proposed: Row) {
  const changes: Row = {};
  for (const [key, value] of Object.entries(proposed)) {
    const existing = current[key];
    if ((existing === null || existing === undefined || existing === "") && value !== null && value !== undefined && value !== "") changes[key] = value;
  }
  return changes;
}

function paymentSignature(row: Row, buyerId: number | null, puppyId: number | null) {
  const reference = stringValue(row, "reference_number", "reference", "transaction_id", "confirmation_number", "id");
  return [
    buyerId || 0,
    puppyId || 0,
    centsValue(row),
    dateValue(row, "payment_date", "paid_date", "event_date", "entry_date", "created_at") || "",
    normalize(stringValue(row, "method", "payment_method", "provider")),
    normalize(reference),
  ].join("|");
}

function paymentType(row: Row) {
  const type = normalize(stringValue(row, "payment_type", "event_type", "entry_type", "type"));
  return type.includes("deposit") || type.includes("reservation") ? "Deposit" : "Payment";
}

function isCountedPayment(row: Row) {
  const type = normalize(stringValue(row, "payment_type", "event_type", "entry_type", "type"));
  if (type.includes("fee") || type.includes("charge") || type.includes("credit") || type.includes("adjustment")) return false;
  const status = normalize(stringValue(row, "status"));
  return !["failed", "void", "voided", "cancelled", "canceled"].includes(status);
}

async function ensureLegacyLitter(apply: boolean, existingLitters: Row[]) {
  const found = existingLitters.find((row) => normalize(stringValue(row, "name")) === "imported legacy puppy records");
  if (found) return Number(found.id) || null;
  if (!apply) return null;
  const now = new Date().toISOString();
  const created = await insert("litters", { name: "Imported Legacy Puppy Records", status: "Archived", notes: "Created by SWVAOS to preserve puppy records that did not include a litter reference.", created_at: now, updated_at: now });
  return Number(created?.id) || null;
}

export async function reconcileSupabaseData(options: { apply: boolean }): Promise<ReconciliationSummary> {
  const apply = options.apply;
  const summary: ReconciliationSummary = {
    ranAt: new Date().toISOString(),
    mode: apply ? "import" : "preview",
    sources: [],
    buyers: { reviewed: 0, added: 0, updated: 0, duplicatesSkipped: 0, unresolved: 0 },
    puppies: { reviewed: 0, added: 0, updated: 0, duplicatesSkipped: 0, unresolved: 0 },
    payments: { reviewed: 0, added: 0, duplicatesSkipped: 0, unresolved: 0 },
    warnings: [],
  };

  const loaded = new Map<string, Row[]>();
  const loadCategory = async (tables: readonly string[], category: Category) => {
    for (const table of tables) {
      try {
        const rows = await safeRows(table);
        if (rows === null) continue;
        loaded.set(table, rows);
        summary.sources.push({ table, category, rows: rows.length });
      } catch (error) {
        summary.warnings.push(`${table}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  await Promise.all([
    loadCategory(buyerSources, "buyers"),
    loadCategory(puppySources, "puppies"),
    loadCategory(paymentSources, "payments"),
  ]);

  let canonicalBuyers = [...(loaded.get("buyers") || [])];
  const buyerByKey = new Map<string, Row>();
  const indexBuyers = () => {
    buyerByKey.clear();
    canonicalBuyers.forEach((row) => buyerKeys(row).forEach((key) => { if (!buyerByKey.has(key)) buyerByKey.set(key, row); }));
  };
  indexBuyers();

  for (const source of buyerSources) {
    const rows = loaded.get(source) || [];
    for (const row of rows) {
      summary.buyers.reviewed += 1;
      const proposed = buyerNormalized(row);
      if (!proposed.first_name && !proposed.last_name && !proposed.email && !proposed.phone) {
        summary.buyers.unresolved += 1;
        continue;
      }
      const sameId = source === "buyers" ? canonicalBuyers.find((candidate) => Number(candidate.id) === Number(row.id)) : null;
      const existing = sameId || buyerKeys(row).map((key) => buyerByKey.get(key)).find(Boolean) || null;
      if (existing) {
        const changes = fillMissing(existing, proposed);
        if (Object.keys(changes).length) {
          summary.buyers.updated += 1;
          if (apply) {
            const updated = await patch("buyers", Number(existing.id), { ...changes, updated_at: new Date().toISOString() });
            if (updated) canonicalBuyers = canonicalBuyers.map((candidate) => Number(candidate.id) === Number(updated.id) ? updated : candidate);
            indexBuyers();
          }
        } else summary.buyers.duplicatesSkipped += 1;
        continue;
      }
      summary.buyers.added += 1;
      if (apply) {
        const now = new Date().toISOString();
        const created = await insert("buyers", { ...proposed, created_at: stringValue(row, "created_at") || now, updated_at: now });
        if (created) {
          canonicalBuyers.push(created);
          indexBuyers();
        }
      }
    }
  }

  let canonicalPuppies = [...(loaded.get("puppies") || [])];
  const puppyByKey = new Map<string, Row>();
  const indexPuppies = () => {
    puppyByKey.clear();
    canonicalPuppies.forEach((row) => puppyKeys(row).forEach((key) => { if (!puppyByKey.has(key)) puppyByKey.set(key, row); }));
  };
  indexPuppies();
  const litters = await safeRows("litters") || [];
  let legacyLitterId: number | null = null;

  for (const source of puppySources) {
    const rows = loaded.get(source) || [];
    for (const row of rows) {
      summary.puppies.reviewed += 1;
      const proposed = puppyNormalized(row);
      if (!proposed.name || proposed.name === "Unnamed puppy") {
        summary.puppies.unresolved += 1;
        continue;
      }
      const sameId = source === "puppies" ? canonicalPuppies.find((candidate) => Number(candidate.id) === Number(row.id)) : null;
      const existing = sameId || puppyKeys(row).map((key) => puppyByKey.get(key)).find(Boolean) || null;
      if (existing) {
        const changes = fillMissing(existing, proposed);
        delete changes.photo_url;
        if (!existing.notes && proposed.photo_url) changes.notes = `[[SWVAOS_PROFILE_IMAGE:${proposed.photo_url}]]`;
        if (Object.keys(changes).length) {
          summary.puppies.updated += 1;
          if (apply) {
            const updated = await patch("puppies", Number(existing.id), { ...changes, updated_at: new Date().toISOString() });
            if (updated) canonicalPuppies = canonicalPuppies.map((candidate) => Number(candidate.id) === Number(updated.id) ? updated : candidate);
            indexPuppies();
          }
        } else summary.puppies.duplicatesSkipped += 1;
        continue;
      }
      summary.puppies.added += 1;
      if (apply) {
        if (!proposed.litter_id) legacyLitterId = legacyLitterId || await ensureLegacyLitter(true, litters);
        const now = new Date().toISOString();
        const notes = [proposed.notes, proposed.photo_url ? `[[SWVAOS_PROFILE_IMAGE:${proposed.photo_url}]]` : "", `[SWVAOS import:${source}:${stringValue(row, "id") || puppyKeys(row)[0]}]`].filter(Boolean).join("\n");
        const created = await insert("puppies", { ...proposed, photo_url: undefined, litter_id: proposed.litter_id || legacyLitterId, notes, created_at: stringValue(row, "created_at") || now, updated_at: now });
        if (created) {
          canonicalPuppies.push(created);
          indexPuppies();
        }
      }
    }
  }

  const canonicalTransactions = await safeRows("transactions") || [];
  const existingMarkers = new Set(canonicalTransactions.map((row) => stringValue(row, "notes").match(importMarker)?.[1]).filter(Boolean));
  const existingSignatures = new Set(canonicalTransactions.map((row) => paymentSignature(row, integerValue(row, "buyer_id"), integerValue(row, "puppy_id"))));
  const buyerIdByLegacyId = new Map<number, number>();
  canonicalBuyers.forEach((row) => buyerIdByLegacyId.set(Number(row.id), Number(row.id)));
  const puppyIdByLegacyId = new Map<number, number>();
  canonicalPuppies.forEach((row) => puppyIdByLegacyId.set(Number(row.id), Number(row.id)));

  for (const source of paymentSources) {
    const rows = loaded.get(source) || [];
    for (const row of rows) {
      if (!isCountedPayment(row)) continue;
      summary.payments.reviewed += 1;
      const amountCents = centsValue(row);
      if (!amountCents) {
        summary.payments.unresolved += 1;
        continue;
      }
      const sourceId = stringValue(row, "id") || paymentSignature(row, integerValue(row, "buyer_id"), integerValue(row, "puppy_id"));
      const marker = `${source}:${sourceId}`;
      let buyerId = buyerIdByLegacyId.get(integerValue(row, "buyer_id") || 0) || null;
      if (!buyerId) {
        const match = buyerKeys(row).map((key) => buyerByKey.get(key)).find(Boolean);
        buyerId = match ? Number(match.id) : null;
      }
      let puppyId = puppyIdByLegacyId.get(integerValue(row, "puppy_id") || 0) || null;
      if (!puppyId) {
        const match = puppyKeys(row).map((key) => puppyByKey.get(key)).find(Boolean);
        puppyId = match ? Number(match.id) : null;
      }
      if (!buyerId && puppyId) buyerId = integerValue(canonicalPuppies.find((candidate) => Number(candidate.id) === puppyId) || {}, "buyer_id");
      if (!buyerId) {
        summary.payments.unresolved += 1;
        continue;
      }
      const signature = paymentSignature(row, buyerId, puppyId);
      if (existingMarkers.has(marker) || existingSignatures.has(signature)) {
        summary.payments.duplicatesSkipped += 1;
        continue;
      }
      summary.payments.added += 1;
      if (apply) {
        const now = new Date().toISOString();
        const paidDate = dateValue(row, "payment_date", "paid_date", "event_date", "entry_date", "created_at");
        const reference = stringValue(row, "reference_number", "reference", "transaction_id", "confirmation_number");
        const notes = [stringValue(row, "note", "notes", "description"), reference ? `Reference: ${reference}` : "", `[SWVAOS import:${marker}]`].filter(Boolean).join("\n");
        await insert("transactions", {
          type: paymentType(row),
          dog_id: null,
          buyer_id: buyerId,
          litter_id: null,
          puppy_id: puppyId,
          payment_plan_id: null,
          category: paymentType(row) === "Deposit" ? "Deposit" : "Puppy sale",
          description: stringValue(row, "description", "payment_type", "event_type") || "Imported payment",
          amount_cents: amountCents,
          due_date: dateValue(row, "due_date"),
          paid_date: paidDate,
          status: stringValue(row, "status") || "Paid",
          method: stringValue(row, "method", "payment_method", "provider") || null,
          notes,
          created_at: stringValue(row, "created_at") || (paidDate ? `${paidDate}T12:00:00.000Z` : now),
          updated_at: now,
        });
        existingMarkers.add(marker);
        existingSignatures.add(signature);
      }
    }
  }

  return summary;
}

let recentRun: { at: number; promise: Promise<ReconciliationSummary> } | null = null;
export function reconcileSupabaseDataOnce() {
  const now = Date.now();
  if (recentRun && now - recentRun.at < 5 * 60 * 1000) return recentRun.promise;
  const promise = reconcileSupabaseData({ apply: true }).catch((error) => ({
    ranAt: new Date().toISOString(),
    mode: "import" as const,
    sources: [],
    buyers: { reviewed: 0, added: 0, updated: 0, duplicatesSkipped: 0, unresolved: 0 },
    puppies: { reviewed: 0, added: 0, updated: 0, duplicatesSkipped: 0, unresolved: 0 },
    payments: { reviewed: 0, added: 0, duplicatesSkipped: 0, unresolved: 0 },
    warnings: [error instanceof Error ? error.message : String(error)],
  }));
  recentRun = { at: now, promise };
  return promise;
}
