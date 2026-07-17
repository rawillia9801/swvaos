import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceUrl = process.env.SOURCE_SITE_URL;
const sourceCookie = process.env.SOURCE_COOKIE;
const sourceAuthorization = process.env.SOURCE_AUTHORIZATION;
const sourceBackupDir = process.env.SOURCE_BACKUP_DIR;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this migration.");
}

const sourceHeaders = new Headers();
if (sourceCookie) sourceHeaders.set("cookie", sourceCookie);
if (sourceAuthorization) sourceHeaders.set("authorization", sourceAuthorization);

if (!sourceBackupDir && !sourceUrl) {
  throw new Error("Set SOURCE_BACKUP_DIR or SOURCE_SITE_URL before running this migration.");
}

if (!sourceBackupDir && !sourceCookie && !sourceAuthorization) {
  throw new Error("Set SOURCE_COOKIE or SOURCE_AUTHORIZATION so the migration can read the private legacy app.");
}

const supabaseHeaders = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
};

async function sourceFetch(path) {
  const response = await fetch(new URL(path, sourceUrl), { headers: sourceHeaders });
  if (!response.ok) throw new Error(`Source ${path} failed with ${response.status}.`);
  return response;
}

async function sourceData() {
  if (sourceBackupDir) {
    return JSON.parse(await readFile(path.join(sourceBackupDir, "data.json"), "utf8"));
  }
  return sourceFetch("/api/data").then((response) => response.json());
}

async function supabaseFetch(path, init = {}) {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(supabaseHeaders)) headers.set(key, value);
  const response = await fetch(new URL(path, `${supabaseUrl}/`), { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${path} failed with ${response.status}: ${text}`);
  }
  return response;
}

async function upsertRows(table, rows) {
  if (!rows?.length) return;
  await supabaseFetch(`rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  console.log(`migrated ${rows.length} ${table}`);
}

async function upsertLinkRows(table, rows, conflict) {
  if (!rows?.length) return;
  await supabaseFetch(`rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  console.log(`migrated ${rows.length} ${table}`);
}

async function uploadObject(objectKey, body, contentType) {
  await supabaseFetch(`storage/v1/object/${bucket}/${objectKey}`, {
    method: "POST",
    headers: {
      "content-type": contentType ?? "application/octet-stream",
      "x-upsert": "true",
    },
    body,
    duplex: "half",
  });
}

async function backupFileFor(directory, document) {
  const folder = path.join(sourceBackupDir, directory);
  const files = await readdir(folder);
  const file = files.find((name) => name.startsWith(`${document.id}-`));
  if (!file) throw new Error(`Missing backup file for ${directory} document ${document.id}.`);
  return path.join(folder, file);
}

async function uploadDocumentObject(directory, urlPath, document) {
  if (sourceBackupDir) {
    await uploadObject(document.object_key, createReadStream(await backupFileFor(directory, document)), document.content_type);
    return;
  }
  const response = await sourceFetch(`${urlPath}/${document.id}`);
  await uploadObject(document.object_key, response.body, response.headers.get("content-type") ?? document.content_type);
}

function withoutPuppyIds(record) {
  const copy = { ...record };
  delete copy.puppy_ids;
  return copy;
}

const data = await sourceData();

await upsertRows("dogs", data.dogs);
await upsertRows("dog_medical_records", data.dog_medical_records);
await upsertRows("dog_registrations", data.dog_registrations);
await upsertRows("buyers", data.buyers);
await upsertRows("litters", data.litters);
await upsertRows("puppies", data.puppies);
await upsertRows("payment_plans", data.payment_plans?.map(withoutPuppyIds));
await upsertLinkRows(
  "payment_plan_puppies",
  data.payment_plans?.flatMap((plan) => (plan.puppy_ids ?? []).map((puppyId) => ({ payment_plan_id: plan.id, puppy_id: puppyId }))),
  "payment_plan_id,puppy_id",
);
await upsertRows("transactions", data.transactions);
await upsertRows("events", data.events);
await upsertRows("puppy_updates", data.updates);

for (const document of data.buyer_documents ?? []) {
  await uploadDocumentObject("buyer-documents", "/api/documents", document);
}
await upsertRows("buyer_documents", data.buyer_documents?.map(withoutPuppyIds));
await upsertLinkRows(
  "buyer_document_puppies",
  data.buyer_documents?.flatMap((document) => (document.puppy_ids ?? []).map((puppyId) => ({ document_id: document.id, puppy_id: puppyId }))),
  "document_id,puppy_id",
);

for (const document of data.dog_documents ?? []) {
  await uploadDocumentObject("dog-documents", "/api/dog-documents", document);
}
await upsertRows("dog_documents", data.dog_documents);

console.log("Migration complete.");
