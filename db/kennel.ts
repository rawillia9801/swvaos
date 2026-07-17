import { env } from "cloudflare:workers";
import type { ResourceInput, ResourceName } from "./resources";
export { isResource, type ResourceInput, type ResourceName } from "./resources";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS dogs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, registered_name TEXT, sex TEXT NOT NULL, role TEXT NOT NULL, date_of_birth TEXT, color TEXT, weight REAL, registration_number TEXT, microchip_number TEXT, health_testing TEXT, acquired_from TEXT, acquisition_date TEXT, purchase_price_cents INTEGER, acquisition_notes TEXT, status TEXT NOT NULL DEFAULT 'Active', next_heat_date TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dog_medical_records (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE, record_type TEXT NOT NULL, title TEXT NOT NULL, record_date TEXT, provider TEXT, cost_cents INTEGER NOT NULL DEFAULT 0, next_due_date TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dog_registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE, registry TEXT NOT NULL, registration_number TEXT NOT NULL, registered_name TEXT, issue_date TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dog_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE, registration_id INTEGER REFERENCES dog_registrations(id) ON DELETE SET NULL, document_type TEXT NOT NULL, registry TEXT, registration_number TEXT, title TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS buyers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, city TEXT, state TEXT, application_status TEXT NOT NULL DEFAULT 'Inquiry', preferred_sex TEXT, preferred_color TEXT, household_notes TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS litters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dam_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL, sire_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL, breeding_date TEXT, due_date TEXT, birth_date TEXT, expected_count INTEGER, status TEXT NOT NULL DEFAULT 'Planned', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS puppies (id INTEGER PRIMARY KEY AUTOINCREMENT, litter_id INTEGER NOT NULL REFERENCES litters(id) ON DELETE CASCADE, buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL, name TEXT NOT NULL, sex TEXT, color TEXT, birth_date TEXT, birth_weight REAL, current_weight REAL, status TEXT NOT NULL DEFAULT 'Available', price_cents INTEGER, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payment_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE, name TEXT NOT NULL DEFAULT 'Puppy payment plan', total_amount_cents INTEGER NOT NULL, payment_amount_cents INTEGER NOT NULL, term_count INTEGER NOT NULL, frequency TEXT NOT NULL DEFAULT 'Monthly', start_date TEXT, next_due_date TEXT, on_time_credit_cents INTEGER NOT NULL DEFAULT 0, credit_eligible INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'Active', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payment_plan_puppies (payment_plan_id INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE, puppy_id INTEGER NOT NULL REFERENCES puppies(id) ON DELETE CASCADE, PRIMARY KEY (payment_plan_id, puppy_id))`,
  `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, dog_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL, buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL, litter_id INTEGER REFERENCES litters(id) ON DELETE SET NULL, puppy_id INTEGER REFERENCES puppies(id) ON DELETE SET NULL, payment_plan_id INTEGER REFERENCES payment_plans(id) ON DELETE SET NULL, category TEXT, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, due_date TEXT, paid_date TEXT, status TEXT NOT NULL DEFAULT 'Pending', method TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS buyer_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE, payment_plan_id INTEGER REFERENCES payment_plans(id) ON DELETE SET NULL, document_type TEXT NOT NULL, title TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS buyer_document_puppies (document_id INTEGER NOT NULL REFERENCES buyer_documents(id) ON DELETE CASCADE, puppy_id INTEGER NOT NULL REFERENCES puppies(id) ON DELETE CASCADE, PRIMARY KEY (document_id, puppy_id))`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_type TEXT NOT NULL, event_date TEXT NOT NULL, event_time TEXT, related_type TEXT, related_id INTEGER, location TEXT, status TEXT NOT NULL DEFAULT 'Scheduled', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS puppy_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, puppy_id INTEGER NOT NULL REFERENCES puppies(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, week_number INTEGER, weight REAL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS dogs_name_idx ON dogs(name)`,
  `CREATE INDEX IF NOT EXISTS dog_medical_records_dog_idx ON dog_medical_records(dog_id)`,
  `CREATE INDEX IF NOT EXISTS dog_medical_records_date_idx ON dog_medical_records(record_date)`,
  `CREATE INDEX IF NOT EXISTS dog_registrations_dog_idx ON dog_registrations(dog_id)`,
  `CREATE INDEX IF NOT EXISTS dog_documents_dog_idx ON dog_documents(dog_id)`,
  `CREATE INDEX IF NOT EXISTS dog_documents_registration_idx ON dog_documents(registration_id)`,
  `CREATE INDEX IF NOT EXISTS dog_documents_type_idx ON dog_documents(document_type)`,
  `CREATE INDEX IF NOT EXISTS buyers_email_idx ON buyers(email)`,
  `CREATE INDEX IF NOT EXISTS litters_status_idx ON litters(status)`,
  `CREATE INDEX IF NOT EXISTS puppies_litter_idx ON puppies(litter_id)`,
  `CREATE INDEX IF NOT EXISTS payment_plans_buyer_idx ON payment_plans(buyer_id)`,
  `CREATE INDEX IF NOT EXISTS payment_plans_status_idx ON payment_plans(status)`,
  `CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS buyer_documents_buyer_idx ON buyer_documents(buyer_id)`,
  `CREATE INDEX IF NOT EXISTS buyer_documents_plan_idx ON buyer_documents(payment_plan_id)`,
  `CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date)`,
  `CREATE INDEX IF NOT EXISTS updates_puppy_idx ON puppy_updates(puppy_id)`,
];

export async function ensureDatabase() {
  await env.DB.batch(schemaStatements.map((statement) => env.DB.prepare(statement)));
}

export async function getKennelData() {
  await ensureDatabase();
  const [dogs, dogMedicalRecords, dogRegistrations, dogDocuments, litters, buyers, puppies, paymentPlans, paymentPlanPuppies, transactions, events, updates, buyerDocuments, buyerDocumentPuppies] = await Promise.all([
    env.DB.prepare("SELECT * FROM dogs ORDER BY name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM dog_medical_records ORDER BY COALESCE(record_date, created_at) DESC").all(),
    env.DB.prepare("SELECT * FROM dog_registrations ORDER BY registry COLLATE NOCASE, registration_number COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM dog_documents ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM litters ORDER BY COALESCE(due_date, birth_date, breeding_date, created_at) DESC").all(),
    env.DB.prepare("SELECT * FROM buyers ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM puppies ORDER BY litter_id DESC, name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM payment_plans ORDER BY status = 'Active' DESC, COALESCE(next_due_date, start_date, created_at)").all(),
    env.DB.prepare("SELECT payment_plan_id, puppy_id FROM payment_plan_puppies").all(),
    env.DB.prepare("SELECT * FROM transactions ORDER BY COALESCE(paid_date, due_date, created_at) DESC").all(),
    env.DB.prepare("SELECT * FROM events ORDER BY event_date, event_time").all(),
    env.DB.prepare("SELECT * FROM puppy_updates ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM buyer_documents ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT document_id, puppy_id FROM buyer_document_puppies").all(),
  ]);
  const planLinks = paymentPlanPuppies.results as { payment_plan_id: number; puppy_id: number }[];
  const documentLinks = buyerDocumentPuppies.results as { document_id: number; puppy_id: number }[];
  return {
    dogs: dogs.results,
    dog_medical_records: dogMedicalRecords.results,
    dog_registrations: dogRegistrations.results,
    dog_documents: dogDocuments.results,
    litters: litters.results,
    buyers: buyers.results,
    puppies: puppies.results,
    payment_plans: paymentPlans.results.map((plan) => ({ ...plan, puppy_ids: planLinks.filter((link) => link.payment_plan_id === Number(plan.id)).map((link) => link.puppy_id) })),
    transactions: transactions.results,
    events: events.results,
    updates: updates.results,
    buyer_documents: buyerDocuments.results.map((document) => ({ ...document, puppy_ids: documentLinks.filter((link) => link.document_id === Number(document.id)).map((link) => link.puppy_id) })),
  };
}

const str = (data: ResourceInput, key: string) => data[key] == null ? "" : String(data[key]).trim();
const nullable = (data: ResourceInput, key: string) => str(data, key) || null;
const num = (data: ResourceInput, key: string) => {
  const value = Number(data[key]);
  return Number.isFinite(value) ? value : null;
};
const id = (data: ResourceInput, key: string) => {
  const value = Number(data[key]);
  return Number.isInteger(value) && value > 0 ? value : null;
};
const cents = (data: ResourceInput, key: string) => Math.round((num(data, key) ?? 0) * 100);
const dollars = (data: ResourceInput) => cents(data, "amount");
const ids = (data: ResourceInput, key: string) => {
  const raw = data[key];
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
};

async function replacePlanPuppies(paymentPlanId: number, buyerId: number, puppyIds: number[]) {
  if (puppyIds.length) {
    const placeholders = puppyIds.map(() => "?").join(",");
    const matches = await env.DB.prepare(`SELECT id FROM puppies WHERE buyer_id = ? AND id IN (${placeholders})`).bind(buyerId, ...puppyIds).all<{ id: number }>();
    if (matches.results.length !== puppyIds.length) throw new Error("Every puppy on a payment plan must be assigned to that buyer.");
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM payment_plan_puppies WHERE payment_plan_id = ?").bind(paymentPlanId),
    ...puppyIds.map((puppyId) => env.DB.prepare("INSERT INTO payment_plan_puppies (payment_plan_id, puppy_id) VALUES (?, ?)").bind(paymentPlanId, puppyId)),
  ]);
}

