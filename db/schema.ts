import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const dogs = sqliteTable("dogs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  registeredName: text("registered_name"),
  sex: text("sex").notNull(),
  role: text("role").notNull(),
  dateOfBirth: text("date_of_birth"),
  color: text("color"),
  weight: real("weight"),
  registrationNumber: text("registration_number"),
  microchipNumber: text("microchip_number"),
  healthTesting: text("health_testing"),
  status: text("status").notNull().default("Active"),
  nextHeatDate: text("next_heat_date"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("dogs_name_idx").on(table.name)]);

export const buyers = sqliteTable("buyers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  city: text("city"),
  state: text("state"),
  applicationStatus: text("application_status").notNull().default("Inquiry"),
  preferredSex: text("preferred_sex"),
  preferredColor: text("preferred_color"),
  householdNotes: text("household_notes"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("buyers_email_idx").on(table.email)]);

export const litters = sqliteTable("litters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  damId: integer("dam_id").references(() => dogs.id, { onDelete: "set null" }),
  sireId: integer("sire_id").references(() => dogs.id, { onDelete: "set null" }),
  breedingDate: text("breeding_date"),
  dueDate: text("due_date"),
  birthDate: text("birth_date"),
  expectedCount: integer("expected_count"),
  status: text("status").notNull().default("Planned"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("litters_status_idx").on(table.status)]);

export const puppies = sqliteTable("puppies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  litterId: integer("litter_id").notNull().references(() => litters.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").references(() => buyers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  sex: text("sex"),
  color: text("color"),
  birthDate: text("birth_date"),
  birthWeight: real("birth_weight"),
  currentWeight: real("current_weight"),
  status: text("status").notNull().default("Available"),
  priceCents: integer("price_cents"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("puppies_litter_idx").on(table.litterId)]);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  buyerId: integer("buyer_id").references(() => buyers.id, { onDelete: "set null" }),
  litterId: integer("litter_id").references(() => litters.id, { onDelete: "set null" }),
  puppyId: integer("puppy_id").references(() => puppies.id, { onDelete: "set null" }),
  category: text("category"),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  status: text("status").notNull().default("Pending"),
  method: text("method"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("transactions_type_idx").on(table.type)]);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  location: text("location"),
  status: text("status").notNull().default("Scheduled"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("events_date_idx").on(table.eventDate)]);

export const puppyUpdates = sqliteTable("puppy_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  puppyId: integer("puppy_id").notNull().references(() => puppies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  weekNumber: integer("week_number"),
  weight: real("weight"),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("updates_puppy_idx").on(table.puppyId)]);

// Kept for migration compatibility with the first prototype. The application
// no longer reads or writes this table; all real data uses the typed tables above.
export const legacyRecords = sqliteTable("records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  amount: integer("amount"),
  status: text("status").notNull().default("Active"),
  date: text("date"),
  createdAt: text("created_at").notNull(),
});
