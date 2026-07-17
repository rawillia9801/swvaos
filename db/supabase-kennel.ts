import { supabaseRequest } from "./supabase";
import type { ResourceInput, ResourceName } from "./resources";

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
    selectAll<Record<string, unknown>>("dogs", "select=*&order=name.asc"),
    selectAll<Record<string, unknown>>("dog_medical_records", "select=*&order=record_date.desc.nullslast,created_at.desc"),
    selectAll<Record<string, unknown>>("dog_registrations", "select=*&order=registry.asc,registration_number.asc"),
    selectAll<Record<string, unknown>>("dog_documents", "select=*&order=created_at.desc"),
    selectAll<Record<string, unknown>>("litters", "select=*&order=created_at.desc"),
    selectAll<Record<string, unknown>>("buyers", "select=*&order=created_at.desc"),
    selectAll<Record<string, unknown>>("puppies", "select=*&order=litter_id.desc,name.asc"),
    selectAll<Record<string, unknown>>("payment_plans", "select=*&order=status.asc,next_due_date.asc.nullslast"),
    selectAll<{ payment_plan_id: number; puppy_id: number }>("payment_plan_puppies"),
    selectAll<Record<string, unknown>>("transactions", "select=*&order=created_at.desc"),
    selectAll<Record<string, unknown>>("events", "select=*&order=event_date.asc,event_time.asc.nullslast"),
    selectAll<Record<string, unknown>>("puppy_updates", "select=*&order=created_at.desc"),
    selectAll<Record<string, unknown>>("buyer_documents", "select=*&order=created_at.desc"),
    selectAll<{ document_id: number; puppy_id: number }>("buyer_document_puppies"),
  ]);

  return {
    dogs,
    dog_medical_records: dogMedicalRecords,
    dog_registrations: dogRegistrations,
    dog_documents: dogDocuments,
    litters,
    buyers: buyers.map(normalizeBuyer),
    puppies,
    payment_plans: paymentPlans.map((plan: Record<string, unknown>) => ({
      ...plan,
      puppy_ids: paymentPlanPuppies
        .filter((link) => link.payment_plan_id === Number(plan.id))
        .map((link) => link.puppy_id),
    })),
    transactions,
    events,
    updates,
    buyer_documents: buyerDocuments.map((document: Record<string, unknown>) => ({
      ...document,
      puppy_ids: buyerDocumentPuppies
        .filter((link) => link.document_id === Number(document.id))
        .map((link) => link.puppy_id),
    })),
  };
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

export async function createSupabaseResource(resource: ResourceName, data: ResourceInput) {
  const row = { ...rowFor(resource, data), created_at: new Date().toISOString() };
  const created = await insertRow<Record<string, unknown>>(tableFor(resource), row);
  if (resource === "payment_plans") {
    const puppyIds = ids(data, "puppy_ids");
    await replacePlanPuppies(Number(created.id), puppyIds);
    return { ...created, puppy_ids: puppyIds };
  }
  return created;
}

export async function updateSupabaseResource(resource: ResourceName, recordId: number, data: ResourceInput) {
  const updated = await updateRow<Record<string, unknown>>(tableFor(resource), recordId, rowFor(resource, data));
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
