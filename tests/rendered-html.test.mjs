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
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /PUPPY BIRTHDAYS/);
  assert.match(page, /birthdayReminders/);
  assert.match(page, /Birthday card and family follow-up schedule/);
  assert.match(page, /brand-lockup/);
  assert.match(page, /<b>Southwest<\/b><strong>Virginia<\/strong><small>Operating System<\/small>/);
  assert.match(css, /High-tech operations interface/);
  assert.match(css, /--electric: #16d6a0/);
  assert.match(css, /\.reminder-label/);
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

test("deploys the app directly on Vercel with a Supabase migration path", async () => {
  const [configuration, migrationScript, supabaseSchema, dataRoute] = await Promise.all([
    readFile(new URL("vercel.json", root), "utf8"),
    readFile(new URL("scripts/migrate-chatgpt-site-to-supabase.mjs", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL("app/api/data/route.ts", root), "utf8"),
  ]);

  const vercel = JSON.parse(configuration);
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.redirects, undefined);
  assert.match(dataRoute, /getKennelDataFromSupabase/);
  assert.match(migrationScript, /buyer_documents/);
  assert.match(migrationScript, /dog_documents/);
  assert.match(supabaseSchema, /create table if not exists dogs/);
  assert.match(supabaseSchema, /insert into storage\.buckets/);
});
