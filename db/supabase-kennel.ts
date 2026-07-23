import { supabaseRequest } from "./supabase";
import { ResourceValidationError, type ResourceInput, type ResourceName } from "./resources";

type TableName =
  | "dogs"
  | "dog_medical_records"
  | "dog_registrations"
  | "dog_documents"
  | "litters"
  | "buyers"
  | "puppies"
  | "payment_plans"
  | "payment_plan_puppies"
  | "transactions"
  | "events"
  | "puppy_updates"
  | "buyer_documents"
  | "buyer_document_puppies";

const tableFor = (resource: ResourceName): TableName =>
  resource === "updates" ? "puppy_updates" : resource;

const str = (data: ResourceInput, key: string) =>
  data[key] == null ? "" : String(data[key]).trim();
const nullable = (data: ResourceInput, key: string) => str(data, key) || null;
const num = (data: ResourceInput, key: string) => {
  const value = Number(data[key]);
  return Number.isFinite(value) ? value : null;
};
const id = (data: ResourceInput, key: string) => {
  const value = Number(data[key]);
  return Number.isInteger(value) && value > 0 ? value : null;
};
const cents = (data: ResourceInput, key: string) =>
  Math.round((num(data, key) ?? 0) * 100);
const ids = (data: ResourceInput, key: string) => {
  const raw = data[key];
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
};
const textValue = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === "string" ? String(row[key]) : "";

function normalizeBuyer(row: Record<string, unknown>) {
  const full = textValue(row, "full_name") || textValue(row, "name");
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return {
    ...row,
    first_name: textValue(row, "first_name") || parts[0] || "",
    last_name: textValue(row, "last_name") || parts.slice(1).join(" "),
    email: textValue(row, "email"),
    application_status: textValue(row, "application_status") || "Inquiry",
  };
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const payload = await response.text();
  const json = payload ? JSON.parse(payload) : null;
  if (!response.ok) {
    const message = json?.message ?? json?.error ?? "Data request failed.";
    throw new Error(message);
  }
  return json as T;
}

async function selectAll<T>(table: TableName, query = "select=*") {
  return jsonRequest<T[]>(`rest/v1/${table}?${query}`);
}

