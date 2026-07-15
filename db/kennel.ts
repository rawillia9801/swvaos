import { env } from "cloudflare:workers";

export type ResourceName = "dogs" | "litters" | "buyers" | "puppies" | "transactions" | "events" | "updates";
export type ResourceInput = Record<string, unknown>;

const resources: ResourceName[] = ["dogs", "litters", "buyers", "puppies", "transactions", "events", "updates"];
export function isResource(value: unknown): value is ResourceName {
  return typeof value === "string" && resources.includes(value as ResourceName);
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS dogs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, registered_name TEXT, sex TEXT NOT NULL, role TEXT NOT NULL, date_of_birth TEXT, color TEXT, weight REAL, registration_number TEXT, microchip_number TEXT, health_testing TEXT, status TEXT NOT NULL DEFAULT 'Active', next_heat_date TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS buyers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, city TEXT, state TEXT, application_status TEXT NOT NULL DEFAULT 'Inquiry', preferred_sex TEXT, preferred_color TEXT, household_notes TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS litters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dam_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL, sire_id INTEGER REFERENCES dogs(id) ON DELETE SET NULL, breeding_date TEXT, due_date TEXT, birth_date TEXT, expected_count INTEGER, status TEXT NOT NULL DEFAULT 'Planned', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS puppies (id INTEGER PRIMARY KEY AUTOINCREMENT, litter_id INTEGER NOT NULL REFERENCES litters(id) ON DELETE CASCADE, buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL, name TEXT NOT NULL, sex TEXT, color TEXT, birth_date TEXT, birth_weight REAL, current_weight REAL, status TEXT NOT NULL DEFAULT 'Available', price_cents INTEGER, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL, litter_id INTEGER REFERENCES litters(id) ON DELETE SET NULL, puppy_id INTEGER REFERENCES puppies(id) ON DELETE SET NULL, category TEXT, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, due_date TEXT, paid_date TEXT, status TEXT NOT NULL DEFAULT 'Pending', method TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_type TEXT NOT NULL, event_date TEXT NOT NULL, event_time TEXT, related_type TEXT, related_id INTEGER, location TEXT, status TEXT NOT NULL DEFAULT 'Scheduled', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS puppy_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, puppy_id INTEGER NOT NULL REFERENCES puppies(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, week_number INTEGER, weight REAL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS dogs_name_idx ON dogs(name)`,
  `CREATE INDEX IF NOT EXISTS buyers_email_idx ON buyers(email)`,
  `CREATE INDEX IF NOT EXISTS litters_status_idx ON litters(status)`,
  `CREATE INDEX IF NOT EXISTS puppies_litter_idx ON puppies(litter_id)`,
  `CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date)`,
  `CREATE INDEX IF NOT EXISTS updates_puppy_idx ON puppy_updates(puppy_id)`,
];

async function ensureDatabase() {
  await env.DB.batch(schemaStatements.map((statement) => env.DB.prepare(statement)));
}

export async function getKennelData() {
  await ensureDatabase();
  const [dogs, litters, buyers, puppies, transactions, events, updates] = await Promise.all([
    env.DB.prepare("SELECT * FROM dogs ORDER BY name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM litters ORDER BY COALESCE(due_date, birth_date, breeding_date, created_at) DESC").all(),
    env.DB.prepare("SELECT * FROM buyers ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM puppies ORDER BY litter_id DESC, name COLLATE NOCASE").all(),
    env.DB.prepare("SELECT * FROM transactions ORDER BY COALESCE(paid_date, due_date, created_at) DESC").all(),
    env.DB.prepare("SELECT * FROM events ORDER BY event_date, event_time").all(),
    env.DB.prepare("SELECT * FROM puppy_updates ORDER BY created_at DESC").all(),
  ]);
  return { dogs: dogs.results, litters: litters.results, buyers: buyers.results, puppies: puppies.results, transactions: transactions.results, events: events.results, updates: updates.results };
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
const dollars = (data: ResourceInput) => Math.round((num(data, "amount") ?? 0) * 100);

export async function createResource(resource: ResourceName, data: ResourceInput) {
  await ensureDatabase();
  const now = new Date().toISOString();
  switch (resource) {
    case "dogs":
      return env.DB.prepare("INSERT INTO dogs (name, registered_name, sex, role, date_of_birth, color, weight, registration_number, microchip_number, health_testing, status, next_heat_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"name"), nullable(data,"registered_name"), str(data,"sex"), str(data,"role"), nullable(data,"date_of_birth"), nullable(data,"color"), num(data,"weight"), nullable(data,"registration_number"), nullable(data,"microchip_number"), nullable(data,"health_testing"), str(data,"status") || "Active", nullable(data,"next_heat_date"), nullable(data,"notes"), now, now).first();
    case "litters":
      return env.DB.prepare("INSERT INTO litters (name, dam_id, sire_id, breeding_date, due_date, birth_date, expected_count, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"name"), id(data,"dam_id"), id(data,"sire_id"), nullable(data,"breeding_date"), nullable(data,"due_date"), nullable(data,"birth_date"), num(data,"expected_count"), str(data,"status") || "Planned", nullable(data,"notes"), now, now).first();
    case "buyers":
      return env.DB.prepare("INSERT INTO buyers (first_name, last_name, email, phone, city, state, application_status, preferred_sex, preferred_color, household_notes, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"first_name"), str(data,"last_name"), str(data,"email"), nullable(data,"phone"), nullable(data,"city"), nullable(data,"state"), str(data,"application_status") || "Inquiry", nullable(data,"preferred_sex"), nullable(data,"preferred_color"), nullable(data,"household_notes"), nullable(data,"notes"), now, now).first();
    case "puppies":
      return env.DB.prepare("INSERT INTO puppies (litter_id, buyer_id, name, sex, color, birth_date, birth_weight, current_weight, status, price_cents, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(id(data,"litter_id"), id(data,"buyer_id"), str(data,"name"), nullable(data,"sex"), nullable(data,"color"), nullable(data,"birth_date"), num(data,"birth_weight"), num(data,"current_weight"), str(data,"status") || "Available", Math.round((num(data,"price") ?? 0) * 100) || null, nullable(data,"notes"), now, now).first();
    case "transactions":
      return env.DB.prepare("INSERT INTO transactions (type, buyer_id, litter_id, puppy_id, category, description, amount_cents, due_date, paid_date, status, method, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *")
        .bind(str(data,"type"), id(data,"buyer_id"), id(data,"litter_id"), id(data,"puppy_id"), nullable(data,"category"), str(data,"description"), dollars(data), nullable(data,"due_date"), nullable(data,"paid_date"), str(data,"status") || "Pending", nullable(data,"method"), nullable(data,"notes"), now, now).first();
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
      return env.DB.prepare("UPDATE dogs SET name=?, registered_name=?, sex=?, role=?, date_of_birth=?, color=?, weight=?, registration_number=?, microchip_number=?, health_testing=?, status=?, next_heat_date=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"name"), nullable(data,"registered_name"), str(data,"sex"), str(data,"role"), nullable(data,"date_of_birth"), nullable(data,"color"), num(data,"weight"), nullable(data,"registration_number"), nullable(data,"microchip_number"), nullable(data,"health_testing"), str(data,"status") || "Active", nullable(data,"next_heat_date"), nullable(data,"notes"), now, recordId).first();
    case "litters":
      return env.DB.prepare("UPDATE litters SET name=?, dam_id=?, sire_id=?, breeding_date=?, due_date=?, birth_date=?, expected_count=?, status=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"name"), id(data,"dam_id"), id(data,"sire_id"), nullable(data,"breeding_date"), nullable(data,"due_date"), nullable(data,"birth_date"), num(data,"expected_count"), str(data,"status") || "Planned", nullable(data,"notes"), now, recordId).first();
    case "buyers":
      return env.DB.prepare("UPDATE buyers SET first_name=?, last_name=?, email=?, phone=?, city=?, state=?, application_status=?, preferred_sex=?, preferred_color=?, household_notes=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"first_name"), str(data,"last_name"), str(data,"email"), nullable(data,"phone"), nullable(data,"city"), nullable(data,"state"), str(data,"application_status") || "Inquiry", nullable(data,"preferred_sex"), nullable(data,"preferred_color"), nullable(data,"household_notes"), nullable(data,"notes"), now, recordId).first();
    case "puppies":
      return env.DB.prepare("UPDATE puppies SET litter_id=?, buyer_id=?, name=?, sex=?, color=?, birth_date=?, birth_weight=?, current_weight=?, status=?, price_cents=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(id(data,"litter_id"), id(data,"buyer_id"), str(data,"name"), nullable(data,"sex"), nullable(data,"color"), nullable(data,"birth_date"), num(data,"birth_weight"), num(data,"current_weight"), str(data,"status") || "Available", Math.round((num(data,"price") ?? 0) * 100) || null, nullable(data,"notes"), now, recordId).first();
    case "transactions":
      return env.DB.prepare("UPDATE transactions SET type=?, buyer_id=?, litter_id=?, puppy_id=?, category=?, description=?, amount_cents=?, due_date=?, paid_date=?, status=?, method=?, notes=?, updated_at=? WHERE id=? RETURNING *")
        .bind(str(data,"type"), id(data,"buyer_id"), id(data,"litter_id"), id(data,"puppy_id"), nullable(data,"category"), str(data,"description"), dollars(data), nullable(data,"due_date"), nullable(data,"paid_date"), str(data,"status") || "Pending", nullable(data,"method"), nullable(data,"notes"), now, recordId).first();
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
  const table = resource === "updates" ? "puppy_updates" : resource;
  const allowedTables = ["dogs", "litters", "buyers", "puppies", "transactions", "events", "puppy_updates"];
  if (!allowedTables.includes(table)) throw new Error("Unsupported resource");
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(recordId).run();
}
