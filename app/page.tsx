"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Command as CommandIcon,
  Dog as DogIcon,
  ExternalLink,
  FileText,
  FileSignature,
  FolderOpen,
  HeartPulse,
  Headphones,
  LayoutDashboard,
  ListTree,
  MessagesSquare,
  MonitorSmartphone,
  PackageSearch,
  PawPrint,
  ClipboardCheck,
  MessageSquareText,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Search as SearchIcon,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Voicemail,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { healthGuaranteeTerms } from "../lib/contract-templates";
import { uploadDocumentDirect } from "../lib/direct-document-upload";
import { defaultTemplatesConfig, type TemplatesConfig } from "../lib/template-defaults";
import { TemplatesCenter } from "../components/templates-center";

type Resource = "dogs" | "litters" | "buyers" | "puppies" | "payment_plans" | "transactions" | "events" | "updates" | "dog_medical_records" | "dog_registrations";
type BaseRecord = { id: number; created_at: string; updated_at: string };
type Dog = BaseRecord & { name: string; registered_name: string | null; sex: string; role: string; date_of_birth: string | null; color: string | null; weight: number | null; status: string; registration_number: string | null; microchip_number: string | null; health_testing: string | null; acquired_from: string | null; acquisition_date: string | null; acquisition_notes: string | null; next_heat_date: string | null; notes: string | null; purchase_price_cents: number | null };
type Litter = BaseRecord & { name: string; dam_id: number | null; sire_id: number | null; breeding_date: string | null; due_date: string | null; birth_date: string | null; expected_count: number | null; status: string; notes: string | null };
type Buyer = BaseRecord & { first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null };
type Puppy = BaseRecord & { litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null; notes: string | null };
type PaymentPlan = BaseRecord & { buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type Transaction = BaseRecord & { type: "Payment" | "Deposit" | "Cost"; dog_id: number | null; buyer_id: number | null; litter_id: number | null; puppy_id: number | null; payment_plan_id: number | null; category: string | null; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null; notes: string | null };
type KennelEvent = BaseRecord & { title: string; event_type: string; event_date: string; event_time: string | null; related_type: string | null; related_id: number | null; location: string | null; status: string; notes: string | null };
type PuppyUpdate = BaseRecord & { puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean };
type DogMedicalRecord = BaseRecord & { dog_id: number; record_type: string; title: string; record_date: string | null; provider: string | null; cost_cents: number; next_due_date: string | null; notes: string | null };
type DogRegistration = BaseRecord & { dog_id: number; registry: string; registration_number: string; registered_name: string | null; issue_date: string | null; notes: string | null };
type StoredDocument = BaseRecord & { title: string; file_name: string; content_type: string; size_bytes: number; document_type: string };
type DogDocument = StoredDocument & { dog_id: number; registration_id: number | null; registry: string | null; registration_number: string | null };
type BuyerDocument = StoredDocument & { buyer_id: number; payment_plan_id: number | null; puppy_ids: number[]; notes?: string | null };
type DataSet = { dogs: Dog[]; litters: Litter[]; buyers: Buyer[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; events: KennelEvent[]; updates: PuppyUpdate[]; dog_medical_records: DogMedicalRecord[]; dog_registrations: DogRegistration[]; dog_documents: DogDocument[]; buyer_documents: BuyerDocument[] };
type ModalState = { resource: Resource; record?: Record<string, unknown>; preset?: Record<string, unknown> } | null;
type DocumentKind = "dog" | "buyer";
type DocumentModalState = { kind: DocumentKind; ownerId?: number } | null;
type ContractModalState = { buyerId: number; portalUrl?: string } | null;
type View = "Command" | "Breeding" | "Litters" | "Puppies" | "Care" | "Applications" | "Families" | "Placement" | "Delivery" | "Finance" | "Inventory" | "Comms" | "Portal" | "CRM" | "Calendar" | "Vault" | "Templates" | "Reports";
type ViewGroup = "Daily work" | "Breeding program" | "Placement journey" | "Business" | "Tools";
type ViewDefinition = { id: View; label: string; icon: LucideIcon; group: ViewGroup; shortcut: string };

const emptyData: DataSet = { dogs: [], litters: [], buyers: [], puppies: [], payment_plans: [], transactions: [], events: [], updates: [], dog_medical_records: [], dog_registrations: [], dog_documents: [], buyer_documents: [] };
const views: ViewDefinition[] = [
  { id: "Command", label: "Today", icon: LayoutDashboard, group: "Daily work", shortcut: "1" },
  { id: "Calendar", label: "Schedule", icon: CalendarDays, group: "Daily work", shortcut: "C" },
  { id: "Breeding", label: "Dogs & breeding", icon: DogIcon, group: "Breeding program", shortcut: "2" },
  { id: "Litters", label: "Litters", icon: ListTree, group: "Breeding program", shortcut: "L" },
  { id: "Puppies", label: "Puppies", icon: PawPrint, group: "Breeding program", shortcut: "P" },
  { id: "Care", label: "Health & care", icon: HeartPulse, group: "Breeding program", shortcut: "4" },
  { id: "Applications", label: "Applications", icon: ClipboardCheck, group: "Placement journey", shortcut: "A" },
  { id: "Families", label: "Buyers & waitlist", icon: UsersRound, group: "Placement journey", shortcut: "3" },
  { id: "Placement", label: "Puppy placement", icon: UserRound, group: "Placement journey", shortcut: "M" },
  { id: "Delivery", label: "Pickup & delivery", icon: Route, group: "Placement journey", shortcut: "D" },
  { id: "Finance", label: "Payments & sales", icon: WalletCards, group: "Business", shortcut: "5" },
  { id: "Inventory", label: "Costs", icon: PackageSearch, group: "Business", shortcut: "6" },
  { id: "Comms", label: "Communications", icon: MessagesSquare, group: "Business", shortcut: "7" },
  { id: "Templates", label: "Automations & templates", icon: MessageSquareText, group: "Business", shortcut: "T" },
  { id: "Reports", label: "Reports", icon: ChartNoAxesCombined, group: "Business", shortcut: "R" },
  { id: "Portal", label: "Family portal", icon: MonitorSmartphone, group: "Tools", shortcut: "8" },
  { id: "CRM", label: "Phone center", icon: Headphones, group: "Tools", shortcut: "9" },
  { id: "Vault", label: "Documents", icon: FolderOpen, group: "Tools", shortcut: "V" },
];
const viewGroups: ViewGroup[] = ["Daily work", "Breeding program", "Placement journey", "Business", "Tools"];

const dogDocumentTypes = ["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Medical Documentation", "Other"];
const buyerDocumentTypes = ["Bill of Sale", "Health Guarantee", "Payment Plan Agreement", "Other"];
const paymentDescriptions = ["Puppy deposit", "Reservation fee", "Installment payment", "Final balance", "Delivery fee", "Registration fee", "Refund", "Other payment"];
const costDescriptions = ["Veterinary care", "Vaccination", "Health testing", "Medication", "Food or supplements", "Kennel supplies", "Equipment", "Grooming", "Registration", "Breeding service", "Travel or delivery", "Payment processing fee", "Refund issued", "Other expense"];
const paymentCategories = ["Puppy sale", "Deposit", "Reservation", "Installment", "Final balance", "Delivery", "Registration", "Refund", "Other income"];
const costCategories = ["Veterinary", "Health testing", "Medication", "Food", "Supplies", "Equipment", "Grooming", "Registration", "Breeding", "Travel and delivery", "Payment processing", "Refund", "Other expense"];
const transactionMethods = ["Cash", "Check", "Credit card", "Debit card", "Bank transfer / ACH", "PayPal", "Venmo", "Cash App", "Zelle", "Financing", "Other"];
const transactionStatuses = ["Pending", "Due", "Partially paid", "Paid", "Overdue", "Refunded", "Reimbursed", "Voided"];
const transactionFeePattern = /^\[Fee charged: \$([0-9]+(?:\.[0-9]{1,2})?)\]\s*/i;
const paymentTypes = new Set(["Payment", "Deposit"]);
const paidStatuses = new Set(["Paid", "Complete"]);

const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const normalizePhone = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "").slice(-10);
const latestCallEvent = (events: KennelEvent[]) => events
  .filter((event) => event.event_type === "Call")
  .sort((left, right) => `${right.created_at}${right.id}`.localeCompare(`${left.created_at}${left.id}`))[0] ?? null;
const shortDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Not set";
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(`${value}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000) : null;
const fullName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const valueOf = (record: Record<string, unknown> | undefined, key: string, fallback = "") => String(record?.[key] ?? fallback);
const transactionFeeDefault = (record?: Record<string, unknown>, preset?: Record<string, unknown>) => {
  const explicit = valueOf(record, "fee_amount", valueOf(preset, "fee_amount"));
  if (explicit) return explicit;
  return String(record?.notes ?? preset?.notes ?? "").match(transactionFeePattern)?.[1] ?? "";
};
const transactionNotesDefault = (record?: Record<string, unknown>, preset?: Record<string, unknown>) => String(record?.notes ?? preset?.notes ?? "").replace(transactionFeePattern, "");
const transactionFeeCents = (transaction: Transaction) => {
  const fee = transaction.notes?.match(transactionFeePattern)?.[1];
  return fee ? Math.round(Number(fee) * 100) : 0;
};
const transactionNotesWithFee = (notes: unknown, fee: unknown) => {
  const cleanNotes = String(notes ?? "").replace(transactionFeePattern, "").trim();
  const amount = Number(fee);
  if (!Number.isFinite(amount) || amount <= 0) return cleanNotes;
  return `[Fee charged: $${amount.toFixed(2)}]${cleanNotes ? `\n${cleanNotes}` : ""}`;
};
const isPaymentTransaction = (transaction: Transaction) => paymentTypes.has(transaction.type);
const isPaidTransaction = (transaction: Transaction) => isPaymentTransaction(transaction) && paidStatuses.has(transaction.status);
const includesAny = (value: string | null | undefined, terms: string[]) => terms.some((term) => (value ?? "").toLowerCase().includes(term));
const friendlyError = (value: unknown, fallback: string) => {
  const message = value instanceof Error ? value.message : String(value || fallback);
  if (/schema cache|could not find the table|relation .* does not exist|column .* does not exist/i.test(message)) return "The SWVAOS data structure needs attention.";
  if (/not configured|missing.*key|missing.*url/i.test(message)) return "The SWVAOS data connection is not configured.";
  return message.replace(/supabase/gi, "data service").replace(/vercel/gi, "hosting service").replace(/chatgpt/gi, "previous site");
};

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function sumBy<T>(items: T[], amount: (item: T) => number) {
  return items.reduce((total, item) => total + amount(item), 0);
}

function Status({ children, tone = "neutral" }: { children: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

function Section({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="panel"><div className="panel-head"><span>{eyebrow}</span><h2>{title}</h2>{action}</div>{children}</section>;
}

function Empty({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty"><b>{title}</b><p>{text}</p><button onClick={onAction}>{action}</button></div>;
}

function useAnalytics(data: DataSet) {
  return useMemo(() => {
    const activeLitters = data.litters.filter((item) => !["Completed", "Archived"].includes(item.status));
    const payments = data.transactions.filter(isPaymentTransaction);
    const paid = payments.filter(isPaidTransaction).reduce((sum, item) => sum + item.amount_cents, 0);
    const costs = data.transactions.filter((item) => item.type === "Cost").reduce((sum, item) => sum + item.amount_cents, 0);
    const fees = data.transactions.reduce((sum, item) => sum + transactionFeeCents(item), 0);
    const outstanding = payments.filter((item) => !paidStatuses.has(item.status)).reduce((sum, item) => sum + item.amount_cents, 0);
    const overdue = payments.filter((item) => !paidStatuses.has(item.status) && item.due_date && item.due_date < today());
    const dueHealth = data.dog_medical_records.filter((item) => item.next_due_date && item.next_due_date <= today());
    const unmatched = data.puppies.filter((item) => !item.buyer_id && !["Placed", "Retained"].includes(item.status));
    const placed = data.puppies.filter((item) => item.buyer_id || item.status === "Placed");
    const approvedBuyers = data.buyers.filter((item) => item.application_status === "Approved");
    const pendingBuyers = data.buyers.filter((item) => !["Approved", "Declined", "Archived"].includes(item.application_status));
    const registryCoverage = pct(data.dogs.filter((dog) => data.dog_registrations.some((registration) => registration.dog_id === dog.id)).length, data.dogs.length);
    const docs = data.buyer_documents.length + data.dog_documents.length;
    const microchipCoverage = pct(data.dogs.filter((dog) => dog.microchip_number).length, data.dogs.length);
    const activePuppies = data.puppies.filter((item) => !["Placed", "Archived"].includes(item.status));
    const readyPuppies = data.puppies.filter((item) => item.status === "Available");
    const careEvents = data.events.filter((item) => includesAny(`${item.event_type} ${item.title}`, ["vet", "vaccine", "medical", "care", "groom", "task", "pickup", "whelp"]));
    const openTasks = data.events.filter((item) => item.status !== "Completed");
    const upcomingCare = careEvents.filter((item) => item.event_date >= today() && item.event_date <= addDays(30) && item.status !== "Completed");
    const supplyCosts = data.transactions.filter((item) => item.type === "Cost" && includesAny(`${item.category} ${item.description}`, ["food", "supply", "med", "vaccine", "equipment", "groom", "clean"]));
    const inventorySpend = sumBy(supplyCosts, (item) => item.amount_cents);
    const draftUpdates = data.updates.filter((item) => !item.published);
    const publishedUpdates = data.updates.filter((item) => item.published);
    const docsNeeded = Math.max(0, data.dogs.length * 2 + data.buyers.length - docs);
    const documentCoverage = pct(docs, data.dogs.length * 2 + data.buyers.length);
    const hasRecords = data.dogs.length + data.litters.length + data.buyers.length + data.puppies.length + data.transactions.length + data.events.length > 0;
    const readiness = hasRecords ? Math.max(0, Math.min(100, Math.round(
      (data.dogs.length ? 15 : 0)
      + registryCoverage * .2
      + microchipCoverage * .15
      + documentCoverage * .2
      + (data.buyers.length ? 10 : 0)
      + (data.dog_medical_records.length || data.events.length ? 10 : 0)
      + (data.transactions.length ? 10 : 0)
      - overdue.length * 5
      - dueHealth.length * 3
    ))) : 0;
    const upcoming = data.events.filter((item) => item.event_date >= today() && item.status !== "Completed").sort((a, b) => `${a.event_date}${a.event_time ?? ""}`.localeCompare(`${b.event_date}${b.event_time ?? ""}`));
    const activePlanValue = data.payment_plans.filter((item) => item.status === "Active").reduce((sum, item) => sum + item.total_amount_cents, 0);
    return { activeLitters, paid, costs, fees, outstanding, overdue, dueHealth, unmatched, placed, approvedBuyers, pendingBuyers, registryCoverage, microchipCoverage, docs, docsNeeded, readiness, upcoming, activePlanValue, activePuppies, readyPuppies, careEvents, openTasks, upcomingCare, supplyCosts, inventorySpend, draftUpdates, publishedUpdates };
  }, [data]);
}

function CommandView({ data, openCreate, setView }: { data: DataSet; openCreate: (resource: Resource, preset?: Record<string, unknown>) => void; setView: (view: View) => void }) {
  const a = useAnalytics(data);
  const dogName = (dogId: number | null) => data.dogs.find((dog) => dog.id === dogId)?.name ?? "Pairing not complete";
  const paidBuyers = new Set(data.transactions.filter((item) => paymentTypes.has(item.type) && paidStatuses.has(item.status) && item.buyer_id).map((item) => item.buyer_id));
  const contractedBuyers = new Set(data.buyer_documents.filter((item) => /bill of sale|health guarantee|agreement/i.test(item.document_type)).map((item) => item.buyer_id));
  const deliveryEvents = data.events.filter((item) => /pickup|delivery|transport/i.test(`${item.event_type} ${item.title}`) && item.status !== "Completed");
  const lifecycle = [
    { label: "Applications", count: a.pendingBuyers.length, view: "Applications" as View, note: "awaiting review" },
    { label: "Approved", count: a.approvedBuyers.length, view: "Families" as View, note: "on the waitlist" },
    { label: "Matched", count: a.placed.length, view: "Placement" as View, note: "puppies assigned" },
    { label: "Paid", count: paidBuyers.size, view: "Finance" as View, note: "buyer accounts" },
    { label: "Contracted", count: contractedBuyers.size, view: "Templates" as View, note: "documented homes" },
    { label: "Go-home", count: deliveryEvents.length, view: "Delivery" as View, note: "scheduled next" },
  ];
  const attention = [
    ...a.overdue.map((item) => ({ title: item.description, detail: `${money(item.amount_cents)} overdue`, view: "Finance" as View, tone: "bad" as const })),
    ...a.dueHealth.map((item) => ({ title: item.title, detail: `${item.record_type} due for ${dogName(item.dog_id)}`, view: "Care" as View, tone: "warn" as const })),
    ...a.unmatched.map((item) => ({ title: `${item.name} needs a family`, detail: "Available puppy is not matched to a buyer", view: "Placement" as View, tone: "warn" as const })),
    ...a.pendingBuyers.map((item) => ({ title: `${fullName(item)} needs review`, detail: "Application is still in the screening queue", view: "Applications" as View, tone: "neutral" as const })),
  ].slice(0, 8);

  return <div className="breeder-dashboard">
    <section className="breeder-desk-head">
      <div><span>BREEDER DESK</span><h1>What needs your attention today?</h1><p>Move every dog, litter, puppy, and family forward without losing the next care, placement, payment, or go-home step.</p></div>
      <div className="breeder-quick-actions"><button onClick={() => openCreate("events")}><CalendarDays size={17} /> Add task</button><button onClick={() => openCreate("puppies")}><PawPrint size={17} /> Add puppy</button><button onClick={() => openCreate("buyers")}><UserRound size={17} /> Add application</button><button className="primary-action" onClick={() => openCreate("transactions", { type: "Payment" })}><ReceiptText size={17} /> Record payment</button></div>
    </section>

    <section className="breeder-lifecycle" aria-label="Placement lifecycle">
      <header><div><span>PLACEMENT JOURNEY</span><h2>From application to go-home</h2></div><button onClick={() => setView("Placement")}>Open placement board <ChevronRight size={15} /></button></header>
      <div>{lifecycle.map((stage, index) => <button key={stage.label} onClick={() => setView(stage.view)}><i>{index + 1}</i><span><b>{stage.label}</b><small>{stage.note}</small></span><strong>{stage.count}</strong></button>)}</div>
    </section>

    <div className="breeder-work-grid">
      <Section eyebrow="Breeding program" title="Active litter work" action={<button className="ghost" onClick={() => setView("Litters")}>All litters</button>}>
        {a.activeLitters.length ? <div className="breeder-litter-list">{a.activeLitters.slice(0, 5).map((litter) => {
          const puppies = data.puppies.filter((puppy) => puppy.litter_id === litter.id);
          const assigned = puppies.filter((puppy) => puppy.buyer_id).length;
          const date = litter.birth_date || litter.due_date;
          return <button key={litter.id} onClick={() => setView("Litters")}><span className="litter-stage-icon"><ListTree size={18} /></span><span><b>{litter.name}</b><small>{dogName(litter.dam_id)} × {dogName(litter.sire_id)}</small></span><span><b>{date ? shortDate(date) : "Date needed"}</b><small>{litter.birth_date ? "Whelped" : "Expected"}</small></span><span><b>{puppies.length || litter.expected_count || 0}</b><small>{litter.birth_date ? `${assigned} matched` : "expected"}</small></span><Status tone={litter.status === "Active" ? "good" : "warn"}>{litter.status}</Status></button>;
        })}</div> : <Empty title="No active litter work" text="Create a planned litter to begin tracking the pairing, due date, whelping, and puppy roster." action="Create litter" onAction={() => openCreate("litters")} />}
      </Section>

      <Section eyebrow="Daily work" title="Schedule and care" action={<button className="ghost" onClick={() => setView("Calendar")}>Full schedule</button>}>
        {a.upcoming.length ? <div className="breeder-agenda">{a.upcoming.slice(0, 6).map((item) => <button key={item.id} onClick={() => setView(/pickup|delivery|transport/i.test(`${item.event_type} ${item.title}`) ? "Delivery" : "Calendar")}><time><b>{new Date(`${item.event_date}T12:00:00`).getDate()}</b><small>{new Date(`${item.event_date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></time><span><b>{item.title}</b><small>{[item.event_time, item.location, item.event_type].filter(Boolean).join(" · ")}</small></span><Status tone={item.event_date === today() ? "warn" : "neutral"}>{item.status}</Status></button>)}</div> : <Empty title="Nothing scheduled" text="Add vaccinations, worming, vet checks, breedings, whelping dates, pickups, and follow-ups." action="Add task" onAction={() => openCreate("events")} />}
      </Section>

      <Section eyebrow="Action queue" title="Records that need a next step" action={<button className="ghost" onClick={() => setView("Applications")}>{attention.length} open</button>}>
        {attention.length ? <div className="signal-list">{attention.map((item, index) => <button key={`${item.title}-${index}`} onClick={() => setView(item.view)}><Status tone={item.tone}>{item.tone === "bad" ? "DUE" : item.tone === "warn" ? "NEXT" : "REVIEW"}</Status><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={15} /></button>)}</div> : <Empty title="Everything has a next step" text="There are no overdue balances, care deadlines, unmatched puppies, or pending applications." action="Open schedule" onAction={() => setView("Calendar")} />}
      </Section>

      <Section eyebrow="Business pulse" title="Sales, costs, and communication">
        <div className="breeder-business-grid"><button onClick={() => setView("Finance")}><span><ReceiptText size={17} /> Sales received</span><b>{money(a.paid)}</b><small>{money(a.outstanding)} still outstanding</small></button><button onClick={() => setView("Inventory")}><span><PackageSearch size={17} /> Program costs</span><b>{money(a.costs)}</b><small>{money(a.paid - a.costs)} recorded net</small></button><button onClick={() => setView("Comms")}><span><MessagesSquare size={17} /> Family updates</span><b>{a.draftUpdates.length}</b><small>{a.publishedUpdates.length} already published</small></button><button onClick={() => setView("Templates")}><span><FileText size={17} /> Automations</span><b>{Object.values(data.buyers).length}</b><small>families in the communication journey</small></button></div>
      </Section>
    </div>
  </div>;
}