async function selectSafeAll<T>(table: TableName) {
  try {
    return await selectAll<T>(table);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Could not find the table") || message.includes("does not exist") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

async function insertRow<T>(table: TableName, row: Record<string, unknown>) {
  return jsonRequest<T[]>(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  }).then((rows) => rows[0]);
}

async function updateRow<T>(table: TableName, recordId: number, row: Record<string, unknown>) {
  return jsonRequest<T[]>(`rest/v1/${table}?id=eq.${recordId}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  }).then((rows) => rows[0]);
}

async function deleteWhere(table: TableName, query: string) {
  await jsonRequest(`rest/v1/${table}?${query}`, { method: "DELETE" });
}

async function replacePlanPuppies(paymentPlanId: number, puppyIds: number[]) {
  await deleteWhere("payment_plan_puppies", `payment_plan_id=eq.${paymentPlanId}`);
  for (const puppyId of puppyIds) {
    await insertRow("payment_plan_puppies", { payment_plan_id: paymentPlanId, puppy_id: puppyId });
  }
}

export async function getKennelDataFromSupabase() {
  const [
    dogs,
    dogMedicalRecords,
    dogRegistrations,
    dogDocuments,
    litters,
    buyers,
    puppies,
    paymentPlans,
    paymentPlanPuppies,
    transactions,
    events,
    updates,
    buyerDocuments,
    buyerDocumentPuppies,
  ] = await Promise.all([
    selectSafeAll<Record<string, unknown>>("dogs"),
    selectSafeAll<Record<string, unknown>>("dog_medical_records"),
    selectSafeAll<Record<string, unknown>>("dog_registrations"),
    selectSafeAll<Record<string, unknown>>("dog_documents"),
    selectSafeAll<Record<string, unknown>>("litters"),
    selectSafeAll<Record<string, unknown>>("buyers"),
    selectSafeAll<Record<string, unknown>>("puppies"),
    selectSafeAll<Record<string, unknown>>("payment_plans"),
    selectSafeAll<{ payment_plan_id: number; puppy_id: number }>("payment_plan_puppies"),
    selectSafeAll<Record<string, unknown>>("transactions"),
    selectSafeAll<Record<string, unknown>>("events"),
    selectSafeAll<Record<string, unknown>>("puppy_updates"),
    selectSafeAll<Record<string, unknown>>("buyer_documents"),
    selectSafeAll<{ document_id: number; puppy_id: number }>("buyer_document_puppies"),
  ]);

  return {
    dogs: dogs.sort((left, right) => textValue(left, "name").localeCompare(textValue(right, "name"))),
    dog_medical_records: dogMedicalRecords.sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
    dog_registrations: dogRegistrations.sort((left, right) => textValue(left, "registry").localeCompare(textValue(right, "registry"))),
    dog_documents: dogDocuments.sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
    litters: litters.sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
    buyers: buyers.map(normalizeBuyer).sort((left, right) => `${textValue(left, "last_name")} ${textValue(left, "first_name")}`.localeCompare(`${textValue(right, "last_name")} ${textValue(right, "first_name")}`)),
    puppies: puppies.sort((left, right) => textValue(left, "name").localeCompare(textValue(right, "name"))),
    payment_plans: paymentPlans.map((plan: Record<string, unknown>) => ({
      ...plan,
      puppy_ids: paymentPlanPuppies
        .filter((link) => link.payment_plan_id === Number(plan.id))
        .map((link) => link.puppy_id),
    })).sort((left, right) => textValue(left, "status").localeCompare(textValue(right, "status"))),
    transactions: transactions.sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
    events: events.sort((left, right) => `${textValue(left, "event_date")}${textValue(left, "event_time")}`.localeCompare(`${textValue(right, "event_date")}${textValue(right, "event_time")}`)),
    updates: updates.sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
    buyer_documents: buyerDocuments.map((document: Record<string, unknown>) => ({
      ...document,
      puppy_ids: buyerDocumentPuppies
        .filter((link) => link.document_id === Number(document.id))
        .map((link) => link.puppy_id),
    })).sort((left, right) => textValue(right, "created_at").localeCompare(textValue(left, "created_at"))),
  };
}

export async function getCallerActivityFromSupabase() {
  const events = await selectSafeAll<Record<string, unknown>>("events");
  return events
    .filter((event) => ["Call", "Portal Request", "Transportation"].includes(textValue(event, "event_type")))
    .sort((left, right) => `${textValue(right, "event_date")}${textValue(right, "event_time")}${textValue(right, "created_at")}`.localeCompare(`${textValue(left, "event_date")}${textValue(left, "event_time")}${textValue(left, "created_at")}`));
}

function rowFor(resource: ResourceName, data: ResourceInput) {
  const now = new Date().toISOString();
  switch (resource) {
    case "dogs":
      return { name: str(data, "name"), registered_name: nullable(data, "registered_name"), sex: str(data, "sex"), role: str(data, "role"), date_of_birth: nullable(data, "date_of_birth"), color: nullable(data, "color"), weight: num(data, "weight"), registration_number: nullable(data, "registration_number"), microchip_number: nullable(data, "microchip_number"), health_testing: nullable(data, "health_testing"), acquired_from: nullable(data, "acquired_from"), acquisition_date: nullable(data, "acquisition_date"), purchase_price_cents: cents(data, "purchase_price") || null, acquisition_notes: nullable(data, "acquisition_notes"), status: str(data, "status") || "Active", next_heat_date: nullable(data, "next_heat_date"), notes: nullable(data, "notes"), updated_at: now };
    case "dog_medical_records":
      return { dog_id: id(data, "dog_id"), record_type: str(data, "record_type"), title: str(data, "title"), record_date: nullable(data, "record_date"), provider: nullable(data, "provider"), cost_cents: cents(data, "cost"), next_due_date: nullable(data, "next_due_date"), notes: nullable(data, "notes"), updated_at: now };
    case "dog_registrations":
      return { dog_id: id(data, "dog_id"), registry: str(data, "registry"), registration_number: str(data, "registration_number"), registered_name: nullable(data, "registered_name"), issue_date: nullable(data, "issue_date"), notes: nullable(data, "notes"), updated_at: now };
    case "litters":
      return { name: str(data, "name"), dam_id: id(data, "dam_id"), sire_id: id(data, "sire_id"), breeding_date: nullable(data, "breeding_date"), due_date: nullable(data, "due_date"), birth_date: nullable(data, "birth_date"), expected_count: num(data, "expected_count"), status: str(data, "status") || "Planned", notes: nullable(data, "notes"), updated_at: now };
    case "buyers":
      return { first_name: str(data, "first_name"), last_name: str(data, "last_name"), email: str(data, "email"), phone: nullable(data, "phone"), city: nullable(data, "city"), state: nullable(data, "state"), application_status: str(data, "application_status") || "Inquiry", preferred_sex: nullable(data, "preferred_sex"), preferred_color: nullable(data, "preferred_color"), household_notes: nullable(data, "household_notes"), notes: nullable(data, "notes"), updated_at: now };
    case "puppies":
      return { litter_id: id(data, "litter_id"), buyer_id: id(data, "buyer_id"), name: str(data, "name"), sex: nullable(data, "sex"), color: nullable(data, "color"), birth_date: nullable(data, "birth_date"), birth_weight: num(data, "birth_weight"), current_weight: num(data, "current_weight"), status: str(data, "status") || "Available", price_cents: cents(data, "price") || null, notes: nullable(data, "notes"), updated_at: now };
    case "transactions":
      return { type: str(data, "type"), dog_id: id(data, "dog_id"), buyer_id: id(data, "buyer_id"), litter_id: id(data, "litter_id"), puppy_id: id(data, "puppy_id"), payment_plan_id: id(data, "payment_plan_id"), category: nullable(data, "category"), description: str(data, "description"), amount_cents: cents(data, "amount"), due_date: nullable(data, "due_date"), paid_date: nullable(data, "paid_date"), status: str(data, "status") || "Pending", method: nullable(data, "method"), notes: nullable(data, "notes"), updated_at: now };
    case "events":
      return { title: str(data, "title"), event_type: str(data, "event_type"), event_date: str(data, "event_date"), event_time: nullable(data, "event_time"), related_type: nullable(data, "related_type"), related_id: id(data, "related_id"), location: nullable(data, "location"), status: str(data, "status") || "Scheduled", notes: nullable(data, "notes"), updated_at: now };
    case "updates":
      return { puppy_id: id(data, "puppy_id"), title: str(data, "title"), body: str(data, "body"), week_number: num(data, "week_number"), weight: num(data, "weight"), published: Boolean(data.published), updated_at: now };
    case "payment_plans":
      return { buyer_id: id(data, "buyer_id"), name: str(data, "name") || "Puppy payment plan", total_amount_cents: cents(data, "total_amount"), payment_amount_cents: cents(data, "payment_amount"), term_count: num(data, "term_count"), frequency: str(data, "frequency") || "Monthly", start_date: nullable(data, "start_date"), next_due_date: nullable(data, "next_due_date"), on_time_credit_cents: cents(data, "credit_amount"), credit_eligible: Boolean(data.credit_eligible), status: str(data, "status") || "Active", notes: nullable(data, "notes"), updated_at: now };
  }
}

async function linkedBuyerId(table: "payment_plans" | "puppies", recordId: number | null) {
  if (!recordId) return null;
  const rows = await selectAll<Record<string, unknown>>(table, `select=buyer_id&id=eq.${recordId}&limit=1`);
  return id(rows[0] ?? {}, "buyer_id");
}

async function transactionRowFor(data: ResourceInput) {
  const row = rowFor("transactions", data);
  const transactionType = str(data, "type");
  if (!row || !["Payment", "Deposit"].includes(transactionType)) return row;

  const specifiedBuyerId = id(data, "buyer_id");
  const [planBuyerId, puppyBuyerId] = await Promise.all([
    linkedBuyerId("payment_plans", id(data, "payment_plan_id")),
    linkedBuyerId("puppies", id(data, "puppy_id")),
  ]);
  const linkedBuyerIds = [...new Set([planBuyerId, puppyBuyerId].filter((value): value is number => Boolean(value)))];

  if (linkedBuyerIds.length > 1 || (specifiedBuyerId && linkedBuyerIds.some((buyerId) => buyerId !== specifiedBuyerId))) {
    throw new ResourceValidationError("The selected puppy or payment plan belongs to a different family. Choose records assigned to the same buyer.");
  }

  const buyerId = specifiedBuyerId ?? linkedBuyerIds[0] ?? null;
  if (!buyerId) {
    throw new ResourceValidationError("Choose a buyer / family before saving a payment or deposit.");
  }

  return { ...row, buyer_id: buyerId };
}

async function preparedRowFor(resource: ResourceName, data: ResourceInput) {
  return resource === "transactions" ? transactionRowFor(data) : rowFor(resource, data);
}

export async function createSupabaseResource(resource: ResourceName, data: ResourceInput) {
  const row = { ...await preparedRowFor(resource, data), created_at: new Date().toISOString() };
  const created = await insertRow<Record<string, unknown>>(tableFor(resource), row);
  if (resource === "payment_plans") {
    const puppyIds = ids(data, "puppy_ids");
    await replacePlanPuppies(Number(created.id), puppyIds);
    return { ...created, puppy_ids: puppyIds };
  }
  return created;
}

export async function updateSupabaseResource(resource: ResourceName, recordId: number, data: ResourceInput) {
  const updated = await updateRow<Record<string, unknown>>(tableFor(resource), recordId, await preparedRowFor(resource, data));
  if (resource === "payment_plans") {
    const puppyIds = ids(data, "puppy_ids");
    await replacePlanPuppies(recordId, puppyIds);
    return { ...updated, puppy_ids: puppyIds };
  }
  return updated;
}

export async function deleteSupabaseResource(resource: ResourceName, recordId: number) {
  await deleteWhere(tableFor(resource), `id=eq.${recordId}`);
}
