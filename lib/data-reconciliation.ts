import "server-only";

import { supabaseRequest } from "../db/supabase";

type Row = Record<string, unknown>;
type Category = "buyers" | "puppies" | "payments";
type Scope = "full" | "repair";

export type ReconciliationMetric = {
  reviewed: number;
  added: number;
  updated: number;
  duplicatesSkipped: number;
  duplicatesRemoved: number;
  unresolved: number;
  linked: number;
};

export type ReconciliationSummary = {
  ranAt: string;
  mode: "preview" | "import";
  scope: Scope;
  sources: Array<{ table: string; category: Category; rows: number }>;
  buyers: ReconciliationMetric;
  puppies: ReconciliationMetric;
  payments: ReconciliationMetric;
  warnings: string[];
};

const buyerSources = ["buyers", "bp_buyers", "core_buyers", "puppy_applications", "applications"] as const;
const puppySources = ["puppies", "bp_puppies", "core_puppies"] as const;
const paymentSources = ["buyer_payments", "bp_payments", "payments", "buyer_ledger", "core_financial_ledger"] as const;
const applicationSources = new Set<string>(["puppy_applications", "applications"]);
const missingRelation = /does not exist|schema cache|could not find the table|relation .* not found/i;
const importMarker = /\[SWVAOS import:([^\]]+)\]/gi;

const emptyMetric = (): ReconciliationMetric => ({ reviewed: 0, added: 0, updated: 0, duplicatesSkipped: 0, duplicatesRemoved: 0, unresolved: 0, linked: 0 });
const text = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
};
const numberValue = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const parsed = Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const positiveId = (row: Row, ...keys: string[]) => {
  const parsed = numberValue(row, ...keys);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const email = (value: unknown) => String(value ?? "").trim().toLowerCase();
const phone = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-10);
const dateValue = (row: Row, ...keys: string[]) => {
  const raw = text(row, ...keys);
  if (!raw) return null;
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const cleanNotes = (value: unknown) => String(value ?? "").replace(importMarker, "").trim();
const importNote = (source: string, row: Row) => `[SWVAOS import:${source}:${text(row, "id") || "unknown"}]`;
const markers = (row: Row) => [...String(row.notes ?? "").matchAll(importMarker)].map((match) => match[1]).filter(Boolean);

async function requestJson<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(payload?.message || payload?.error || raw || `Data request failed (${response.status}).`);
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

async function insert(table: string, values: Row) {
  return requestJson<Row[]>(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(values),
  }).then((rows) => rows[0] || null);
}

async function patchId(table: string, id: number, values: Row) {
  return requestJson<Row[]>(`rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(values),
  }).then((rows) => rows[0] || null);
}

async function patchWhere(table: string, query: string, values: Row) {
  await requestJson(`rest/v1/${table}?${query}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(values) });
}

