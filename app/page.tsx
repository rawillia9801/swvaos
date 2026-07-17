"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Resource = "dogs" | "litters" | "buyers" | "puppies" | "payment_plans" | "transactions" | "events" | "updates" | "dog_medical_records" | "dog_registrations";
type BaseRecord = { id: number; created_at: string; updated_at: string };
type Dog = BaseRecord & { name: string; registered_name: string | null; sex: string; role: string; date_of_birth: string | null; color: string | null; weight: number | null; status: string; registration_number: string | null; microchip_number: string | null; health_testing: string | null; next_heat_date: string | null; notes: string | null; purchase_price_cents: number | null };
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
type View = "Command" | "Breeding" | "Families" | "Finance" | "Calendar" | "Vault";

const emptyData: DataSet = { dogs: [], litters: [], buyers: [], puppies: [], payment_plans: [], transactions: [], events: [], updates: [], dog_medical_records: [], dog_registrations: [], dog_documents: [], buyer_documents: [] };
const views: { id: View; label: string; code: string }[] = [
  { id: "Command", label: "Command", code: "01" },
  { id: "Breeding", label: "Breeding", code: "02" },
  { id: "Families", label: "Families", code: "03" },
  { id: "Finance", label: "Finance", code: "$" },
  { id: "Calendar", label: "Calendar", code: "05" },
  { id: "Vault", label: "Vault", code: "06" },
];

const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const shortDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Not set";
const today = () => new Date().toISOString().slice(0, 10);
const fullName = (buyer: Buyer) => `${buyer.first_name} ${buyer.last_name}`;
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const valueOf = (record: Record<string, unknown> | undefined, key: string, fallback = "") => String(record?.[key] ?? fallback);

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
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
    const readiness = Math.max(0, Math.min(100, Math.round(46 + Math.min(activeLitters.length, 4) * 8 + Math.min(approvedBuyers.length, 8) * 3 + Math.min(docs, 12) * 1.4 + registryCoverage * 0.12 - overdue.length * 8 - dueHealth.length * 5 - unmatched.length * 2)));
    const upcoming = data.events.filter((item) => item.event_date >= today() && item.status !== "Completed").sort((a, b) => `${a.event_date}${a.event_time ?? ""}`.localeCompare(`${b.event_date}${b.event_time ?? ""}`));
    const activePlanValue = data.payment_plans.filter((item) => item.status === "Active").reduce((sum, item) => sum + item.total_amount_cents, 0);
    return { activeLitters, paid, costs, outstanding, overdue, dueHealth, unmatched, placed, approvedBuyers, pendingBuyers, registryCoverage, docs, readiness, upcoming, activePlanValue };
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
      <div><span className="eyebrow">LIVE SUPABASE OPERATIONS</span><h1>Southwest Virginia Chihuahua OS</h1><p>A direct Vercel dashboard for breeding operations, buyer pipeline, payments, document storage, care schedules, and family updates.</p><div className="hero-actions"><button onClick={() => openCreate("dogs")}>Add dog</button><button onClick={() => openCreate("litters")}>Create litter</button><button onClick={() => openCreate("buyers")}>Add buyer</button><button onClick={() => openCreate("transactions", { type: "Payment" })}>Log payment</button></div></div>
      <div className="readiness"><span>Readiness</span><b>{a.readiness}</b><small>{alerts.length ? `${alerts.length} attention signals` : "All core signals nominal"}</small><i style={{ "--score": `${a.readiness}%` } as React.CSSProperties} /></div>
    </section>
    <div className="metric-row panel-wide">
      <button onClick={() => setView("Breeding")}><span>Active litters</span><b>{a.activeLitters.length}</b><small>{data.puppies.length} puppies recorded</small></button>
      <button onClick={() => setView("Families")}><span>Placement rate</span><b>{pct(a.placed.length, data.puppies.length)}%</b><small>{a.unmatched.length} unmatched puppies</small></button>
      <button onClick={() => setView("Finance")}><span>Net recorded</span><b>{money(a.paid - a.costs)}</b><small>{money(a.outstanding)} outstanding</small></button>
      <button onClick={() => setView("Vault")}><span>Vault files</span><b>{a.docs}</b><small>{a.registryCoverage}% registry coverage</small></button>
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

