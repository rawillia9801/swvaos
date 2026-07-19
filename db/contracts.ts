import { getSupabaseConfig, supabaseRequest } from "./supabase";
import { contractNotes, parseContractNotes, renderContractPdf, type ContractSnapshot } from "../lib/contract-pdf";
import { billOfSaleTerms, healthGuaranteeTerms } from "../lib/contract-templates";
import { createPortalToken, verifyPortalToken } from "../lib/portal-token";

type Row = Record<string, unknown>;
type DocumentRow = Row & {
  id: number;
  buyer_id: number;
  object_key: string;
  file_name: string;
  content_type: string;
  title: string;
  document_type: string;
  notes: string | null;
};

export type ContractPackageInput = {
  buyerId: number;
  puppyId: number;
  salePriceCents?: number;
  depositCents?: number;
  balanceDueDate?: string;
  transferDate?: string;
  examHours?: number;
  guaranteeMonths?: number;
  billTerms?: string[];
  healthTerms?: string[];
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const number = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;
const fullName = (row: Row) => [text(row, "first_name"), text(row, "last_name")].filter(Boolean).join(" ") || text(row, "email") || `Family #${row.id}`;
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

function sellerDetails() {
  return {
    name: process.env.SWVAOS_SELLER_NAME?.trim() || "Southwest Virginia Chihuahua",
    location: process.env.SWVAOS_SELLER_LOCATION?.trim() || "Southwest Virginia",
  };
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const payload = await response.text();
  const json = payload ? JSON.parse(payload) : null;
  if (!response.ok) throw new Error(json?.message ?? json?.error ?? "Contract request failed.");
  return json as T;
}

async function select<T extends Row>(table: string, query: string) {
  return jsonRequest<T[]>(`rest/v1/${table}?${query}`);
}

async function first<T extends Row>(table: string, query: string) {
  return (await select<T>(table, `${query}&limit=1`))[0] ?? null;
}

async function insert<T extends Row>(table: string, row: Row) {
  return jsonRequest<T[]>(`rest/v1/${table}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  }).then((rows) => rows[0]);
}

async function update(table: string, query: string, row: Row) {
  return jsonRequest<Row[]>(`rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  }).then((rows) => rows[0]);
}

async function uploadPdf(objectKey: string, bytes: Uint8Array, upsert: boolean) {
  const { storageBucket } = getSupabaseConfig();
  const body = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, {
    method: "POST",
    headers: { "content-type": "application/pdf", "x-upsert": String(upsert) },
    body,
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to store the generated contract.");
}

async function downloadObject(objectKey: string) {
  const { storageBucket } = getSupabaseConfig();
  return supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, { cache: "no-store" });
}

async function addPuppyLink(documentId: number, puppyId: number) {
  await jsonRequest("rest/v1/buyer_document_puppies", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, puppy_id: puppyId }),
  });
}

