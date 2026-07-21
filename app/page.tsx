"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleGauge,
  Dog as DogIcon,
  ExternalLink,
  FileText,
  FileSignature,
  FolderOpen,
  HeartPulse,
  Headphones,
  LayoutDashboard,
  MessagesSquare,
  PackageSearch,
  ClipboardCheck,
  MessageSquareText,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  ReceiptText,
  Route,
  Search as SearchIcon,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Voicemail,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { billOfSaleTerms, healthGuaranteeTerms } from "../lib/contract-templates";
import { uploadDocumentDirect } from "../lib/direct-document-upload";

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
type View = "Command" | "Breeding" | "Families" | "Care" | "Finance" | "Inventory" | "Comms" | "CRM" | "Calendar" | "Vault" | "Reports";

const emptyData: DataSet = { dogs: [], litters: [], buyers: [], puppies: [], payment_plans: [], transactions: [], events: [], updates: [], dog_medical_records: [], dog_registrations: [], dog_documents: [], buyer_documents: [] };
const views: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "Command", label: "Command", icon: LayoutDashboard },
  { id: "Breeding", label: "Breeding", icon: DogIcon },
  { id: "Families", label: "Families", icon: UsersRound },
  { id: "Care", label: "Care", icon: HeartPulse },
  { id: "Finance", label: "Finance", icon: WalletCards },
  { id: "Inventory", label: "Inventory", icon: PackageSearch },
  { id: "Comms", label: "Comms", icon: MessagesSquare },
  { id: "CRM", label: "Caller CRM", icon: Headphones },
  { id: "Calendar", label: "Calendar", icon: CalendarDays },
  { id: "Vault", label: "Vault", icon: FolderOpen },
  { id: "Reports", label: "Reports", icon: ChartNoAxesCombined },
];

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
  const alerts = [
    ...a.overdue.map((item) => ({ title: item.description, detail: `${money(item.amount_cents)} overdue`, view: "Finance" as View, tone: "bad" as const })),
    ...a.dueHealth.map((item) => ({ title: item.title, detail: `${item.record_type} due for dog #${item.dog_id}`, view: "Breeding" as View, tone: "warn" as const })),
    ...a.unmatched.slice(0, 4).map((item) => ({ title: item.name, detail: "Puppy is not assigned to a buyer", view: "Families" as View, tone: "warn" as const })),
  ];
  return <div className="grid command-grid">
    <section className="hero panel-wide">
      <div><span className="eyebrow">OPERATING SYSTEM</span><h1>SWVAOS</h1><p>Breeding operations, buyer pipeline, payments, document storage, care schedules, family updates, and reporting in one place.</p><div className="hero-actions"><button onClick={() => openCreate("dogs")}>Add dog</button><button onClick={() => openCreate("litters")}>Create litter</button><button onClick={() => openCreate("buyers")}>Add buyer</button><button onClick={() => openCreate("transactions", { type: "Payment" })}>Log payment</button></div></div>
      <div className="readiness" style={{ "--score": `${a.readiness}%` } as React.CSSProperties}><span>Readiness</span><b>{a.readiness}</b><small>{alerts.length ? `${alerts.length} attention signals` : "All core signals nominal"}</small><i /></div>
    </section>
    <div className="metric-row panel-wide">
      <button onClick={() => setView("Breeding")}><span>Active litters</span><b>{a.activeLitters.length}</b><small>{data.puppies.length} puppies recorded</small></button>
      <button onClick={() => setView("Families")}><span>Placement rate</span><b>{pct(a.placed.length, data.puppies.length)}%</b><small>{a.unmatched.length} unmatched puppies</small></button>
      <button onClick={() => setView("Finance")}><span>Net recorded</span><b>{money(a.paid - a.costs)}</b><small>{money(a.outstanding)} outstanding</small></button>
      <button onClick={() => setView("Vault")}><span>Vault files</span><b>{a.docs}</b><small>{a.registryCoverage}% registry coverage</small></button>
    </div>
    <div className="ops-strip panel-wide">
      <button onClick={() => setView("Care")}><b>{a.upcomingCare.length}</b><span>Care tasks due in 30 days</span></button>
      <button onClick={() => setView("Inventory")}><b>{money(a.inventorySpend)}</b><span>Supply and medical spend</span></button>
      <button onClick={() => setView("Comms")}><b>{a.draftUpdates.length}</b><span>Family updates waiting</span></button>
      <button onClick={() => setView("Reports")}><b>{a.docsNeeded}</b><span>Estimated missing documents</span></button>
    </div>
    <Section eyebrow="Risk Radar" title="Attention queue" action={<button className="ghost" onClick={() => openCreate("events")}>Schedule</button>}>
      {alerts.length ? <div className="signal-list">{alerts.slice(0, 7).map((item, index) => <button key={`${item.title}-${index}`} onClick={() => setView(item.view)}><Status tone={item.tone}>{item.tone.toUpperCase()}</Status><span><b>{item.title}</b><small>{item.detail}</small></span></button>)}</div> : <Empty title="No immediate risks" text="No overdue balances, care deadlines, or unassigned puppy records are currently flagged." action="Add event" onAction={() => openCreate("events")} />}
    </Section>
    <Section eyebrow="Program Pulse" title="Breeding and pipeline">
      <div className="pulse-bars"><span style={{ "--value": `${Math.min(100, a.activeLitters.length * 22)}%` } as React.CSSProperties}><b>Litters</b><i>{a.activeLitters.length}</i></span><span style={{ "--value": `${Math.min(100, a.approvedBuyers.length * 12)}%` } as React.CSSProperties}><b>Approved buyers</b><i>{a.approvedBuyers.length}</i></span><span style={{ "--value": `${Math.min(100, a.pendingBuyers.length * 12)}%` } as React.CSSProperties}><b>In review</b><i>{a.pendingBuyers.length}</i></span><span style={{ "--value": `${a.registryCoverage}%` } as React.CSSProperties}><b>Registry coverage</b><i>{a.registryCoverage}%</i></span></div>
    </Section>
    <Section eyebrow="Upcoming" title="Next events" action={<button className="ghost" onClick={() => setView("Calendar")}>Calendar</button>}>
      {a.upcoming.length ? <div className="event-stack">{a.upcoming.slice(0, 5).map((item) => <button key={item.id} onClick={() => setView("Calendar")}><span><b>{new Date(`${item.event_date}T12:00:00`).getDate()}</b><small>{new Date(`${item.event_date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></span><p><b>{item.title}</b><small>{[item.event_time, item.location, item.event_type].filter(Boolean).join(" / ")}</small></p><Status>{item.status}</Status></button>)}</div> : <Empty title="No events scheduled" text="Add veterinary visits, whelping reminders, buyer pickups, and follow-up tasks." action="Schedule event" onAction={() => openCreate("events")} />}
    </Section>
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

function CallerCrmView({ data, openCreate, openEdit, openContracts }: ViewProps) {
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

    <section className="crm-routing panel-wide"><div className={routingReady ? "online" : routingReady === false ? "attention" : "checking"}><PhoneIncoming size={19} /><span><b>{routingReady ? "Phone routing online" : routingReady === false ? "Phone routing needs setup" : "Checking phone routing"}</b><small>{routingReady ? "Caller recognition, account menus, and message recording are ready." : "The CRM remains available while phone routing is checked."}</small></span></div><div><button onClick={() => openCreate("events", callPreset)}><PhoneOutgoing size={15} /> Log call</button><button onClick={() => openCreate("events", callbackPreset)}><ClipboardCheck size={15} /> Schedule callback</button></div></section>

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
        return <button key={event.id} className={selectedInteraction?.id === event.id ? "active" : ""} onClick={() => setSelectedInteractionId(event.id)}><span><Icon size={16} /></span><span><b>{event.title}</b><small>{buyer ? fullName(buyer) : event.related_type === "caller" ? "Unrecognized caller" : "General record"} / {shortDate(event.event_date)}{event.event_time ? ` at ${event.event_time}` : ""}</small></span><Status tone={["New", "Scheduled", "Follow-up", "Callback"].includes(event.status) ? "warn" : event.status === "Failed" ? "bad" : "good"}>{event.status}</Status></button>;
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

    <section className="crm-menu-console panel-wide"><header><div><span>CALLER MENUS</span><h2>Account-aware phone routing</h2><p>Recognized callers receive their own account information. New callers receive public options without exposing private records.</p></div><Status tone={routingReady ? "good" : "warn"}>{routingReady ? "Online" : "Review setup"}</Status></header><div><section><h3>Recognized caller flow</h3><div className="crm-menu-list">{knownMenu.map(([key, label, description]) => <span key={key}><b>{key}</b><small><strong>{label}</strong>{description}</small></span>)}</div></section><section><h3>Public caller flow</h3><div className="crm-menu-list public">{publicMenu.map(([key, label, description]) => <span key={key}><b>{key}</b><small><strong>{label}</strong>{description}</small></span>)}</div></section></div></section>
  </div>;
}

function FinanceView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  return <div className="grid">
    <div className="metric-row panel-wide"><button><span>Payments received</span><b>{money(a.paid)}</b><small>{money(a.fees)} in documented fees</small></button><button><span>Recorded costs</span><b>{money(a.costs)}</b><small>Program expenses</small></button><button><span>Outstanding</span><b>{money(a.outstanding)}</b><small>{a.overdue.length} overdue items</small></button><button><span>Active plan value</span><b>{money(a.activePlanValue)}</b><small>Payment plans</small></button></div>
    <Section eyebrow="Ledger" title="Transactions" action={<button className="ghost" onClick={() => openCreate("transactions", { type: "Payment" })}>Log transaction</button>}>
      {data.transactions.length ? <div className="table-list">{data.transactions.map((item) => { const fee = transactionFeeCents(item); return <button key={item.id} onClick={() => openEdit("transactions", item as unknown as Record<string, unknown>)}><span><b>{item.description}</b><small>{[item.type, item.category, item.method, item.status, fee ? `Fee ${money(fee)}` : null, item.due_date ? `Due ${shortDate(item.due_date)}` : null].filter(Boolean).join(" / ")}</small></span><strong>{money(item.amount_cents)}</strong></button>; })}</div> : <Empty title="No ledger entries" text="Log deposits, balances, refunds, veterinary costs, supplies, and other financial events." action="Log transaction" onAction={() => openCreate("transactions", { type: "Payment" })} />}
    </Section>
    <Section eyebrow="Payment Plans" title="Installments" action={<button className="ghost" onClick={() => openCreate("payment_plans")}>New plan</button>}>
      {data.payment_plans.length ? <div className="card-grid compact">{data.payment_plans.map((plan) => <article key={plan.id} className="record-card"><div><h3>{plan.name}</h3><p>{money(plan.payment_amount_cents)} {plan.frequency.toLowerCase()} / {plan.term_count} terms</p></div><b>{money(plan.total_amount_cents)}</b><Status tone={plan.status === "Active" ? "good" : "neutral"}>{plan.status}</Status><footer><button onClick={() => openEdit("payment_plans", plan as unknown as Record<string, unknown>)}>Edit</button></footer></article>)}</div> : <Empty title="No payment plans" text="Create installment schedules and connect them to buyers and puppies." action="New plan" onAction={() => openCreate("payment_plans")} />}
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
  const descriptions = type === "Cost" ? costDescriptions : paymentDescriptions;
  const currentCategory = valueOf(record, "category", valueOf(preset, "category"));
  const currentMethod = valueOf(record, "method", valueOf(preset, "method"));
  const currentStatus = valueOf(record, "status", valueOf(preset, "status", "Paid"));
  const knownCategories = [...paymentCategories, ...costCategories];
  const dogOptions = data.dogs.map((dog) => ({ value: dog.id, label: dog.name }));
  const buyerOptions = data.buyers.map((buyer) => ({ value: buyer.id, label: fullName(buyer) }));
  const litterOptions = data.litters.map((litter) => ({ value: litter.id, label: litter.name }));
  const puppyOptions = data.puppies.map((puppy) => ({ value: puppy.id, label: puppy.name }));
  const planOptions = data.payment_plans.map((plan) => ({ value: plan.id, label: plan.name }));

  return <>
    <label><span>Transaction type</span><select name="type" value={type} onChange={(event) => setType(event.target.value as "Payment" | "Deposit" | "Cost")} required><option value="Payment">Payment received</option><option value="Deposit">Deposit received</option><option value="Cost">Cost or expense</option></select></label>
    <label><span>Category</span><select name="category" defaultValue={currentCategory}><option value="">Choose a category</option>{currentCategory && !knownCategories.includes(currentCategory) && <option value={currentCategory}>{currentCategory}</option>}<optgroup label="Payments and income">{paymentCategories.map((category) => <option key={`payment-${category}`} value={category}>{category}</option>)}</optgroup><optgroup label="Costs and expenses">{costCategories.map((category) => <option key={`cost-${category}`} value={category}>{category}</option>)}</optgroup></select></label>
    <label className="wide"><span>What was this for?</span><input name="description" list="transaction-description-options" defaultValue={valueOf(record, "description", valueOf(preset, "description"))} placeholder={type === "Cost" ? "Example: Veterinary care" : "Example: Puppy deposit"} required /><datalist id="transaction-description-options">{descriptions.map((description) => <option key={description} value={description} />)}</datalist><small className="field-hint">Choose a suggestion or enter a specific description.</small></label>
    <label><span>Transaction amount</span><input name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={dollarDefault(record, "amount", "amount_cents", preset)} required /></label>
    <label><span>Fee charged</span><input name="fee_amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={transactionFeeDefault(record, preset)} placeholder="0.00" /><small className="field-hint">Processing, card, transfer, or other fee.</small></label>
    <SelectField label="Buyer / family" name="buyer_id" options={buyerOptions} record={record} preset={preset} empty="No family" />
    <SelectField label="Puppy" name="puppy_id" options={puppyOptions} record={record} preset={preset} empty="No puppy" />
    <SelectField label="Dog" name="dog_id" options={dogOptions} record={record} preset={preset} empty="No breeding dog" />
    <SelectField label="Litter" name="litter_id" options={litterOptions} record={record} preset={preset} empty="No litter" />
    <SelectField label="Payment plan" name="payment_plan_id" options={planOptions} record={record} preset={preset} empty="No payment plan" />
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
    {resource === "events" && <><Field label="Title" name="title" record={record} preset={preset} required /><Field label="Type" name="event_type" record={record} preset={preset} required /><Field label="Date" name="event_date" type="date" record={record} preset={preset} required /><Field label="Time" name="event_time" type="time" record={record} preset={preset} /><Field label="Location" name="location" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
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

function ContractModal({ modal, data, saving, error, onClose, onSubmit, onOpenPortal }: {
  modal: Exclude<ContractModalState, null>;
  data: DataSet;
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
  const [healthTermsEdited, setHealthTermsEdited] = useState(false);
  const [healthTerms, setHealthTerms] = useState(() => healthGuaranteeTerms(240, 12, false).join("\n\n"));
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
          <details className="contract-terms"><summary>Review and edit contract language</summary><label><span>Bill of Sale terms</span><textarea name="bill_terms" rows={13} defaultValue={billOfSaleTerms.join("\n\n")} /></label><label><span>Health Guarantee terms</span><textarea name="health_terms" rows={28} value={healthTerms} onChange={(event) => { setHealthTermsEdited(true); setHealthTerms(event.target.value); }} /></label><button className="contract-terms-reset" type="button" onClick={() => { setHealthTermsEdited(false); setHealthTerms(healthGuaranteeTerms(examDays * 24, guaranteeMonths, microToy).join("\n\n")); }}>Restore revised standard language</button><small>Section markers organize the signed portal agreement and PDF. The Virginia Consumer Notice is rendered in bold 10-point type. Have Virginia counsel review business-specific terms before relying on them.</small></details>
        </>}
      </div>
      <footer><button type="button" onClick={onClose}>Close</button>{existingContracts.length > 0 && <button type="button" onClick={onOpenPortal} disabled={saving}>Open existing portal</button>}<button className="primary-action" disabled={saving || !puppies.length}><FileSignature size={16} /> {saving ? "Preparing..." : "Create both documents"}</button></footer>
    </form>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("Command");
  const [data, setData] = useState<DataSet>(emptyData);
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
  const analytics = useAnalytics(data);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load records.");
      setData({ ...emptyData, ...payload });
    } catch (loadError) {
      setError(friendlyError(loadError, "Unable to load records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);

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
      ...data.litters.map((item) => ({ label: item.name, detail: `Litter / ${item.status}`, view: "Breeding" as View })),
      ...data.buyers.map((item) => ({ label: fullName(item), detail: [item.phone, item.email].filter(Boolean).join(" / "), view: item.phone ? "CRM" as View : "Families" as View })),
      ...data.puppies.map((item) => ({ label: item.name, detail: `Puppy / ${item.status}`, view: "Families" as View })),
      ...data.transactions.map((item) => ({ label: item.description, detail: `${item.type} / ${money(item.amount_cents)}`, view: "Finance" as View })),
      ...data.events.map((item) => ({ label: item.title, detail: shortDate(item.event_date), view: "Calendar" as View })),
      ...data.dog_medical_records.map((item) => ({ label: item.title, detail: `${item.record_type} / ${shortDate(item.next_due_date)}`, view: "Care" as View })),
      ...data.updates.map((item) => ({ label: item.title, detail: item.published ? "Published update" : "Draft update", view: "Comms" as View })),
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [data, search]);

  const activeViewProps = { data, openCreate, openEdit, openDocumentUpload, remove, removeDocument, openContracts };
  const quickResource = view === "Calendar" || view === "Care" || view === "CRM" ? "events" : view === "Families" || view === "Comms" ? "buyers" : view === "Breeding" ? "dogs" : view === "Finance" || view === "Inventory" || view === "Reports" ? "transactions" : "events";
  const viewCopy: Record<View, { title: string; text: string }> = {
    Command: { title: "Operating command", text: "Control surface for every record in the program." },
    Breeding: { title: "Breeding control", text: "Manage dogs, litters, registrations, health context, and pairings." },
    Families: { title: "Families and placement", text: "Manage buyer pipeline, puppy assignments, and family-facing updates." },
    Care: { title: "Care operations", text: "Run medical schedules, open tasks, heat watch, and appointment control." },
    Finance: { title: "Finance ledger", text: "Track payments, costs, balances, payment plans, and profitability." },
    Inventory: { title: "Inventory control", text: "Control supply spend, restock watchlists, and cost category burn." },
    Comms: { title: "Communications hub", text: "Manage family pipeline, puppy updates, and quick outreach." },
    CRM: { title: "Caller CRM", text: "Identify callers and surface their account, assigned puppy, payment, update, and conversation records." },
    Calendar: { title: "Mission calendar", text: "Schedule care, breeding, pickup, buyer, and reminder events." },
    Vault: { title: "Document vault", text: "Access buyer files, dog files, certificates, agreements, and reports." },
    Reports: { title: "Reports and intelligence", text: "Review performance, compliance, profitability, and export an operating snapshot." },
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("Command")}><span><CircleGauge size={22} /></span><b>SWVAOS</b><small>Operating system</small></button>
      <nav aria-label="SWVAOS sections">{views.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}</nav>
      <div className="system-card"><span className={error ? "offline" : ""} /><b>{error ? "Action needed" : "System online"}</b><small>{analytics.readiness}% readiness / {analytics.docs} vault files</small></div>
    </aside>
    <main>
      <header className="topbar">
        <div className="search"><SearchIcon size={18} /><input aria-label="Search SWVAOS" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dogs, families, payments, care, files..." />{searchResults.length > 0 && <div className="search-menu">{searchResults.map((item) => <button key={`${item.view}-${item.label}`} onClick={() => { setView(item.view); setSearch(""); }}><b>{item.label}</b><small>{item.detail}</small></button>)}</div>}</div>
        <div className="top-actions"><span suppressHydrationWarning>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date())}</span><button onClick={() => openDocumentUpload(view === "Families" ? "buyer" : "dog")}><Upload size={16} /> Upload</button><button onClick={() => openCreate("transactions", { type: "Payment" })}><ReceiptText size={16} /> Payment</button><button className="primary-action" onClick={() => openCreate(quickResource)}><Plus size={16} /> Add</button></div>
      </header>
      <div className="content">
        <div className="view-title"><span>{view.toUpperCase()}</span><h1>{viewCopy[view].title}</h1><p>{viewCopy[view].text}</p></div>
        {error && <div className="error-banner"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
        {loading ? <div className="loading"><span />Loading records...</div> : <>{view === "Command" && <CommandView data={data} openCreate={openCreate} setView={setView} />}{view === "Breeding" && <BreedingView {...activeViewProps} />}{view === "Families" && <FamiliesView {...activeViewProps} />}{view === "Care" && <CareView {...activeViewProps} />}{view === "Finance" && <FinanceView {...activeViewProps} />}{view === "Inventory" && <InventoryView {...activeViewProps} />}{view === "Comms" && <CommunicationsView {...activeViewProps} />}{view === "CRM" && <CallerCrmView {...activeViewProps} />}{view === "Calendar" && <CalendarView {...activeViewProps} />}{view === "Vault" && <VaultView data={data} openDocumentUpload={openDocumentUpload} removeDocument={removeDocument} />}{view === "Reports" && <ReportsView data={data} openCreate={openCreate} />}</>}
      </div>
    </main>
    {modal && <RecordModal modal={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={submitRecord} />}
    {documentModal && <DocumentUploadModal modal={documentModal} data={data} saving={saving} error={uploadError} onClose={() => setDocumentModal(null)} onKindChange={(kind) => setDocumentModal({ kind })} onSubmit={submitDocument} />}
    {contractModal && <ContractModal modal={contractModal} data={data} saving={saving} error={contractError} onClose={() => setContractModal(null)} onSubmit={submitContracts} onOpenPortal={() => void openExistingPortal()} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
