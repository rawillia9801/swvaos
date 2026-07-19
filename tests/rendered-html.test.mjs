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

test("allows buyer records without an email address", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /Field label="Email \(optional\)" name="email" type="email" record=\{record\} preset=\{preset\} \/>/);
  assert.doesNotMatch(page, /label="Email" name="email"[^>]*required/);
});

test("provides guided transaction entry, documented fees, and readable puppy placement cards", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /TransactionFields/);
  assert.match(page, /Fee charged/);
  assert.match(page, /transactionNotesWithFee/);
  assert.match(page, /Payment received/);
  assert.match(page, /Deposit received/);
  assert.match(page, /paidStatuses = new Set\(\["Paid", "Complete"\]\)/);
  assert.match(page, /Payment method/);
  assert.match(page, /Receipt, reference, or internal notes/);
  assert.match(page, /puppy-placement-grid/);
  assert.match(css, /\.puppy-placement-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
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

test("ships the caller CRM and complete recognized and public voice menus", async () => {
  const [page, callerCrm, callerVoice, lookupRoute, webhook, env] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("db/caller-crm.ts", root), "utf8"),
    readFile(new URL("lib/caller-voice.ts", root), "utf8"),
    readFile(new URL("app/api/caller-crm/lookup/route.ts", root), "utf8"),
    readFile(new URL("lib/voice-webhook.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);

  assert.match(page, /Caller CRM/);
  assert.match(page, /suppressHydrationWarning/);
  assert.match(page, /Recognized caller flow/);
  assert.match(page, /Public caller flow/);
  assert.match(page, /Assigned Records/);
  assert.match(page, /Conversations and messages/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.match(callerCrm, /toStudioCallerLookup/);
  assert.match(callerCrm, /assigned_puppy_information/);
  assert.match(callerCrm, /voice_prompts/);
  assert.match(lookupRoute, /isAuthorizedCallerLookup/);
  assert.match(lookupRoute, /toStudioCallerLookup/);
  assert.match(webhook, /x-twilio-signature/);
  assert.match(webhook, /validateRequest/);
  assert.match(webhook, /Basic/);
  assert.match(callerVoice, /Press 7 to speak with someone/);
  assert.match(callerVoice, /Press 6 to speak with someone/);
  assert.match(callerVoice, /Polly\.Joanna/);
  assert.match(env, /TWILIO_AUTH_TOKEN/);
  assert.match(env, /SWVAOS_CRM_API_KEY/);
});

test("generates e-signature contracts and retains them in the puppy portal", async () => {
  const [page, contracts, pdf, templates, portal, signaturePage, signatureRoute, env] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("db/contracts.ts", root), "utf8"),
    readFile(new URL("lib/contract-pdf.ts", root), "utf8"),
    readFile(new URL("lib/contract-templates.ts", root), "utf8"),
    readFile(new URL("app/portal/[token]/page.tsx", root), "utf8"),
    readFile(new URL("app/portal/[token]/contracts/[id]/page.tsx", root), "utf8"),
    readFile(new URL("app/api/portal/[token]/contracts/[id]/sign/route.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);

  assert.match(page, /Bill of Sale and Health Guarantee/);
  assert.match(page, /Create both documents/);
  assert.match(page, /Open existing portal/);
  assert.match(contracts, /prepareContractPackage/);
  assert.match(contracts, /unloggedDepositCents/);
  assert.match(contracts, /Puppy deposit/);
  assert.match(contracts, /buyer_document_puppies/);
  assert.match(contracts, /SHA-256/);
  assert.match(pdf, /SIGNED COPY/);
  assert.match(portal, /Agreements and signatures/);
  assert.match(portal, /Family account details/);
  assert.match(portal, /Additional documents/);
  assert.match(portal, /Upcoming dates and next steps/);
  assert.match(page, /Designate this puppy as Micro-Toy/);
  assert.match(page, /exam_days/);
  assert.match(templates, /Virginia Consumer Protection Act/);
  assert.match(templates, /within 14 days following receipt if the animal is infected with parvovirus/);
  assert.match(signaturePage, /separately agree to conduct this transaction electronically/);
  assert.match(signaturePage, /Virginia Consumer Notice/);
  assert.match(signatureRoute, /electronic_consent/);
  assert.match(signatureRoute, /health_acknowledged/);
  assert.doesNotMatch(`${page}${portal}${signaturePage}`, /localStorage|sessionStorage/);
  assert.match(env, /SWVAOS_PORTAL_SECRET/);
});

test("unifies phone operations and family requests inside SWVAOS", async () => {
  const [page, portal, contracts, requestRoute, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/portal/[token]/page.tsx", root), "utf8"),
    readFile(new URL("db/contracts.ts", root), "utf8"),
    readFile(new URL("app/api/portal/[token]/requests/route.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /Interaction Inbox/);
  assert.match(page, /Calls, messages, and requests/);
  assert.match(page, /Schedule callback/);
  assert.match(page, /Account-aware phone routing/);
  assert.match(page, /Phone routing online/);
  assert.match(portal, /YOUR PUPPY JOURNEY/);
  assert.match(portal, /Pickup and transportation/);
  assert.match(portal, /Messages and requests/);
  assert.match(portal, /Ready for home/);
  assert.match(portal, /Send request/);
  assert.match(contracts, /createPortalRequest/);
  assert.match(contracts, /\[Family request\]/);
  assert.match(requestRoute, /createPortalRequest/);
  assert.match(css, /family-journey\.png/);
  assert.match(css, /\.crm-inbox-list/);
  assert.doesNotMatch(`${page}${portal}`, /localStorage|sessionStorage/);
});
