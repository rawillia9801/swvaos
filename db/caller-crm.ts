import { createSupabaseResource, getKennelDataFromSupabase } from "./supabase-kennel";

type Row = Record<string, unknown>;

export type CallerCrmProfile = {
  recognized: boolean;
  phone: string;
  buyer: null | {
    id: number;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    postal_code: string;
    application_status: string;
  };
  puppies: Array<{
    id: number;
    name: string;
    sex: string;
    color: string;
    status: string;
    litter: string;
    birth_date: string;
    price_cents: number;
  }>;
  updates: Array<{
    id: number;
    puppy_id: number;
    puppy_name: string;
    title: string;
    body: string;
    week_number: number | null;
    weight: number | null;
    created_at: string;
  }>;
  payment_plans: Array<{
    id: number;
    name: string;
    total_amount_cents: number;
    payment_amount_cents: number;
    frequency: string;
    next_due_date: string;
    status: string;
  }>;
  account: {
    paid_cents: number;
    outstanding_cents: number;
    overdue_count: number;
    next_due_date: string;
  };
  calls: Array<{
    id: number;
    title: string;
    event_date: string;
    event_time: string;
    status: string;
    notes: string;
  }>;
  public_information: {
    available_puppy_count: number;
    available_puppy_names: string[];
  };
};

const text = (row: Row, key: string) => typeof row[key] === "string" ? String(row[key]) : "";
const number = (row: Row, key: string) => Number.isFinite(Number(row[key])) ? Number(row[key]) : 0;
const id = (row: Row, key: string) => {
  const value = number(row, key);
  return Number.isInteger(value) && value > 0 ? value : 0;
};
const published = (row: Row) => row.published === true || row.published === 1 || row.published === "1" || row.published === "true";
const fiveDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-5);

