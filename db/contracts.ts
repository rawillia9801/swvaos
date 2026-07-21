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
  depositMethod?: string;
  depositPaidDate?: string;
  balanceDueDate?: string;
  transferDate?: string;
  examHours?: number;
  guaranteeMonths?: number;
  microToy?: boolean;
  billTerms?: string[];
  healthTerms?: string[];
};

export type PortalRequestInput = {
  kind: "support" | "transportation";
  subject: string;
  message: string;
  requestedDate?: string;
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const number = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;
const fullName = (row: Row) => [text(row, "first_name"), text(row, "last_name")].filter(Boolean).join(" ") || text(row, "email") || `Family #${row.id}`;
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const isPaymentRow = (row: Row) => ["Payment", "Deposit"].includes(text(row, "type"));
const isSettledRow = (row: Row) => ["Paid", "Complete"].includes(text(row, "status"));

function sellerDetails() {
  return {
    name: process.env.SWVAOS_SELLER_NAME?.trim() || "Southwest Virginia Chihuahua LLC",
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
    select<Row>("transactions", `select=*&buyer_id=eq.${buyerId}&type=in.(Payment,Deposit)`),
  ]);

  const paidCents = payments.filter((payment) => isSettledRow(payment) && (!payment.puppy_id || Number(payment.puppy_id) === puppyId)).reduce((sum, payment) => sum + number(payment, "amount_cents"), 0);
  const salePriceCents = Math.max(0, Number(input.salePriceCents ?? puppy.price_cents ?? 0));
  const depositCents = Math.max(0, Number(input.depositCents ?? paidCents));
  const balanceCents = Math.max(0, salePriceCents - depositCents);
  const examHours = Math.max(1, Math.min(336, Number(input.examHours ?? 240)));
  const guaranteeMonths = Math.max(1, Math.min(120, Number(input.guaranteeMonths ?? 12)));
  const microToy = input.microToy === true;
  const seller = sellerDetails();
  const groupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const unloggedDepositCents = Math.max(0, depositCents - paidCents);
  if (unloggedDepositCents > 0) {
    await insert("transactions", {
      type: "Payment",
      dog_id: null,
      buyer_id: buyerId,
      litter_id: litterId,
      puppy_id: puppyId,
      payment_plan_id: null,
      category: "Deposit",
      description: `Puppy deposit - ${text(puppy, "name") || `Puppy #${puppyId}`}`,
      amount_cents: unloggedDepositCents,
      due_date: null,
      paid_date: input.depositPaidDate?.trim() || createdAt.slice(0, 10),
      status: "Paid",
      method: input.depositMethod?.trim() || null,
      notes: "Recorded while preparing the family contract package.",
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
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
    microToy,
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
      terms: input.healthTerms?.filter(Boolean) ?? healthGuaranteeTerms(examHours, guaranteeMonths, microToy),
    },
  ];
  const documents = [];
  for (const snapshot of snapshots) documents.push(await createContractDocument(snapshot));
  const token = await createPortalToken(buyerId);
  return {
    buyerId,
    puppyId,
    token,
    depositLoggedCents: unloggedDepositCents,
    contracts: documents.map((document) => contractSummary(document)).filter(Boolean),
  };
}

export async function reconcileContractDeposits(buyerIdValue: number) {
  const buyerId = positiveId(buyerIdValue);
  if (!buyerId) throw new Error("Choose a valid family account.");
  const [documents, payments] = await Promise.all([
    select<DocumentRow>("buyer_documents", `select=*&buyer_id=eq.${buyerId}&document_type=eq.Bill%20of%20Sale&order=created_at.desc`),
    select<Row>("transactions", `select=*&buyer_id=eq.${buyerId}&type=in.(Payment,Deposit)`),
  ]);
  const latestByPuppy = new Map<number, ContractSnapshot>();
  for (const document of documents) {
    const snapshot = parseContractNotes(document.notes);
    if (snapshot?.kind === "bill_of_sale" && !latestByPuppy.has(snapshot.puppyId)) latestByPuppy.set(snapshot.puppyId, snapshot);
  }
  const snapshots = [...latestByPuppy.values()];
  const contractDeposits = snapshots.reduce((sum, snapshot) => sum + snapshot.depositCents, 0);
  const recordedPayments = payments.filter(isSettledRow).reduce((sum, payment) => sum + number(payment, "amount_cents"), 0);
  const missingDeposit = Math.max(0, contractDeposits - recordedPayments);
  const snapshot = snapshots[0];
  if (!missingDeposit || !snapshot) return 0;
  const now = new Date().toISOString();
  await insert("transactions", {
    type: "Payment",
    dog_id: null,
    buyer_id: buyerId,
    litter_id: null,
    puppy_id: snapshot.puppyId,
    payment_plan_id: null,
    category: "Deposit",
    description: `Puppy deposit - ${snapshot.puppyName}`,
    amount_cents: missingDeposit,
    due_date: null,
    paid_date: snapshot.createdAt.slice(0, 10),
    status: "Paid",
    method: null,
    notes: "Recovered from the existing Bill of Sale contract record.",
    created_at: now,
    updated_at: now,
  });
  return missingDeposit;
}

export async function findPortalBuyerByEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const buyer = await first<Row>("buyers", `select=id,first_name,last_name,email&email=ilike.${encodeURIComponent(email)}`);
  if (!buyer || text(buyer, "email").toLowerCase() !== email) return null;
  return { id: Number(buyer.id), firstName: text(buyer, "first_name"), name: fullName(buyer), email: text(buyer, "email") };
}

