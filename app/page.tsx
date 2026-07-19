"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleGauge,
  Dog as DogIcon,
  ExternalLink,
  FileText,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  MessagesSquare,
  PackageSearch,
  Plus,
  ReceiptText,
  Search as SearchIcon,
  Trash2,
  Upload,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

type Resource = "dogs" | "litters" | "buyers" | "puppies" | "payment_plans" | "transactions" | "events" | "updates" | "dog_medical_records" | "dog_registrations";
type BaseRecord = { id: number; created_at: string; updated_at: string };
type Dog = BaseRecord & { name: string; registered_name: string | null; sex: string; role: string; date_of_birth: string | null; color: string | null; weight: number | null; status: string; registration_number: string | null; microchip_number: string | null; health_testing: string | null; acquired_from: string | null; acquisition_date: string | null; acquisition_notes: string | null; next_heat_date: string | null; notes: string | null; purchase_price_cents: number | null };
type Litter = BaseRecord & { name: string; dam_id: number | null; sire_id: number | null; breeding_date: string | null; due_date: string | null; birth_date: string | null; expected_count: number | null; status: string; notes: string | null };
type Buyer = BaseRecord & { first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null };
type Puppy = BaseRecord & { litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null; notes: string | null };
type PaymentPlan = BaseRecord & { buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type Transaction = BaseRecord & { type: "Payment" | "Cost"; dog_id: number | null; buyer_id: number | null; litter_id: number | null; puppy_id: number | null; payment_plan_id: number | null; category: string | null; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null; notes: string | null };
type KennelEvent = BaseRecord & { title: string; event_type: string; event_date: string; event_time: string | null; location: string | null; status: string; notes: string | null };
type PuppyUpdate = BaseRecord & { puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean };
type DogMedicalRecord = BaseRecord & { dog_id: number; record_type: string; title: string; record_date: string | null; provider: string | null; cost_cents: number; next_due_date: string | null; notes: string | null };
type DogRegistration = BaseRecord & { dog_id: number; registry: string; registration_number: string; registered_name: string | null; issue_date: string | null; notes: string | null };
type StoredDocument = BaseRecord & { title: string; file_name: string; content_type: string; size_bytes: number; document_type: string };
type DogDocument = StoredDocument & { dog_id: number; registration_id: number | null; registry: string | null; registration_number: string | null };
type BuyerDocument = StoredDocument & { buyer_id: number; payment_plan_id: number | null; puppy_ids: number[] };
type DataSet = { dogs: Dog[]; litters: Litter[]; buyers: Buyer[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; events: KennelEvent[]; updates: PuppyUpdate[]; dog_medical_records: DogMedicalRecord[]; dog_registrations: DogRegistration[]; dog_documents: DogDocument[]; buyer_documents: BuyerDocument[] };
type ModalState = { resource: Resource; record?: Record<string, unknown>; preset?: Record<string, unknown> } | null;
type DocumentKind = "dog" | "buyer";
type DocumentModalState = { kind: DocumentKind; ownerId?: number } | null;
type View = "Command" | "Breeding" | "Families" | "Care" | "Finance" | "Inventory" | "Comms" | "Calendar" | "Vault" | "Reports";

const emptyData: DataSet = { dogs: [], litters: [], buyers: [], puppies: [], payment_plans: [], transactions: [], events: [], updates: [], dog_medical_records: [], dog_registrations: [], dog_documents: [], buyer_documents: [] };
const views: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "Command", label: "Command", icon: LayoutDashboard },
  { id: "Breeding", label: "Breeding", icon: DogIcon },
  { id: "Families", label: "Families", icon: UsersRound },
  { id: "Care", label: "Care", icon: HeartPulse },
  { id: "Finance", label: "Finance", icon: WalletCards },
  { id: "Inventory", label: "Inventory", icon: PackageSearch },
  { id: "Comms", label: "Comms", icon: MessagesSquare },
  { id: "Calendar", label: "Calendar", icon: CalendarDays },
  { id: "Vault", label: "Vault", icon: FolderOpen },
  { id: "Reports", label: "Reports", icon: ChartNoAxesCombined },
];