export function normalizeCallerPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function postalCodes(row: Row) {
  const codes = new Set<string>();
  for (const key of ["postal_code", "zip", "zipcode", "zip_code", "billing_zip", "shipping_zip"]) {
    const value = fiveDigits(row[key]);
    if (value.length === 5) codes.add(value);
  }

  const addressText = [
    text(row, "street_address"),
    text(row, "address"),
    text(row, "mailing_address"),
    text(row, "household_notes"),
    text(row, "notes"),
  ].filter(Boolean).join("\n");

  const labeled = addressText.matchAll(/(?:zip|postal(?:\s+code)?|street\s+address|mailing\s+address|address)[^\d]{0,60}(\d{5})(?:-\d{4})?/gi);
  for (const match of labeled) codes.add(match[1]);

  const addressLines = addressText.split(/\n|\|/).filter((line) => /address|city|state|zip|postal/i.test(line));
  for (const line of addressLines) {
    const matches = [...line.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
    if (matches.length) codes.add(matches[matches.length - 1][1]);
  }

  return [...codes];
}

const fullName = (buyer: Row) => [text(buyer, "first_name"), text(buyer, "last_name")].filter(Boolean).join(" ") || text(buyer, "email") || `Family ${id(buyer, "id")}`;

function buyerScore(buyer: Row) {
  const fields = ["first_name", "last_name", "email", "phone", "city", "state", "application_status", "household_notes", "notes"];
  const completeness = fields.reduce((score, key) => score + (text(buyer, key).trim() ? 1 : 0), 0);
  const zipScore = postalCodes(buyer).length ? 5 : 0;
  const importedPenalty = /\[SWVAOS import:/i.test(text(buyer, "notes")) ? -4 : 0;
  const closedPenalty = ["declined", "archived", "closed"].includes(text(buyer, "application_status").toLowerCase()) ? -2 : 0;
  return completeness + zipScore + importedPenalty + closedPenalty;
}

function chooseBuyer(candidates: Row[], preferredPostalCode?: string, preferredBuyerId?: number) {
  if (preferredBuyerId) {
    const exactBuyer = candidates.find((candidate) => id(candidate, "id") === preferredBuyerId);
    if (exactBuyer) return exactBuyer;
  }
  const preferred = fiveDigits(preferredPostalCode);
  const matching = preferred.length === 5
    ? candidates.filter((candidate) => postalCodes(candidate).includes(preferred))
    : [];
  const pool = matching.length ? matching : candidates;
  return [...pool].sort((left, right) => buyerScore(right) - buyerScore(left) || id(left, "id") - id(right, "id"))[0] ?? null;
}

export async function getCallerCrmProfile(phone: string, preferredPostalCode?: string, preferredBuyerId?: number): Promise<CallerCrmProfile> {
  const data = await getKennelDataFromSupabase();
  const normalizedPhone = normalizeCallerPhone(phone);
  const buyers = data.buyers as Row[];
  const puppies = data.puppies as Row[];
  const litters = data.litters as Row[];
  const updates = data.updates as Row[];
  const plans = data.payment_plans as Row[];
  const transactions = data.transactions as Row[];
  const events = data.events as Row[];
  const matchingBuyers = normalizedPhone
    ? buyers.filter((candidate) => normalizeCallerPhone(text(candidate, "phone")) === normalizedPhone)
    : [];
  const buyer = chooseBuyer(matchingBuyers, preferredPostalCode, preferredBuyerId);
  const buyerId = buyer ? id(buyer, "id") : 0;
  const assignedPuppies = buyer ? puppies.filter((puppy) => id(puppy, "buyer_id") === buyerId) : [];
  const puppyIds = new Set(assignedPuppies.map((puppy) => id(puppy, "id")));
  const puppyName = (puppyId: number) => text(assignedPuppies.find((puppy) => id(puppy, "id") === puppyId) ?? {}, "name") || `Puppy ${puppyId}`;
  const buyerTransactions = buyer ? transactions.filter((transaction) => id(transaction, "buyer_id") === buyerId || puppyIds.has(id(transaction, "puppy_id"))) : [];
  const unpaid = buyerTransactions.filter((transaction) => ["Payment", "Deposit"].includes(text(transaction, "type")) && !["Paid", "Complete"].includes(text(transaction, "status")));
  const paid = buyerTransactions.filter((transaction) => ["Payment", "Deposit"].includes(text(transaction, "type")) && ["Paid", "Complete"].includes(text(transaction, "status")));
  const today = new Date().toISOString().slice(0, 10);
  const buyerPlans = buyer ? plans.filter((plan) => id(plan, "buyer_id") === buyerId) : [];
  const nextDueDates = [...unpaid.map((transaction) => text(transaction, "due_date")), ...buyerPlans.filter((plan) => text(plan, "status") === "Active").map((plan) => text(plan, "next_due_date"))].filter(Boolean).sort();
  const availablePuppies = puppies.filter((puppy) => !id(puppy, "buyer_id") && text(puppy, "status") === "Available");
  const buyerPostalCode = buyer ? postalCodes(buyer)[0] || "" : "";

  return {
    recognized: Boolean(buyer),
    phone,
    buyer: buyer ? {
      id: buyerId,
      name: fullName(buyer),
      first_name: text(buyer, "first_name"),
      last_name: text(buyer, "last_name"),
      email: text(buyer, "email"),
      phone: text(buyer, "phone"),
      city: text(buyer, "city"),
      state: text(buyer, "state"),
      postal_code: buyerPostalCode,
      application_status: text(buyer, "application_status") || "Inquiry",
    } : null,
    puppies: assignedPuppies.map((puppy) => {
      const litter = litters.find((candidate) => id(candidate, "id") === id(puppy, "litter_id"));
      return {
        id: id(puppy, "id"),
        name: text(puppy, "name"),
        sex: text(puppy, "sex"),
        color: text(puppy, "color"),
        status: text(puppy, "status"),
        litter: litter ? text(litter, "name") : "",
        birth_date: text(puppy, "birth_date"),
        price_cents: number(puppy, "price_cents"),
      };
    }),
    updates: updates
      .filter((update) => puppyIds.has(id(update, "puppy_id")) && published(update))
      .sort((left, right) => text(right, "created_at").localeCompare(text(left, "created_at")))
      .map((update) => ({
        id: id(update, "id"),
        puppy_id: id(update, "puppy_id"),
        puppy_name: puppyName(id(update, "puppy_id")),
        title: text(update, "title"),
        body: text(update, "body"),
        week_number: update.week_number == null ? null : number(update, "week_number"),
        weight: update.weight == null ? null : number(update, "weight"),
        created_at: text(update, "created_at"),
      })),
    payment_plans: buyerPlans.map((plan) => ({
      id: id(plan, "id"),
      name: text(plan, "name"),
      total_amount_cents: number(plan, "total_amount_cents"),
      payment_amount_cents: number(plan, "payment_amount_cents"),
      frequency: text(plan, "frequency"),
      next_due_date: text(plan, "next_due_date"),
      status: text(plan, "status"),
    })),
    account: {
      paid_cents: paid.reduce((sum, transaction) => sum + number(transaction, "amount_cents"), 0),
      outstanding_cents: unpaid.reduce((sum, transaction) => sum + number(transaction, "amount_cents"), 0),
      overdue_count: unpaid.filter((transaction) => text(transaction, "due_date") && text(transaction, "due_date") < today).length,
      next_due_date: nextDueDates[0] ?? "",
    },
    calls: buyer ? events
      .filter((event) => text(event, "event_type") === "Call" && text(event, "related_type") === "buyers" && id(event, "related_id") === buyerId)
      .sort((left, right) => `${text(right, "event_date")}${text(right, "event_time")}`.localeCompare(`${text(left, "event_date")}${text(left, "event_time")}`))
      .map((event) => ({ id: id(event, "id"), title: text(event, "title"), event_date: text(event, "event_date"), event_time: text(event, "event_time"), status: text(event, "status"), notes: text(event, "notes") })) : [],
    public_information: {
      available_puppy_count: availablePuppies.length,
      available_puppy_names: availablePuppies.slice(0, 5).map((puppy) => text(puppy, "name")).filter(Boolean),
    },
  };
}

const spokenMoney = (cents: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} dollars`;

export function toStudioCallerLookup(profile: CallerCrmProfile) {
  const buyer = profile.buyer;
  const firstName = buyer?.first_name || buyer?.name || "caller";
  const puppyNames = profile.puppies.map((puppy) => puppy.name).filter(Boolean);
  const latestUpdate = profile.updates[0] ?? null;
  const reservationMessage = profile.puppies.length
    ? `Your account has ${profile.puppies.length} assigned ${profile.puppies.length === 1 ? "puppy" : "puppies"}: ${puppyNames.join(", ")}. ${latestUpdate ? `The latest published update is ${latestUpdate.title}. ${latestUpdate.body}` : "There is not a published puppy update yet."}`
    : "There is not currently a puppy assigned to your account. Our team can review your placement status with you.";
  const pickupMessage = profile.puppies.length
    ? `Your pickup or delivery request will be connected to ${puppyNames.join(" and ")}. No requested appointment is confirmed until our team approves it.`
    : "There is not currently an assigned puppy on this account. Our team can still answer general pickup and delivery questions.";
  const paymentMessage = `Your recorded outstanding balance is ${spokenMoney(profile.account.outstanding_cents)}. Your recorded payments total ${spokenMoney(profile.account.paid_cents)}. ${profile.account.next_due_date ? `Your next recorded due date is ${profile.account.next_due_date}.` : "There is no upcoming payment date recorded."}`;
  const activePlans = profile.payment_plans.filter((plan) => plan.status === "Active");
  const planMessage = activePlans.length
    ? `You have ${activePlans.length} active puppy payment ${activePlans.length === 1 ? "plan" : "plans"}. ${activePlans.map((plan) => `${plan.name}, ${spokenMoney(plan.payment_amount_cents)} ${plan.frequency.toLowerCase()}, with the next recorded due date ${plan.next_due_date || "not scheduled"}`).join(". ")}.`
    : "There is no active puppy payment plan recorded on your account.";
  const email = buyer?.email || "";

  return {
    ...profile,
    found: profile.recognized,
    customer_id: buyer?.id ?? "",
    first_name: firstName,
    name: buyer?.name || "",
    phone: buyer?.phone || profile.phone,
    email,
    customer_email: email,
    email_on_file: email,
    Email: email,
    zip: buyer?.postal_code || "",
    application_status: buyer?.application_status || "Not found",
    application_message: buyer ? `Your application or approval status is ${buyer.application_status || "Inquiry"}.` : "We could not match this phone number to an application.",
    reservation_message: reservationMessage,
    pickup_delivery_message: pickupMessage,
    assigned_puppy_information: profile.puppies,
    latest_update: latestUpdate,
    account_information: profile.account,
    voice_prompts: {
      payment_menu: paymentMessage,
      payment_plan_menu: planMessage,
    },
  };
}

function easternDateTime() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}

export async function logCallerEvent(input: { phone: string; callSid?: string; buyerId?: number; title: string; status?: string; details?: string }) {
  const stamp = easternDateTime();
  return createSupabaseResource("events", {
    title: input.title,
    event_type: "Call",
    event_date: stamp.date,
    event_time: stamp.time,
    related_type: input.buyerId ? "buyers" : "caller",
    related_id: input.buyerId || null,
    location: "Phone",
    status: input.status || "Completed",
    notes: [input.phone ? `Caller: ${input.phone}` : "", input.callSid ? `Call: ${input.callSid}` : "", input.details || ""].filter(Boolean).join("\n"),
  });
}