function BreedingView({ data, openCreate, openEdit, openDocumentUpload, remove }: ViewProps) {
  const [selectedDogId, setSelectedDogId] = useState<number | null>(data.dogs[0]?.id ?? null);
  const selectedDog = data.dogs.find((dog) => dog.id === selectedDogId) ?? data.dogs[0] ?? null;
  return <div className="grid two-one">
    <Section eyebrow="Dog Matrix" title="Breeding dogs" action={<button className="ghost" onClick={() => openCreate("dogs")}>Add dog</button>}>
      {data.dogs.length ? <div className="card-grid">{data.dogs.map((dog) => <article key={dog.id} className={selectedDog?.id === dog.id ? "record-card selected" : "record-card"}><a className="record-card-profile" href={`/dogs/${dog.id}`} target="_blank" rel="noreferrer" onClick={() => setSelectedDogId(dog.id)} aria-label={`Open ${dog.name} profile in a new tab`}><span className="avatar">{initials(dog.name)}</span><div><h3>{dog.name}</h3><p>{[dog.role, dog.sex, dog.color].filter(Boolean).join(" / ")}</p><small>Open complete profile</small></div><Status tone={dog.status === "Active" ? "good" : "neutral"}>{dog.status}</Status></a><footer><button onClick={() => openEdit("dogs", dog as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => remove("dogs", dog.id, dog.name)}>Delete</button></footer></article>)}</div> : <Empty title="No breeding dogs" text="Add dams and sires with health, registry, acquisition, and notes." action="Add dog" onAction={() => openCreate("dogs")} />}
    </Section>
    <Section eyebrow="Selected Profile" title={selectedDog?.name ?? "No dog selected"} action={selectedDog && <div className="panel-actions"><a className="ghost action-link" href={`/dogs/${selectedDog.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open profile</a><button className="ghost" onClick={() => openCreate("dog_registrations", { dog_id: selectedDog.id, registered_name: selectedDog.registered_name || selectedDog.name })}>Add registry</button><button className="ghost" onClick={() => openCreate("dog_medical_records", { dog_id: selectedDog.id })}>Add medical</button><button className="ghost" onClick={() => openCreate("transactions", { type: "Cost", dog_id: selectedDog.id, status: "Paid" })}>Add cost</button><button className="primary-action" onClick={() => openDocumentUpload("dog", selectedDog.id)}><Upload size={15} /> Upload file</button></div>}>
      {selectedDog ? <div className="profile-stack"><div className="profile-metrics"><span><b>{data.litters.filter((item) => item.dam_id === selectedDog.id || item.sire_id === selectedDog.id).length}</b><small>Litters</small></span><span><b>{data.dog_medical_records.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Care records</small></span><span><b>{data.dog_registrations.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Registries</small></span><span><b>{data.dog_documents.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Files</small></span></div><p>{selectedDog.health_testing || selectedDog.notes || "No health testing or notes recorded yet."}</p><div className="mini-list">{data.dog_medical_records.filter((item) => item.dog_id === selectedDog.id).slice(0, 4).map((item) => <span key={item.id}><b>{item.title}</b><small>{item.record_type} / {shortDate(item.record_date)}</small></span>)}</div></div> : <Empty title="No dog selected" text="Select or add a breeding dog to open the profile panel." action="Add dog" onAction={() => openCreate("dogs")} />}
    </Section>
    <Section eyebrow="Litter Control" title="Litters" action={<button className="ghost" onClick={() => openCreate("litters")}>Create litter</button>}>
      {data.litters.length ? <div className="table-list">{data.litters.map((litter) => <button key={litter.id} onClick={() => openEdit("litters", litter as unknown as Record<string, unknown>)}><span><b>{litter.name}</b><small>{shortDate(litter.birth_date || litter.due_date)} / {data.puppies.filter((puppy) => puppy.litter_id === litter.id).length} puppies</small></span><Status tone={litter.status === "Active" ? "good" : "neutral"}>{litter.status}</Status></button>)}</div> : <Empty title="No litters" text="Create planned and active litters with due dates, birth dates, and pairings." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
  </div>;
}

function LittersView({ data, openCreate, openEdit, remove }: ViewProps) {
  const activeLitters = data.litters.filter((litter) => !["Completed", "Archived"].includes(litter.status));
  const dueSoon = data.litters
    .filter((litter) => {
      const days = daysUntil(litter.due_date);
      return days !== null && days >= 0 && days <= 30;
    })
    .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)));
  const expectedPuppies = activeLitters.reduce((sum, litter) => sum + (litter.expected_count ?? 0), 0);
  const dogName = (dogId: number | null) => data.dogs.find((dog) => dog.id === dogId)?.name ?? "Not selected";
  const litterPuppies = (litterId: number) => data.puppies.filter((puppy) => puppy.litter_id === litterId);

  return <div className="grid command-grid">
    <div className="metric-row panel-wide">
      <button type="button"><span>Total litters</span><b>{data.litters.length}</b><small>Complete litter registry</small></button>
      <button type="button"><span>Active program</span><b>{activeLitters.length}</b><small>{dueSoon.length} due within 30 days</small></button>
      <button type="button"><span>Puppies recorded</span><b>{data.puppies.length}</b><small>Across every litter</small></button>
      <button type="button"><span>Expected puppies</span><b>{expectedPuppies}</b><small>From active litter plans</small></button>
    </div>
    <Section eyebrow="Litter Registry" title="Litters" action={<button className="primary-action" onClick={() => openCreate("litters")}><Plus size={15} /> Create litter</button>}>
      {data.litters.length ? <div className="card-grid">{data.litters.map((litter) => {
        const puppies = litterPuppies(litter.id);
        return <article key={litter.id} className="record-card"><a className="record-card-profile" href={`/litters/${litter.id}`}><span className="avatar"><ListTree size={18} /></span><div><h3>{litter.name}</h3><p>{dogName(litter.dam_id)} × {dogName(litter.sire_id)}</p><small>{litter.birth_date ? `Born ${shortDate(litter.birth_date)}` : litter.due_date ? `Due ${shortDate(litter.due_date)}` : "Dates not scheduled"} · {puppies.length} {puppies.length === 1 ? "puppy" : "puppies"}</small></div><Status tone={litter.status === "Active" ? "good" : litter.status === "Planned" ? "warn" : "neutral"}>{litter.status}</Status></a><footer><a href={`/litters/${litter.id}`}><ExternalLink size={14} /> Open</a><button onClick={() => openEdit("litters", litter as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => remove("litters", litter.id, litter.name)}>Delete</button></footer></article>;
      })}</div> : <Empty title="No litters" text="Create planned and active litters with pairings, due dates, birth dates, and expected counts." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
    <Section eyebrow="Next Milestones" title="Litter schedule" action={<button className="ghost" onClick={() => openCreate("events", { event_type: "Breeding" })}>Schedule event</button>}>
      {dueSoon.length ? <div className="event-stack">{dueSoon.map((litter) => <button key={litter.id} onClick={() => openEdit("litters", litter as unknown as Record<string, unknown>)}><span><b>{new Date(`${litter.due_date}T12:00:00`).getDate()}</b><small>{new Date(`${litter.due_date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></span><p><b>{litter.name}</b><small>{dogName(litter.dam_id)} × {dogName(litter.sire_id)} · {litter.expected_count ?? "?"} expected</small></p><Status tone="warn">{`${daysUntil(litter.due_date)}d`}</Status></button>)}</div> : <Empty title="No litter due dates in the next 30 days" text="Add a due date to a planned litter and it will appear in this schedule." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
    <Section eyebrow="Roster Health" title="Puppies by litter">
      {data.litters.length ? <div className="table-list">{data.litters.map((litter) => {
        const puppies = litterPuppies(litter.id);
        const assigned = puppies.filter((puppy) => puppy.buyer_id).length;
        return <a href={`/litters/${litter.id}`} key={litter.id}><span><b>{litter.name}</b><small>{puppies.length ? puppies.map((puppy) => puppy.name).join(", ") : "No puppies recorded"}</small></span><strong>{assigned}/{puppies.length} assigned</strong></a>;
      })}</div> : <Empty title="No litter rosters" text="Create a litter, then add its puppies to build the roster." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
  </div>;
}

function PuppiesView({ data, openCreate, openEdit, remove }: ViewProps) {
  const available = data.puppies.filter((puppy) => puppy.status === "Available");
  const assigned = data.puppies.filter((puppy) => puppy.buyer_id);
  const unassigned = data.puppies.filter((puppy) => !puppy.buyer_id);
  const placementRate = pct(assigned.length, data.puppies.length);
  const litterName = (litterId: number) => data.litters.find((litter) => litter.id === litterId)?.name ?? "Unknown litter";
  const buyerName = (buyerId: number | null) => {
    if (!buyerId) return "Unassigned";
    const buyer = data.buyers.find((candidate) => candidate.id === buyerId);
    return buyer ? fullName(buyer) : `Buyer #${buyerId}`;
  };

  return <div className="grid command-grid">
    <div className="metric-row panel-wide">
      <button type="button"><span>Total puppies</span><b>{data.puppies.length}</b><small>Complete puppy registry</small></button>
      <button type="button"><span>Available</span><b>{available.length}</b><small>Ready for placement</small></button>
      <button type="button"><span>Assigned</span><b>{assigned.length}</b><small>{placementRate}% placement rate</small></button>
      <button type="button"><span>Unassigned</span><b>{unassigned.length}</b><small>{unassigned.length ? "Placement attention needed" : "Every puppy has a family"}</small></button>
    </div>
    <Section eyebrow="Puppy Registry" title="Puppies" action={<button className="primary-action" onClick={() => openCreate("puppies")}><Plus size={15} /> Add puppy</button>}>
      {data.puppies.length ? <div className="card-grid">{data.puppies.map((puppy) => <article key={puppy.id} className="record-card"><a className="record-card-profile" href={`/puppies/${puppy.id}`}><span className="avatar"><PawPrint size={18} /></span><div><h3>{puppy.name}</h3><p>{[puppy.sex, puppy.color, litterName(puppy.litter_id)].filter(Boolean).join(" · ")}</p><small>{puppy.buyer_id ? `Family: ${buyerName(puppy.buyer_id)}` : "No family assigned"} · {money(puppy.price_cents)}</small></div><Status tone={puppy.buyer_id ? "good" : puppy.status === "Available" ? "warn" : "neutral"}>{puppy.status}</Status></a><footer><a href={`/puppies/${puppy.id}`}><ExternalLink size={14} /> Open</a><button onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => openCreate("updates", { puppy_id: puppy.id })}>Update</button><button onClick={() => remove("puppies", puppy.id, puppy.name)}>Delete</button></footer></article>)}</div> : <Empty title="No puppies" text="Add puppy records and connect them to litters and families." action="Add puppy" onAction={() => openCreate("puppies")} />}
    </Section>
    <Section eyebrow="Placement Queue" title="Puppies needing a family" action={<button className="ghost" onClick={() => openCreate("buyers")}>Add family</button>}>
      {unassigned.length ? <div className="table-list">{unassigned.map((puppy) => <button key={puppy.id} onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}><span><b>{puppy.name}</b><small>{litterName(puppy.litter_id)} · {[puppy.sex, puppy.color].filter(Boolean).join(" · ") || "Details not recorded"}</small></span><Status tone="warn">{puppy.status}</Status></button>)}</div> : <Empty title="Every puppy is assigned" text="There are no puppies waiting for a family." action="Add puppy" onAction={() => openCreate("puppies")} />}
    </Section>
    <Section eyebrow="Family Connections" title="Assigned puppies">
      {assigned.length ? <div className="table-list">{assigned.map((puppy) => <a href={`/families/${puppy.buyer_id}`} key={puppy.id}><span><b>{puppy.name}</b><small>{buyerName(puppy.buyer_id)} · {litterName(puppy.litter_id)}</small></span><strong>{money(puppy.price_cents)}</strong></a>)}</div> : <Empty title="No family assignments" text="Assign a buyer from a puppy record to connect the placement." action="Add family" onAction={() => openCreate("buyers")} />}
    </Section>
  </div>;
}

function ApplicationsView({ data, openCreate, openEdit }: ViewProps) {
  const statusOf = (buyer: Buyer) => buyer.application_status || "New";
  const review = data.buyers.filter((buyer) => !["Approved", "Waitlist", "Matched", "Placed", "Declined", "Archived"].includes(statusOf(buyer)));
  const approved = data.buyers.filter((buyer) => ["Approved", "Waitlist"].includes(statusOf(buyer)));
  const matched = data.buyers.filter((buyer) => data.puppies.some((puppy) => puppy.buyer_id === buyer.id));
  const closed = data.buyers.filter((buyer) => ["Declined", "Archived"].includes(statusOf(buyer)));
  const stages = [
    { label: "Needs review", items: review, tone: "warn" as const },
    { label: "Approved / waitlist", items: approved, tone: "good" as const },
    { label: "Matched", items: matched, tone: "good" as const },
    { label: "Not moving forward", items: closed, tone: "neutral" as const },
  ];

  return <div className="breeder-operations-page">
    <section className="workflow-summary panel-wide">
      <div><span>APPLICATION PIPELINE</span><h2>Screen families before placement</h2><p>Keep the inquiry, application decision, preferences, waitlist position, and puppy match connected to one family record.</p></div>
      <button className="primary-action" onClick={() => openCreate("buyers", { application_status: "New" })}><Plus size={16} /> New application</button>
      <div className="workflow-counts">{stages.map((stage) => <span key={stage.label}><b>{stage.items.length}</b><small>{stage.label}</small></span>)}</div>
    </section>
    <section className="pipeline-board" aria-label="Application review board">{stages.map((stage) => <div className="pipeline-column" key={stage.label}><header><span>{stage.label}</span><b>{stage.items.length}</b></header>{stage.items.length ? stage.items.map((buyer) => {
      const puppy = data.puppies.find((item) => item.buyer_id === buyer.id);
      return <article key={buyer.id}><button className="pipeline-card-main" onClick={() => openEdit("buyers", buyer as unknown as Record<string, unknown>)}><span className="family-avatar">{initials(fullName(buyer))}</span><span><b>{fullName(buyer)}</b><small>{[buyer.city, buyer.state].filter(Boolean).join(", ") || "Location not recorded"}</small></span><Status tone={stage.tone}>{statusOf(buyer)}</Status></button><dl><div><dt>Preference</dt><dd>{[buyer.preferred_sex, buyer.preferred_color].filter(Boolean).join(" · ") || "Open"}</dd></div><div><dt>Puppy</dt><dd>{puppy?.name ?? "Not matched"}</dd></div></dl><footer><a href={`/families/${buyer.id}`}>Open family file</a><button onClick={() => openEdit("buyers", buyer as unknown as Record<string, unknown>)}>Review</button></footer></article>;
    }) : <p className="pipeline-empty">No families in this stage.</p>}</div>)}</section>
  </div>;
}

function PlacementView({ data, openCreate, openEdit, openContracts }: ViewProps) {
  const approvedBuyers = data.buyers.filter((buyer) => ["Approved", "Waitlist"].includes(buyer.application_status) && !data.puppies.some((puppy) => puppy.buyer_id === buyer.id));
  const unassigned = data.puppies.filter((puppy) => !puppy.buyer_id && !["Retained", "Archived"].includes(puppy.status));
  const assigned = data.puppies.filter((puppy) => puppy.buyer_id);
  const buyerFor = (puppy: Puppy) => data.buyers.find((buyer) => buyer.id === puppy.buyer_id);
  const paidFor = (puppy: Puppy) => data.transactions.filter((item) => item.buyer_id === puppy.buyer_id && isPaidTransaction(item) && (!item.puppy_id || item.puppy_id === puppy.id)).reduce((sum, item) => sum + item.amount_cents, 0);

  return <div className="breeder-operations-page">
    <section className="workflow-summary panel-wide"><div><span>PUPPY PLACEMENT</span><h2>Match the right puppy to the right family</h2><p>Work from approved preferences, then carry the match into deposits, contracts, communication, and go-home planning.</p></div><button className="primary-action" onClick={() => openCreate("puppies")}><Plus size={16} /> Add puppy</button><div className="workflow-counts"><span><b>{unassigned.length}</b><small>Need a family</small></span><span><b>{approvedBuyers.length}</b><small>Families waiting</small></span><span><b>{assigned.length}</b><small>Matched</small></span></div></section>
    <div className="placement-workbench">
      <Section eyebrow="Placement queue" title="Puppies needing a family" action={<button className="ghost" onClick={() => openCreate("buyers", { application_status: "Approved" })}>Add approved family</button>}>
        {unassigned.length ? <div className="placement-cards">{unassigned.map((puppy) => {
          const litter = data.litters.find((item) => item.id === puppy.litter_id);
          return <article key={puppy.id}><header><span className="puppy-avatar"><PawPrint size={18} /></span><span><b>{puppy.name}</b><small>{litter?.name ?? "Litter not found"} · {[puppy.sex, puppy.color].filter(Boolean).join(" · ") || "Details needed"}</small></span><Status tone="warn">{puppy.status}</Status></header><dl><div><dt>Price</dt><dd>{money(puppy.price_cents)}</dd></div><div><dt>Best next step</dt><dd>Review approved families</dd></div></dl><button onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}>Assign family</button></article>;
        })}</div> : <Empty title="Every available puppy is matched" text="There are no puppies waiting for a family." action="Add puppy" onAction={() => openCreate("puppies")} />}
      </Section>
      <Section eyebrow="Approved waitlist" title="Families ready for a match" action={<button className="ghost" onClick={() => openCreate("buyers", { application_status: "Approved" })}>New family</button>}>
        {approvedBuyers.length ? <div className="waitlist-stack">{approvedBuyers.map((buyer) => <button key={buyer.id} onClick={() => openEdit("buyers", buyer as unknown as Record<string, unknown>)}><span className="family-avatar">{initials(fullName(buyer))}</span><span><b>{fullName(buyer)}</b><small>{[buyer.preferred_sex, buyer.preferred_color].filter(Boolean).join(" · ") || "Open preferences"}</small></span><ChevronRight size={15} /></button>)}</div> : <Empty title="No approved families are waiting" text="Approve an application to add the family to the matching queue." action="Add application" onAction={() => openCreate("buyers", { application_status: "New" })} />}
      </Section>
    </div>
    <Section eyebrow="Active placements" title="Matched puppy and family records">
      {assigned.length ? <div className="placement-ledger">{assigned.map((puppy) => {
        const buyer = buyerFor(puppy); const paid = paidFor(puppy); const balance = Math.max(0, (puppy.price_cents ?? 0) - paid); const docs = data.buyer_documents.filter((item) => item.buyer_id === buyer?.id);
        return <article key={puppy.id}><a href={`/puppies/${puppy.id}`}><span className="puppy-avatar"><PawPrint size={17} /></span><span><b>{puppy.name}</b><small>{buyer ? fullName(buyer) : "Buyer record missing"}</small></span></a><span><small>Sale price</small><b>{money(puppy.price_cents)}</b></span><span><small>Received</small><b>{money(paid)}</b></span><span><small>Balance</small><b>{money(balance)}</b></span><span><small>Documents</small><b>{docs.length}</b></span><footer><button onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}>Edit match</button>{buyer && <><button onClick={() => openCreate("transactions", { type: "Payment", buyer_id: buyer.id, puppy_id: puppy.id, status: "Paid" })}>Record payment</button><button onClick={() => openContracts(buyer.id)}>Contracts</button></>}</footer></article>;
      })}</div> : <Empty title="No active placements" text="Assign an approved family from a puppy record to start the placement workflow." action="Add puppy" onAction={() => openCreate("puppies")} />}
    </Section>
  </div>;
}