async function deleteWhere(table: string, query: string) {
  await requestJson(`rest/v1/${table}?${query}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
}

async function insertIgnore(table: string, values: Row) {
  await requestJson(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(values),
  });
}

function splitName(row: Row) {
  const first = text(row, "first_name", "firstName");
  const last = text(row, "last_name", "lastName");
  if (first || last) return { first, last };
  const full = text(row, "full_name", "name", "applicant_name", "buyer_name", "customer_name");
  const parts = full.split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function buyerNormalized(row: Row, source?: string) {
  const name = splitName(row);
  const existingNotes = cleanNotes(text(row, "notes", "additional_notes"));
  const note = source && source !== "buyers" ? [existingNotes, importNote(source, row)].filter(Boolean).join("\n") : existingNotes || null;
  return {
    first_name: name.first,
    last_name: name.last,
    email: email(text(row, "email", "user_email", "applicant_email", "customer_email")),
    phone: text(row, "phone", "telephone", "phone_number") || null,
    city: text(row, "city") || null,
    state: text(row, "state") || null,
    postal_code: text(row, "postal_code", "zip", "zipcode") || null,
    application_status: text(row, "application_status", "status", "buyer_stage") || "Inquiry",
    preferred_sex: text(row, "preferred_sex", "sex_pref") || null,
    preferred_color: text(row, "preferred_color", "color_pref") || null,
    household_notes: text(row, "household_notes", "household_details") || null,
    notes: note,
  };
}

function buyerKeys(row: Row) {
  const buyer = buyerNormalized(row);
  const fullName = normalize(`${buyer.first_name} ${buyer.last_name}`);
  const normalizedPhone = phone(buyer.phone);
  const location = [normalize(buyer.city), normalize(buyer.state), normalize(buyer.postal_code)].filter(Boolean).join("|");
  return [
    buyer.email ? `email:${buyer.email}` : "",
    normalizedPhone && fullName ? `phone-name:${normalizedPhone}|${fullName}` : "",
    fullName && location ? `name-location:${fullName}|${location}` : "",
  ].filter(Boolean);
}

function puppyNormalized(row: Row, source?: string) {
  const directCents = numberValue(row, "price_cents");
  const price = numberValue(row, "price", "list_price", "sale_price");
  const existingNotes = cleanNotes(text(row, "notes", "description"));
  const image = text(row, "photo_url", "image_url", "profile_photo_url");
  const noteParts = [existingNotes, image ? `[[SWVAOS_PROFILE_IMAGE:${image}]]` : "", source && source !== "puppies" ? importNote(source, row) : ""].filter(Boolean);
  return {
    litter_id: positiveId(row, "litter_id"),
    buyer_id: positiveId(row, "buyer_id"),
    name: text(row, "name", "call_name", "puppy_name", "display_name") || "Unnamed puppy",
    sex: text(row, "sex", "gender") || null,
    color: text(row, "color", "colour", "markings") || null,
    birth_date: dateValue(row, "birth_date", "dob", "date_of_birth"),
    birth_weight: numberValue(row, "birth_weight", "birth_weight_lbs"),
    current_weight: numberValue(row, "current_weight", "weight", "latest_weight"),
    status: text(row, "status", "placement_status") || "Available",
    price_cents: directCents !== null ? Math.round(directCents) : price !== null ? Math.round(price * 100) : null,
    notes: noteParts.join("\n") || null,
  };
}

function puppyKeys(row: Row) {
  const puppy = puppyNormalized(row);
  const name = normalize(puppy.name);
  return [
    name && puppy.birth_date ? `name-dob:${name}|${puppy.birth_date}` : "",
    name && puppy.litter_id && puppy.sex && puppy.color ? `litter-identity:${puppy.litter_id}|${name}|${normalize(puppy.sex)}|${normalize(puppy.color)}` : "",
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

function completeness(row: Row, keys: string[]) {
  return keys.reduce((score, key) => score + (row[key] !== null && row[key] !== undefined && String(row[key]).trim() ? 1 : 0), 0);
}

function choosePrimary(rows: Row[], keys: string[]) {
  return [...rows].sort((left, right) => {
    const markerDifference = Number(markers(left).length > 0) - Number(markers(right).length > 0);
    if (markerDifference) return markerDifference;
    const completenessDifference = completeness(right, keys) - completeness(left, keys);
    if (completenessDifference) return completenessDifference;
    return Number(left.id || 0) - Number(right.id || 0);
  })[0];
}

function duplicateGroups(rows: Row[], keyFor: (row: Row) => string[]) {
  const byKey = new Map<string, Row[]>();
  for (const row of rows) for (const key of keyFor(row)) byKey.set(key, [...(byKey.get(key) || []), row]);
  const groups: Row[][] = [];
  const handled = new Set<number>();
  for (const candidates of byKey.values()) {
    const unique = [...new Map(candidates.map((row) => [Number(row.id), row])).values()].filter((row) => !handled.has(Number(row.id)));
    if (unique.length < 2) continue;
    unique.forEach((row) => handled.add(Number(row.id)));
    groups.push(unique);
  }
  return groups;
}

async function movePuppyLinks(duplicateId: number, primaryId: number) {
  for (const table of ["payment_plan_puppies", "buyer_document_puppies"] as const) {
    const key = table === "payment_plan_puppies" ? "payment_plan_id" : "document_id";
    const rows = await safeRows(table) || [];
    for (const row of rows.filter((candidate) => Number(candidate.puppy_id) === duplicateId)) {
      await insertIgnore(table, { [key]: Number(row[key]), puppy_id: primaryId });
    }
    await deleteWhere(table, `puppy_id=eq.${duplicateId}`);
  }
}

async function cleanupBuyerDuplicates(rows: Row[], apply: boolean, metric: ReconciliationMetric) {
  const removed = new Set<number>();
  for (const group of duplicateGroups(rows, buyerKeys)) {
    const active = group.filter((row) => !removed.has(Number(row.id)));
    if (active.length < 2) continue;
    const primary = choosePrimary(active, ["email", "phone", "city", "state", "postal_code", "application_status", "notes"]);
    for (const duplicate of active.filter((row) => Number(row.id) !== Number(primary.id))) {
      metric.duplicatesRemoved += 1;
      removed.add(Number(duplicate.id));
      if (!apply) continue;
      const proposed = buyerNormalized(duplicate);
      const changes = fillMissing(primary, proposed);
      const combinedNotes = [cleanNotes(primary.notes), cleanNotes(duplicate.notes)].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).join("\n");
      if (combinedNotes && !primary.notes) changes.notes = combinedNotes;
      if (Object.keys(changes).length) await patchId("buyers", Number(primary.id), { ...changes, updated_at: new Date().toISOString() });
      await patchWhere("puppies", `buyer_id=eq.${Number(duplicate.id)}`, { buyer_id: Number(primary.id) });
      await patchWhere("transactions", `buyer_id=eq.${Number(duplicate.id)}`, { buyer_id: Number(primary.id) });
      await patchWhere("payment_plans", `buyer_id=eq.${Number(duplicate.id)}`, { buyer_id: Number(primary.id) });
      await patchWhere("buyer_documents", `buyer_id=eq.${Number(duplicate.id)}`, { buyer_id: Number(primary.id) });
      await deleteWhere("buyers", `id=eq.${Number(duplicate.id)}`);
    }
  }
  return rows.filter((row) => !removed.has(Number(row.id)));
}

async function cleanupPuppyDuplicates(rows: Row[], apply: boolean, metric: ReconciliationMetric) {
  const removed = new Set<number>();
  for (const group of duplicateGroups(rows, puppyKeys)) {
    const active = group.filter((row) => !removed.has(Number(row.id)));
    if (active.length < 2) continue;
    const primary = choosePrimary(active, ["buyer_id", "litter_id", "birth_date", "current_weight", "price_cents", "status", "notes"]);
    for (const duplicate of active.filter((row) => Number(row.id) !== Number(primary.id))) {
      metric.duplicatesRemoved += 1;
      removed.add(Number(duplicate.id));
      if (!apply) continue;
      const changes = fillMissing(primary, puppyNormalized(duplicate));
      if (Object.keys(changes).length) await patchId("puppies", Number(primary.id), { ...changes, updated_at: new Date().toISOString() });
      await patchWhere("transactions", `puppy_id=eq.${Number(duplicate.id)}`, { puppy_id: Number(primary.id) });
      await patchWhere("puppy_updates", `puppy_id=eq.${Number(duplicate.id)}`, { puppy_id: Number(primary.id) });
      await patchWhere("events", `related_id=eq.${Number(duplicate.id)}&related_type=ilike.*puppy*`, { related_id: Number(primary.id) });
      await movePuppyLinks(Number(duplicate.id), Number(primary.id));
      await deleteWhere("puppies", `id=eq.${Number(duplicate.id)}`);
    }
  }
  return rows.filter((row) => !removed.has(Number(row.id)));
}

function indexRows(rows: Row[], keyFor: (row: Row) => string[]) {
  const index = new Map<string, Row>();
  for (const row of rows) for (const key of keyFor(row)) if (!index.has(key)) index.set(key, row);
  return index;
}

function addSourceMapping(map: Map<string, number>, candidates: Map<number, Set<number>>, source: string, row: Row, canonicalId: number) {
  const legacyId = positiveId(row, "id");
  if (!legacyId) return;
  map.set(`${source}:${legacyId}`, canonicalId);
  const current = candidates.get(legacyId) || new Set<number>();
  current.add(canonicalId);
  candidates.set(legacyId, current);
}

function resolveMappedId(source: string, rawId: number | null, sourceMap: Map<string, number>, candidates: Map<number, Set<number>>, canonicalTable: string) {
  if (!rawId) return null;
  const preferred = source === "bp_payments" ? [`bp_${canonicalTable}`, canonicalTable] : source === "core_financial_ledger" ? [`core_${canonicalTable}`, canonicalTable] : [canonicalTable, `bp_${canonicalTable}`, `core_${canonicalTable}`];
  for (const table of preferred) {
    const matched = sourceMap.get(`${table}:${rawId}`);
    if (matched) return matched;
  }
  const possible = [...(candidates.get(rawId) || [])];
  return possible.length === 1 ? possible[0] : null;
}

function amountCents(row: Row) {
  const cents = numberValue(row, "amount_cents");
  if (cents !== null) return Math.abs(Math.round(cents));
  const amount = numberValue(row, "amount", "payment_amount", "paid_amount", "total");
  return amount === null ? 0 : Math.abs(Math.round(amount * 100));
}

function paymentType(row: Row) {
  const type = normalize(text(row, "payment_type", "event_type", "entry_type", "type"));
  return type.includes("deposit") || type.includes("reservation") ? "Deposit" : "Payment";
}

function isPaymentRow(source: string, row: Row) {
  const type = normalize(text(row, "payment_type", "event_type", "entry_type", "type"));
  const status = normalize(text(row, "status"));
  if (["failed", "void", "voided", "cancelled", "canceled", "refunded"].includes(status)) return false;
  if (/(fee|charge|credit|adjustment|refund|expense|cost)/.test(type)) return false;
  if (source.includes("ledger") && type && !/(payment|deposit|receipt|sale)/.test(type)) return false;
  return amountCents(row) > 0;
}

function paymentReference(row: Row) {
  return text(row, "reference_number", "reference", "transaction_id", "confirmation_number", "provider_payment_id");
}

function paymentSignature(row: Row, buyerId: number | null, puppyId: number | null) {
  return [
    buyerId || 0,
    puppyId || 0,
    amountCents(row),
    dateValue(row, "payment_date", "paid_date", "event_date", "entry_date", "created_at") || "",
    normalize(text(row, "method", "payment_method", "provider")),
    normalize(paymentReference(row)),
  ].join("|");
}

async function ensureLegacyLitter(apply: boolean, litters: Row[]) {
  const existing = litters.find((row) => normalize(text(row, "name")) === "imported legacy puppy records");
  if (existing) return Number(existing.id) || null;
  if (!apply) return null;
  const now = new Date().toISOString();
  const created = await insert("litters", { name: "Imported Legacy Puppy Records", status: "Archived", notes: "Preserved records that did not include a litter reference.", created_at: now, updated_at: now });
  return Number(created?.id) || null;
}

export async function reconcileSupabaseData(options: { apply: boolean; scope?: Scope }): Promise<ReconciliationSummary> {
  const apply = options.apply;
  const scope = options.scope || "full";
  const summary: ReconciliationSummary = {
    ranAt: new Date().toISOString(),
    mode: apply ? "import" : "preview",
    scope,
    sources: [],
    buyers: emptyMetric(),
    puppies: emptyMetric(),
    payments: emptyMetric(),
    warnings: [],
  };

  const loaded = new Map<string, Row[]>();
  const load = async (tables: readonly string[], category: Category) => {
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
  await Promise.all([load(buyerSources, "buyers"), load(puppySources, "puppies"), load(paymentSources, "payments")]);

  let canonicalBuyers = await cleanupBuyerDuplicates([...(loaded.get("buyers") || [])], apply, summary.buyers);
  let canonicalPuppies = await cleanupPuppyDuplicates([...(loaded.get("puppies") || [])], apply, summary.puppies);
  if (apply && (summary.buyers.duplicatesRemoved || summary.puppies.duplicatesRemoved)) {
    canonicalBuyers = await safeRows("buyers") || canonicalBuyers;
    canonicalPuppies = await safeRows("puppies") || canonicalPuppies;
  }

  let buyerIndex = indexRows(canonicalBuyers, buyerKeys);
  let puppyIndex = indexRows(canonicalPuppies, puppyKeys);
  const buyerSourceMap = new Map<string, number>();
  const puppySourceMap = new Map<string, number>();
  const buyerIdCandidates = new Map<number, Set<number>>();
  const puppyIdCandidates = new Map<number, Set<number>>();

  for (const source of buyerSources) {
    for (const row of loaded.get(source) || []) {
      summary.buyers.reviewed += 1;
      const sameId = source === "buyers" ? canonicalBuyers.find((candidate) => Number(candidate.id) === Number(row.id)) : null;
      const existing = sameId || buyerKeys(row).map((key) => buyerIndex.get(key)).find(Boolean) || null;
      if (existing) {
        addSourceMapping(buyerSourceMap, buyerIdCandidates, source, row, Number(existing.id));
        const changes = fillMissing(existing, buyerNormalized(row));
        if (Object.keys(changes).length) {
          summary.buyers.updated += 1;
          if (apply && scope === "full") {
            const updated = await patchId("buyers", Number(existing.id), { ...changes, updated_at: new Date().toISOString() });
            if (updated) canonicalBuyers = canonicalBuyers.map((candidate) => Number(candidate.id) === Number(updated.id) ? updated : candidate);
            buyerIndex = indexRows(canonicalBuyers, buyerKeys);
          }
        } else summary.buyers.duplicatesSkipped += 1;
        continue;
      }
      if (applicationSources.has(source) || scope === "repair") {
        summary.buyers.unresolved += 1;
        continue;
      }
      const proposed = buyerNormalized(row, source);
      if (!proposed.first_name && !proposed.last_name && !proposed.email && !proposed.phone) {
        summary.buyers.unresolved += 1;
        continue;
      }
      summary.buyers.added += 1;
      if (apply) {
        const now = new Date().toISOString();
        const created = await insert("buyers", { ...proposed, created_at: text(row, "created_at") || now, updated_at: now });
        if (created) {
          canonicalBuyers.push(created);
          buyerIndex = indexRows(canonicalBuyers, buyerKeys);
          addSourceMapping(buyerSourceMap, buyerIdCandidates, source, row, Number(created.id));
        }
      }
    }
  }

  const litters = await safeRows("litters") || [];
  let legacyLitterId: number | null = null;
  for (const source of puppySources) {
    for (const row of loaded.get(source) || []) {
      summary.puppies.reviewed += 1;
      const sameId = source === "puppies" ? canonicalPuppies.find((candidate) => Number(candidate.id) === Number(row.id)) : null;
      const existing = sameId || puppyKeys(row).map((key) => puppyIndex.get(key)).find(Boolean) || null;
      if (existing) {
        addSourceMapping(puppySourceMap, puppyIdCandidates, source, row, Number(existing.id));
        const changes = fillMissing(existing, puppyNormalized(row));
        if (Object.keys(changes).length) {
          summary.puppies.updated += 1;
          if (apply && scope === "full") {
            const updated = await patchId("puppies", Number(existing.id), { ...changes, updated_at: new Date().toISOString() });
            if (updated) canonicalPuppies = canonicalPuppies.map((candidate) => Number(candidate.id) === Number(updated.id) ? updated : candidate);
            puppyIndex = indexRows(canonicalPuppies, puppyKeys);
          }
        } else summary.puppies.duplicatesSkipped += 1;
        continue;
      }
      if (scope === "repair") {
        summary.puppies.unresolved += 1;
        continue;
      }
      const proposed = puppyNormalized(row, source);
      if (!proposed.name || proposed.name === "Unnamed puppy") {
        summary.puppies.unresolved += 1;
        continue;
      }
      summary.puppies.added += 1;
      if (apply) {
        if (!proposed.litter_id) legacyLitterId = legacyLitterId || await ensureLegacyLitter(true, litters);
        const now = new Date().toISOString();
        const created = await insert("puppies", { ...proposed, litter_id: proposed.litter_id || legacyLitterId, created_at: text(row, "created_at") || now, updated_at: now });
        if (created) {
          canonicalPuppies.push(created);
          puppyIndex = indexRows(canonicalPuppies, puppyKeys);
          addSourceMapping(puppySourceMap, puppyIdCandidates, source, row, Number(created.id));
        }
      }
    }
  }

  const canonicalTransactions = await safeRows("transactions") || [];
  const existingMarkers = new Set(canonicalTransactions.flatMap(markers));
  const existingSignatures = new Set(canonicalTransactions.map((row) => paymentSignature(row, positiveId(row, "buyer_id"), positiveId(row, "puppy_id"))));

  for (const source of paymentSources) {
    for (const row of loaded.get(source) || []) {
      if (!isPaymentRow(source, row)) continue;
      summary.payments.reviewed += 1;
      let buyerId = resolveMappedId(source, positiveId(row, "buyer_id"), buyerSourceMap, buyerIdCandidates, "buyers");
      let puppyId = resolveMappedId(source, positiveId(row, "puppy_id"), puppySourceMap, puppyIdCandidates, "puppies");
      if (!buyerId) {
        const matched = buyerKeys(row).map((key) => buyerIndex.get(key)).find(Boolean);
        buyerId = matched ? Number(matched.id) : null;
      }
      if (!puppyId) {
        const matched = puppyKeys(row).map((key) => puppyIndex.get(key)).find(Boolean);
        puppyId = matched ? Number(matched.id) : null;
      }
      if (!buyerId && puppyId) buyerId = positiveId(canonicalPuppies.find((candidate) => Number(candidate.id) === puppyId) || {}, "buyer_id");
      if (!buyerId) {
        summary.payments.unresolved += 1;
        continue;
      }
      summary.payments.linked += 1;
      const sourceId = text(row, "id") || paymentSignature(row, buyerId, puppyId);
      const marker = `${source}:${sourceId}`;
      const signature = paymentSignature(row, buyerId, puppyId);
      if (existingMarkers.has(marker) || existingSignatures.has(signature)) {
        summary.payments.duplicatesSkipped += 1;
        continue;
      }
      summary.payments.added += 1;
      if (apply) {
        const now = new Date().toISOString();
        const paidDate = dateValue(row, "payment_date", "paid_date", "event_date", "entry_date", "created_at");
        const reference = paymentReference(row);
        const type = paymentType(row);
        const note = [cleanNotes(text(row, "note", "notes", "description")), reference ? `Reference: ${reference}` : "", `[SWVAOS import:${marker}]`].filter(Boolean).join("\n");
        await insert("transactions", {
          type,
          dog_id: null,
          buyer_id: buyerId,
          litter_id: null,
          puppy_id: puppyId,
          payment_plan_id: null,
          category: type === "Deposit" ? "Deposit" : "Puppy sale",
          description: text(row, "description", "payment_type", "event_type") || "Imported payment",
          amount_cents: amountCents(row),
          due_date: dateValue(row, "due_date"),
          paid_date: paidDate,
          status: text(row, "status") || "Paid",
          method: text(row, "method", "payment_method", "provider") || null,
          notes: note,
          created_at: text(row, "created_at") || (paidDate ? `${paidDate}T12:00:00.000Z` : now),
          updated_at: now,
        });
        existingMarkers.add(marker);
        existingSignatures.add(signature);
      }
    }
  }

  return summary;
}

let recentRepair: { at: number; promise: Promise<ReconciliationSummary> } | null = null;
export function repairImportedDataOnce() {
  const now = Date.now();
  if (recentRepair && now - recentRepair.at < 10 * 60 * 1000) return recentRepair.promise;
  const promise = reconcileSupabaseData({ apply: true, scope: "repair" }).catch((error) => ({
    ranAt: new Date().toISOString(),
    mode: "import" as const,
    scope: "repair" as const,
    sources: [],
    buyers: emptyMetric(),
    puppies: emptyMetric(),
    payments: emptyMetric(),
    warnings: [error instanceof Error ? error.message : String(error)],
  }));
  recentRepair = { at: now, promise };
  return promise;
}
