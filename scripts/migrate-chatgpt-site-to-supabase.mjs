const sourceUrl = process.env.SOURCE_SITE_URL ?? "https://southwest-virginia-chihuahua-os.dswillia74.chatgpt.site";
const sourceCookie = process.env.SOURCE_COOKIE;
const sourceAuthorization = process.env.SOURCE_AUTHORIZATION;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this migration.");
}

const sourceHeaders = new Headers();
if (sourceCookie) sourceHeaders.set("cookie", sourceCookie);
if (sourceAuthorization) sourceHeaders.set("authorization", sourceAuthorization);

if (!sourceCookie && !sourceAuthorization) {
  throw new Error("Set SOURCE_COOKIE or SOURCE_AUTHORIZATION so the migration can read the private ChatGPT/Sites app.");
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

async function uploadObject(objectKey, response) {
  await supabaseFetch(`storage/v1/object/${bucket}/${objectKey}`, {
    method: "POST",
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "x-upsert": "true",
    },
    body: response.body,
    duplex: "half",
  });
}

function withoutPuppyIds(record) {
  const copy = { ...record };
  delete copy.puppy_ids;
  return copy;
}

const data = await sourceFetch("/api/data").then((response) => response.json());

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
  const response = await sourceFetch(`/api/documents/${document.id}`);
  await uploadObject(document.object_key, response);
}
await upsertRows("buyer_documents", data.buyer_documents?.map(withoutPuppyIds));
await upsertLinkRows(
  "buyer_document_puppies",
  data.buyer_documents?.flatMap((document) => (document.puppy_ids ?? []).map((puppyId) => ({ document_id: document.id, puppy_id: puppyId }))),
  "document_id,puppy_id",
);

for (const document of data.dog_documents ?? []) {
  const response = await sourceFetch(`/api/dog-documents/${document.id}`);
  await uploadObject(document.object_key, response);
}
await upsertRows("dog_documents", data.dog_documents);

console.log("Migration complete.");