function DeliveryView({ data, openCreate, openEdit, openContracts }: ViewProps) {
  const assigned = data.puppies.filter((puppy) => puppy.buyer_id);
  const deliveryFor = (puppy: Puppy, buyer: Buyer | undefined) => data.events.find((event) => /pickup|delivery|transport|go.home/i.test(`${event.event_type} ${event.title}`) && ((event.related_type === "buyers" && event.related_id === buyer?.id) || `${event.title} ${event.notes}`.toLowerCase().includes(puppy.name.toLowerCase())));

  return <div className="breeder-operations-page">
    <section className="workflow-summary panel-wide"><div><span>GO-HOME OPERATIONS</span><h2>Prepare every puppy and family for handoff</h2><p>See the balance, signed documents, schedule, and care handoff together before pickup or delivery.</p></div><button className="primary-action" onClick={() => openCreate("events", { event_type: "Pickup", status: "Scheduled" })}><Plus size={16} /> Schedule go-home</button><div className="workflow-counts"><span><b>{assigned.length}</b><small>Matched puppies</small></span><span><b>{assigned.filter((puppy) => deliveryFor(puppy, data.buyers.find((buyer) => buyer.id === puppy.buyer_id))).length}</b><small>Scheduled</small></span><span><b>{data.events.filter((event) => /pickup|delivery|transport|go.home/i.test(`${event.event_type} ${event.title}`) && event.status === "Completed").length}</b><small>Completed</small></span></div></section>
    {assigned.length ? <div className="delivery-board">{assigned.map((puppy) => {
      const buyer = data.buyers.find((item) => item.id === puppy.buyer_id); const paid = data.transactions.filter((item) => item.buyer_id === buyer?.id && isPaidTransaction(item) && (!item.puppy_id || item.puppy_id === puppy.id)).reduce((sum, item) => sum + item.amount_cents, 0); const balance = Math.max(0, (puppy.price_cents ?? 0) - paid); const contracts = data.buyer_documents.filter((item) => item.buyer_id === buyer?.id && /bill of sale|health guarantee|agreement/i.test(item.document_type)); const delivery = deliveryFor(puppy, buyer); const ready = balance === 0 && contracts.length >= 2 && Boolean(delivery);
      return <article key={puppy.id} className={ready ? "ready" : ""}><header><span className="puppy-avatar"><PawPrint size={18} /></span><span><b>{puppy.name}</b><small>{buyer ? fullName(buyer) : "Family record missing"}</small></span><Status tone={ready ? "good" : "warn"}>{ready ? "Ready" : "In progress"}</Status></header><div className="readiness-checks"><span className={buyer ? "complete" : ""}><i>{buyer ? "✓" : "1"}</i><b>Family matched</b><small>{buyer?.email || buyer?.phone || "Contact needed"}</small></span><span className={balance === 0 ? "complete" : ""}><i>{balance === 0 ? "✓" : "2"}</i><b>Balance</b><small>{balance === 0 ? "Paid in full" : `${money(balance)} due`}</small></span><span className={contracts.length >= 2 ? "complete" : ""}><i>{contracts.length >= 2 ? "✓" : "3"}</i><b>Documents</b><small>{contracts.length >= 2 ? "Package on file" : `${contracts.length}/2 on file`}</small></span><span className={delivery ? "complete" : ""}><i>{delivery ? "✓" : "4"}</i><b>Go-home plan</b><small>{delivery ? `${shortDate(delivery.event_date)}${delivery.location ? ` · ${delivery.location}` : ""}` : "Not scheduled"}</small></span></div><footer>{buyer && balance > 0 && <button onClick={() => openCreate("transactions", { type: "Payment", buyer_id: buyer.id, puppy_id: puppy.id, status: "Paid", description: "Final balance" })}>Record balance</button>}{buyer && <button onClick={() => openContracts(buyer.id)}>Contracts</button>}{delivery ? <button onClick={() => openEdit("events", delivery as unknown as Record<string, unknown>)}>Edit schedule</button> : <button onClick={() => openCreate("events", { title: `${puppy.name} go-home`, event_type: "Pickup", status: "Scheduled", related_type: "buyers", related_id: buyer?.id })}>Schedule pickup</button>}</footer></article>;
    })}</div> : <Empty title="No puppies are in go-home planning" text="A puppy appears here after a family is assigned." action="Add puppy" onAction={() => openCreate("puppies")} />}
  </div>;
}

function FamiliesView({ data, openCreate, openEdit, openDocumentUpload, openContracts, remove }: ViewProps) {
  return <div className="grid two-one">
    <Section eyebrow="Buyer Pipeline" title="Families" action={<div className="panel-actions"><button className="ghost" onClick={() => openCreate("buyers")}>Add buyer</button><button className="primary-action" onClick={() => openDocumentUpload("buyer")}><Upload size={15} /> Upload file</button></div>}>
      {data.buyers.length ? <div className="family-record-list">{data.buyers.map((buyer) => <article key={buyer.id}><a className="family-record-main" href={`/families/${buyer.id}`}><span><b>{fullName(buyer)}</b><small>{[buyer.email, buyer.phone, buyer.city, buyer.state].filter(Boolean).join(" / ") || "Contact information not recorded"}</small></span><Status tone={buyer.application_status === "Approved" ? "good" : "neutral"}>{buyer.application_status}</Status></a><button className="family-contract-action" onClick={() => openContracts(buyer.id)}><FileSignature size={15} /> Contracts</button></article>)}</div> : <Empty title="No buyers" text="Track applications, preferences, family notes, and contact details." action="Add buyer" onAction={() => openCreate("buyers")} />}
    </Section>
    <Section eyebrow="Puppy Placement" title="Puppies" action={<button className="ghost" onClick={() => openCreate("puppies")}>Add puppy</button>}>
      {data.puppies.length ? <div className="card-grid puppy-placement-grid">{data.puppies.map((puppy) => <article key={puppy.id} className="record-card"><a className="record-card-profile" href={`/puppies/${puppy.id}`}><span className="avatar">{initials(puppy.name)}</span><div><h3>{puppy.name}</h3><p>{[puppy.sex, puppy.color, money(puppy.price_cents)].filter(Boolean).join(" / ")}</p></div><Status tone={puppy.buyer_id ? "good" : "warn"}>{puppy.buyer_id ? "Assigned" : puppy.status}</Status></a><footer><button onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => remove("puppies", puppy.id, puppy.name)}>Delete</button></footer></article>)}</div> : <Empty title="No puppies" text="Add puppy records and connect them to litters and buyers." action="Add puppy" onAction={() => openCreate("puppies")} />}
    </Section>
    <Section eyebrow="Family Portal" title="Published updates" action={<button className="ghost" onClick={() => openCreate("updates")}>New update</button>}>
      {data.updates.length ? <div className="mini-list">{data.updates.slice(0, 8).map((update) => <span key={update.id}><b>{update.title}</b><small>Week {update.week_number ?? "n/a"} / {update.published ? "Published" : "Draft"}</small></span>)}</div> : <Empty title="No updates" text="Publish growth notes, weights, milestones, and family-facing updates." action="New update" onAction={() => openCreate("updates")} />}
    </Section>
  </div>;
}

