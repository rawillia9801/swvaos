import { parseContractNotes } from "../lib/contract-pdf";
import { sendOwnerNotification } from "../lib/email-service";
import { supabaseRequest } from "./supabase";
import { createSupabaseResource, getKennelDataFromSupabase } from "./supabase-kennel";

type Row = Record<string, unknown>;

export type TransportationEligibility = {
  buyerId: number;
  buyerName: string;
  puppyNames: string[];
  totalPriceCents: number;
  paidCents: number;
  outstandingCents: number;
  minimumPaidCents: number;
  paidPercent: number;
  hasPaymentPlan: boolean;
  paymentReady: boolean;
  documentsReady: boolean;
  missingDocuments: string[];
  existingReservation: null | {
    id: number;
    date: string;
    time: string;
    status: string;
  };
  canReserve: boolean;
};

export type TransportationReservationResult = {
  reserved: boolean;
  unavailable?: boolean;
  existing?: boolean;
  eventId?: number;
  date: string;
  time: string;
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "").trim();
const amount = (row: Row | null | undefined, key: string) => Number(row?.[key] ?? 0) || 0;
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
const settled = (row: Row) => ["paid", "complete", "completed", "settled"].includes(text(row, "status").toLowerCase());
const activeReservation = (row: Row) => !["cancelled", "canceled", "denied", "rejected", "void"].includes(text(row, "status").toLowerCase());
const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const buyerDisplayName = (buyer: Row | undefined) => [text(buyer, "first_name"), text(buyer, "last_name")].filter(Boolean).join(" ") || text(buyer, "email") || `Buyer #${positiveId(buyer?.id)}`;

const requiredDocuments = [
  { name: "Deposit Agreement", terms: ["deposit agreement", "reservation agreement"] },
  { name: "Hypoglycemia Awareness Form", terms: ["hypoglycemia awareness", "hypoglycemia form", "pup lift acknowledgement"] },
  { name: "Transportation Policy", terms: ["transportation policy", "transport policy", "pickup delivery policy"] },
  { name: "Puppy Sale Agreement", terms: ["puppy sale agreement", "bill of sale", "sales agreement"] },
];

const financingDocument = { name: "Puppy Payment Financing Agreement", terms: ["payment plan agreement", "financing agreement", "puppy payment financing"] };

function documentIsCompleted(row: Row) {
  const snapshot = parseContractNotes(text(row, "notes"));
  if (snapshot?.status === "signed") return true;
  const combined = normalize(`${text(row, "title")} ${text(row, "document_type")} ${text(row, "notes")}`);
  return ["signed", "completed", "complete", "acknowledged", "executed", "fully executed"].some((term) => combined.includes(term));
}

function documentMatches(row: Row, terms: string[]) {
  const combined = normalize(`${text(row, "title")} ${text(row, "document_type")}`);
  return terms.some((term) => combined.includes(normalize(term)));
}

function easternToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimePartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateWithinReservationWindow(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const candidate = new Date(`${date}T12:00:00Z`);
  const tomorrow = new Date(`${easternToday()}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const latest = new Date(tomorrow);
  latest.setUTCDate(latest.getUTCDate() + 180);
  return !Number.isNaN(candidate.getTime()) && candidate >= tomorrow && candidate <= latest;
}

export function transportationTimeSlots() {
  const configured = (process.env.SWVAOS_TRANSPORTATION_TIME_SLOTS || "10:00,13:00,16:00")
    .split(",")
    .map((slot) => slot.trim())
    .filter((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot))
    .slice(0, 9);
  return configured.length ? configured : ["10:00", "13:00", "16:00"];
}

export function spokenTransportationTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = hour >= 12 ? "P M" : "A M";
  const displayHour = hour % 12 || 12;
  return minute ? `${displayHour} ${String(minute).padStart(2, "0")} ${period}` : `${displayHour} ${period}`;
}

export function parseTransportationDate(digits: string) {
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length !== 8) return "";
  const month = Number(cleaned.slice(0, 2));
  const day = Number(cleaned.slice(2, 4));
  const year = Number(cleaned.slice(4, 8));
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return "";
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dateWithinReservationWindow(date) ? date : "";
}

export async function getTransportationEligibility(buyerId: number): Promise<TransportationEligibility> {
  const data = await getKennelDataFromSupabase();
  const buyers = data.buyers as Row[];
  const puppies = data.puppies as Row[];
  const plans = data.payment_plans as Row[];
  const transactions = data.transactions as Row[];
  const documents = data.buyer_documents as Row[];
  const events = data.events as Row[];
  const buyer = buyers.find((row) => positiveId(row.id) === buyerId);
  if (!buyer) throw new Error("The family account was not found.");

  const assignedPuppies = puppies.filter((row) => positiveId(row.buyer_id) === buyerId && !["cancelled", "canceled", "void"].includes(text(row, "status").toLowerCase()));
  const puppyIds = new Set(assignedPuppies.map((row) => positiveId(row.id)).filter(Boolean));
  const buyerTransactions = transactions.filter((row) => positiveId(row.buyer_id) === buyerId || puppyIds.has(positiveId(row.puppy_id)));
  const buyerPlans = plans.filter((row) => positiveId(row.buyer_id) === buyerId && !["cancelled", "canceled", "closed", "complete", "completed"].includes(text(row, "status").toLowerCase()));
  const hasPaymentPlan = buyerPlans.length > 0;

  const puppyPriceCents = assignedPuppies.reduce((sum, row) => sum + Math.max(0, amount(row, "price_cents")), 0);
  const planTotalCents = buyerPlans.reduce((sum, row) => sum + Math.max(0, amount(row, "total_amount_cents")), 0);
  const paidCents = buyerTransactions
    .filter((row) => ["payment", "deposit"].includes(text(row, "type").toLowerCase()) && settled(row))
    .reduce((sum, row) => sum + Math.max(0, amount(row, "amount_cents")), 0);
  const openLedgerCents = buyerTransactions
    .filter((row) => ["payment", "deposit"].includes(text(row, "type").toLowerCase()) && !settled(row))
    .reduce((sum, row) => sum + Math.max(0, amount(row, "amount_cents")), 0);
  const totalPriceCents = Math.max(puppyPriceCents, planTotalCents, paidCents + openLedgerCents);
  const outstandingCents = Math.max(0, totalPriceCents - paidCents);
  const minimumPaidCents = totalPriceCents > 0 ? Math.ceil(totalPriceCents * 0.5) : 0;
  const paidPercent = totalPriceCents > 0 ? Math.min(100, Math.floor((paidCents / totalPriceCents) * 100)) : 100;
  const paymentReady = outstandingCents === 0 || paidCents >= minimumPaidCents;

  const buyerDocuments = documents.filter((row) => positiveId(row.buyer_id) === buyerId);
  const documentsToCheck = hasPaymentPlan ? [...requiredDocuments, financingDocument] : requiredDocuments;
  const missingDocuments = documentsToCheck
    .filter((requirement) => !buyerDocuments.some((row) => documentMatches(row, requirement.terms) && documentIsCompleted(row)))
    .map((requirement) => requirement.name);
  const documentsReady = missingDocuments.length === 0;

  const today = easternToday();
  const existing = events
    .filter((row) => text(row, "event_type") === "Transportation" && positiveId(row.related_id) === buyerId && text(row, "related_type") === "buyers" && activeReservation(row) && text(row, "event_date") >= today)
    .sort((left, right) => `${text(left, "event_date")} ${text(left, "event_time")}`.localeCompare(`${text(right, "event_date")} ${text(right, "event_time")}`))[0];

  return {
    buyerId,
    buyerName: buyerDisplayName(buyer),
    puppyNames: assignedPuppies.map((row) => text(row, "name")).filter(Boolean),
    totalPriceCents,
    paidCents,
    outstandingCents,
    minimumPaidCents,
    paidPercent,
    hasPaymentPlan,
    paymentReady,
    documentsReady,
    missingDocuments,
    existingReservation: existing ? { id: positiveId(existing.id), date: text(existing, "event_date"), time: text(existing, "event_time"), status: text(existing, "status") } : null,
    canReserve: assignedPuppies.length > 0 && paymentReady && documentsReady && !existing,
  };
}

async function transportationEventsForDate(date: string) {
  const response = await supabaseRequest(`rest/v1/events?select=*&event_type=eq.Transportation&event_date=eq.${date}&order=id.asc`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Unable to check transportation availability.");
  return await response.json() as Row[];
}

async function deleteEvent(id: number) {
  const response = await supabaseRequest(`rest/v1/events?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || "Unable to release the duplicate transportation request.");
}