export async function getPuppyPortalForBuyer(buyerIdValue: number) {
  const buyerId = positiveId(buyerIdValue);
  if (!buyerId) return null;
  const buyer = await first<Row>("buyers", `select=*&id=eq.${buyerId}`);
  if (!buyer) return null;
  const [puppies, transactions, documents] = await Promise.all([
    select<Row>("puppies", `select=*&buyer_id=eq.${buyerId}&order=created_at.desc`),
    select<Row>("transactions", `select=*&buyer_id=eq.${buyerId}&order=created_at.desc`),
    select<DocumentRow>("buyer_documents", `select=*&buyer_id=eq.${buyerId}&order=created_at.desc`),
  ]);
  const puppyIds = puppies.map((puppy) => Number(puppy.id));
  const litterIds = [...new Set(puppies.map((puppy) => positiveId(puppy.litter_id)).filter((id): id is number => Boolean(id)))];
  const today = new Date().toISOString().slice(0, 10);
  const [updates, links, litters, buyerActivity, puppyEvents] = await Promise.all([
    puppyIds.length ? select<Row>("puppy_updates", `select=*&published=eq.true&puppy_id=in.(${puppyIds.join(",")})&order=created_at.desc`) : Promise.resolve([]),
    documents.length ? select<Row>("buyer_document_puppies", `select=*&document_id=in.(${documents.map((document) => document.id).join(",")})`) : Promise.resolve([]),
    litterIds.length ? select<Row>("litters", `select=*&id=in.(${litterIds.join(",")})`) : Promise.resolve([]),
    select<Row>("events", `select=*&related_type=eq.buyers&related_id=eq.${buyerId}&order=event_date.desc,event_time.desc&limit=100`),
    puppyIds.length ? select<Row>("events", `select=*&related_type=eq.puppies&related_id=in.(${puppyIds.join(",")})&event_date=gte.${today}&status=neq.Completed&order=event_date.asc,event_time.asc`) : Promise.resolve([]),
  ]);
  const parentIds = [...new Set(litters.flatMap((litter) => [positiveId(litter.dam_id), positiveId(litter.sire_id)]).filter((id): id is number => Boolean(id)))];
  const parents = parentIds.length ? await select<Row>("dogs", `select=id,name,registered_name&id=in.(${parentIds.join(",")})`) : [];
  const contracts = documents.map((document) => contractSummary(document, links.filter((link) => Number(link.document_id) === document.id).map((link) => Number(link.puppy_id)))).filter(Boolean);
  const payments = transactions.filter(isPaymentRow);
  const latestBills = new Map<number, NonNullable<(typeof contracts)[number]>>();
  for (const contract of contracts) if (contract?.kind === "bill_of_sale" && !latestBills.has(contract.puppyId)) latestBills.set(contract.puppyId, contract);
  const contractDepositCents = [...latestBills.values()].reduce((sum, contract) => sum + contract.snapshot.depositCents, 0);
  const recordedPaidCents = payments.filter(isSettledRow).reduce((sum, payment) => sum + number(payment, "amount_cents"), 0);
  const legacyDepositCents = Math.max(0, contractDepositCents - recordedPaidCents);
  const portalPayments = legacyDepositCents > 0 ? [{ id: -1, description: "Puppy deposit", category: "Deposit", method: "Contract record", amount_cents: legacyDepositCents, status: "Paid", due_date: null, paid_date: [...latestBills.values()][0]?.createdAt.slice(0, 10) ?? "" }, ...payments] : payments;
  const paidCents = recordedPaidCents + legacyDepositCents;
  const pendingCents = payments.filter((payment) => !isSettledRow(payment)).reduce((sum, payment) => sum + number(payment, "amount_cents"), 0);
  const saleTotalCents = puppies.reduce((sum, puppy) => {
    const bill = contracts
      .filter((contract) => contract?.kind === "bill_of_sale" && contract.puppyId === Number(puppy.id))
      .sort((left, right) => String(right?.createdAt ?? "").localeCompare(String(left?.createdAt ?? "")))[0];
    return sum + Number(bill?.snapshot.salePriceCents ?? puppy.price_cents ?? 0);
  }, 0);
  const upcomingEvents = [...buyerActivity.filter((event) => text(event, "event_date") >= today && text(event, "status") !== "Completed" && text(event, "event_type") !== "Portal Request"), ...puppyEvents]
    .filter((event, index, items) => items.findIndex((candidate) => Number(candidate.id) === Number(event.id)) === index)
    .sort((left, right) => `${text(left, "event_date")}${text(left, "event_time")}`.localeCompare(`${text(right, "event_date")}${text(right, "event_time")}`))
    .slice(0, 12);
  const requests = buyerActivity
    .filter((event) => ["Portal Request", "Transportation"].includes(text(event, "event_type")) && text(event, "notes").startsWith("[Family request]"))
    .slice(0, 12);
  return {
    buyer: {
      id: Number(buyer.id),
      name: fullName(buyer),
      email: text(buyer, "email"),
      phone: text(buyer, "phone"),
      location: [text(buyer, "city"), text(buyer, "state")].filter(Boolean).join(", "),
      applicationStatus: text(buyer, "application_status") || "Inquiry",
      preferredSex: text(buyer, "preferred_sex"),
      preferredColor: text(buyer, "preferred_color"),
    },
    puppies: puppies.map((puppy) => {
      const litter = litters.find((candidate) => Number(candidate.id) === Number(puppy.litter_id));
      const dam = parents.find((candidate) => Number(candidate.id) === Number(litter?.dam_id));
      const sire = parents.find((candidate) => Number(candidate.id) === Number(litter?.sire_id));
      return {
        id: Number(puppy.id), name: text(puppy, "name"), sex: text(puppy, "sex"), color: text(puppy, "color"), birthDate: text(puppy, "birth_date"), birthWeight: number(puppy, "birth_weight"), currentWeight: number(puppy, "current_weight"), status: text(puppy, "status"), priceCents: number(puppy, "price_cents"), notes: text(puppy, "notes"), litterName: text(litter, "name"), damName: text(dam, "registered_name") || text(dam, "name"), sireName: text(sire, "registered_name") || text(sire, "name"),
      };
    }),
    updates: updates.map((update) => ({ id: Number(update.id), puppyId: Number(update.puppy_id), title: text(update, "title"), body: text(update, "body"), weekNumber: number(update, "week_number") || null, weight: number(update, "weight") || null, createdAt: text(update, "created_at") })),
    contracts,
    documents: documents.map((document) => ({ id: Number(document.id), title: text(document, "title"), documentType: text(document, "document_type"), fileName: text(document, "file_name"), createdAt: text(document, "created_at"), isContract: Boolean(parseContractNotes(document.notes)), puppyIds: links.filter((link) => Number(link.document_id) === document.id).map((link) => Number(link.puppy_id)) })),
    upcomingEvents: upcomingEvents.map((event) => ({ id: Number(event.id), title: text(event, "title"), eventType: text(event, "event_type"), date: text(event, "event_date"), time: text(event, "event_time"), location: text(event, "location"), status: text(event, "status"), puppyName: text(event, "related_type") === "puppies" ? text(puppies.find((puppy) => Number(puppy.id) === Number(event.related_id)), "name") : "" })),
    requests: requests.map((event) => ({ id: Number(event.id), kind: text(event, "event_type") === "Transportation" ? "transportation" : "support", subject: text(event, "title"), status: text(event, "status"), requestedDate: text(event, "event_date"), createdAt: text(event, "created_at") })),
    support: {
      phone: process.env.SWVAOS_SUPPORT_PHONE?.trim() || "",
      email: process.env.SWVAOS_SUPPORT_EMAIL?.trim() || "",
    },
    payments: {
      saleTotalCents,
      paidCents,
      outstandingCents: Math.max(pendingCents, Math.max(0, saleTotalCents - paidCents)),
      items: portalPayments.slice(0, 20).map((payment) => ({ id: Number(payment.id), description: text(payment, "description"), category: text(payment, "category"), method: text(payment, "method"), amountCents: number(payment, "amount_cents"), status: text(payment, "status"), dueDate: text(payment, "due_date"), paidDate: text(payment, "paid_date") })),
    },
  };
}

