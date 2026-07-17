import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships a high-tech Supabase command surface", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /LIVE SUPABASE OPERATIONS/);
  assert.match(page, /Readiness/);
  assert.match(page, /Risk Radar/);
  assert.match(page, /Document Vault/);
  assert.match(page, /Supabase command center/);
  assert.match(page, /\/api\/dog-documents/);
});

test("includes the redesigned operations styling", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /Command/);
  assert.match(page, /Breeding/);
  assert.match(page, /Families/);
  assert.match(page, /Finance/);
  assert.match(page, /Calendar/);
  assert.match(css, /--cyan: #55d6ff/);
  assert.match(css, /--mint: #43f0b5/);
  assert.match(css, /\.command-grid/);
});

test("persists dog medical records and private documents through Supabase", async () => {
  const [kennel, documents, schema] = await Promise.all([
    readFile(new URL("db/supabase-kennel.ts", root), "utf8"),
    readFile(new URL("db/supabase-documents.ts", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
  ]);

  assert.match(kennel, /purchase_price_cents/);
  assert.match(documents, /uploadDogDocumentToSupabase/);
  assert.match(documents, /20 \* 1024 \* 1024/);
  assert.match(schema, /create table if not exists dog_documents/);
  assert.match(schema, /create table if not exists dog_medical_records/);
  assert.match(schema, /create table if not exists dog_registrations/);
});

test("deploys the app directly on Vercel with a Supabase data path", async () => {
  const [configuration, packageManifest, supabaseSchema, dataRoute] = await Promise.all([
    readFile(new URL("vercel.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("supabase/schema.sql", root), "utf8"),
    readFile(new URL("app/api/data/route.ts", root), "utf8"),
  ]);

  const vercel = JSON.parse(configuration);
  const pkg = JSON.parse(packageManifest);
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.redirects, undefined);
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.dependencies.vinext, undefined);
  assert.match(dataRoute, /getKennelDataFromSupabase/);
  assert.match(supabaseSchema, /create table if not exists dogs/);
  assert.match(supabaseSchema, /insert into storage\.buckets/);
});