const dogDocumentTypes = ["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Medical Documentation", "Other"];
const buyerDocumentTypes = ["Bill of Sale", "Health Guarantee", "Payment Plan Agreement", "Other"];

const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
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
    const payments = data.transactions.filter((item) => item.type === "Payment");
    const paid = payments.filter((item) => item.status === "Paid").reduce((sum, item) => sum + item.amount_cents, 0);
    const costs = data.transactions.filter((item) => item.type === "Cost").reduce((sum, item) => sum + item.amount_cents, 0);
    const outstanding = payments.filter((item) => item.status !== "Paid").reduce((sum, item) => sum + item.amount_cents, 0);
    const overdue = payments.filter((item) => item.status !== "Paid" && item.due_date && item.due_date < today());
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
    return { activeLitters, paid, costs, outstanding, overdue, dueHealth, unmatched, placed, approvedBuyers, pendingBuyers, registryCoverage, microchipCoverage, docs, docsNeeded, readiness, upcoming, activePlanValue, activePuppies, readyPuppies, careEvents, openTasks, upcomingCare, supplyCosts, inventorySpend, draftUpdates, publishedUpdates };
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

function FamiliesView({ data, openCreate, openEdit, openDocumentUpload, remove }: ViewProps) {
  return <div className="grid two-one">
    <Section eyebrow="Buyer Pipeline" title="Families" action={<div className="panel-actions"><button className="ghost" onClick={() => openCreate("buyers")}>Add buyer</button><button className="primary-action" onClick={() => openDocumentUpload("buyer")}><Upload size={15} /> Upload file</button></div>}>
      {data.buyers.length ? <div className="table-list">{data.buyers.map((buyer) => <button key={buyer.id} onClick={() => openEdit("buyers", buyer as unknown as Record<string, unknown>)}><span><b>{fullName(buyer)}</b><small>{[buyer.email, buyer.phone, buyer.city, buyer.state].filter(Boolean).join(" / ")}</small></span><Status tone={buyer.application_status === "Approved" ? "good" : "neutral"}>{buyer.application_status}</Status></button>)}</div> : <Empty title="No buyers" text="Track applications, preferences, family notes, and contact details." action="Add buyer" onAction={() => openCreate("buyers")} />}
    </Section>
    <Section eyebrow="Puppy Placement" title="Puppies" action={<button className="ghost" onClick={() => openCreate("puppies")}>Add puppy</button>}>
      {data.puppies.length ? <div className="card-grid compact">{data.puppies.map((puppy) => <article key={puppy.id} className="record-card"><span className="avatar">{initials(puppy.name)}</span><div><h3>{puppy.name}</h3><p>{[puppy.sex, puppy.color, money(puppy.price_cents)].filter(Boolean).join(" / ")}</p></div><Status tone={puppy.buyer_id ? "good" : "warn"}>{puppy.buyer_id ? "Assigned" : puppy.status}</Status><footer><button onClick={() => openEdit("puppies", puppy as unknown as Record<string, unknown>)}>Edit</button><button onClick={() => remove("puppies", puppy.id, puppy.name)}>Delete</button></footer></article>)}</div> : <Empty title="No puppies" text="Add puppy records and connect them to litters and buyers." action="Add puppy" onAction={() => openCreate("puppies")} />}
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
      {data.buyers.length ? <div className="matrix-list">{data.buyers.slice(0, 12).map((buyer) => <span key={buyer.id}><b>{fullName(buyer)}</b><small><a href={`mailto:${buyer.email}`}>{buyer.email}</a>{buyer.phone ? ` / ${buyer.phone}` : ""}</small></span>)}</div> : <Empty title="No contacts" text="Add families to activate the contact center." action="Add family" onAction={() => openCreate("buyers")} />}
    </Section>
  </div>;
}

