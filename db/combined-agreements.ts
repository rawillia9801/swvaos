import { getSupabaseConfig, supabaseRequest } from "./supabase";
import { contractNotes, renderContractPdf, type ContractSnapshot } from "../lib/contract-pdf";
import { combinedAgreementTerms, type CombinedAgreementDetails } from "../lib/combined-agreement";
import { createPortalToken } from "../lib/portal-token";

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

export type CombinedAgreementInput = {
  buyerId: number;
  puppyId: number;
  salePriceCents?: number;
  salesTaxCents?: number;
  transportCents?: number;
  otherChargesCents?: number;
  reservationCreditCents?: number;
  additionalPaymentsCents?: number;
  balanceDueDate?: string;
  transferDate?: string;
  microToy?: boolean;
  terms?: string[];
  details?: CombinedAgreementDetails;
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const amount = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const fullName = (row: Row) => [text(row, "first_name"), text(row, "last_name")].filter(Boolean).join(" ") || text(row, "email") || `Family #${row.id}`;
const settled = (row: Row) => ["Paid", "Complete"].includes(text(row, "status"));
const moneyValue = (value: unknown) => Math.max(0, Number(value) || 0);

function sellerDetails() {
  return {
    name: process.env.SWVAOS_SELLER_NAME?.trim() || "Southwest Virginia Chihuahua LLC",
    location: process.env.SWVAOS_SELLER_LOCATION?.trim() || "Marion, Virginia",
  };
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await supabaseRequest(path, { ...init, headers, cache: "no-store" });
  const payload = await response.text();
  const json = payload ? JSON.parse(payload) : null;
  if (!response.ok) throw new Error(json?.message ?? json?.error ?? "Agreement request failed.");
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

async function uploadPdf(objectKey: string, bytes: Uint8Array) {
  const { storageBucket } = getSupabaseConfig();
  const response = await supabaseRequest(`storage/v1/object/${storageBucket}/${objectKey}`, {
    method: "POST",
    headers: { "content-type": "application/pdf", "x-upsert": "false" },
    body: new Blob([bytes as BlobPart], { type: "application/pdf" }),
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to store the generated agreement.");
}

async function addPuppyLink(documentId: number, puppyId: number) {
  await jsonRequest("rest/v1/buyer_document_puppies", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, puppy_id: puppyId }),
  });
}

const dateValue = (value: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? String(value) : "";

function ageAtTransfer(birthDate: string, transferDate: string) {
  if (!birthDate || !transferDate) return "";
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00Z`);
  const transfer = new Date(`${transferDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(transfer.getTime()) || transfer < birth) return "";
  const days = Math.floor((transfer.getTime() - birth.getTime()) / 86400000);
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return `${weeks} week${weeks === 1 ? "" : "s"}${remainder ? `, ${remainder} day${remainder === 1 ? "" : "s"}` : ""}`;
}

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "puppy";
}

export async function prepareCombinedAgreement(input: CombinedAgreementInput) {
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
  const parentIds = [positiveId(litter?.dam_id), positiveId(litter?.sire_id)].filter((id): id is number => Boolean(id));
  const [parents, parentRegistrations, payments] = await Promise.all([
    parentIds.length ? select<Row>("dogs", `select=*&id=in.(${parentIds.join(",")})`) : Promise.resolve([]),
    parentIds.length ? select<Row>("dog_registrations", `select=*&dog_id=in.(${parentIds.join(",")})&order=created_at.desc`) : Promise.resolve([]),
    select<Row>("transactions", `select=*&buyer_id=eq.${buyerId}&type=in.(Payment,Deposit)&order=created_at.desc`),
  ]);

  const dam = parents.find((row) => Number(row.id) === Number(litter?.dam_id)) ?? null;
  const sire = parents.find((row) => Number(row.id) === Number(litter?.sire_id)) ?? null;
  const registrationFor = (dog: Row | null) => {
    const dogId = positiveId(dog?.id);
    const registration = parentRegistrations.find((row) => Number(row.dog_id) === dogId);
    return text(registration, "registration_number") || text(dog, "registration_number");
  };

  const settledPayments = payments.filter(settled).filter((payment) => !payment.puppy_id || Number(payment.puppy_id) === puppyId);
  const recordedReservationCents = settledPayments
    .filter((payment) => /deposit|reservation/i.test(`${text(payment, "category")} ${text(payment, "description")}`))
    .reduce((sum, payment) => sum + amount(payment, "amount_cents"), 0);
  const recordedAdditionalCents = settledPayments
    .filter((payment) => !/deposit|reservation/i.test(`${text(payment, "category")} ${text(payment, "description")}`))
    .reduce((sum, payment) => sum + amount(payment, "amount_cents"), 0);

  const salePriceCents = moneyValue(input.salePriceCents ?? puppy.price_cents);
  const salesTaxCents = moneyValue(input.salesTaxCents);
  const transportCents = moneyValue(input.transportCents);
  const otherChargesCents = moneyValue(input.otherChargesCents);
  const reservationCreditCents = moneyValue(input.reservationCreditCents ?? recordedReservationCents);
  const additionalPaymentsCents = moneyValue(input.additionalPaymentsCents ?? recordedAdditionalCents);
  const depositCents = reservationCreditCents + additionalPaymentsCents;
  const totalSaleCents = salePriceCents + salesTaxCents + transportCents + otherChargesCents;
  const balanceCents = Math.max(0, totalSaleCents - depositCents);
  const seller = sellerDetails();
  const groupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const transferDate = dateValue(input.transferDate);
  const supplied = input.details ?? {};

  const buyerCityStateZip = supplied.buyerCityStateZip || [
    [text(buyer, "city"), text(buyer, "state")].filter(Boolean).join(", "),
    text(buyer, "postal_code"),
  ].filter(Boolean).join(" ");

  const details: CombinedAgreementDetails = {
    ...supplied,
    agreementNumber: supplied.agreementNumber || groupId.slice(0, 8).toUpperCase(),
    agreementDate: supplied.agreementDate || createdAt.slice(0, 10),
    buyerStreetAddress: supplied.buyerStreetAddress || text(buyer, "street_address") || text(buyer, "address"),
    buyerCityStateZip,
    puppyAgeAtTransfer: supplied.puppyAgeAtTransfer || ageAtTransfer(text(puppy, "birth_date"), transferDate),
    puppyCoatType: supplied.puppyCoatType || text(puppy, "coat_type"),
    puppyCurrentWeight: supplied.puppyCurrentWeight || (amount(puppy, "current_weight") ? `${amount(puppy, "current_weight")} lb` : ""),
    microchipNumber: supplied.microchipNumber || text(puppy, "microchip_number"),
    registry: supplied.registry || text(puppy, "registry"),
    registrationNumber: supplied.registrationNumber || text(puppy, "registration_number"),
    litterInternalId: supplied.litterInternalId || text(litter, "name") || (litterId ? `Litter #${litterId}` : ""),
    bredBySeller: supplied.bredBySeller ?? true,
    acquiredFrom: supplied.acquiredFrom || "Bred by Seller",
    sireRegistrationNumber: supplied.sireRegistrationNumber || registrationFor(sire),
    damRegistrationNumber: supplied.damRegistrationNumber || registrationFor(dam),
    knownConditions: supplied.knownConditions || text(puppy, "notes"),
    salesTaxCents,
    transportCents,
    otherChargesCents,
    reservationCreditCents,
    additionalPaymentsCents,
    paymentMethod: supplied.paymentMethod || text(settledPayments[0], "method"),
    sellerRepresentative: supplied.sellerRepresentative || seller.name,
  };

  const snapshot: ContractSnapshot = {
    version: 1,
    groupId,
    kind: "health_guarantee",
    status: "pending",
    createdAt,
    buyerId,
    buyerName: fullName(buyer),
    buyerEmail: text(buyer, "email"),
    buyerPhone: text(buyer, "phone"),
    buyerLocation: buyerCityStateZip,
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
    balanceDueDate: dateValue(input.balanceDueDate),
    transferDate,
    sellerName: seller.name,
    sellerLocation: seller.location,
    microToy: input.microToy === true,
    title: `Bill of Sale, Animal History Certificate and One-Year Health Guarantee - ${text(puppy, "name") || `Puppy #${puppyId}`}`,
    introduction: `This production agreement records the sale, animal history, transfer terms, one-year limited health guarantee, statutory notice, and electronic signature for ${text(puppy, "name") || `Puppy #${puppyId}`}.`,
    terms: input.terms?.filter(Boolean) ?? combinedAgreementTerms,
    agreementDetails: details,
  };

  const pdf = await renderContractPdf(snapshot);
  const objectKey = `buyers/${buyerId}/contracts/${groupId}-bill-of-sale-health-guarantee.pdf`;
  await uploadPdf(objectKey, pdf);

  const document = await insert<DocumentRow>("buyer_documents", {
    buyer_id: buyerId,
    payment_plan_id: null,
    document_type: "Bill of Sale and Health Guarantee",
    title: snapshot.title,
    object_key: objectKey,
    file_name: `bill-of-sale-health-guarantee-${fileSafe(snapshot.puppyName)}.pdf`,
    content_type: "application/pdf",
    size_bytes: pdf.length,
    notes: contractNotes(snapshot),
    created_at: createdAt,
    updated_at: createdAt,
  });
  await addPuppyLink(document.id, puppyId);

  try {
    await insert("events", {
      title: `${snapshot.title} prepared`,
      event_type: "Contract",
      event_date: createdAt.slice(0, 10),
      event_time: createdAt.slice(11, 16),
      related_type: "buyers",
      related_id: buyerId,
      location: "SWVAOS",
      status: "Awaiting signature",
      notes: `Combined production agreement document #${document.id}`,
      created_at: createdAt,
      updated_at: createdAt,
    });
  } catch {
    // The document record remains authoritative if activity logging is unavailable.
  }

  const token = await createPortalToken(buyerId);
  return {
    buyerId,
    puppyId,
    token,
    contracts: [{
      id: document.id,
      title: document.title,
      documentType: document.document_type,
      status: snapshot.status,
      kind: snapshot.kind,
      puppyId,
      puppyName: snapshot.puppyName,
      createdAt,
      signedAt: null,
      signerName: null,
      snapshot,
    }],
  };
}
