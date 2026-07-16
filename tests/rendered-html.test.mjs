import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("includes the connected breeding-dog profile experience", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /BREEDING DOG PROFILE/);
  assert.match(page, /PAID PUPPY-SALE REVENUE/);
  assert.match(page, /MEDICAL & VACCINATIONS/);
  assert.match(page, /Registration Certificate/);
  assert.match(page, /Embark Results/);
  assert.match(page, /OFA Test Results/);
  assert.match(page, /Medical Documentation/);
  assert.match(page, /Multiple registration records/);
  assert.match(page, /TOTAL RECORDED COSTS/);
  assert.match(page, /\/api\/dog-documents/);
});

test("includes birthday marketing reminders and Southwest branding", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /UPCOMING BIRTHDAYS/);
  assert.match(page, /birthdayReminders/);
  assert.match(page, /birthday cards, check-ins, and family marketing follow-up/);
  assert.match(page, /southwest-wordmark">Southwest/);
});

test("persists dog medical records and private documents", async () => {
  const [schema, kennel, documents, migration, registrationsMigration] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/kennel.ts", root), "utf8"),
    readFile(new URL("db/dog-documents.ts", root), "utf8"),
    readFile(new URL("drizzle/0003_silent_hydra.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_quick_vision.sql", root), "utf8"),
  ]);

  assert.match(schema, /dogMedicalRecords/);
  assert.match(schema, /dogDocuments/);
  assert.match(schema, /dogRegistrations/);
  assert.match(kennel, /purchase_price_cents/);
  assert.match(documents, /env\.DOCUMENTS\.put/);
  assert.match(documents, /20 \* 1024 \* 1024/);
  assert.match(migration, /CREATE TABLE `dog_documents`/);
  assert.match(migration, /CREATE TABLE `dog_medical_records`/);
  assert.match(registrationsMigration, /CREATE TABLE `dog_registrations`/);
  assert.match(registrationsMigration, /ALTER TABLE `transactions` ADD `dog_id`/);
});