function FinanceView({ data, openCreate, openEdit }: ViewProps) {
  const a = useAnalytics(data);
  return <div className="grid">
    <div className="metric-row panel-wide"><button><span>Payments received</span><b>{money(a.paid)}</b><small>Paid transactions</small></button><button><span>Recorded costs</span><b>{money(a.costs)}</b><small>Program expenses</small></button><button><span>Outstanding</span><b>{money(a.outstanding)}</b><small>{a.overdue.length} overdue items</small></button><button><span>Active plan value</span><b>{money(a.activePlanValue)}</b><small>Payment plans</small></button></div>
    <Section eyebrow="Ledger" title="Transactions" action={<button className="ghost" onClick={() => openCreate("transactions", { type: "Payment" })}>Log transaction</button>}>
      {data.transactions.length ? <div className="table-list">{data.transactions.map((item) => <button key={item.id} onClick={() => openEdit("transactions", item as unknown as Record<string, unknown>)}><span><b>{item.description}</b><small>{[item.type, item.category, item.status, item.due_date ? `Due ${shortDate(item.due_date)}` : null].filter(Boolean).join(" / ")}</small></span><strong>{money(item.amount_cents)}</strong></button>)}</div> : <Empty title="No ledger entries" text="Log deposits, balances, refunds, veterinary costs, supplies, and other financial events." action="Log transaction" onAction={() => openCreate("transactions", { type: "Payment" })} />}
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
    const revenue = sumBy(data.transactions.filter((item) => item.litter_id === litter.id && item.type === "Payment" && item.status === "Paid"), (item) => item.amount_cents);
    const costs = sumBy(data.transactions.filter((item) => item.litter_id === litter.id && item.type === "Cost"), (item) => item.amount_cents);
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
      {litterReports.length ? <div className="table-list">{litterReports.map((item) => <button key={item.litter.id}><span><b>{item.litter.name}</b><small>{item.puppies.length} puppies / revenue {money(item.revenue)} / costs {money(item.costs)}</small></span><strong>{money(item.net)}</strong></button>)}</div> : <Empty title="No litter reports" text="Create litters and connect transactions to see profitability." action="Create litter" onAction={() => openCreate("litters")} />}
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

function RecordModal({ modal, data, saving, onClose, onSubmit }: { modal: Exclude<ModalState, null>; data: DataSet; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { resource, record, preset } = modal;
  const editing = Boolean(record?.id);
  const dogOptions = data.dogs.map((dog) => ({ value: dog.id, label: dog.name }));
  const buyerOptions = data.buyers.map((buyer) => ({ value: buyer.id, label: fullName(buyer) }));
  const litterOptions = data.litters.map((litter) => ({ value: litter.id, label: litter.name }));
  const puppyOptions = data.puppies.map((puppy) => ({ value: puppy.id, label: puppy.name }));
  const planOptions = data.payment_plans.map((plan) => ({ value: plan.id, label: plan.name }));
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal" onSubmit={onSubmit}><header><span>{editing ? "Edit record" : "Create record"}</span><h2>{resource.replaceAll("_", " ")}</h2><button type="button" onClick={onClose}>Close</button></header><div className="form-grid">
    {resource === "dogs" && <><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Registered name" name="registered_name" record={record} preset={preset} /><Field label="Sex" name="sex" record={record} preset={preset} required /><Field label="Role" name="role" record={record} preset={preset} required /><Field label="Birth date" name="date_of_birth" type="date" record={record} preset={preset} /><Field label="Color" name="color" record={record} preset={preset} /><Field label="Weight" name="weight" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Microchip number" name="microchip_number" record={record} preset={preset} /><Field label="Primary registration number" name="registration_number" record={record} preset={preset} /><Field label="Acquired from" name="acquired_from" record={record} preset={preset} /><Field label="Acquisition date" name="acquisition_date" type="date" record={record} preset={preset} /><Field label="Purchase price" name="purchase_price" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "purchase_price", "purchase_price_cents", preset)} /><Field label="Next heat" name="next_heat_date" type="date" record={record} preset={preset} /><TextArea label="Health testing" name="health_testing" record={record} preset={preset} /><TextArea label="Acquisition notes" name="acquisition_notes" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "litters" && <><Field label="Name" name="name" record={record} preset={preset} required /><SelectField label="Dam" name="dam_id" options={dogOptions} record={record} preset={preset} empty="No dam" /><SelectField label="Sire" name="sire_id" options={dogOptions} record={record} preset={preset} empty="No sire" /><Field label="Breeding date" name="breeding_date" type="date" record={record} preset={preset} /><Field label="Due date" name="due_date" type="date" record={record} preset={preset} /><Field label="Birth date" name="birth_date" type="date" record={record} preset={preset} /><Field label="Expected count" name="expected_count" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "buyers" && <><Field label="First name" name="first_name" record={record} preset={preset} required /><Field label="Last name" name="last_name" record={record} preset={preset} required /><Field label="Email" name="email" type="email" record={record} preset={preset} required /><Field label="Phone" name="phone" record={record} preset={preset} /><Field label="City" name="city" record={record} preset={preset} /><Field label="State" name="state" record={record} preset={preset} /><Field label="Application status" name="application_status" record={record} preset={preset} /><Field label="Preferred sex" name="preferred_sex" record={record} preset={preset} /><Field label="Preferred color" name="preferred_color" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "puppies" && <><SelectField label="Litter" name="litter_id" options={litterOptions} record={record} preset={preset} required /><SelectField label="Buyer" name="buyer_id" options={buyerOptions} record={record} preset={preset} empty="No buyer" /><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Sex" name="sex" record={record} preset={preset} /><Field label="Color" name="color" record={record} preset={preset} /><Field label="Birth date" name="birth_date" type="date" record={record} preset={preset} /><Field label="Birth weight" name="birth_weight" type="number" record={record} preset={preset} /><Field label="Current weight" name="current_weight" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Price" name="price" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "price", "price_cents", preset)} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
    {resource === "transactions" && <><Field label="Type" name="type" record={record} preset={preset} required /><Field label="Description" name="description" record={record} preset={preset} required /><Field label="Amount" name="amount" type="number" record={record} preset={preset} required defaultValue={dollarDefault(record, "amount", "amount_cents", preset)} /><Field label="Category" name="category" record={record} preset={preset} /><SelectField label="Dog" name="dog_id" options={dogOptions} record={record} preset={preset} empty="No dog" /><SelectField label="Buyer" name="buyer_id" options={buyerOptions} record={record} preset={preset} empty="No buyer" /><SelectField label="Litter" name="litter_id" options={litterOptions} record={record} preset={preset} empty="No litter" /><SelectField label="Puppy" name="puppy_id" options={puppyOptions} record={record} preset={preset} empty="No puppy" /><SelectField label="Plan" name="payment_plan_id" options={planOptions} record={record} preset={preset} empty="No plan" /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Due date" name="due_date" type="date" record={record} preset={preset} /><Field label="Paid date" name="paid_date" type="date" record={record} preset={preset} /><Field label="Method" name="method" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
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

export default function Home() {
  const [view, setView] = useState<View>("Command");
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [documentModal, setDocumentModal] = useState<DocumentModalState>(null);
  const [uploadError, setUploadError] = useState("");
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
  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, unknown>;
    if (modal.resource === "updates") values.published = form.get("published") === "on";
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
      const endpoint = documentModal.kind === "dog" ? "/api/dog-documents" : "/api/documents";
      const response = await fetch(endpoint, { method: "POST", body: new FormData(event.currentTarget) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to upload the document.");
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

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return [
      ...data.dogs.map((item) => ({ label: item.name, detail: `${item.role} / ${item.status}`, view: "Breeding" as View })),
      ...data.litters.map((item) => ({ label: item.name, detail: `Litter / ${item.status}`, view: "Breeding" as View })),
      ...data.buyers.map((item) => ({ label: fullName(item), detail: item.email, view: "Families" as View })),
      ...data.puppies.map((item) => ({ label: item.name, detail: `Puppy / ${item.status}`, view: "Families" as View })),
      ...data.transactions.map((item) => ({ label: item.description, detail: `${item.type} / ${money(item.amount_cents)}`, view: "Finance" as View })),
      ...data.events.map((item) => ({ label: item.title, detail: shortDate(item.event_date), view: "Calendar" as View })),
      ...data.dog_medical_records.map((item) => ({ label: item.title, detail: `${item.record_type} / ${shortDate(item.next_due_date)}`, view: "Care" as View })),
      ...data.updates.map((item) => ({ label: item.title, detail: item.published ? "Published update" : "Draft update", view: "Comms" as View })),
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [data, search]);

  const activeViewProps = { data, openCreate, openEdit, openDocumentUpload, remove, removeDocument };
  const quickResource = view === "Calendar" || view === "Care" ? "events" : view === "Families" || view === "Comms" ? "buyers" : view === "Breeding" ? "dogs" : view === "Finance" || view === "Inventory" || view === "Reports" ? "transactions" : "events";
  const viewCopy: Record<View, { title: string; text: string }> = {
    Command: { title: "Operating command", text: "Control surface for every record in the program." },
    Breeding: { title: "Breeding control", text: "Manage dogs, litters, registrations, health context, and pairings." },
    Families: { title: "Families and placement", text: "Manage buyer pipeline, puppy assignments, and family-facing updates." },
    Care: { title: "Care operations", text: "Run medical schedules, open tasks, heat watch, and appointment control." },
    Finance: { title: "Finance ledger", text: "Track payments, costs, balances, payment plans, and profitability." },
    Inventory: { title: "Inventory control", text: "Control supply spend, restock watchlists, and cost category burn." },
    Comms: { title: "Communications hub", text: "Manage family pipeline, puppy updates, and quick outreach." },
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
        <div className="top-actions"><span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date())}</span><button onClick={() => openDocumentUpload(view === "Families" ? "buyer" : "dog")}><Upload size={16} /> Upload</button><button onClick={() => openCreate("transactions", { type: "Payment" })}><ReceiptText size={16} /> Payment</button><button className="primary-action" onClick={() => openCreate(quickResource)}><Plus size={16} /> Add</button></div>
      </header>
      <div className="content">
        <div className="view-title"><span>{view.toUpperCase()}</span><h1>{viewCopy[view].title}</h1><p>{viewCopy[view].text}</p></div>
        {error && <div className="error-banner"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
        {loading ? <div className="loading"><span />Loading records...</div> : <>{view === "Command" && <CommandView data={data} openCreate={openCreate} setView={setView} />}{view === "Breeding" && <BreedingView {...activeViewProps} />}{view === "Families" && <FamiliesView {...activeViewProps} />}{view === "Care" && <CareView {...activeViewProps} />}{view === "Finance" && <FinanceView {...activeViewProps} />}{view === "Inventory" && <InventoryView {...activeViewProps} />}{view === "Comms" && <CommunicationsView {...activeViewProps} />}{view === "Calendar" && <CalendarView {...activeViewProps} />}{view === "Vault" && <VaultView data={data} openDocumentUpload={openDocumentUpload} removeDocument={removeDocument} />}{view === "Reports" && <ReportsView data={data} openCreate={openCreate} />}</>}
      </div>
    </main>
    {modal && <RecordModal modal={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={submitRecord} />}
    {documentModal && <DocumentUploadModal modal={documentModal} data={data} saving={saving} error={uploadError} onClose={() => setDocumentModal(null)} onKindChange={(kind) => setDocumentModal({ kind })} onSubmit={submitDocument} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