export async function reserveTransportationMeet(input: { buyerId: number; date: string; time: string; callSid?: string }): Promise<TransportationReservationResult> {
  if (!dateWithinReservationWindow(input.date)) throw new Error("Choose a valid date between tomorrow and 180 days from now.");
  if (!transportationTimeSlots().includes(input.time)) throw new Error("Choose one of the offered transportation times.");

  const eligibility = await getTransportationEligibility(input.buyerId);
  if (eligibility.existingReservation) return { reserved: true, existing: true, date: eligibility.existingReservation.date, time: eligibility.existingReservation.time };
  if (!eligibility.canReserve) throw new Error("The family account is not currently eligible to reserve a transportation meeting.");

  const occupied = (await transportationEventsForDate(input.date)).filter(activeReservation);
  if (occupied.length) return { reserved: false, unavailable: true, date: input.date, time: input.time };

  const now = new Date().toISOString();
  const created = await createSupabaseResource("events", {
    title: `Transportation meet request - ${eligibility.buyerName}`,
    event_type: "Transportation",
    event_date: input.date,
    event_time: input.time,
    related_type: "buyers",
    related_id: input.buyerId,
    location: "Meet-up location to be confirmed",
    status: "Requested",
    notes: [
      "Reserved through the verified telephone menu.",
      `Buyer: ${eligibility.buyerName}`,
      `Puppy: ${eligibility.puppyNames.join(", ") || "Not recorded"}`,
      `Paid before request: ${eligibility.paidPercent}%`,
      `Payment plan: ${eligibility.hasPaymentPlan ? "Yes" : "No"}`,
      "Required documents: Complete",
      input.callSid ? `Call: ${input.callSid}` : "",
    ].filter(Boolean).join("\n"),
  }) as Row;
  const createdId = positiveId(created.id);

  await new Promise((resolve) => setTimeout(resolve, 175));
  const competing = (await transportationEventsForDate(input.date)).filter(activeReservation);
  const winner = competing.slice().sort((left, right) => positiveId(left.id) - positiveId(right.id))[0];
  if (!winner || positiveId(winner.id) !== createdId) {
    if (createdId) await deleteEvent(createdId).catch(() => null);
    return { reserved: false, unavailable: true, date: input.date, time: input.time };
  }

  await sendOwnerNotification({
    category: "Transportation",
    subject: `Transportation date requested by ${eligibility.buyerName}`,
    buyerId: input.buyerId,
    body: [
      "A verified buyer reserved the program's transportation meeting date through the telephone menu.",
      "",
      `Buyer: ${eligibility.buyerName}`,
      `Puppy: ${eligibility.puppyNames.join(", ") || "Not recorded"}`,
      `Date: ${input.date}`,
      `Time: ${spokenTransportationTime(input.time)}`,
      `Paid: ${eligibility.paidPercent}%`,
      `Payment plan: ${eligibility.hasPaymentPlan ? "Yes" : "No"}`,
      "Required documents: Complete",
      "Status: Requested - breeder confirmation is still required.",
      "",
      "Review in SWVAOS: https://swvaos.site/?view=Delivery",
    ].join("\n"),
  }).catch(() => null);

  return { reserved: true, eventId: createdId, date: input.date, time: input.time };
}
