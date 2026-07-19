import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the SWVAOS command surface", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /SWVAOS/);
  assert.match(page, /OPERATING SYSTEM/);
  assert.match(page, /Readiness/);
  assert.match(page, /Risk Radar/);
  assert.match(page, /Document Vault/);
  assert.match(page, /Care operations/);
  assert.match(page, /Inventory control/);
  assert.match(page, /Communications hub/);
  assert.match(page, /Reports and intelligence/);
  assert.match(page, /\/api\/dog-documents/);
});

test("includes bright responsive operations styling and document uploads", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /Command/);
  assert.match(page, /Breeding/);
  assert.match(page, /Families/);
  assert.match(page, /Care/);
  assert.match(page, /Finance/);
  assert.match(page, /Inventory/);
  assert.match(page, /Comms/);
  assert.match(page, /Calendar/);
  assert.match(page, /Reports/);
  assert.match(page, /DocumentUploadModal/);
  assert.match(page, /Upload document/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /--canvas: #eaf4f2/);
  assert.match(css, /--blue: #2768e8/);
  assert.match(css, /\.command-grid/);
  assert.match(css, /grid-auto-columns: minmax\(128px, 1fr\)/);
  assert.match(css, /\.vault-upload/);
  assert.match(css, /\.segment-control/);
  assert.match(css, /\.report-grid/);
});

test("persists dog medical records and private documents", async () => {
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

test("opens complete dog profiles with connected operations", async () => {
  const [command, profile] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/dogs/[id]/page.tsx", root), "utf8"),
  ]);

  assert.match(command, /href=\{`\/dogs\/\$\{dog\.id\}`\}/);
  assert.match(command, /target="_blank"/);
  assert.match(command, /Add registry/);
  assert.match(command, /Add medical/);
  assert.match(command, /Add cost/);
  assert.match(profile, /Registries and identifiers/);
  assert.match(profile, /Health, testing, and care/);
  assert.match(profile, /Expenses and purchases/);
  assert.match(profile, /Acquired from/);
  assert.match(profile, /\/api\/dog-documents/);
  assert.doesNotMatch(profile, /localStorage|sessionStorage/);
});

test("deploys the app directly without redirects", async () => {
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

test("includes buyer schema repair for existing projects", async () => {
  const [repairSql, fullRepairSql, kennel] = await Promise.all([
    readFile(new URL("supabase/repair-buyers-schema.sql", root), "utf8"),
    readFile(new URL("supabase/repair-swvaos-schema.sql", root), "utf8"),
    readFile(new URL("db/supabase-kennel.ts", root), "utf8"),
  ]);

  assert.match(repairSql, /add column if not exists last_name/);
  assert.match(repairSql, /full_name/);
  assert.match(repairSql, /create index if not exists buyers_email_idx/);
  assert.match(fullRepairSql, /create table if not exists dog_registrations/);
  assert.match(fullRepairSql, /create table if not exists dog_documents/);
  assert.match(kennel, /selectSafeAll/);
  assert.doesNotMatch(kennel, /order=last_name/);
});