export async function getPuppyPortal(token: string) {
  const claims = await verifyPortalToken(token);
  if (!claims) return null;
  return getPuppyPortalForBuyer(claims.buyerId);
}

export async function createPortalRequest(token: string, input: PortalRequestInput) {
  const claims = await verifyPortalToken(token);
  if (!claims) throw new Error("This puppy portal link is invalid or has expired.");
  const buyer = await first<Row>("buyers", `select=id&id=eq.${claims.buyerId}`);
  if (!buyer) throw new Error("The family account was not found.");
  const subject = input.subject.trim().replace(/\s+/g, " ").slice(0, 120);
  const message = input.message.trim().slice(0, 2000);
  if (subject.length < 3) throw new Error("Enter a short subject for this request.");
  if (message.length < 5) throw new Error("Add a little more detail so the team can help.");
  const today = new Date().toISOString().slice(0, 10);
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(input.requestedDate ?? "") ? String(input.requestedDate) : today;
  const now = new Date().toISOString();
  const eventType = input.kind === "transportation" ? "Transportation" : "Portal Request";
  return insert<Row>("events", {
    title: subject,
    event_type: eventType,
    event_date: requestedDate,
    event_time: null,
    related_type: "buyers",
    related_id: claims.buyerId,
    location: input.kind === "transportation" ? "Pickup or delivery" : "Puppy portal",
    status: "New",
    notes: `[Family request]\n${message}`,
    created_at: now,
    updated_at: now,
  });
}