function BreedingView({ data, openCreate, openEdit, remove }: ViewProps) {
  const [selectedDogId, setSelectedDogId] = useState<number | null>(data.dogs[0]?.id ?? null);
  const selectedDog = data.dogs.find((dog) => dog.id === selectedDogId) ?? data.dogs[0] ?? null;
  return <div className="grid two-one">
    <Section eyebrow="Dog Matrix" title="Breeding dogs" action={<button className="ghost" onClick={() => openCreate("dogs")}>Add dog</button>}>
      {data.dogs.length ? <div className="card-grid">{data.dogs.map((dog) => <article key={dog.id} className={selectedDog?.id === dog.id ? "record-card selected" : "record-card"} onClick={() => setSelectedDogId(dog.id)}><span className="avatar">{initials(dog.name)}</span><div><h3>{dog.name}</h3><p>{[dog.role, dog.sex, dog.color].filter(Boolean).join(" / ")}</p></div><Status tone={dog.status === "Active" ? "good" : "neutral"}>{dog.status}</Status><footer><button onClick={(event) => { event.stopPropagation(); openEdit("dogs", dog as unknown as Record<string, unknown>); }}>Edit</button><button onClick={(event) => { event.stopPropagation(); remove("dogs", dog.id, dog.name); }}>Delete</button></footer></article>)}</div> : <Empty title="No breeding dogs" text="Add dams and sires with health, registry, acquisition, and notes." action="Add dog" onAction={() => openCreate("dogs")} />}
    </Section>
    <Section eyebrow="Selected Profile" title={selectedDog?.name ?? "No dog selected"} action={selectedDog && <button className="ghost" onClick={() => openCreate("dog_medical_records", { dog_id: selectedDog.id })}>Add care</button>}>
      {selectedDog ? <div className="profile-stack"><div className="profile-metrics"><span><b>{data.litters.filter((item) => item.dam_id === selectedDog.id || item.sire_id === selectedDog.id).length}</b><small>Litters</small></span><span><b>{data.dog_medical_records.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Care records</small></span><span><b>{data.dog_registrations.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Registries</small></span><span><b>{data.dog_documents.filter((item) => item.dog_id === selectedDog.id).length}</b><small>Files</small></span></div><p>{selectedDog.health_testing || selectedDog.notes || "No health testing or notes recorded yet."}</p><div className="mini-list">{data.dog_medical_records.filter((item) => item.dog_id === selectedDog.id).slice(0, 4).map((item) => <span key={item.id}><b>{item.title}</b><small>{item.record_type} / {shortDate(item.record_date)}</small></span>)}</div></div> : <Empty title="No dog selected" text="Select or add a breeding dog to open the profile panel." action="Add dog" onAction={() => openCreate("dogs")} />}
    </Section>
    <Section eyebrow="Litter Control" title="Litters" action={<button className="ghost" onClick={() => openCreate("litters")}>Create litter</button>}>
      {data.litters.length ? <div className="table-list">{data.litters.map((litter) => <button key={litter.id} onClick={() => openEdit("litters", litter as unknown as Record<string, unknown>)}><span><b>{litter.name}</b><small>{shortDate(litter.birth_date || litter.due_date)} / {data.puppies.filter((puppy) => puppy.litter_id === litter.id).length} puppies</small></span><Status tone={litter.status === "Active" ? "good" : "neutral"}>{litter.status}</Status></button>)}</div> : <Empty title="No litters" text="Create planned and active litters with due dates, birth dates, and pairings." action="Create litter" onAction={() => openCreate("litters")} />}
    </Section>
  </div>;
}

function FamiliesView({ data, openCreate, openEdit, remove }: ViewProps) {
  return <div className="grid two-one">
    <Section eyebrow="Buyer Pipeline" title="Families" action={<button className="ghost" onClick={() => openCreate("buyers")}>Add buyer</button>}>
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

function VaultView({ data }: { data: DataSet }) {
  const buyerDocs = data.buyer_documents.map((doc) => ({ ...doc, href: `/api/documents/${doc.id}`, owner: data.buyers.find((buyer) => buyer.id === doc.buyer_id) ? fullName(data.buyers.find((buyer) => buyer.id === doc.buyer_id)!) : `Buyer #${doc.buyer_id}` }));
  const dogDocs = data.dog_documents.map((doc) => ({ ...doc, href: `/api/dog-documents/${doc.id}`, owner: data.dogs.find((dog) => dog.id === doc.dog_id)?.name ?? `Dog #${doc.dog_id}` }));
  const docs = [...buyerDocs, ...dogDocs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <div className="grid">
    <Section eyebrow="Document Vault" title="Stored files">
      {docs.length ? <div className="vault-list">{docs.map((doc) => <a key={`${doc.href}-${doc.id}`} href={doc.href} target="_blank" rel="noreferrer"><span><b>{doc.title}</b><small>{doc.owner} / {doc.document_type}</small></span><em>{fileSize(doc.size_bytes)}</em></a>)}</div> : <Empty title="No documents stored" text="Uploaded buyer and dog documents will appear here once Supabase Storage is configured." action="Open breeding" onAction={() => undefined} />}
    </Section>
  </div>;
}

type ViewProps = { data: DataSet; openCreate: (resource: Resource, preset?: Record<string, unknown>) => void; openEdit: (resource: Resource, record: Record<string, unknown>) => void; remove: (resource: Resource, id: number, label: string) => void };

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
    {resource === "dogs" && <><Field label="Name" name="name" record={record} preset={preset} required /><Field label="Registered name" name="registered_name" record={record} preset={preset} /><Field label="Sex" name="sex" record={record} preset={preset} required /><Field label="Role" name="role" record={record} preset={preset} required /><Field label="Birth date" name="date_of_birth" type="date" record={record} preset={preset} /><Field label="Color" name="color" record={record} preset={preset} /><Field label="Weight" name="weight" type="number" record={record} preset={preset} /><Field label="Status" name="status" record={record} preset={preset} /><Field label="Purchase price" name="purchase_price" type="number" record={record} preset={preset} defaultValue={dollarDefault(record, "purchase_price", "purchase_price_cents", preset)} /><Field label="Next heat" name="next_heat_date" type="date" record={record} preset={preset} /><TextArea label="Health testing" name="health_testing" record={record} preset={preset} /><TextArea label="Notes" name="notes" record={record} preset={preset} /></>}
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

export default function Home() {
  const [view, setView] = useState<View>("Command");
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
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
      setError(loadError instanceof Error ? loadError.message : "Unable to load records.");
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
      setError(saveError instanceof Error ? saveError.message : "Unable to save record.");
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
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [data, search]);

  const activeViewProps = { data, openCreate, openEdit, remove };
  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => setView("Command")}><span>SV</span><b>Chihuahua OS</b><small>Supabase command center</small></button><nav>{views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><i>{item.code}</i><span>{item.label}</span></button>)}</nav><div className="system-card"><span className={error ? "offline" : ""} /><b>{error ? "Action needed" : "Supabase online"}</b><small>{analytics.readiness}% readiness / {analytics.docs} vault files</small></div></aside>
    <main><header className="topbar"><div className="search"><span>SEARCH</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Dogs, buyers, payments, events..." />{searchResults.length > 0 && <div className="search-menu">{searchResults.map((item) => <button key={`${item.view}-${item.label}`} onClick={() => { setView(item.view); setSearch(""); }}><b>{item.label}</b><small>{item.detail}</small></button>)}</div>}</div><div className="top-actions"><span>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date())}</span><button onClick={() => openCreate("transactions", { type: "Payment" })}>Log payment</button><button onClick={() => openCreate(view === "Calendar" ? "events" : view === "Families" ? "buyers" : view === "Breeding" ? "dogs" : "events")}>Quick add</button></div></header>
      <div className="content"><div className="view-title"><span>{view.toUpperCase()}</span><h1>{view === "Command" ? "Operating command" : view}</h1><p>{view === "Command" ? "High-tech control surface for every record in the program." : "Manage records directly against Supabase."}</p></div>{error && <div className="error-banner"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}{loading ? <div className="loading"><span />Loading Supabase records...</div> : <>{view === "Command" && <CommandView data={data} openCreate={openCreate} setView={setView} />}{view === "Breeding" && <BreedingView {...activeViewProps} />}{view === "Families" && <FamiliesView {...activeViewProps} />}{view === "Finance" && <FinanceView {...activeViewProps} />}{view === "Calendar" && <CalendarView {...activeViewProps} />}{view === "Vault" && <VaultView data={data} />}</>}</div>
    </main>
    {modal && <RecordModal modal={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={submitRecord} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