async function createContractDocument(snapshot: ContractSnapshot) {
  const pdf = await renderContractPdf(snapshot);
  const fileStem = snapshot.kind === "bill_of_sale" ? "bill-of-sale" : "health-guarantee";
  const objectKey = `buyers/${snapshot.buyerId}/contracts/${snapshot.groupId}-${fileStem}.pdf`;
  await uploadPdf(objectKey, pdf, false);
  const now = new Date().toISOString();
  const document = await insert<DocumentRow>("buyer_documents", {
    buyer_id: snapshot.buyerId,
    payment_plan_id: null,
    document_type: snapshot.kind === "bill_of_sale" ? "Bill of Sale" : "Health Guarantee",
    title: snapshot.title,
    object_key: objectKey,
    file_name: `${fileStem}-${snapshot.puppyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    content_type: "application/pdf",
    size_bytes: pdf.length,
    notes: contractNotes(snapshot),
    created_at: now,
    updated_at: now,
  });
  await addPuppyLink(document.id, snapshot.puppyId);
  return document;
}

function contractSummary(document: DocumentRow, puppyIds: number[] = []) {
  const snapshot = parseContractNotes(document.notes);
  if (!snapshot) return null;
  return {
    id: document.id,
    title: document.title,
    documentType: document.document_type,
    status: snapshot.status,
    kind: snapshot.kind,
    puppyId: snapshot.puppyId,
    puppyIds,
    puppyName: snapshot.puppyName,
    createdAt: snapshot.createdAt,
    signedAt: snapshot.signature?.signedAt ?? null,
    signerName: snapshot.signature?.signerName ?? null,
    snapshot,
  };
}

export async function prepareContractPackage(input: ContractPackageInput) {
  const buyerId = positiveId(input.buyerId);
  const puppyId = positiveId(input.puppyId);
  if (!buyerId || !puppyId) throw new Error("Choose a family and an assigned puppy.");
  const [buyer, puppy] = await Promise.all([
    first<Row>("buyers", `select=*&id=eq.${buyerId}`),
    first<Row>("puppies", `select=*&id=eq.${puppyId}&buyer_id=eq.${buyerId}`),
  ]);
  if (!buyer) throw new Error("The selected family was not found.");
  if (!puppy) throw new Error("The selected puppy is not assigned to this family.");

  const litterId = positiveId(puppy.litter_id);
  const litter = litterId ? await first<Row>("litters", `select=*&id=eq.${litterId}`) : null;
  const [dam, sire, payments] = await Promise.all([
    positiveId(litter?.dam_id) ? first<Row>("dogs", `select=id,name,registered_name&id=eq.${litter?.dam_id}`) : Promise.resolve(null),
    positiveId(litter?.sire_id) ? first<Row>("dogs", `select=id,name,registered_name&id=eq.${litter?.sire_id}`) : Promise.resolve(null),
    select<Row>("transactions", `select=*&buyer_id=eq.${buyerId}&type=eq.Payment`),
  ]);

  const paidCents = payments.filter((payment) => text(payment, "status") === "Paid" && (!payment.puppy_id || Number(payment.puppy_id) === puppyId)).reduce((sum, payment) => sum + number(payment, "amount_cents"), 0);
  const salePriceCents = Math.max(0, Number(input.salePriceCents ?? puppy.price_cents ?? 0));
  const depositCents = Math.max(0, Number(input.depositCents ?? paidCents));
  const balanceCents = Math.max(0, salePriceCents - depositCents);
  const examHours = Math.max(1, Math.min(336, Number(input.examHours ?? 72)));
  const guaranteeMonths = Math.max(1, Math.min(120, Number(input.guaranteeMonths ?? 12)));
  const seller = sellerDetails();
  const groupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const shared = {
    version: 1 as const,
    groupId,
    status: "pending" as const,
    createdAt,
    buyerId,
    buyerName: fullName(buyer),
    buyerEmail: text(buyer, "email"),
    buyerPhone: text(buyer, "phone"),
    buyerLocation: [text(buyer, "city"), text(buyer, "state")].filter(Boolean).join(", "),
    puppyId,
    puppyName: text(puppy, "name") || `Puppy #${puppyId}`,
    puppySex: text(puppy, "sex"),
    puppyColor: text(puppy, "color"),
    puppyBirthDate: text(puppy, "birth_date"),
    litterName: text(litter, "name"),
    damName: text(dam, "registered_name") || text(dam, "name"),
    sireName: text(sire, "registered_name") || text(sire, "name"),
    salePriceCents,
    depositCents,
    balanceCents,
    balanceDueDate: input.balanceDueDate?.trim() || "",
    transferDate: input.transferDate?.trim() || "",
    sellerName: seller.name,
    sellerLocation: seller.location,
  };
  const snapshots: ContractSnapshot[] = [
    {
      ...shared,
      kind: "bill_of_sale",
      title: `Bill of Sale - ${shared.puppyName}`,
      introduction: `This Bill of Sale records the transfer agreement between ${seller.name} as seller and ${shared.buyerName} as buyer for the puppy identified below.`,
      terms: input.billTerms?.filter(Boolean) ?? billOfSaleTerms,
    },
    {
      ...shared,
      kind: "health_guarantee",
      title: `Health Guarantee - ${shared.puppyName}`,
      introduction: `This Health Guarantee describes the limited health commitments and buyer responsibilities connected to ${shared.puppyName}.`,
      terms: input.healthTerms?.filter(Boolean) ?? healthGuaranteeTerms(examHours, guaranteeMonths),
    },
  ];
  const documents = [];
  for (const snapshot of snapshots) documents.push(await createContractDocument(snapshot));
  const token = await createPortalToken(buyerId);
  return {
    buyerId,
    puppyId,
    token,
    contracts: documents.map((document) => contractSummary(document)).filter(Boolean),
  };
}

export async function getPuppyPortal(token: string) {
  const claims = await verifyPortalToken(token);
  if (!claims) return null;
  const buyer = await first<Row>("buyers", `select=*&id=eq.${claims.buyerId}`);
  if (!buyer) return null;
  const [puppies, transactions, documents] = await Promise.all([
    select<Row>("puppies", `select=*&buyer_id=eq.${claims.buyerId}&order=created_at.desc`),
    select<Row>("transactions", `select=*&buyer_id=eq.${claims.buyerId}&order=created_at.desc`),
    select<DocumentRow>("buyer_documents", `select=*&buyer_id=eq.${claims.buyerId}&order=created_at.desc`),
  ]);
  const puppyIds = puppies.map((puppy) => Number(puppy.id));
  const [updates, links] = await Promise.all([
    puppyIds.length ? select<Row>("puppy_updates", `select=*&published=eq.true&puppy_id=in.(${puppyIds.join(",")})&order=created_at.desc`) : Promise.resolve([]),
    documents.length ? select<Row>("buyer_document_puppies", `select=*&document_id=in.(${documents.map((document) => document.id).join(",")})`) : Promise.resolve([]),
  ]);
  const contracts = documents.map((document) => contractSummary(document, links.filter((link) => Number(link.document_id) === document.id).map((link) => Number(link.puppy_id)))).filter(Boolean);
  const payments = transactions.filter((transaction) => text(transaction, "type") === "Payment");
  return {
    buyer: {
      id: Number(buyer.id),
      name: fullName(buyer),
      email: text(buyer, "email"),
      phone: text(buyer, "phone"),
      location: [text(buyer, "city"), text(buyer, "state")].filter(Boolean).join(", "),
    },
    puppies: puppies.map((puppy) => ({
      id: Number(puppy.id), name: text(puppy, "name"), sex: text(puppy, "sex"), color: text(puppy, "color"), birthDate: text(puppy, "birth_date"), currentWeight: number(puppy, "current_weight"), status: text(puppy, "status"), priceCents: number(puppy, "price_cents"), notes: text(puppy, "notes"),
    })),
    updates: updates.map((update) => ({ id: Number(update.id), puppyId: Number(update.puppy_id), title: text(update, "title"), body: text(update, "body"), weekNumber: number(update, "week_number") || null, weight: number(update, "weight") || null, createdAt: text(update, "created_at") })),
    contracts,
    payments: {
      paidCents: payments.filter((payment) => text(payment, "status") === "Paid").reduce((sum, payment) => sum + number(payment, "amount_cents"), 0),
      outstandingCents: payments.filter((payment) => text(payment, "status") !== "Paid").reduce((sum, payment) => sum + number(payment, "amount_cents"), 0),
      items: payments.slice(0, 20).map((payment) => ({ id: Number(payment.id), description: text(payment, "description"), amountCents: number(payment, "amount_cents"), status: text(payment, "status"), dueDate: text(payment, "due_date"), paidDate: text(payment, "paid_date") })),
    },
  };
}

export async function getPortalDocument(token: string, documentId: number) {
  const claims = await verifyPortalToken(token);
  if (!claims) return null;
  const document = await first<DocumentRow>("buyer_documents", `select=*&id=eq.${documentId}&buyer_id=eq.${claims.buyerId}`);
  if (!document || !parseContractNotes(document.notes)) return null;
  const object = await downloadObject(document.object_key);
  return object.ok ? { document, object } : null;
}

export async function signPortalContract(token: string, documentId: number, signerName: string, ipAddress: string, userAgent: string) {
  const claims = await verifyPortalToken(token);
  if (!claims) throw new Error("This puppy portal link is invalid or has expired.");
  const document = await first<DocumentRow>("buyer_documents", `select=*&id=eq.${documentId}&buyer_id=eq.${claims.buyerId}`);
  if (!document) throw new Error("The contract was not found.");
  const snapshot = parseContractNotes(document.notes);
  if (!snapshot || snapshot.buyerId !== claims.buyerId) throw new Error("The contract is not available in this portal.");
  if (snapshot.status === "signed") return contractSummary(document);
  const cleanedName = signerName.trim().replace(/\s+/g, " ").slice(0, 120);
  if (cleanedName.length < 3) throw new Error("Enter the buyer's full legal name.");
  const signedAt = new Date().toISOString();
  const auditPayload = JSON.stringify({ snapshot, signerName: cleanedName, signedAt, ipAddress, userAgent });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(auditPayload));
  const auditHash = Buffer.from(digest).toString("hex");
  const signedSnapshot: ContractSnapshot = {
    ...snapshot,
    status: "signed",
    signature: { signerName: cleanedName, signedAt, ipAddress: ipAddress.slice(0, 100), userAgent: userAgent.slice(0, 500), auditHash },
  };
  const pdf = await renderContractPdf(signedSnapshot);
  await uploadPdf(document.object_key, pdf, true);
  const updated = await update("buyer_documents", `id=eq.${document.id}`, {
    title: `Signed ${snapshot.title}`,
    file_name: document.file_name.replace(/\.pdf$/i, "-signed.pdf"),
    size_bytes: pdf.length,
    notes: contractNotes(signedSnapshot),
    updated_at: signedAt,
  }) as DocumentRow;
  try {
    await insert("events", {
      title: `${snapshot.title} signed by ${cleanedName}`,
      event_type: "Contract",
      event_date: signedAt.slice(0, 10),
      event_time: signedAt.slice(11, 16),
      related_type: "buyers",
      related_id: claims.buyerId,
      location: "Puppy portal",
      status: "Completed",
      notes: `Electronic signature audit ${auditHash}`,
      created_at: signedAt,
      updated_at: signedAt,
    });
  } catch {
    // The signed PDF and audit metadata are authoritative if calendar logging is unavailable.
  }
  return contractSummary(updated);
}