export async function createResource(resource: ResourceName, data: ResourceInput) {
  await ensureDatabase();
  const now = new Date().toISOString();
  switch (resource) {
    case "dogs":
      return env.DB.prepare("INSERT INTO dogs (name, registered_name, sex, role, date_of_birth, color, weight, registration_number, microchip_number, health_testing, acquired_from, acquisition_date, purchase_price_cents, acquisition_notes, status, next_heat_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"name"), nullable(data,"registered_name"), str(data,"sex"), str(data,"role"), nullable(data,"date_of_birth"), nullable(data,"color"), num(data,"weight"), nullable(data,"registration_number"), nullable(data,"microchip_number"), nullable(data,"health_testing"), nullable(data,"acquired_from"), nullable(data,"acquisition_date"), cents(data,"purchase_price") || null, nullable(data,"acquisition_notes"), str(data,"status") || "Active", nullable(data,"next_heat_date"), nullable(data,"notes"), now, now).first();
    case "dog_medical_records":
      return env.DB.prepare("INSERT INTO dog_medical_records (dog_id, record_type, title, record_date, provider, cost_cents, next_due_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(id(data,"dog_id"), str(data,"record_type"), str(data,"title"), nullable(data,"record_date"), nullable(data,"provider"), cents(data,"cost"), nullable(data,"next_due_date"), nullable(data,"notes"), now, now).first();
    case "dog_registrations":
      return env.DB.prepare("INSERT INTO dog_registrations (dog_id, registry, registration_number, registered_name, issue_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(id(data,"dog_id"), str(data,"registry"), str(data,"registration_number"), nullable(data,"registered_name"), nullable(data,"issue_date"), nullable(data,"notes"), now, now).first();
    case "litters":
      return env.DB.prepare("INSERT INTO litters (name, dam_id, sire_id, breeding_date, due_date, birth_date, expected_count, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"name"), id(data,"dam_id"), id(data,"sire_id"), nullable(data,"breeding_date"), nullable(data,"due_date"), nullable(data,"birth_date"), num(data,"expected_count"), str(data,"status") || "Planned", nullable(data,"notes"), now, now).first();
    case "buyers":
      return env.DB.prepare("INSERT INTO buyers (first_name, last_name, email, phone, city, state, application_status, preferred_sex, preferred_color, household_notes, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"first_name"), str(data,"last_name"), str(data,"email"), nullable(data,"phone"), nullable(data,"city"), nullable(data,"state"), str(data,"application_status") || "Inquiry", nullable(data,"preferred_sex"), nullable(data,"preferred_color"), nullable(data,"household_notes"), nullable(data,"notes"), now, now).first();
    case "puppies":
      return env.DB.prepare("INSERT INTO puppies (litter_id, buyer_id, name, sex, color, birth_date, birth_weight, current_weight, status, price_cents, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(id(data,"litter_id"), id(data,"buyer_id"), str(data,"name"), nullable(data,"sex"), nullable(data,"color"), nullable(data,"birth_date"), num(data,"birth_weight"), num(data,"current_weight"), str(data,"status") || "Available", Math.round((num(data,"price") ?? 0) * 100) || null, nullable(data,"notes"), now, now).first();
    case "payment_plans": {
      const buyerId = id(data, "buyer_id");
      const totalAmountCents = cents(data, "total_amount");
      const paymentAmountCents = cents(data, "payment_amount");
      const termCount = num(data, "term_count");
      if (!buyerId || totalAmountCents <= 0 || paymentAmountCents <= 0 || !termCount || termCount <= 0) throw new Error("Buyer, contract amount, payment amount, and term are required.");
      const plan = await env.DB.prepare("INSERT INTO payment_plans (buyer_id, name, total_amount_cents, payment_amount_cents, term_count, frequency, start_date, next_due_date, on_time_credit_cents, credit_eligible, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(buyerId, str(data,"name") || "Puppy payment plan", totalAmountCents, paymentAmountCents, termCount, str(data,"frequency") || "Monthly", nullable(data,"start_date"), nullable(data,"next_due_date"), cents(data,"credit_amount"), data.credit_eligible ? 1 : 0, str(data,"status") || "Active", nullable(data,"notes"), now, now).first<Record<string, unknown> & { id: number }>();
      if (!plan) throw new Error("Unable to create the payment plan.");
      const puppyIds = ids(data, "puppy_ids");
      await replacePlanPuppies(plan.id, buyerId, puppyIds);
      return { ...plan, puppy_ids: puppyIds };
    }
    case "transactions":
      return env.DB.prepare("INSERT INTO transactions (type, dog_id, buyer_id, litter_id, puppy_id, payment_plan_id, category, description, amount_cents, due_date, paid_date, status, method, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"type"), id(data,"dog_id"), id(data,"buyer_id"), id(data,"litter_id"), id(data,"puppy_id"), id(data,"payment_plan_id"), nullable(data,"category"), str(data,"description"), dollars(data), nullable(data,"due_date"), nullable(data,"paid_date"), str(data,"status") || "Pending", nullable(data,"method"), nullable(data,"notes"), now, now).first();
    case "events":
      return env.DB.prepare("INSERT INTO events (title, event_type, event_date, event_time, related_type, related_id, location, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"title"), str(data,"event_type"), str(data,"event_date"), nullable(data,"event_time"), nullable(data,"related_type"), id(data,"related_id"), nullable(data,"location"), str(data,"status") || "Scheduled", nullable(data,"notes"), now, now).first();
    case "updates":
      return env.DB.prepare("INSERT INTO puppy_updates (puppy_id, title, body, week_number, weight, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(id(data,"puppy_id"), str(data,"title"), str(data,"body"), num(data,"week_number"), num(data,"weight"), data.published ? 1 : 0, now, now).first();
  }
}

export async function updateResource(resource: ResourceName, recordId: number, data: ResourceInput) {
  await ensureDatabase();
  const now = new Date().toISOString();
  switch (resource) {
    case "dogs":
      return env.DB.prepare("UPDATE dogs SET name=?, registered_name=?, sex=?, role=?, date_of_birth=?, color=?, weight=?, registration_number=?, microchip_number=?, health_testing=?, acquired_from=?, acquisition_date=?, purchase_price_cents=?, acquisition_notes=?, status=?, next_heat_date=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"name"), nullable(data,"registered_name"), str(data,"sex"), str(data,"role"), nullable(data,"date_of_birth"), nullable(data,"color"), num(data,"weight"), nullable(data,"registration_number"), nullable(data,"microchip_number"), nullable(data,"health_testing"), nullable(data,"acquired_from"), nullable(data,"acquisition_date"), cents(data,"purchase_price") || null, nullable(data,"acquisition_notes"), str(data,"status") || "Active", nullable(data,"next_heat_date"), nullable(data,"notes"), now, recordId).first();
    case "dog_medical_records":
      return env.DB.prepare("UPDATE dog_medical_records SET dog_id=?, record_type=?, title=?, record_date=?, provider=?, cost_cents=?, next_due_date=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(id(data,"dog_id"), str(data,"record_type"), str(data,"title"), nullable(data,"record_date"), nullable(data,"provider"), cents(data,"cost"), nullable(data,"next_due_date"), nullable(data,"notes"), now, recordId).first();
    case "dog_registrations":
      return env.DB.prepare("UPDATE dog_registrations SET dog_id=?, registry=?, registration_number=?, registered_name=?, issue_date=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(id(data,"dog_id"), str(data,"registry"), str(data,"registration_number"), nullable(data,"registered_name"), nullable(data,"issue_date"), nullable(data,"notes"), now, recordId).first();
    case "litters":
      return env.DB.prepare("UPDATE litters SET name=?, dam_id=?, sire_id=?, breeding_date=?, due_date=?, birth_date=?, expected_count=?, status=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"name"), id(data,"dam_id"), id(data,"sire_id"), nullable(data,"breeding_date"), nullable(data,"due_date"), nullable(data,"birth_date"), num(data,"expected_count"), str(data,"status") || "Planned", nullable(data,"notes"), now, recordId).first();
    case "buyers":
      return env.DB.prepare("UPDATE buyers SET first_name=?, last_name=?, email=?, phone=?, city=?, state=?, application_status=?, preferred_sex=?, preferred_color=?, household_notes=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"first_name"), str(data,"last_name"), str(data,"email"), nullable(data,"phone"), nullable(data,"city"), nullable(data,"state"), str(data,"application_status") || "Inquiry", nullable(data,"preferred_sex"), nullable(data,"preferred_color"), nullable(data,"household_notes"), nullable(data,"notes"), now, recordId).first();
    case "puppies":
      return env.DB.prepare("UPDATE puppies SET litter_id=?, buyer_id=?, name=?, sex=?, color=?, birth_date=?, birth_weight=?, current_weight=?, status=?, price_cents=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(id(data,"litter_id"), id(data,"buyer_id"), str(data,"name"), nullable(data,"sex"), nullable(data,"color"), nullable(data,"birth_date"), num(data,"birth_weight"), num(data,"current_weight"), str(data,"status") || "Available", Math.round((num(data,"price") ?? 0) * 100) || null, nullable(data,"notes"), now, recordId).first();
    case "payment_plans": {
      const buyerId = id(data, "buyer_id");
      const totalAmountCents = cents(data, "total_amount");
      const paymentAmountCents = cents(data, "payment_amount");
      const termCount = num(data, "term_count");
      if (!buyerId || totalAmountCents <= 0 || paymentAmountCents <= 0 || !termCount || termCount <= 0) throw new Error("Buyer, contract amount, payment amount, and term are required.");
      const plan = await env.DB.prepare("UPDATE payment_plans SET buyer_id=?, name=?, total_amount_cents=?, payment_amount_cents=?, term_count=?, frequency=?, start_date=?, next_due_date=?, on_time_credit_cents=?, credit_eligible=?, status=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(buyerId, str(data,"name") || "Puppy payment plan", totalAmountCents, paymentAmountCents, termCount, str(data,"frequency") || "Monthly", nullable(data,"start_date"), nullable(data,"next_due_date"), cents(data,"credit_amount"), data.credit_eligible ? 1 : 0, str(data,"status") || "Active", nullable(data,"notes"), now, recordId).first<Record<string, unknown> & { id: number }>();
      if (!plan) throw new Error("Payment plan not found.");
      const puppyIds = ids(data, "puppy_ids");
      await replacePlanPuppies(recordId, buyerId, puppyIds);
      return { ...plan, puppy_ids: puppyIds };
    }
    case "transactions":
      return env.DB.prepare("UPDATE transactions SET type=?, dog_id=?, buyer_id=?, litter_id=?, puppy_id=?, payment_plan_id=?, category=?, description=?, amount_cents=?, due_date=?, paid_date=?, status=?, method=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"type"), id(data,"dog_id"), id(data,"buyer_id"), id(data,"litter_id"), id(data,"puppy_id"), id(data,"payment_plan_id"), nullable(data,"category"), str(data,"description"), dollars(data), nullable(data,"due_date"), nullable(data,"paid_date"), str(data,"status") || "Pending", nullable(data,"method"), nullable(data,"notes"), now, recordId).first();
    case "events":
      return env.DB.prepare("UPDATE events SET title=?, event_type=?, event_date=?, event_time=?, related_type=?, related_id=?, location=?, status=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"title"), str(data,"event_type"), str(data,"event_date"), nullable(data,"event_time"), nullable(data,"related_type"), id(data,"related_id"), nullable(data,"location"), str(data,"status") || "Scheduled", nullable(data,"notes"), now, recordId).first();
    case "updates":
      return env.DB.prepare("UPDATE puppy_updates SET puppy_id=?, title=?, body=?, week_number=?, weight=?, published=?, updated_at=? WHERE id=? RETURNING *")
        .bind(id(data,"puppy_id"), str(data,"title"), str(data,"body"), num(data,"week_number"), num(data,"weight"), data.published ? 1 : 0, now, recordId).first();
  }
}

export async function deleteResource(resource: ResourceName, recordId: number) {
  await ensureDatabase();
  if (resource === "buyers") {
    const documents = await env.DB.prepare("SELECT COUNT(*) AS count FROM buyer_documents WHERE buyer_id = ?").bind(recordId).first<{ count: number }>();
    if (Number(documents?.count) > 0) throw new Error("Delete this buyer's stored documents before deleting the buyer record.");
  }
  if (resource === "dogs") {
    const documents = await env.DB.prepare("SELECT COUNT(*) AS count FROM dog_documents WHERE dog_id = ?").bind(recordId).first<{ count: number }>();
    if (Number(documents?.count) > 0) throw new Error("Delete this dog's stored documents before deleting the dog record.");
  }
  const table = resource === "updates" ? "puppy_updates" : resource;
  const allowedTables = ["dogs", "dog_medical_records", "dog_registrations", "litters", "buyers", "puppies", "payment_plans", "transactions", "events", "puppy_updates"];
  if (!allowedTables.includes(table)) throw new Error("Unsupported resource");
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(recordId).run();
}