export async function getPortalDocument(token: string, documentId: number) {
  const claims = await verifyPortalToken(token);
  if (!claims) return null;
  const document = await first<DocumentRow>("buyer_documents", `select=*&id=eq.${documentId}&buyer_id=eq.${claims.buyerId}`);
  if (!document) return null;
  const object = await downloadObject(document.object_key);
  return object.ok ? { document, object } : null;
}

export async function signPortalContract(token: string, documentId: number, signerName: string, ipAddress: string, userAgent: string, consent: { electronicConsent: boolean; healthAcknowledged: boolean }) {
  const claims = await verifyPortalToken(token);
  if (!claims) throw new Error("This puppy portal link is invalid or has expired.");
  const document = await first<DocumentRow>("buyer_documents", `select=*&id=eq.${documentId}&buyer_id=eq.${claims.buyerId}`);
  if (!document) throw new Error("The contract was not found.");
  const snapshot = parseContractNotes(document.notes);
  if (!snapshot || snapshot.buyerId !== claims.buyerId) throw new Error("The contract is not available in this portal.");
  if (snapshot.status === "signed") return contractSummary(document);
  if (!consent.electronicConsent) throw new Error("Separately consent to use electronic records and an electronic signature.");
  if (snapshot.kind === "health_guarantee" && !consent.healthAcknowledged) throw new Error("Acknowledge the Health Guarantee and Virginia Consumer Notice before signing.");
  const cleanedName = signerName.trim().replace(/\s+/g, " ").slice(0, 120);
  if (cleanedName.length < 3) throw new Error("Enter the buyer's full legal name.");
  const signedAt = new Date().toISOString();
  const auditPayload = JSON.stringify({ snapshot, signerName: cleanedName, signedAt, ipAddress, userAgent, electronicConsent: true, healthAcknowledged: snapshot.kind === "health_guarantee" });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(auditPayload));
  const auditHash = Buffer.from(digest).toString("hex");
  const signedSnapshot: ContractSnapshot = {
    ...snapshot,
    status: "signed",
    signature: { signerName: cleanedName, signedAt, ipAddress: ipAddress.slice(0, 100), userAgent: userAgent.slice(0, 500), auditHash, electronicConsent: true, ...(snapshot.kind === "health_guarantee" ? { healthAcknowledged: true as const } : {}) },
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