function PortalPreviewView({ data }: { data: DataSet }) {
  const [buyerId, setBuyerId] = useState<number | null>(data.buyers[0]?.id ?? null);
  const [portalUrl, setPortalUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const buyer = data.buyers.find((item) => item.id === buyerId) ?? null;
  const assigned = buyer ? data.puppies.filter((puppy) => puppy.buyer_id === buyer.id) : [];

  async function loadPreview() {
    if (!buyerId) return;
    setBusy(true); setError(""); setPortalUrl("");
    try {
      const response = await fetch("/api/contracts/portal-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer_id: buyerId }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to prepare this portal preview.");
      setPortalUrl(payload.portalUrl);
    } catch (failure) { setError(friendlyError(failure, "Unable to prepare this portal preview.")); }
    finally { setBusy(false); }
  }

  return <div className="portal-preview-workspace">
    <section className="portal-preview-console">
      <header><span>CLIENT EXPERIENCE</span><h2>Puppy Portal simulator</h2><p>Select a family, then inspect the exact customer-facing account without leaving SWVAOS.</p></header>
      <label><span>Family account</span><select value={buyerId ?? ""} onChange={(event) => { setBuyerId(Number(event.target.value) || null); setPortalUrl(""); }}><option value="">Choose a family</option>{data.buyers.map((item) => <option value={item.id} key={item.id}>{fullName(item)}{item.email ? ` — ${item.email}` : ""}</option>)}</select></label>
      <div className="portal-preview-account"><span><small>Selected family</small><b>{buyer ? fullName(buyer) : "None selected"}</b></span><span><small>Assigned puppies</small><b>{assigned.length ? assigned.map((puppy) => puppy.name).join(", ") : "None"}</b></span><span><small>Portal access</small><b>{buyer?.email ? "Email sign-in ready" : "Email required"}</b></span></div>
      <button className="portal-preview-launch" disabled={!buyerId || busy} onClick={() => void loadPreview()}><MonitorSmartphone size={17} /> {busy ? "Opening simulator…" : "Load customer view"}</button>
      {error && <p className="portal-preview-error">{error}</p>}
      <div className="portal-preview-auth"><ShieldCheck size={18} /><span><b>Customer authentication</b><small>Customers sign in with the email on their family account. SWVAOS sends a short-lived secure link—there is no shared password.</small></span><a href="/portal/login" target="_blank" rel="noreferrer">Open customer sign-in <ExternalLink size={14} /></a></div>
    </section>
    <section className="portal-preview-stage">
      <header><div><i /><i /><i /><span>{portalUrl ? `${buyer ? fullName(buyer) : "Family"} / live portal` : "Customer portal / waiting"}</span></div><nav><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>Desktop</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>Mobile</button>{portalUrl && <a href={portalUrl} target="_blank" rel="noreferrer">Open full screen <ExternalLink size={14} /></a>}</nav></header>
      <div className={`portal-device ${device}`}>{portalUrl ? <iframe src={portalUrl} title={`Puppy Portal preview for ${buyer ? fullName(buyer) : "selected family"}`} /> : <div className="portal-preview-placeholder"><MonitorSmartphone size={38} /><b>No customer view loaded</b><p>Choose a family and load the simulator to inspect updates, contracts, payments, documents, schedule, and support.</p></div>}</div>
    </section>
  </div>;
}

function CareView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  const careRecords = [...data.dog_medical_records].sort((left, right) => String(left.next_due_date ?? "9999").localeCompare(String(right.next_due_date ?? "9999")));
  const heatWatch = data.dogs.filter((dog) => dog.next_heat_date).sort((left, right) => String(left.next_heat_date).localeCompare(String(right.next_heat_date)));
  return <div className="grid two-one">
    <div className="metric-row panel-wide"><button><span>Open tasks</span><b>{a.openTasks.length}</b><small>Scheduled items not completed</small></button><button><span>Care due</span><b>{a.dueHealth.length}</b><small>Medical records at or past due</small></button><button><span>30-day care</span><b>{a.upcomingCare.length}</b><small>Upcoming care and pickup signals</small></button><button><span>Microchips</span><b>{a.microchipCoverage}%</b><small>Dog microchip coverage</small></button></div>
    <Section eyebrow="Medical Control" title="Care schedule" action={<button className="ghost" onClick={() => openCreate("dog_medical_records")}>Add care</button>}>
      {careRecords.length ? <div className="ops-list">{careRecords.map((item) => {
        const dog = data.dogs.find((candidate) => candidate.id === item.dog_id);
        const days = daysUntil(item.next_due_date);
        const tone = days !== null && days <= 0 ? "bad" : days !== null && days <= 14 ? "warn" : "neutral";
        return <button key={item.id} onClick={() => openEdit("dog_medical_records", item as unknown as Record<string, unknown>)}><Status tone={tone}>{days === null ? "File" : days <= 0 ? "Due" : `${days}d`}</Status><span><b>{item.title}</b><small>{dog?.name ?? `Dog #${item.dog_id}`} / {item.record_type} / next {shortDate(item.next_due_date)}</small></span><strong>{money(item.cost_cents)}</strong></button>;
      })}</div> : <Empty title="No care records" text="Add vaccinations, exams, health tests, medication, and recurring due dates." action="Add care" onAction={() => openCreate("dog_medical_records")} />}
    </Section>
    <Section eyebrow="Heat And Breeding Watch" title="Female readiness">
      {heatWatch.length ? <div className="ops-list">{heatWatch.map((dog) => {
        const days = daysUntil(dog.next_heat_date);
        return <button key={dog.id} onClick={() => openEdit("dogs", dog as unknown as Record<string, unknown>)}><Status tone={days !== null && days <= 7 ? "warn" : "neutral"}>{days === null ? "Watch" : `${days}d`}</Status><span><b>{dog.name}</b><small>{dog.role} / next heat {shortDate(dog.next_heat_date)}</small></span></button>;
      })}</div> : <Empty title="No heat dates tracked" text="Add next heat dates on dam profiles to activate breeding readiness watch." action="Add dog" onAction={() => openCreate("dogs")} />}
    </Section>
    <Section eyebrow="Operations Queue" title="Tasks and reminders" action={<button className="ghost" onClick={() => openCreate("events", { event_type: "Task", status: "Scheduled" })}>New task</button>}>
      {a.openTasks.length ? <div className="calendar-list">{a.openTasks.slice(0, 10).map((event) => <article key={event.id}><time><b>{new Date(`${event.event_date}T12:00:00`).getDate()}</b><small>{new Date(`${event.event_date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></time><div><h3>{event.title}</h3><p>{[event.event_type, event.event_time, event.location].filter(Boolean).join(" / ")}</p></div><Status tone={event.event_date < today() ? "bad" : "neutral"}>{event.status}</Status><footer><button onClick={() => openEdit("events", event as unknown as Record<string, unknown>)}>Edit</button></footer></article>)}</div> : <Empty title="No open tasks" text="Schedule kennel chores, appointment reminders, whelping prep, pickups, and follow-up work." action="New task" onAction={() => openCreate("events", { event_type: "Task" })} />}
    </Section>
  </div>;
}

function InventoryView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  const categories = ["Food", "Medical", "Supplies", "Equipment", "Cleaning", "Grooming"].map((name) => {
    const items = data.transactions.filter((item) => item.type === "Cost" && includesAny(`${item.category} ${item.description}`, [name.toLowerCase(), name === "Medical" ? "vaccine" : ""]));
    return { name, count: items.length, amount: sumBy(items, (item) => item.amount_cents) };
  });
  const total = sumBy(categories, (item) => item.amount);
  return <div className="grid two-one">
    <div className="metric-row panel-wide"><button><span>Inventory spend</span><b>{money(a.inventorySpend)}</b><small>Tracked from cost transactions</small></button><button><span>Cost records</span><b>{a.supplyCosts.length}</b><small>Supply-like ledger entries</small></button><button><span>Highest category</span><b>{categories.sort((l, r) => r.amount - l.amount)[0]?.name ?? "None"}</b><small>{money(categories[0]?.amount ?? 0)}</small></button><button><span>Total costs</span><b>{money(a.costs)}</b><small>All expense categories</small></button></div>
    <Section eyebrow="Supply Ledger" title="Inventory and supplies" action={<button className="ghost" onClick={() => openCreate("transactions", { type: "Cost", category: "Supplies" })}>Log supply</button>}>
      {a.supplyCosts.length ? <div className="table-list">{a.supplyCosts.map((item) => <button key={item.id} onClick={() => openEdit("transactions", item as unknown as Record<string, unknown>)}><span><b>{item.description}</b><small>{[item.category, item.status, item.paid_date ? `Paid ${shortDate(item.paid_date)}` : null].filter(Boolean).join(" / ")}</small></span><strong>{money(item.amount_cents)}</strong></button>)}</div> : <Empty title="No supply records" text="Log food, medicine, cleaning, grooming, equipment, and whelping supplies as cost transactions." action="Log supply" onAction={() => openCreate("transactions", { type: "Cost", category: "Supplies" })} />}
    </Section>
    <Section eyebrow="Category Burn" title="Spend controls">
      <div className="pulse-bars">{categories.map((item) => <span key={item.name} style={{ "--value": `${pct(item.amount, total)}%` } as React.CSSProperties}><b>{item.name}</b><i>{money(item.amount)} / {item.count}</i></span>)}</div>
    </Section>
    <Section eyebrow="Restock Planning" title="Suggested watchlist">
      <div className="matrix-list">{["Food and supplements", "Vaccines and medication", "Whelping pads and heat support", "Cleaning and disinfectant", "Microchips and registry packets", "Puppy go-home bags"].map((item) => <span key={item}><b>{item}</b><small>Track purchases as Cost transactions for inventory reporting.</small></span>)}</div>
    </Section>
  </div>;
}

function CommunicationsView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  const stages = ["Inquiry", "Applied", "Approved", "Matched", "Placed"].map((stage) => ({ stage, buyers: data.buyers.filter((buyer) => buyer.application_status === stage) }));
  return <div className="grid two-one">
    <div className="metric-row panel-wide"><button><span>Buyers</span><b>{data.buyers.length}</b><small>{a.approvedBuyers.length} approved</small></button><button><span>Published</span><b>{a.publishedUpdates.length}</b><small>Family-facing updates</small></button><button><span>Drafts</span><b>{a.draftUpdates.length}</b><small>Updates waiting</small></button><button><span>Assigned puppies</span><b>{a.placed.length}</b><small>Buyer-connected placements</small></button></div>
    <Section eyebrow="Family Pipeline" title="Buyer stages" action={<button className="ghost" onClick={() => openCreate("buyers")}>Add family</button>}>
      <div className="stage-board">{stages.map((stage) => <div key={stage.stage}><b>{stage.stage}</b>{stage.buyers.length ? stage.buyers.slice(0, 5).map((buyer) => <button key={buyer.id} onClick={() => openEdit("buyers", buyer as unknown as Record<string, unknown>)}>{fullName(buyer)}<small>{buyer.email}</small></button>) : <small>No families</small>}</div>)}</div>
    </Section>
    <Section eyebrow="Update Studio" title="Puppy updates" action={<button className="ghost" onClick={() => openCreate("updates", { published: true })}>New update</button>}>
      {data.updates.length ? <div className="ops-list">{data.updates.slice(0, 12).map((update) => <button key={update.id} onClick={() => openEdit("updates", update as unknown as Record<string, unknown>)}><Status tone={update.published ? "good" : "warn"}>{update.published ? "Live" : "Draft"}</Status><span><b>{update.title}</b><small>{data.puppies.find((puppy) => puppy.id === update.puppy_id)?.name ?? `Puppy #${update.puppy_id}`} / week {update.week_number ?? "n/a"} / {update.weight ?? "no"} lb</small></span></button>)}</div> : <Empty title="No updates" text="Create family-facing updates with growth notes, weights, milestones, and photos once uploads are connected." action="New update" onAction={() => openCreate("updates", { published: true })} />}
    </Section>
    <Section eyebrow="Contact Center" title="Quick outreach">
      {data.buyers.length ? <div className="matrix-list">{data.buyers.slice(0, 12).map((buyer) => <span key={buyer.id}><b>{fullName(buyer)}</b><small>{buyer.email && <a href={`mailto:${buyer.email}`}>{buyer.email}</a>}{buyer.email && buyer.phone ? " / " : ""}{buyer.phone || "No phone recorded"}</small></span>)}</div> : <Empty title="No contacts" text="Add families to activate the contact center." action="Add family" onAction={() => openCreate("buyers")} />}
    </Section>
  </div>;
}

function CallerCrmView({ data, openCreate, openEdit, openContracts, refreshActivity, activityRefreshing, activitySyncedAt, activityError, newCallId }: ViewProps & { refreshActivity: () => Promise<void>; activityRefreshing: boolean; activitySyncedAt: Date | null; activityError: string; newCallId: number | null }) {
  const callers = useMemo(() => data.buyers.filter((buyer) => buyer.phone).sort((left, right) => fullName(left).localeCompare(fullName(right))), [data.buyers]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(callers[0]?.id ?? null);
  const [callerSearch, setCallerSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"All" | "Calls" | "Messages" | "Requests">("All");
  const [selectedInteractionId, setSelectedInteractionId] = useState<number | null>(null);
  const [routingReady, setRoutingReady] = useState<boolean | null>(null);
  const [dialNumber, setDialNumber] = useState("");
  const [dialOperator, setDialOperator] = useState<"cristy" | "robert">("cristy");
  const [dialing, setDialing] = useState(false);
  const [dialMessage, setDialMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [syncingLines, setSyncingLines] = useState(false);
  const [lineMessage, setLineMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const selectedBuyer = data.buyers.find((buyer) => buyer.id === selectedBuyerId) ?? callers[0] ?? null;
  const dialTarget = dialNumber.replace(/[^\d+]/g, "");
  const canDial = dialTarget.replace(/\D/g, "").length >= 7;
  const dialBuyer = data.buyers.find((buyer) => buyer.phone && normalizePhone(buyer.phone) === normalizePhone(dialTarget)) ?? null;
  const dialKeys = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];

  const filteredCallers = callers.filter((buyer) => `${fullName(buyer)} ${buyer.phone} ${buyer.email} ${buyer.city} ${buyer.state}`.toLowerCase().includes(callerSearch.trim().toLowerCase()));
  const assignedPuppies = selectedBuyer ? data.puppies.filter((puppy) => puppy.buyer_id === selectedBuyer.id) : [];
  const puppyIds = new Set(assignedPuppies.map((puppy) => puppy.id));
  const updates = data.updates.filter((update) => puppyIds.has(update.puppy_id) && Boolean(update.published)).sort((left, right) => right.created_at.localeCompare(left.created_at));
  const plans = selectedBuyer ? data.payment_plans.filter((plan) => plan.buyer_id === selectedBuyer.id) : [];
  const transactions = selectedBuyer ? data.transactions.filter((item) => item.buyer_id === selectedBuyer.id || (item.puppy_id ? puppyIds.has(item.puppy_id) : false)) : [];
  const payments = transactions.filter(isPaymentTransaction);
  const paid = sumBy(payments.filter(isPaidTransaction), (item) => item.amount_cents);
  const outstanding = sumBy(payments.filter((item) => !paidStatuses.has(item.status)), (item) => item.amount_cents);
  const nextDue = payments.filter((item) => !paidStatuses.has(item.status) && item.due_date).sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))[0]?.due_date;
  const calls = selectedBuyer ? data.events.filter((event) => event.event_type === "Call" && event.related_type === "buyers" && event.related_id === selectedBuyer.id).sort((left, right) => `${right.event_date}${right.event_time ?? ""}`.localeCompare(`${left.event_date}${left.event_time ?? ""}`)) : [];
  const unmatchedCalls = data.events.filter((event) => event.event_type === "Call" && event.related_type === "caller");
  const contractDocuments = selectedBuyer ? data.buyer_documents.filter((document) => document.buyer_id === selectedBuyer.id && ["Bill of Sale", "Health Guarantee"].includes(document.document_type)) : [];
  const knownMenu = [
    ["1", "Account and payments", "Balance, payments, due dates, and active payment plans"],
    ["2", "Pickup or delivery", "Scheduling and assigned-puppy transportation context"],
    ["3", "Puppy details", "Assigned puppy profile and latest published update"],
    ["4", "Application status", "Current family approval or placement stage"],
    ["5", "Leave a message", "Records a message and connects it to the family account"],
    ["6", "Speak with someone", "Connects the caller to the configured team line"],
    ["9", "Repeat menu", "Returns to the beginning of the recognized-caller menu"],
  ];
  const publicMenu = [
    ["1", "Available puppies", "Current availability from SWVAOS records"],
    ["2", "Application help", "Help locating a submitted family application"],
    ["3", "Reserved puppy help", "Help locating an existing puppy reservation"],
    ["4", "Pickup or delivery", "General transportation information"],
    ["5", "Pup-Lift", "Current delivery-service information"],
    ["6", "Chihuahua HQ", "Current community information"],
    ["7", "Speak with someone", "Connects the caller to the team"],
    ["9", "Repeat menu", "Returns to the beginning of the public menu"],
  ];
  const pupLiftMenu = [
    ["1", "Immediate support", "Warmth, tiny amounts on the gums, feeding, and veterinary escalation"],
    ["2", "Warning signs", "Weakness, wobbling, trembling, collapse, seizures, and urgent red flags"],
    ["3", "How to use Pup-Lift", "Safe placement, timing, and what not to do"],
    ["4", "Prevention and aftercare", "Feeding rhythm, warmth, monitoring, and veterinarian follow-up"],
    ["5", "Leave a message", "Records the caller's name, phone number, and question"],
    ["6", "Speak with someone", "Rings Cristy and Robert through the team route"],
    ["9", "Repeat menu", "Returns to the beginning of the Pup-Lift menu"],
  ];
  const callPreset = selectedBuyer ? { event_type: "Call", related_type: "buyers", related_id: selectedBuyer.id, title: `Call with ${fullName(selectedBuyer)}`, event_date: today(), location: "Phone", status: "Completed" } : {};
  const callbackPreset = selectedBuyer ? { event_type: "Call", related_type: "buyers", related_id: selectedBuyer.id, title: `Callback - ${fullName(selectedBuyer)}`, event_date: addDays(1), location: "Phone", status: "Scheduled" } : { event_type: "Call", event_date: addDays(1), location: "Phone", status: "Scheduled" };
  const interactions = data.events
    .filter((event) => ["Call", "Portal Request", "Transportation"].includes(event.event_type))
    .sort((left, right) => `${right.event_date}${right.event_time ?? ""}${right.created_at}`.localeCompare(`${left.event_date}${left.event_time ?? ""}${left.created_at}`));
  const filteredInteractions = interactions.filter((event) => {
    if (inboxFilter === "Calls") return event.event_type === "Call" && !/message/i.test(event.title);
    if (inboxFilter === "Messages") return event.event_type === "Call" && /message/i.test(event.title);
    if (inboxFilter === "Requests") return ["Portal Request", "Transportation"].includes(event.event_type);
    return true;
  });
  const selectedInteraction = data.events.find((event) => event.id === selectedInteractionId) ?? filteredInteractions[0] ?? null;
  const selectedInteractionBuyer = selectedInteraction?.related_type === "buyers" ? data.buyers.find((buyer) => buyer.id === selectedInteraction.related_id) ?? null : null;
  const interactionPhone = selectedInteraction?.notes?.match(/^Caller:\s*(.+)$/m)?.[1]?.trim() || selectedInteractionBuyer?.phone || "";
  const interactionDetail = selectedInteraction?.notes?.replace(/^\[Family request\]\s*/i, "").replace(/^Call:\s*.+$/gm, "").replace(/^Recording(?: ID)?:\s*.+$/gm, "").trim() || "No additional details recorded.";
  const todayCalls = interactions.filter((event) => event.event_type === "Call" && event.event_date === today());
  const newMessages = interactions.filter((event) => /message/i.test(event.title) && ["New", "Unheard"].includes(event.status));
  const callbacks = interactions.filter((event) => event.event_type === "Call" && ["Scheduled", "Callback", "Follow-up"].includes(event.status));

  useEffect(() => {
    if (!newCallId) return;
    const timer = window.setTimeout(() => {
      setInboxFilter("All");
      setSelectedInteractionId(newCallId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [newCallId]);

  async function startOutboundCall() {
    if (!canDial || dialing) return;
    setDialing(true);
    setDialMessage(null);
    try {
      const response = await fetch("/api/voice/outbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: dialTarget, operator: dialOperator, buyerId: dialBuyer?.id, label: dialBuyer ? fullName(dialBuyer) : "" }),
      });
      const result = await response.json() as { error?: string; operator?: string };
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/")}`);
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to start the call.");
      setDialMessage({ tone: "good", text: `${result.operator || "The selected operator"}'s phone is ringing. Answer it to connect the call.` });
    } catch (error) {
      setDialMessage({ tone: "bad", text: error instanceof Error ? error.message : "Unable to start the call." });
    } finally {
      setDialing(false);
    }
  }

  async function syncVoiceLines() {
    if (syncingLines) return;
    setSyncingLines(true);
    setLineMessage(null);
    try {
      const response = await fetch("/api/voice/configure", { method: "POST" });
      const result = await response.json() as { configured?: boolean; error?: string; lines?: { configured?: boolean }[] };
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/")}`);
        return;
      }
      if (!response.ok && response.status !== 207) throw new Error(result.error || "Unable to sync the Twilio lines.");
      const configuredCount = result.lines?.filter((line) => line.configured).length ?? 0;
      if (!result.configured) throw new Error(`${configuredCount} of 2 phone lines were configured. Confirm both numbers belong to this Twilio account.`);
      setRoutingReady(true);
      setLineMessage({ tone: "good", text: "Both Twilio numbers now route into their correct SWVAOS call flows." });
    } catch (error) {
      setLineMessage({ tone: "bad", text: error instanceof Error ? error.message : "Unable to sync the Twilio lines." });
    } finally {
      setSyncingLines(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/voice/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((status: { voice_webhook_configured?: boolean; webhook_base_configured?: boolean; call_forwarding_configured?: boolean; caller_id_configured?: boolean } | null) => {
        if (active) setRoutingReady(Boolean(
          status?.voice_webhook_configured
          && status?.webhook_base_configured
          && status?.call_forwarding_configured
          && status?.caller_id_configured
        ));
      })
      .catch(() => { if (active) setRoutingReady(false); });
    return () => { active = false; };
  }, []);

  return <div className="grid crm-grid">
    <div className="metric-row panel-wide">
      <button><span>Calls today</span><b>{todayCalls.length}</b><small>{unmatchedCalls.length} unmatched caller records</small></button>
      <button><span>New messages</span><b>{newMessages.length}</b><small>Recorded messages needing review</small></button>
      <button><span>Callbacks</span><b>{callbacks.length}</b><small>Scheduled or marked for follow-up</small></button>
      <button><span>Recognized families</span><b>{callers.length}</b><small>{data.puppies.filter((puppy) => puppy.buyer_id).length} assigned puppies</small></button>
    </div>

    <section className="crm-routing panel-wide"><div className={routingReady ? "online" : routingReady === false ? "attention" : "checking"}><PhoneIncoming size={19} /><span><b>{routingReady ? "Phone routing online" : routingReady === false ? "Phone routing needs setup" : "Checking phone routing"}</b><small>{routingReady ? "Caller recognition, account menus, and message recording are ready." : "The CRM remains available while phone routing is checked."}</small></span></div><div><span className={`crm-live-sync ${activityError ? "error" : ""}`}><i /><span><b>{activityError ? "Sync interrupted" : "Live call feed"}</b><small>{activityError || (activitySyncedAt ? `Updated ${activitySyncedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Connecting...")}</small></span></span><button type="button" onClick={() => void refreshActivity()} disabled={activityRefreshing}><RefreshCw className={activityRefreshing ? "spinning" : ""} size={15} /> {activityRefreshing ? "Refreshing" : "Refresh calls"}</button><button onClick={() => openCreate("events", callPreset)}><PhoneOutgoing size={15} /> Log call</button><button onClick={() => openCreate("events", callbackPreset)}><ClipboardCheck size={15} /> Schedule callback</button></div></section>

    <section className="crm-lines panel-wide">
      <header><div><span>VOICE LINE DIRECTORY</span><h2>Two numbers, two call experiences</h2><p>Each Twilio number enters the Voice CRM but receives its own greeting, keypad menu, and activity label.</p></div><button type="button" onClick={syncVoiceLines} disabled={syncingLines}><ShieldCheck size={16} /> {syncingLines ? "Syncing..." : "Sync Twilio lines"}</button></header>
      <div className="crm-line-cards">
        <article><span className="crm-line-icon"><PhoneIncoming size={20} /></span><div><small>SWVAOS MAIN LINE</small><h3>+1 (855) 506-5425</h3><p>Families, applications, puppies, pickup, delivery, balances, messages, and staff transfer.</p></div><Status tone={routingReady ? "good" : "warn"}>{routingReady ? "Receiving" : "Check route"}</Status></article>
        <article className="pup-lift"><span className="crm-line-icon"><HeartPulse size={20} /></span><div><small>PUP-LIFT SUPPORT</small><h3>+1 (715) 888-9526</h3><p>Dedicated hypoglycemia support guidance, urgent warning signs, voicemail, and staff transfer.</p></div><Status tone={routingReady ? "good" : "warn"}>{routingReady ? "Receiving" : "Check route"}</Status></article>
      </div>
      {lineMessage && <p className={`crm-line-message ${lineMessage.tone}`}>{lineMessage.text}</p>}
    </section>

    <section className="crm-dialer panel-wide">
      <header><div><span>OUTBOUND PHONE</span><h2>Dial a customer or call request</h2><p>Enter any number or load a family. Twilio rings the selected operator first, then connects the destination through the SWVAOS line.</p></div><Status tone={routingReady ? "good" : "warn"}>{routingReady ? "Ready" : "Check setup"}</Status></header>
      <div className="crm-dialer-body">
        <div className="crm-dial-screen">
          <label htmlFor="crm-dial-number">Number to call</label>
          <input id="crm-dial-number" type="tel" inputMode="tel" autoComplete="tel" value={dialNumber} onChange={(event) => { setDialNumber(event.target.value); setDialMessage(null); }} placeholder="Enter phone number" />
          <div><button type="button" onClick={() => setDialNumber((current) => current.slice(0, -1))} disabled={!dialNumber}>Delete</button><button type="button" onClick={() => setDialNumber("")} disabled={!dialNumber}>Clear</button>{selectedBuyer?.phone && <button type="button" onClick={() => setDialNumber(selectedBuyer.phone || "")}>Load {fullName(selectedBuyer)}</button>}</div>
          {dialBuyer && <small className="crm-dial-match">Matched to {fullName(dialBuyer)}. This call will be added to their history.</small>}
        </div>
        <div className="crm-keypad" aria-label="Phone keypad">{dialKeys.map(([digit, letters]) => <button key={digit} type="button" onClick={() => { setDialNumber((current) => `${current}${digit}`); setDialMessage(null); }} aria-label={`Dial ${digit}`}><b>{digit}</b>{letters && <small>{letters}</small>}</button>)}</div>
        <div className="crm-dial-actions">
          <fieldset><legend>Ring me first</legend><label className={dialOperator === "cristy" ? "active" : ""}><input type="radio" name="dial-operator" value="cristy" checked={dialOperator === "cristy"} onChange={() => setDialOperator("cristy")} /> Cristy</label><label className={dialOperator === "robert" ? "active" : ""}><input type="radio" name="dial-operator" value="robert" checked={dialOperator === "robert"} onChange={() => setDialOperator("robert")} /> Robert</label></fieldset>
          <button className="crm-start-call" type="button" onClick={startOutboundCall} disabled={!canDial || dialing}><PhoneCall size={18} /> {dialing ? "Starting call..." : "Start outbound call"}</button>
          <small>Answer your ringing phone; SWVAOS then connects the number above and displays the business caller ID.</small>
          {dialMessage && <p className={dialMessage.tone}>{dialMessage.text}</p>}
        </div>
      </div>
    </section>

    <Section eyebrow="Caller Directory" title="Recognized phone numbers" action={<button className="ghost" onClick={() => openCreate("buyers")}>Add family</button>}>
      <label className="crm-search"><SearchIcon size={16} /><input value={callerSearch} onChange={(event) => setCallerSearch(event.target.value)} placeholder="Search name or phone number" aria-label="Search caller directory" /></label>
      {filteredCallers.length ? <div className="crm-directory">{filteredCallers.map((buyer) => {
        const buyerPuppies = data.puppies.filter((puppy) => puppy.buyer_id === buyer.id);
        return <button key={buyer.id} className={selectedBuyer?.id === buyer.id ? "active" : ""} onClick={() => setSelectedBuyerId(buyer.id)}><span className="avatar">{initials(fullName(buyer))}</span><span><b>{fullName(buyer)}</b><small>{buyer.phone}</small></span><span><b>{buyerPuppies.length}</b><small>{buyerPuppies.length === 1 ? "puppy" : "puppies"}</small></span></button>;
      })}</div> : <Empty title="No matching callers" text="Families need a phone number before incoming calls can be recognized." action="Add family" onAction={() => openCreate("buyers")} />}
    </Section>

    <Section eyebrow="Active Caller" title={selectedBuyer ? fullName(selectedBuyer) : "No caller selected"} action={selectedBuyer && <div className="panel-actions"><button className="ghost" onClick={() => openEdit("buyers", selectedBuyer as unknown as Record<string, unknown>)}>Edit account</button><button className="ghost" onClick={() => openContracts(selectedBuyer.id)}><FileSignature size={15} /> Contracts</button><button className="primary-action" onClick={() => openCreate("events", callPreset)}><PhoneCall size={15} /> Log call</button></div>}>
      {selectedBuyer ? <div className="crm-account">
        <div className="crm-identity"><span className="avatar">{initials(fullName(selectedBuyer))}</span><div><b>{fullName(selectedBuyer)}</b><p>{[selectedBuyer.city, selectedBuyer.state].filter(Boolean).join(", ") || "Location not recorded"}</p><span><a href={`tel:${selectedBuyer.phone}`}>{selectedBuyer.phone}</a>{selectedBuyer.email && <a href={`mailto:${selectedBuyer.email}`}>{selectedBuyer.email}</a>}</span></div><Status tone={selectedBuyer.application_status === "Approved" ? "good" : "neutral"}>{selectedBuyer.application_status}</Status></div>
        <div className="crm-balance"><span><small>Paid</small><b>{money(paid)}</b></span><span><small>Outstanding</small><b>{money(outstanding)}</b></span><span><small>Next due</small><b>{shortDate(nextDue)}</b></span><span><small>Plans</small><b>{plans.filter((plan) => plan.status === "Active").length}</b></span></div>
      </div> : <Empty title="No recognized callers" text="Add a family phone number to activate account matching." action="Add family" onAction={() => openCreate("buyers")} />}
    </Section>

    <Section eyebrow="Interaction Inbox" title="Calls, messages, and requests" action={<button className="ghost" onClick={() => openCreate("events", callbackPreset)}><ClipboardCheck size={15} /> Callback</button>}>
      <div className="crm-inbox-tabs">{(["All", "Calls", "Messages", "Requests"] as const).map((filter) => <button key={filter} className={inboxFilter === filter ? "active" : ""} onClick={() => { setInboxFilter(filter); setSelectedInteractionId(null); }}>{filter}<b>{filter === "All" ? interactions.length : filter === "Calls" ? interactions.filter((event) => event.event_type === "Call" && !/message/i.test(event.title)).length : filter === "Messages" ? interactions.filter((event) => event.event_type === "Call" && /message/i.test(event.title)).length : interactions.filter((event) => ["Portal Request", "Transportation"].includes(event.event_type)).length}</b></button>)}</div>
      {filteredInteractions.length ? <div className="crm-inbox-list">{filteredInteractions.slice(0, 24).map((event) => {
        const buyer = event.related_type === "buyers" ? data.buyers.find((candidate) => candidate.id === event.related_id) : null;
        const Icon = event.event_type === "Transportation" ? Route : event.event_type === "Portal Request" ? MessageSquareText : /message/i.test(event.title) ? Voicemail : event.status === "Missed" ? PhoneMissed : PhoneIncoming;
        return <button key={event.id} className={`${selectedInteraction?.id === event.id ? "active" : ""}${newCallId === event.id ? " new-call" : ""}`} onClick={() => setSelectedInteractionId(event.id)}><span><Icon size={16} /></span><span><b>{event.title}</b><small>{buyer ? fullName(buyer) : event.related_type === "caller" ? "Unrecognized caller" : "General record"} / {shortDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ""}</small></span><Status tone={["New", "Scheduled", "Follow-up", "Callback"].includes(event.status) ? "warn" : event.status === "Failed" ? "bad" : "good"}>{event.status}</Status></button>;
      })}</div> : <div className="crm-empty-line">No records match this inbox view.</div>}
    </Section>

    <Section eyebrow="Selected Interaction" title={selectedInteraction?.title || "Nothing selected"} action={selectedInteraction && <button className="ghost" onClick={() => openEdit("events", selectedInteraction as unknown as Record<string, unknown>)}>Edit record</button>}>
      {selectedInteraction ? <div className="crm-interaction-detail"><div className="crm-interaction-head"><span>{selectedInteraction.event_type === "Transportation" ? <Route size={20} /> : selectedInteraction.event_type === "Portal Request" ? <MessageSquareText size={20} /> : /message/i.test(selectedInteraction.title) ? <Voicemail size={20} /> : <PhoneCall size={20} />}</span><div><b>{selectedInteractionBuyer ? fullName(selectedInteractionBuyer) : interactionPhone || "Unrecognized caller"}</b><small>{[interactionPhone, selectedInteraction.event_type, shortDate(selectedInteraction.event_date), selectedInteraction.event_time].filter(Boolean).join(" / ")}</small></div><Status tone={["New", "Scheduled", "Follow-up", "Callback"].includes(selectedInteraction.status) ? "warn" : selectedInteraction.status === "Failed" ? "bad" : "good"}>{selectedInteraction.status}</Status></div><p>{interactionDetail}</p><div>{interactionPhone && <a href={`tel:${interactionPhone}`}><PhoneCall size={15} /> Call back</a>}<button onClick={() => openCreate("events", { ...callbackPreset, related_id: selectedInteractionBuyer?.id ?? null, related_type: selectedInteractionBuyer ? "buyers" : "caller", notes: interactionPhone ? `Caller: ${interactionPhone}` : "" })}><ClipboardCheck size={15} /> Schedule callback</button>{selectedInteractionBuyer && <button onClick={() => setSelectedBuyerId(selectedInteractionBuyer.id)}><UserRound size={15} /> Open account</button>}</div></div> : <div className="crm-empty-line">Choose a call, message, or family request to review it.</div>}
    </Section>

    <Section eyebrow="Assigned Records" title="Puppies and latest updates" action={selectedBuyer && assignedPuppies[0] && <button className="ghost" onClick={() => openCreate("updates", { puppy_id: assignedPuppies[0].id, published: true })}>Add update</button>}>
      {assignedPuppies.length ? <div className="crm-puppies">{assignedPuppies.map((puppy) => {
        const latest = updates.find((update) => update.puppy_id === puppy.id);
        return <article key={puppy.id}><span className="avatar">{initials(puppy.name)}</span><div><b>{puppy.name}</b><p>{[puppy.sex, puppy.color, puppy.status].filter(Boolean).join(" / ")}</p><small>{latest ? `${latest.title}: ${latest.body}` : "No published update yet"}</small></div><Status tone={puppy.status === "Available" || puppy.status === "Reserved" ? "good" : "neutral"}>{puppy.status}</Status></article>;
      })}</div> : <div className="crm-empty-line">No puppy is assigned to this caller account.</div>}
    </Section>

    <Section eyebrow="Contract Center" title="Agreements and puppy portal" action={selectedBuyer && <button className="ghost" onClick={() => openContracts(selectedBuyer.id)}><FileSignature size={15} /> Prepare documents</button>}>
      {contractDocuments.length ? <div className="contract-records">{contractDocuments.map((document) => {
        const signed = document.title.startsWith("Signed ");
        return <a key={document.id} href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer"><FileText size={17} /><span><b>{document.title}</b><small>{document.document_type} / {shortDate(document.updated_at)}</small></span><Status tone={signed ? "good" : "warn"}>{signed ? "Signed" : "Waiting"}</Status><ExternalLink size={15} /></a>;
      })}</div> : <div className="crm-empty-line">No Bill of Sale or Health Guarantee has been prepared for this caller yet.</div>}
    </Section>

    <Section eyebrow="Account History" title="Conversations and messages" action={selectedBuyer && <button className="ghost" onClick={() => openCreate("events", callPreset)}><PhoneIncoming size={15} /> New entry</button>}>
      {calls.length ? <div className="crm-history">{calls.slice(0, 8).map((call) => <button key={call.id} onClick={() => openEdit("events", call as unknown as Record<string, unknown>)}><span><b>{call.title}</b><small>{shortDate(call.event_date)}{call.event_time ? ` / ${call.event_time}` : ""}</small></span><Status tone={call.status === "Completed" ? "good" : "neutral"}>{call.status}</Status><p>{call.notes || "No notes recorded"}</p></button>)}</div> : <div className="crm-empty-line">No calls or recorded messages are connected to this account yet.</div>}
    </Section>

    <section className="crm-menu-console panel-wide"><header><div><span>CALLER MENUS</span><h2>Line-aware phone routing</h2><p>Family callers receive account-aware choices, public callers receive general choices, and the Pup-Lift number always opens its dedicated support flow.</p></div><Status tone={routingReady ? "good" : "warn"}>{routingReady ? "Online" : "Review setup"}</Status></header><div><section><h3>Recognized family flow</h3><div className="crm-menu-list">{knownMenu.map(([key, label, description]) => <span key={key}><b>{key}</b><small><strong>{label}</strong>{description}</small></span>)}</div></section><section><h3>Public SWVAOS flow</h3><div className="crm-menu-list public">{publicMenu.map(([key, label, description]) => <span key={key}><b>{key}</b><small><strong>{label}</strong>{description}</small></span>)}</div></section><section className="pup-lift-menu"><h3>Pup-Lift support flow</h3><div className="crm-menu-list">{pupLiftMenu.map(([key, label, description]) => <span key={key}><b>{key}</b><small><strong>{label}</strong>{description}</small></span>)}</div></section></div></section>
  </div>;
}

function FinanceView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [accountQuery, setAccountQuery] = useState("");
  const paymentTransactions = data.transactions.filter(isPaymentTransaction);
  const unassignedPayments = paymentTransactions.filter((item) => !item.buyer_id);
  const accounts = data.buyers.map((buyer) => {
    const transactions = paymentTransactions.filter((item) => item.buyer_id === buyer.id);
    const plans = data.payment_plans.filter((plan) => plan.buyer_id === buyer.id);
    const paid = sumBy(transactions.filter(isPaidTransaction), (item) => item.amount_cents);
    const outstanding = sumBy(transactions.filter((item) => !paidStatuses.has(item.status)), (item) => item.amount_cents);
    return { buyer, transactions, plans, paid, outstanding };
  }).filter((account) => `${fullName(account.buyer)} ${account.buyer.email} ${account.buyer.phone ?? ""}`.toLowerCase().includes(accountQuery.trim().toLowerCase()))
    .sort((left, right) => right.outstanding - left.outstanding || fullName(left.buyer).localeCompare(fullName(right.buyer)));
  const selectedAccount = accounts.find((account) => account.buyer.id === selectedBuyerId) ?? null;
  const visibleTransactions = selectedAccount ? selectedAccount.transactions : data.transactions;

  return <div className="grid finance-grid">
    <div className="metric-row panel-wide"><button><span>Payments received</span><b>{money(a.paid)}</b><small>{money(a.fees)} in documented fees</small></button><button><span>Recorded costs</span><b>{money(a.costs)}</b><small>Program expenses</small></button><button><span>Outstanding</span><b>{money(a.outstanding)}</b><small>{a.overdue.length} overdue items</small></button><button><span>Buyer accounts</span><b>{data.buyers.length}</b><small>{unassignedPayments.length ? `${unassignedPayments.length} payments need a family` : "Every payment is assigned"}</small></button></div>
    <section className="finance-workbench panel-wide">
      <aside className="finance-accounts">
        <header><span>BUYER ACCOUNTS</span><h2>Receivables</h2><p>Choose a family to inspect every payment credited to their account.</p></header>
        <label className="finance-account-search"><SearchIcon size={15} /><input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="Find a buyer..." /></label>
        <button className={!selectedAccount ? "finance-account active" : "finance-account"} onClick={() => setSelectedBuyerId(null)}><span><b>All ledger activity</b><small>{data.transactions.length} total entries</small></span><strong>{money(a.paid)}</strong></button>
        <div className="finance-account-list">{accounts.map((account) => <button className={selectedAccount?.buyer.id === account.buyer.id ? "finance-account active" : "finance-account"} key={account.buyer.id} onClick={() => setSelectedBuyerId(account.buyer.id)}><span className="finance-account-avatar">{initials(fullName(account.buyer))}</span><span><b>{fullName(account.buyer)}</b><small>{money(account.paid)} received · {money(account.outstanding)} due</small></span><strong>{account.transactions.length}</strong></button>)}</div>
      </aside>
      <div className="finance-ledger-window">
        <header><div><span>{selectedAccount ? "FAMILY ACCOUNT" : "MASTER LEDGER"}</span><h2>{selectedAccount ? fullName(selectedAccount.buyer) : "All transactions"}</h2><p>{selectedAccount ? `${selectedAccount.transactions.length} credited transactions and ${selectedAccount.plans.length} payment plans` : "Payments, deposits, costs, refunds, and fees across the entire program."}</p></div><div className="finance-ledger-actions">{selectedAccount && <a href={`/families/${selectedAccount.buyer.id}`}>Open family <ExternalLink size={14} /></a>}<button onClick={() => openCreate("transactions", { type: "Payment", buyer_id: selectedAccount?.buyer.id ?? "" })}><Plus size={15} /> Credit payment</button></div></header>
        {selectedAccount && <div className="finance-account-summary"><span><small>Received</small><b>{money(selectedAccount.paid)}</b></span><span><small>Outstanding</small><b>{money(selectedAccount.outstanding)}</b></span><span><small>Active plans</small><b>{selectedAccount.plans.filter((plan) => plan.status === "Active").length}</b></span><span><small>Account status</small><Status tone={selectedAccount.outstanding > 0 ? "warn" : "good"}>{selectedAccount.outstanding > 0 ? "Open" : "Current"}</Status></span></div>}
        {visibleTransactions.length ? <div className="finance-ledger-list">{visibleTransactions.map((item) => {
          const fee = transactionFeeCents(item);
          const buyer = item.buyer_id ? data.buyers.find((candidate) => candidate.id === item.buyer_id) : null;
          return <button key={item.id} onClick={() => openEdit("transactions", item as unknown as Record<string, unknown>)}><span className={`ledger-type ${item.type.toLowerCase()}`}>{item.type === "Cost" ? "−" : "+"}</span><span><b>{item.description}</b><small>{[buyer ? fullName(buyer) : isPaymentTransaction(item) ? "Unassigned buyer" : null, item.category, item.method, item.paid_date ? shortDate(item.paid_date) : item.due_date ? `Due ${shortDate(item.due_date)}` : null, fee ? `Fee ${money(fee)}` : null].filter(Boolean).join(" · ")}</small></span><Status tone={paidStatuses.has(item.status) ? "good" : item.status === "Overdue" ? "bad" : "neutral"}>{item.status}</Status><strong>{item.type === "Cost" ? "−" : "+"}{money(item.amount_cents)}</strong></button>;
        })}</div> : <Empty title="No account activity" text={selectedAccount ? "Credit the first payment to this buyer and it will appear here and in their family profile." : "Payments, deposits, costs, and refunds will appear here as they are recorded."} action="Credit payment" onAction={() => openCreate("transactions", { type: "Payment", buyer_id: selectedAccount?.buyer.id ?? "" })} />}
      </div>
    </section>
    {unassignedPayments.length > 0 && <section className="finance-integrity-alert panel-wide"><ShieldCheck size={20} /><span><b>{unassignedPayments.length} existing {unassignedPayments.length === 1 ? "payment is" : "payments are"} not assigned to a buyer</b><small>Open each item below and choose the family that should receive credit. New payments now require a buyer.</small></span><button onClick={() => openEdit("transactions", unassignedPayments[0] as unknown as Record<string, unknown>)}>Review first item</button></section>}
    <Section eyebrow="Payment Plans" title="Installment schedules" action={<button className="ghost" onClick={() => openCreate("payment_plans")}>New plan</button>}>
      {data.payment_plans.length ? <div className="card-grid compact">{data.payment_plans.map((plan) => { const buyer = data.buyers.find((item) => item.id === plan.buyer_id); return <article key={plan.id} className="record-card"><div><h3>{plan.name}</h3><p>{buyer ? fullName(buyer) : "Buyer not found"} · {money(plan.payment_amount_cents)} {plan.frequency.toLowerCase()} · {plan.term_count} terms</p></div><b>{money(plan.total_amount_cents)}</b><Status tone={plan.status === "Active" ? "good" : "neutral"}>{plan.status}</Status><footer><button onClick={() => openCreate("transactions", { type: "Payment", buyer_id: plan.buyer_id, payment_plan_id: plan.id, category: "Installment", description: "Installment payment" })}>Record payment</button><button onClick={() => openEdit("payment_plans", plan as unknown as Record<string, unknown>)}>Edit</button></footer></article>; })}</div> : <Empty title="No payment plans" text="Create installment schedules and connect them to buyers and puppies." action="New plan" onAction={() => openCreate("payment_plans")} />}
    </Section>
  </div>;
}

function CalendarView({ data, openCreate, openEdit, remove }: ViewProps) {
  const events = [...data.events].sort((a, b) => `${a.event_date}${a.event_time ?? ""}`.localeCompare(`${b.event_date}${b.event_time ?? ""}`));
  return <div className="grid">
    <Section eyebrow="Mission Calendar" title="Events and reminders" action={<button className="ghost" onClick={() => openCreate("events")}>Add event</button>}>
      {events.length ? <div className="calendar-list">{events.map((event) => <article key={event.id}><time><b>{new Date(`${event.event_date}T12:00:00`).getDate()}</b><small>{new Date(`${event.event_date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></time><div><h3>{event.title}</h3><p>{[event.event_type, event.event_time, event.location].filter(Boolean).join(" / ")}</p></div><Status tone={event.status === "Completed" ? "good" : "neutral"}>{event.status}</Status><footer><button onClick={() => openEdit("events", event as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => remove("events", event.id, event.title)}>Delete</button></footer></article>)}</div> : <Empty title="No events" text="Schedule care, breeding, pickup, buyer, and reminder events." action="Add event" onAction={() => openCreate("events")} />}
    </Section>
  </div>;
}

function VaultView({ data, openDocumentUpload, removeDocument }: Pick<ViewProps, "data" | "openDocumentUpload" | "removeDocument">) {
  const buyerDocs = data.buyer_documents.map((doc) => ({ ...doc, kind: "buyer" as const, href: `/api/documents/${doc.id}`, owner: data.buyers.find((buyer) => buyer.id === doc.buyer_id) ? fullName(data.buyers.find((buyer) => buyer.id === doc.buyer_id)!) : `Buyer #${doc.buyer_id}` }));
  const dogDocs = data.dog_documents.map((doc) => ({ ...doc, kind: "dog" as const, href: `/api/dog-documents/${doc.id}`, owner: data.dogs.find((dog) => dog.id === doc.dog_id)?.name ?? `Dog #${doc.dog_id}` }));
  const docs = [...buyerDocs, ...dogDocs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <div className="grid vault-grid">
    <section className="vault-upload panel-wide">
      <div><span className="eyebrow">SECURE RECORDS</span><h2>Put every scan where it belongs.</h2><p>Registration papers, pedigrees, health results, contracts, guarantees, and payment documents stay connected to the correct dog or family.</p></div>
      <div className="upload-actions"><button onClick={() => openDocumentUpload("dog")}><DogIcon size={18} /> Dog document</button><button onClick={() => openDocumentUpload("buyer")}><UsersRound size={18} /> Family document</button></div>
    </section>
    <Section eyebrow="Document Vault" title={`${docs.length} stored ${docs.length === 1 ? "file" : "files"}`}>
      {docs.length ? <div className="vault-list">{docs.map((doc) => <article key={`${doc.kind}-${doc.id}`}><span className="file-mark"><FileText size={18} /></span><span className="file-copy"><b>{doc.title}</b><small>{doc.owner} / {doc.document_type} / {fileSize(doc.size_bytes)}</small></span><div className="file-actions"><a href={doc.href} target="_blank" rel="noreferrer" aria-label={`Open ${doc.title}`} title="Open document"><ExternalLink size={16} /></a><button onClick={() => removeDocument(doc.kind, doc.id, doc.title)} aria-label={`Delete ${doc.title}`} title="Delete document"><Trash2 size={16} /></button></div></article>)}</div> : <Empty title="No documents stored" text="Upload the first dog or family document. It will appear here immediately." action="Upload document" onAction={() => openDocumentUpload("dog")} />}
    </Section>
  </div>;
}

function ReportsView({ data, openCreate }: Pick<ViewProps, "data" | "openCreate">) {
  const a = useAnalytics(data);
  const litterReports = data.litters.map((litter) => {
    const puppies = data.puppies.filter((puppy) => puppy.litter_id === litter.id);
    const puppyIds = new Set(puppies.map((puppy) => puppy.id));
    const buyerIds = new Set(puppies.map((puppy) => puppy.buyer_id).filter((buyerId): buyerId is number => Boolean(buyerId)));
    const planIds = new Set(data.payment_plans.filter((plan) => plan.puppy_ids.some((puppyId) => puppyIds.has(puppyId)) || buyerIds.has(plan.buyer_id)).map((plan) => plan.id));
    const linkedTransactions = data.transactions.filter((item) => item.litter_id === litter.id || (item.puppy_id ? puppyIds.has(item.puppy_id) : false) || (item.payment_plan_id ? planIds.has(item.payment_plan_id) : false) || (item.buyer_id ? buyerIds.has(item.buyer_id) : false));
    const revenue = sumBy(linkedTransactions.filter(isPaidTransaction), (item) => item.amount_cents);
    const costs = sumBy(linkedTransactions.filter((item) => item.type === "Cost"), (item) => item.amount_cents);
    return { litter, puppies, revenue, costs, net: revenue - costs };
  }).sort((left, right) => right.net - left.net);
  const reportCards = [
    { label: "Readiness", value: `${a.readiness}%`, detail: "Composite program health" },
    { label: "Revenue", value: money(a.paid), detail: `${money(a.outstanding)} outstanding` },
    { label: "Net", value: money(a.paid - a.costs), detail: `${money(a.costs)} recorded costs` },
    { label: "Placement", value: `${pct(a.placed.length, data.puppies.length)}%`, detail: `${a.unmatched.length} puppies unmatched` },
    { label: "Compliance", value: `${a.registryCoverage}%`, detail: `${a.docsNeeded} estimated file gaps` },
    { label: "Care Load", value: String(a.openTasks.length), detail: `${a.upcomingCare.length} due in 30 days` },
  ];
  function exportSnapshot() {
    const payload = JSON.stringify({ exported_at: new Date().toISOString(), analytics: a, data }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `swvaos-snapshot-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <div className="grid">
    <Section eyebrow="Executive Report" title="Operating snapshot" action={<button className="ghost" onClick={exportSnapshot}>Export JSON</button>}>
      <div className="report-grid">{reportCards.map((card) => <article key={card.label} className="report-card"><span>{card.label}</span><b>{card.value}</b><small>{card.detail}</small></article>)}</div>
    </Section>
    <Section eyebrow="Litter Economics" title="Profitability by litter" action={<button className="ghost" onClick={() => openCreate("transactions", { type: "Payment" })}>Add ledger</button>}>
      {litterReports.length ? <div className="table-list">{litterReports.map((item) => <a href={`/litters/${item.litter.id}`} key={item.litter.id}><span><b>{item.litter.name}</b><small>{item.puppies.length} puppies / revenue {money(item.revenue)} / costs {money(item.costs)}</small></span><strong>{money(item.net)}</strong></a>)}</div> : <Empty title="No litter reports" text="Create litters and connect transactions to see profitability." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
    <Section eyebrow="Compliance Matrix" title="Documents and registrations">
      <div className="progress-list">
        <span style={{ "--value": `${a.registryCoverage}%` } as React.CSSProperties}><b>Registry coverage</b><i>{a.registryCoverage}%</i></span>
        <span style={{ "--value": `${a.microchipCoverage}%` } as React.CSSProperties}><b>Microchip coverage</b><i>{a.microchipCoverage}%</i></span>
        <span style={{ "--value": `${pct(a.docs, Math.max(1, data.dogs.length * 2 + data.buyers.length))}%` } as React.CSSProperties}><b>Document completeness</b><i>{a.docs} files</i></span>
        <span style={{ "--value": `${pct(a.publishedUpdates.length, Math.max(1, data.puppies.length))}%` } as React.CSSProperties}><b>Family update coverage</b><i>{a.publishedUpdates.length} updates</i></span>
      </div>
    </Section>
  </div>;
}

type ViewProps = {
  data: DataSet;
  openCreate: (resource: Resource, preset?: Record<string, unknown>) => void;
  openEdit: (resource: Resource, record: Record<string, unknown>) => void;
  openDocumentUpload: (kind: DocumentKind, ownerId?: number) => void;
  remove: (resource: Resource, id: number, label: string) => void;
  removeDocument: (kind: DocumentKind, id: number, label: string) => void;
  openContracts: (buyerId: number) => void;
};

function dollarDefault(record: Record<string, unknown> | undefined, key: string, centsKey: string, preset?: Record<string, unknown>) {
  if (record?.[key] !== undefined) return String(record[key]);
  if (typeof record?.[centsKey] === "number") return String((record[centsKey] as number) / 100);
  return valueOf(preset, key);
}

function Field({ label, name, type = "text", record, preset, required = false, defaultValue }: { label: string; name: string; type?: string; record?: Record<string, unknown>; preset?: Record<string, unknown>; required?: boolean; defaultValue?: string }) {
  return <label><span>{label}</span><input name={name} type={type} defaultValue={defaultValue ?? valueOf(record, name, valueOf(preset, name))} required={required} /></label>;
}

function SelectField({ label, name, options, record, preset, empty, required = false }: { label: string; name: string; options: { value: string | number; label: string }[]; record?: Record<string, unknown>; preset?: Record<string, unknown>; empty?: string; required?: boolean }) {
  return <label><span>{label}</span><select name={name} defaultValue={valueOf(record, name, valueOf(preset, name))} required={required}>{empty && <option value="">{empty}</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function TextArea({ label, name, record, preset }: { label: string; name: string; record?: Record<string, unknown>; preset?: Record<string, unknown> }) {
  return <label className="wide"><span>{label}</span><textarea name={name} defaultValue={valueOf(record, name, valueOf(preset, name))} rows={3} /></label>;
}

function TransactionFields({ data, record, preset }: { data: DataSet; record?: Record<string, unknown>; preset?: Record<string, unknown> }) {
  const initialValue = valueOf(record, "type", valueOf(preset, "type", "Payment"));
  const initialType = initialValue === "Cost" ? "Cost" : initialValue === "Deposit" ? "Deposit" : "Payment";
  const [type, setType] = useState<"Payment" | "Deposit" | "Cost">(initialType);
  const [buyerId, setBuyerId] = useState(valueOf(record, "buyer_id", valueOf(preset, "buyer_id")));
  const [puppyId, setPuppyId] = useState(valueOf(record, "puppy_id", valueOf(preset, "puppy_id")));
  const [planId, setPlanId] = useState(valueOf(record, "payment_plan_id", valueOf(preset, "payment_plan_id")));
  const descriptions = type === "Cost" ? costDescriptions : paymentDescriptions;
  const currentCategory = valueOf(record, "category", valueOf(preset, "category"));
  const currentMethod = valueOf(record, "method", valueOf(preset, "method"));
  const currentStatus = valueOf(record, "status", valueOf(preset, "status", "Paid"));
  const knownCategories = [...paymentCategories, ...costCategories];
  const dogOptions = data.dogs.map((dog) => ({ value: dog.id, label: dog.name }));
  const buyerOptions = data.buyers.map((buyer) => ({ value: buyer.id, label: fullName(buyer) }));
  const litterOptions = data.litters.map((litter) => ({ value: litter.id, label: litter.name }));
  const selectedBuyer = data.buyers.find((buyer) => buyer.id === Number(buyerId)) ?? null;
  const buyerLabel = (candidateId: number) => {
    const buyer = data.buyers.find((item) => item.id === candidateId);
    return buyer ? fullName(buyer) : `Buyer #${candidateId}`;
  };

  function chooseBuyer(nextBuyerId: string) {
    setBuyerId(nextBuyerId);
    const currentPuppy = data.puppies.find((puppy) => puppy.id === Number(puppyId));
    const currentPlan = data.payment_plans.find((plan) => plan.id === Number(planId));
    if (nextBuyerId && currentPuppy?.buyer_id && currentPuppy.buyer_id !== Number(nextBuyerId)) setPuppyId("");
    if (nextBuyerId && currentPlan?.buyer_id && currentPlan.buyer_id !== Number(nextBuyerId)) setPlanId("");
  }

  function choosePuppy(nextPuppyId: string) {
    setPuppyId(nextPuppyId);
    const puppy = data.puppies.find((item) => item.id === Number(nextPuppyId));
    if (puppy?.buyer_id) setBuyerId(String(puppy.buyer_id));
  }

  function choosePlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = data.payment_plans.find((item) => item.id === Number(nextPlanId));
    if (plan?.buyer_id) setBuyerId(String(plan.buyer_id));
    if (plan?.puppy_ids.length === 1) setPuppyId(String(plan.puppy_ids[0]));
  }

  return <>
    <label><span>Transaction type</span><select name="type" value={type} onChange={(event) => setType(event.target.value as "Payment" | "Deposit" | "Cost")} required><option value="Payment">Payment received</option><option value="Deposit">Deposit received</option><option value="Cost">Cost or expense</option></select></label>
    <label><span>Category</span><select name="category" defaultValue={currentCategory}><option value="">Choose a category</option>{currentCategory && !knownCategories.includes(currentCategory) && <option value={currentCategory}>{currentCategory}</option>}<optgroup label="Payments and income">{paymentCategories.map((category) => <option key={`payment-${category}`} value={category}>{category}</option>)}</optgroup><optgroup label="Costs and expenses">{costCategories.map((category) => <option key={`cost-${category}`} value={category}>{category}</option>)}</optgroup></select></label>
    <label className="wide"><span>What was this for?</span><input name="description" list="transaction-description-options" defaultValue={valueOf(record, "description", valueOf(preset, "description"))} placeholder={type === "Cost" ? "Example: Veterinary care" : "Example: Puppy deposit"} required /><datalist id="transaction-description-options">{descriptions.map((description) => <option key={description} value={description} />)}</datalist><small className="field-hint">Choose a suggestion or enter a specific description.</small></label>
    <label><span>Transaction amount</span><input name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={dollarDefault(record, "amount", "amount_cents", preset)} required /></label>
    <label><span>Fee charged</span><input name="fee_amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={transactionFeeDefault(record, preset)} placeholder="0.00" /><small className="field-hint">Processing, card, transfer, or other fee.</small></label>
    <label className={type === "Cost" ? "" : "payment-buyer-field"}><span>{type === "Cost" ? "Buyer / family (optional)" : "Credit to buyer / family"}</span><select name="buyer_id" value={buyerId} onChange={(event) => chooseBuyer(event.target.value)} required={type !== "Cost"}><option value="">{type === "Cost" ? "No family" : "Choose the family receiving credit"}</option>{buyerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{type !== "Cost" && <small className="field-hint">Required. This payment will appear in the selected family&apos;s profile, balance, portal, and receipts.</small>}</label>
    <label><span>Puppy</span><select name="puppy_id" value={puppyId} onChange={(event) => choosePuppy(event.target.value)}><option value="">No puppy</option>{data.puppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name}{puppy.buyer_id ? ` / ${buyerLabel(puppy.buyer_id)}` : " / Unassigned"}</option>)}</select></label>
    <SelectField label="Dog" name="dog_id" options={dogOptions} record={record} preset={preset} empty="No breeding dog" />
    <SelectField label="Litter" name="litter_id" options={litterOptions} record={record} preset={preset} empty="No litter" />
    <label><span>Payment plan</span><select name="payment_plan_id" value={planId} onChange={(event) => choosePlan(event.target.value)}><option value="">No payment plan</option>{data.payment_plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} / {buyerLabel(plan.buyer_id)}</option>)}</select></label>
    {type !== "Cost" && <div className={selectedBuyer ? "payment-credit-preview wide assigned" : "payment-credit-preview wide"}><span><ShieldCheck size={20} /></span><div><b>{selectedBuyer ? `${fullName(selectedBuyer)} will receive this payment` : "A buyer must receive this payment"}</b><small>{selectedBuyer ? "Saving updates this family’s ledger and enables the correct receipt and account history." : "Choose a family directly, or select an assigned puppy or payment plan to fill it automatically."}</small></div></div>}
    <label><span>Payment method</span><select name="method" defaultValue={currentMethod}><option value="">Choose a method</option>{currentMethod && !transactionMethods.includes(currentMethod) && <option value={currentMethod}>{currentMethod}</option>}{transactionMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
    <label><span>Status</span><select name="status" defaultValue={currentStatus}>{currentStatus && !transactionStatuses.includes(currentStatus) && <option value={currentStatus}>{currentStatus}</option>}{transactionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
    <Field label="Due date" name="due_date" type="date" record={record} preset={preset} />
    <Field label="Paid or processed date" name="paid_date" type="date" record={record} preset={preset} />
    <label className="wide"><span>Receipt, reference, or internal notes</span><textarea name="notes" defaultValue={transactionNotesDefault(record, preset)} rows={3} placeholder="Receipt or confirmation number, check number, refund reason, or other details..." /></label>
  </>;
}

function RecordModal({ modal, data, saving, onClose, onSubmit }: { modal: Exclude<ModalState, null>; data: DataSet; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { resource, record, preset } = modal;
  const editing = Boolean(record?.id);
  const dogOptions = data.dogs.map((dog) => ({ value: dog.id, label: dog.name }));
  const buyerOptions = data.buyers.map((buyer) => ({ value: buyer.id, label: fullName(buyer) }));
  const litterOptions = data.litters.map((litter) => ({ value: litter.id, label: litter.name }));
  const puppyOptions = data.puppies.map((puppy) => ({ value: puppy.id, label: puppy.name }));
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal" onSubmit={onSubmit}><header><span>{editing ? "Edit record" : "Create record"}</span><h2>{resource.replaceAll("_", " ")}</h2><button type="button" onClick={onClose}>Close</button></header><div className="form-grid">
    {resource === "dogs" && <><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Registered name" name="registered_name" record={record} preset={preset} /><Field label="Sex" name="sex" record={record} preset={preset} required /><Field label="Role" name="role" record={record} preset={preset} required /><Field label="Birth date" name="date_of_birth" type="date" record={record} preset={preset} /><Field label="Color" name="color" record={record} preset={preset} /><Field label="Weight" name="weight" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Microchip number" name="microchip_number" record={record} preset={preset} /><Field label="Primary registration number" name="registration_number" record={record} preset={preset} /><Field label="Acquired from" name="acquired_from" record={record} preset={preset} /><Field label="Acquisition date" name="acquisition_date" type="date" record={record} preset={preset} /><Field label="Purchase price" name="purchase_price" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "purchase_price", "purchase_price_cents", preset)} /><Field label="Next heat" name="next_heat_date" type="date" record={record} preset={preset} /><TextArea label="Health testing" name="health_testing" record={record} preset={preset} /><TextArea label="Acquisition notes" name="acquisition_notes" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "litters" && <><Field label="Name" name="name" record={record} preset={preset} required /><SelectField label="Dam" name="dam_id" options={dogOptions} record={record} preset={preset} empty="No dam" /><SelectField label="Sire" name="sire_id" options={dogOptions} record={record} preset={preset} empty="No sire" /><Field label="Breeding date" name="breeding_date" type="date" record={record} preset={preset} /><Field label="Due date" name="due_date" type="date" record={record} preset={preset} /><Field label="Birth date" name="birth_date" type="date" record={record} preset={preset} /><Field label="Expected count" name="expected_count" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "buyers" && <><Field label="First name" name="first_name" record={record} preset={preset} required /><Field label="Last name" name="last_name" record={record} preset={preset} required /><Field label="Email (optional)" name="email" type="email" record={record} preset={preset} /><Field label="Phone" name="phone" record={record} preset={preset} /><Field label="City" name="city" record={record} preset={preset} /><Field label="State" name="state" record={record} preset={preset} /><Field label="Application status" name="application_status" record={record} preset={preset} /><Field label="Preferred sex" name="preferred_sex" record={record} preset={preset} /><Field label="Preferred color" name="preferred_color" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "puppies" && <><SelectField label="Litter" name="litter_id" options={litterOptions} record={record} preset={preset} required /><SelectField label="Buyer" name="buyer_id" options={buyerOptions} record={record} preset={preset} empty="No buyer" /><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Sex" name="sex" record={record} preset={preset} /><Field label="Color" name="color" record={record} preset={preset} /><Field label="Birth date" name="birth_date" type="date" record={record} preset={preset} /><Field label="Birth weight" name="birth_weight" type="number" record={record} preset={preset} /><Field label="Current weight" name="current_weight" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Price" name="price" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "price", "price_cents", preset)} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "transactions" && <TransactionFields data={data} record={record} preset={preset} />}
    {resource === "payment_plans" && <><SelectField label="Buyer" name="buyer_id" options={buyerOptions} record={record} preset={preset} /><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Contract amount" name="total_amount" type="number" record={record} preset={preset} required defaultValue={dollarDefault(record, "total_amount", "total_amount_cents", preset)} /><Field label="Payment amount" name="payment_amount" type="number" record={record} preset={preset} required defaultValue={dollarDefault(record, "payment_amount", "payment_amount_cents", preset)} /><Field label="Number of payments" name="term_count" type="number" record={record} preset={preset} required /><Field label="Frequency" name="frequency" record={record} preset={preset} /><Field label="Next due date" name="next_due_date" type="date" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "events" && <><input type="hidden" name="related_type" value={valueOf(record, "related_type", valueOf(preset, "related_type"))} /><input type="hidden" name="related_id" value={valueOf(record, "related_id", valueOf(preset, "related_id"))} /><Field label="Title" name="title" record={record} preset={preset} required /><Field label="Type" name="event_type" record={record} preset={preset} required /><Field label="Date" name="event_date" type="date" record={record} preset={preset} required /><Field label="Time" name="event_time" type="time" record={record} preset={preset} /><Field label="Location" name="location" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "updates" && <><SelectField label="Puppy" name="puppy_id" options={puppyOptions} record={record} preset={preset} /><Field label="Title" name="title" record={record} preset={preset} required /><Field label="Week" name="week_number" type="number" record={record} preset={preset} /><Field label="Weight" name="weight" type="number" record={record} preset={preset} /><TextArea label="Body" name="body" record={record} preset={preset} /><label className="check wide"><input name="published" type="checkbox" defaultChecked={Boolean(record?.published ?? preset?.published)} /><span>Publish update</span></label></>}
    {resource === "dog_medical_records" && <><SelectField label="Dog" name="dog_id" options={dogOptions} record={record} preset={preset} /><Field label="Type" name="record_type" record={record} preset={preset} required /><Field label="Title" name="title" record={record} preset={preset} required /><Field label="Date" name="record_date" type="date" record={record} preset={preset} /><Field label="Provider" name="provider" record={record} preset={preset} /><Field label="Cost" name="cost" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "cost", "cost_cents", preset)} /><Field label="Next due" name="next_due_date" type="date" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "dog_registrations" && <><SelectField label="Dog" name="dog_id" options={dogOptions} record={record} preset={preset} /><Field label="Registry" name="registry" record={record} preset={preset} required /><Field label="Registration number" name="registration_number" record={record} preset={preset} required /><Field label="Registered name" name="registered_name" record={record} preset={preset} /><Field label="Issue date" name="issue_date" type="date" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
  </div><footer><button type="button" onClick={onClose}>Cancel</button><button disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create record"}</button></footer></form></div>;
}

function DocumentUploadModal({ modal, data, saving, error, onClose, onKindChange, onSubmit }: {
  modal: Exclude<DocumentModalState, null>;
  data: DataSet;
  saving: boolean;
  error: string;
  onClose: () => void;
  onKindChange: (kind: DocumentKind) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isDog = modal.kind === "dog";
  const hasOwners = isDog ? data.dogs.length > 0 : data.buyers.length > 0;
  const documentTypes = isDog ? dogDocumentTypes : buyerDocumentTypes;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="document-upload-title">
    <form className="modal upload-modal" onSubmit={onSubmit}>
      <header><span>Document vault</span><h2 id="document-upload-title">Upload document</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close upload"><X size={18} /></button></header>
      <div className="upload-form">
        <div className="segment-control" aria-label="Document owner type"><button type="button" aria-pressed={isDog} className={isDog ? "active" : ""} onClick={() => onKindChange("dog")}><DogIcon size={17} /> Dog</button><button type="button" aria-pressed={!isDog} className={!isDog ? "active" : ""} onClick={() => onKindChange("buyer")}><UsersRound size={17} /> Family</button></div>
        {!hasOwners && <div className="inline-notice">Add a {isDog ? "dog" : "family"} record before attaching a document.</div>}
        {error && <div className="inline-error">{error}</div>}
        <div className="form-grid document-fields">
          <label><span>{isDog ? "Dog" : "Family"}</span><select name={isDog ? "dog_id" : "buyer_id"} defaultValue={modal.ownerId ?? ""} required><option value="">Choose {isDog ? "a dog" : "a family"}</option>{isDog ? data.dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>) : data.buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{fullName(buyer)}</option>)}</select></label>
          <label><span>Document type</span><select name="document_type" defaultValue={documentTypes[0]} required>{documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="wide"><span>Title</span><input name="title" placeholder="A clear name for this document" /></label>
          {isDog && <><label><span>Registry</span><input name="registry" placeholder="AKC, CKC, ACA..." /></label><label><span>Registration number</span><input name="registration_number" /></label></>}
          {!isDog && <label className="wide"><span>Payment plan</span><select name="payment_plan_id" defaultValue=""><option value="">Not connected to a plan</option>{data.payment_plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>}
          <label className="wide file-input"><span>PDF or image</span><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required /><small>PDF, JPG, PNG, or WebP. Maximum 20 MB.</small></label>
          <label className="wide"><span>Notes</span><textarea name="notes" rows={3} /></label>
        </div>
      </div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" disabled={saving || !hasOwners}><Upload size={16} /> {saving ? "Uploading..." : "Upload document"}</button></footer>
    </form>
  </div>;
}

function ContractModal({ modal, data, templates, saving, error, onClose, onSubmit, onOpenPortal }: {
  modal: Exclude<ContractModalState, null>;
  data: DataSet;
  templates: TemplatesConfig;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenPortal: () => void;
}) {
  const buyer = data.buyers.find((item) => item.id === modal.buyerId);
  const puppies = data.puppies.filter((puppy) => puppy.buyer_id === modal.buyerId);
  const [puppyId, setPuppyId] = useState(puppies[0]?.id ?? 0);
  const selectedPuppy = puppies.find((puppy) => puppy.id === puppyId) ?? puppies[0];
  const paid = data.transactions.filter((item) => item.buyer_id === modal.buyerId && isPaidTransaction(item) && (!item.puppy_id || item.puppy_id === selectedPuppy?.id)).reduce((sum, item) => sum + item.amount_cents, 0);
  const existingContracts = data.buyer_documents.filter((document) => document.buyer_id === modal.buyerId && ["Bill of Sale", "Health Guarantee"].includes(document.document_type));
  const [salePrice, setSalePrice] = useState(String((selectedPuppy?.price_cents ?? 0) / 100));
  const [examDays, setExamDays] = useState(10);
  const [guaranteeMonths, setGuaranteeMonths] = useState(12);
  const [microToy, setMicroToy] = useState(false);
  const standardHealthTerms = healthGuaranteeTerms(240, 12, false).join("\n\n");
  const [healthTermsEdited, setHealthTermsEdited] = useState(templates.documents.health_guarantee.content !== standardHealthTerms);
  const [healthTerms, setHealthTerms] = useState(() => templates.documents.health_guarantee.content);
  const regenerateHealthTerms = (nextExamDays: number, nextGuaranteeMonths: number, nextMicroToy: boolean) => {
    if (!healthTermsEdited) setHealthTerms(healthGuaranteeTerms(nextExamDays * 24, nextGuaranteeMonths, nextMicroToy).join("\n\n"));
  };
  const copyPortal = async () => {
    if (!modal.portalUrl) return;
    await navigator.clipboard.writeText(modal.portalUrl);
  };

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="contract-modal-title">
    <form className="modal contract-modal" onSubmit={onSubmit}>
      <header><span>Contract center</span><h2 id="contract-modal-title">Bill of Sale and Health Guarantee</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close contracts"><X size={18} /></button></header>
      <div className="contract-modal-body">
        <div className="contract-recipient"><span><b>{buyer ? fullName(buyer) : "Family not found"}</b><small>{[buyer?.phone, buyer?.email].filter(Boolean).join(" / ") || "No contact information recorded"}</small></span><Status tone={existingContracts.some((document) => document.title.startsWith("Signed ")) ? "good" : "neutral"}>{`${existingContracts.length} stored`}</Status></div>
        {error && <div className="inline-error">{error}</div>}
        {modal.portalUrl && <div className="portal-link-result"><FileSignature size={22} /><div><b>Puppy portal ready</b><p>The family can review, sign, and retain both documents at this private link.</p><input aria-label="Puppy portal link" readOnly value={modal.portalUrl} /></div><button type="button" onClick={() => void copyPortal()}>Copy link</button><a href={modal.portalUrl} target="_blank" rel="noreferrer">Open portal <ExternalLink size={15} /></a></div>}
        {!puppies.length ? <div className="inline-notice">Assign a puppy to this family before creating contracts.</div> : <>
          <div className="form-grid contract-fields">
            <label><span>Assigned puppy</span><select name="puppy_id" value={selectedPuppy?.id ?? ""} onChange={(event) => { const next = Number(event.target.value); setPuppyId(next); const puppy = puppies.find((item) => item.id === next); setSalePrice(String((puppy?.price_cents ?? 0) / 100)); }} required>{puppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name}</option>)}</select></label>
            <label><span>Purchase price</span><input name="sale_price" type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required /></label>
            <label><span>Deposit and payments recorded</span><input name="deposit_amount" type="number" min="0" step="0.01" defaultValue={(paid / 100).toFixed(2)} /></label>
            <label><span>Deposit method</span><select name="deposit_method" defaultValue=""><option value="">Not recorded</option>{transactionMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label><span>Deposit/payment date</span><input name="deposit_paid_date" type="date" defaultValue={today()} /></label>
            <label><span>Balance due date</span><input name="balance_due_date" type="date" /></label>
            <label><span>Transfer or pickup date</span><input name="transfer_date" type="date" /></label>
            <label><span>Required veterinary exam</span><div className="field-with-unit"><input name="exam_days" type="number" min="1" max="14" value={examDays} onChange={(event) => { const next = Number(event.target.value); setExamDays(next); regenerateHealthTerms(next, guaranteeMonths, microToy); }} required /><small>days</small></div></label>
            <label><span>Voluntary guarantee period</span><div className="field-with-unit"><input name="guarantee_months" type="number" min="1" max="120" value={guaranteeMonths} onChange={(event) => { const next = Number(event.target.value); setGuaranteeMonths(next); regenerateHealthTerms(examDays, next, microToy); }} required /><small>months</small></div></label>
            <label className="check wide"><input name="micro_toy" type="checkbox" checked={microToy} onChange={(event) => { const next = event.target.checked; setMicroToy(next); regenerateHealthTerms(examDays, guaranteeMonths, next); }} /><span>Designate this puppy as Micro-Toy and apply the voluntary extended-guarantee exclusion.</span></label>
          </div>
          <details className="contract-terms"><summary>Review and edit contract language</summary><label><span>Bill of Sale terms</span><textarea name="bill_terms" rows={13} defaultValue={templates.documents.bill_of_sale.content} /></label><label><span>Health Guarantee terms</span><textarea name="health_terms" rows={28} value={healthTerms} onChange={(event) => { setHealthTermsEdited(true); setHealthTerms(event.target.value); }} /></label><button className="contract-terms-reset" type="button" onClick={() => { setHealthTermsEdited(true); setHealthTerms(templates.documents.health_guarantee.content); }}>Reload saved global template</button><button className="contract-terms-reset" type="button" onClick={() => { setHealthTermsEdited(false); setHealthTerms(healthGuaranteeTerms(examDays * 24, guaranteeMonths, microToy).join("\n\n")); }}>Use generated standard language</button><small>Section markers organize the signed portal agreement and PDF. The Virginia Consumer Notice is rendered in bold 10-point type. Have Virginia counsel review business-specific terms before relying on them.</small></details>
        </>}
      </div>
      <footer><button type="button" onClick={onClose}>Close</button>{existingContracts.length > 0 && <button type="button" onClick={onOpenPortal} disabled={saving}>Open existing portal</button>}<button className="primary-action" disabled={saving || !puppies.length}><FileSignature size={16} /> {saving ? "Preparing..." : "Create both documents"}</button></footer>
    </form>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("Command");
  const [data, setData] = useState<DataSet>(emptyData);
  const [templates, setTemplates] = useState<TemplatesConfig>(defaultTemplatesConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [documentModal, setDocumentModal] = useState<DocumentModalState>(null);
  const [contractModal, setContractModal] = useState<ContractModalState>(null);
  const [uploadError, setUploadError] = useState("");
  const [contractError, setContractError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activityRefreshing, setActivityRefreshing] = useState(false);
  const [activitySyncedAt, setActivitySyncedAt] = useState<Date | null>(null);
  const [activityError, setActivityError] = useState("");
  const [newCallId, setNewCallId] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const dataRef = useRef<DataSet>(emptyData);
  const activityRequestInFlight = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const analytics = useAnalytics(data);

  const navigateTo = useCallback((nextView: View) => {
    setView(nextView);
    setCommandOpen(false);
    setSearch("");
  }, []);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [dataResponse, templateResponse] = await Promise.all([fetch("/api/data", { cache: "no-store" }), fetch("/api/templates/config", { cache: "no-store" })]);
      const payload = await dataResponse.json() as DataSet & { error?: string };
      if (!dataResponse.ok) throw new Error(payload.error || "Unable to load records.");
      const nextData = { ...emptyData, ...payload };
      dataRef.current = nextData;
      setData(nextData);
      if (templateResponse.ok) setTemplates(await templateResponse.json() as TemplatesConfig);
    } catch (loadError) {
      setError(friendlyError(loadError, "Unable to load records."));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    if (activityRequestInFlight.current) return;
    activityRequestInFlight.current = true;
    setActivityRefreshing(true);
    try {
      const response = await fetch("/api/voice/activity", { cache: "no-store" });
      const payload = await response.json() as { events?: KennelEvent[]; synced_at?: string; error?: string };
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/")}`);
        return;
      }
      if (!response.ok || !Array.isArray(payload.events)) throw new Error(payload.error || "Unable to refresh call activity.");
      const previousCall = latestCallEvent(dataRef.current.events);
      const nextCall = latestCallEvent(payload.events);
      const nonActivityEvents = dataRef.current.events.filter((event) => !["Call", "Portal Request", "Transportation"].includes(event.event_type));
      const nextData = { ...dataRef.current, events: [...nonActivityEvents, ...payload.events] };
      dataRef.current = nextData;
      setData(nextData);
      setActivitySyncedAt(payload.synced_at ? new Date(payload.synced_at) : new Date());
      setActivityError("");
      if (previousCall && nextCall && nextCall.id !== previousCall.id && nextCall.created_at > previousCall.created_at) {
        setNewCallId(nextCall.id);
        setToast(nextCall.related_type === "buyers" ? "Incoming call matched to a family" : "New incoming call received");
      }
    } catch (refreshError) {
      setActivityError(friendlyError(refreshError, "Live call refresh failed."));
    } finally {
      activityRequestInFlight.current = false;
      setActivityRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);
  useEffect(() => {
    if (view !== "CRM") return;
    void refreshActivity();
    const interval = window.setInterval(() => void refreshActivity(), 5000);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refreshActivity(); };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshActivity, view]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSearch("");
        return;
      }
      if (event.altKey && /^[1-9a-z]$/i.test(event.key)) {
        const target = views.find((item) => item.shortcut === event.key.toUpperCase());
        if (target) {
          event.preventDefault();
          navigateTo(target.id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [navigateTo]);

  const openCreate = (resource: Resource, preset: Record<string, unknown> = {}) => setModal({ resource, preset });
  const openEdit = (resource: Resource, record: Record<string, unknown>) => setModal({ resource, record });
  const openDocumentUpload = (kind: DocumentKind, ownerId?: number) => {
    setUploadError("");
    setDocumentModal({ kind, ownerId });
  };
  const openContracts = (buyerId: number) => {
    setContractError("");
    setContractModal({ buyerId });
  };
  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, unknown>;
    if (modal.resource === "updates") values.published = form.get("published") === "on";
    if (modal.resource === "transactions") {
      values.notes = transactionNotesWithFee(values.notes, values.fee_amount);
      delete values.fee_amount;
    }
    try {
      const response = await fetch("/api/data", { method: modal.record?.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource: modal.resource, id: modal.record?.id, data: values }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save record.");
      setModal(null);
      setToast("Record saved");
      await loadData();
    } catch (saveError) {
      setError(friendlyError(saveError, "Unable to save record."));
    } finally {
      setSaving(false);
    }
  }
  async function remove(resource: Resource, id: number, label: string) {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/data?resource=${resource}&id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || "Unable to delete record.");
      return;
    }
    setToast("Record deleted");
    await loadData();
  }
  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentModal) return;
    setSaving(true);
    setUploadError("");
    try {
      await uploadDocumentDirect(new FormData(event.currentTarget), documentModal.kind);
      setDocumentModal(null);
      setToast("Document uploaded");
      await loadData();
    } catch (uploadFailure) {
      setUploadError(friendlyError(uploadFailure, "Unable to upload the document."));
    } finally {
      setSaving(false);
    }
  }
  async function removeDocument(kind: DocumentKind, id: number, label: string) {
    if (!window.confirm(`Delete "${label}" from the document vault? This cannot be undone.`)) return;
    const endpoint = kind === "dog" ? "/api/dog-documents" : "/api/documents";
    const response = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || "Unable to delete the document.");
      return;
    }
    setToast("Document deleted");
    await loadData();
  }
  async function submitContracts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractModal) return;
    setSaving(true);
    setContractError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/contracts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, buyer_id: contractModal.buyerId }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to prepare the contract package.");
      setContractModal({ ...contractModal, portalUrl: payload.portalUrl });
      setToast("Contracts prepared");
      await loadData();
    } catch (contractFailure) {
      setContractError(friendlyError(contractFailure, "Unable to prepare the contract package."));
    } finally {
      setSaving(false);
    }
  }
  async function openExistingPortal() {
    if (!contractModal) return;
    setSaving(true);
    setContractError("");
    try {
      const response = await fetch("/api/contracts/portal-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer_id: contractModal.buyerId }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to open the puppy portal.");
      setContractModal({ ...contractModal, portalUrl: payload.portalUrl });
    } catch (portalFailure) {
      setContractError(friendlyError(portalFailure, "Unable to open the puppy portal."));
    } finally {
      setSaving(false);
    }
  }

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return [
      ...data.dogs.map((item) => ({ label: item.name, detail: `${item.role} / ${item.status}`, view: "Breeding" as View })),
      ...data.litters.map((item) => ({ label: item.name, detail: `Litter / ${item.status}`, view: "Litters" as View })),
      ...data.buyers.map((item) => ({ label: fullName(item), detail: `${item.application_status} / ${[item.phone, item.email].filter(Boolean).join(" / ")}`, view: ["Approved", "Waitlist", "Matched", "Placed"].includes(item.application_status) ? "Families" as View : "Applications" as View })),
      ...data.puppies.map((item) => ({ label: item.name, detail: `Puppy / ${item.status}`, view: "Puppies" as View })),
      ...data.transactions.map((item) => ({ label: item.description, detail: `${item.type} / ${money(item.amount_cents)}`, view: "Finance" as View })),
      ...data.events.map((item) => ({ label: item.title, detail: shortDate(item.event_date), view: /pickup|delivery|transport|go.home/i.test(`${item.event_type} ${item.title}`) ? "Delivery" as View : "Calendar" as View })),
      ...data.dog_medical_records.map((item) => ({ label: item.title, detail: `${item.record_type} / ${shortDate(item.next_due_date)}`, view: "Care" as View })),
      ...data.updates.map((item) => ({ label: item.title, detail: item.published ? "Published update" : "Draft update", view: "Comms" as View })),
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [data, search]);

  const activeViewProps = { data, openCreate, openEdit, openDocumentUpload, remove, removeDocument, openContracts };
  const quickResource = view === "Litters" ? "litters" : view === "Puppies" || view === "Placement" ? "puppies" : view === "Calendar" || view === "Care" || view === "CRM" || view === "Delivery" ? "events" : view === "Applications" || view === "Families" || view === "Comms" || view === "Portal" ? "buyers" : view === "Breeding" ? "dogs" : view === "Finance" || view === "Inventory" || view === "Reports" ? "transactions" : "events";
  const viewCopy: Record<View, { title: string; text: string }> = {
    Command: { title: "Today’s breeder desk", text: "The next care, placement, payment, communication, and go-home work across the program." },
    Breeding: { title: "Dogs & breeding", text: "Manage breeding dogs, pairings, heat dates, registrations, and program records." },
    Litters: { title: "Litters", text: "Track every litter from planned pairing and due date through whelping and puppy roster." },
    Puppies: { title: "Puppies", text: "Keep identity, growth, care, availability, pricing, and family assignment on one record." },
    Care: { title: "Health & care", text: "Run medical schedules, puppy milestones, recurring care, and kennel work." },
    Applications: { title: "Applications", text: "Screen families, record preferences, approve the right homes, and build the waitlist." },
    Families: { title: "Buyers & waitlist", text: "Open the complete family relationship: contact, preferences, puppies, payments, documents, and portal." },
    Placement: { title: "Puppy placement", text: "Match approved families to puppies and carry every placement into payment and contract work." },
    Delivery: { title: "Pickup & delivery", text: "Control final balances, signed documents, handoff schedules, and go-home readiness." },
    Finance: { title: "Payments & sales", text: "Credit every payment to the right buyer and puppy, then manage balances and sale revenue." },
    Inventory: { title: "Costs & expenses", text: "See veterinary, breeding, supply, travel, and program costs against recorded sales." },
    Comms: { title: "Family communications", text: "Manage family updates, calls, messages, requests, and communication history." },
    Portal: { title: "Puppy Portal simulator", text: "See exactly what each customer sees and manage secure family access." },
    CRM: { title: "Caller CRM", text: "Identify callers and surface their account, assigned puppy, payment, update, and conversation records." },
    Calendar: { title: "Schedule", text: "Schedule breeding, whelping, care, family calls, pickup, delivery, and follow-up work." },
    Vault: { title: "Documents", text: "Access buyer files, dog records, certificates, signed agreements, and reports." },
    Templates: { title: "Automations & templates", text: "Control the saved business language and automatic emails used across each family journey." },
    Reports: { title: "Reports and intelligence", text: "Review performance, compliance, profitability, and export an operating snapshot." },
  };
  const ActiveViewIcon = views.find((item) => item.id === view)?.icon ?? LayoutDashboard;
  const activeViewDefinition = views.find((item) => item.id === view) ?? views[0];
  const coreRecordCount = data.dogs.length + data.litters.length + data.buyers.length + data.puppies.length;
  const viewBadges: Partial<Record<View, number>> = {
    Breeding: analytics.activeLitters.length,
    Litters: analytics.activeLitters.length,
    Puppies: analytics.unmatched.length,
    Applications: analytics.pendingBuyers.length,
    Families: analytics.approvedBuyers.length,
    Placement: analytics.unmatched.length,
    Delivery: data.events.filter((item) => /pickup|delivery|transport|go.home/i.test(`${item.event_type} ${item.title}`) && item.status !== "Completed").length,
    Care: analytics.upcomingCare.length,
    Finance: analytics.overdue.length,
    Comms: analytics.draftUpdates.length,
    CRM: data.events.filter((item) => item.event_type === "Call" && item.status !== "Completed").length,
    Calendar: analytics.openTasks.length,
    Vault: analytics.docs,
  };

  return <div className="breeder-shell">
    <aside className="breeder-sidebar">
      <button className="breeder-brand" onClick={() => navigateTo("Command")}><span><DogIcon size={23} /></span><b>Southwest Virginia Chihuahua</b><small>Breeder operating system</small></button>
      <button className="breeder-new-record" onClick={() => openCreate(quickResource)}><Plus size={17} /> Add to {activeViewDefinition.label}</button>
      <div className="breeder-nav-groups">{viewGroups.map((group) => <section key={group}><span>{group}</span><nav aria-label={group}>{views.filter((item) => item.group === group).map((item) => { const Icon = item.icon; const badge = viewBadges[item.id]; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigateTo(item.id)} title={`Alt+${item.shortcut}`}><Icon size={18} /><b>{item.label}</b>{Boolean(badge) && <em>{Number(badge) > 99 ? "99+" : badge}</em>}</button>; })}</nav></section>)}</div>
      <footer className="breeder-sidebar-footer"><span><i className={error ? "offline" : ""} />{error ? "Data needs attention" : "Records connected"}</span><small>{coreRecordCount} dogs, litters, puppies, and families · {analytics.docs} documents</small></footer>
    </aside>
    <main className="breeder-workspace">
      <header className="breeder-topbar">
        <div className="breeder-mobile-brand"><DogIcon size={18} /><b>SWVAOS</b></div>
        <div className="breeder-global-search"><SearchIcon size={18} /><input ref={searchInputRef} aria-label="Search SWVAOS" value={search} onFocus={() => setCommandOpen(true)} onChange={(event) => { setSearch(event.target.value); setCommandOpen(true); }} placeholder="Search a dog, litter, puppy, family, payment, or task…" /><kbd><CommandIcon size={11} />K</kbd>{commandOpen && <div className="breeder-search-menu"><header><span>Search and quick actions</span><button onClick={() => { setCommandOpen(false); setSearch(""); }} aria-label="Close search"><X size={15} /></button></header>{search.trim() ? searchResults.length ? <div className="command-results">{searchResults.map((item) => <button key={`${item.view}-${item.label}`} onClick={() => navigateTo(item.view)}><span><b>{item.label}</b><small>{item.detail}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="command-empty"><SearchIcon size={19} /><b>No matching records</b><small>Try a family name, puppy, transaction, or event.</small></div> : <><span className="command-section-label">Go to workspace</span><div className="breeder-search-links">{views.slice(0, 12).map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => navigateTo(item.id)}><Icon size={16} /><span>{item.label}</span></button>; })}</div><span className="command-section-label">Create</span><div className="command-actions"><button onClick={() => { setCommandOpen(false); openCreate("transactions", { type: "Payment" }); }}><ReceiptText size={16} /><span><b>Record payment</b><small>Credit a buyer account</small></span></button><button onClick={() => { setCommandOpen(false); openCreate("buyers", { application_status: "New" }); }}><ClipboardCheck size={16} /><span><b>New application</b><small>Start family screening</small></span></button><button onClick={() => { setCommandOpen(false); openCreate("events", { event_type: "Pickup", status: "Scheduled" }); }}><Route size={16} /><span><b>Schedule go-home</b><small>Pickup or delivery</small></span></button></div></>}</div>}</div>
        <div className="breeder-top-actions"><span suppressHydrationWarning>{now ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now) : "Today"}</span><button onClick={() => openCreate("transactions", { type: "Payment" })}><ReceiptText size={16} /> Record payment</button><button className="primary-action" onClick={() => openCreate(quickResource)}><Plus size={16} /> Add record</button></div>
      </header>
      <div className="breeder-content">
        {view !== "Command" && <header className="breeder-page-head"><span className="breeder-page-icon"><ActiveViewIcon size={22} /></span><div><small>{activeViewDefinition.group}</small><h1>{viewCopy[view].title}</h1><p>{viewCopy[view].text}</p></div><span className="breeder-page-date" suppressHydrationWarning>{now ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now) : "Today"}</span></header>}
        {error && <div className="error-banner"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
        {loading ? <div className="loading"><span />Loading records...</div> : <>
          {view === "Command" && <CommandView data={data} openCreate={openCreate} setView={navigateTo} />}
          {view === "Breeding" && <BreedingView {...activeViewProps} />}
          {view === "Litters" && <LittersView {...activeViewProps} />}
          {view === "Puppies" && <PuppiesView {...activeViewProps} />}
          {view === "Care" && <CareView {...activeViewProps} />}
          {view === "Applications" && <ApplicationsView {...activeViewProps} />}
          {view === "Families" && <FamiliesView {...activeViewProps} />}
          {view === "Placement" && <PlacementView {...activeViewProps} />}
          {view === "Delivery" && <DeliveryView {...activeViewProps} />}
          {view === "Finance" && <FinanceView {...activeViewProps} />}
          {view === "Inventory" && <InventoryView {...activeViewProps} />}
          {view === "Comms" && <CommunicationsView {...activeViewProps} />}
          {view === "Portal" && <PortalPreviewView data={data} />}
          {view === "CRM" && <CallerCrmView {...activeViewProps} refreshActivity={refreshActivity} activityRefreshing={activityRefreshing} activitySyncedAt={activitySyncedAt} activityError={activityError} newCallId={newCallId} />}
          {view === "Calendar" && <CalendarView {...activeViewProps} />}
          {view === "Vault" && <VaultView data={data} openDocumentUpload={openDocumentUpload} removeDocument={removeDocument} />}
          {view === "Templates" && <TemplatesCenter initialConfig={templates} onSaved={setTemplates} />}
          {view === "Reports" && <ReportsView data={data} openCreate={openCreate} />}
        </>}
      </div>
    </main>
    {modal && <RecordModal modal={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={submitRecord} />}
    {documentModal && <DocumentUploadModal modal={documentModal} data={data} saving={saving} error={uploadError} onClose={() => setDocumentModal(null)} onKindChange={(kind) => setDocumentModal({ kind })} onSubmit={submitDocument} />}
    {contractModal && <ContractModal modal={contractModal} data={data} templates={templates} saving={saving} error={contractError} onClose={() => setContractModal(null)} onSubmit={submitContracts} onOpenPortal={() => void openExistingPortal()} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
