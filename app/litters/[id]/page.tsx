"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Dog, ExternalLink, HeartPulse, ReceiptText, UserRound } from "lucide-react";

type BaseRecord = { id: number; created_at: string; updated_at: string };
type DogRecord = BaseRecord & { name: string; registered_name: string | null; sex: string; role: string; color: string | null; status: string };
type Litter = BaseRecord & { name: string; dam_id: number | null; sire_id: number | null; breeding_date: string | null; due_date: string | null; birth_date: string | null; expected_count: number | null; status: string; notes: string | null };
type Puppy = BaseRecord & { litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null };
type Buyer = BaseRecord & { first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; application_status: string };
type PaymentPlan = BaseRecord & { buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type Transaction = BaseRecord & { type: string; dog_id: number | null; buyer_id: number | null; litter_id: number | null; puppy_id: number | null; payment_plan_id: number | null; category: string | null; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null };
type KennelEvent = BaseRecord & { title: string; event_type: string; event_date: string; event_time: string | null; related_type: string | null; related_id: number | null; location: string | null; status: string; notes: string | null };
type DataSet = { dogs: DogRecord[]; litters: Litter[]; puppies: Puppy[]; buyers: Buyer[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; events: KennelEvent[] };
type Tab = "Overview" | "Parents" | "Puppies" | "Families" | "Payments" | "Care & Events";

const tabs: Tab[] = ["Overview", "Parents", "Puppies", "Families", "Payments", "Care & Events"];
const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const buyerName = (buyer: Buyer | undefined) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Family #${buyer.id}` : "No family assigned";

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="profile-empty"><b>{title}</b><span>{text}</span></div>;
}

export default function LitterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const litterId = Number(id);
  const [data, setData] = useState<DataSet | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this litter.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this litter.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const litter = data?.litters.find((candidate) => candidate.id === litterId) ?? null;
  useEffect(() => { if (litter) document.title = `${litter.name} | SWVAOS`; }, [litter]);

  const profile = useMemo(() => {
    if (!data || !litter) return null;
    const dam = data.dogs.find((dog) => dog.id === litter.dam_id);
    const sire = data.dogs.find((dog) => dog.id === litter.sire_id);
    const puppies = data.puppies.filter((puppy) => puppy.litter_id === litter.id);
    const puppyIds = new Set(puppies.map((puppy) => puppy.id));
    const buyerIds = new Set(puppies.map((puppy) => puppy.buyer_id).filter((buyerId): buyerId is number => Boolean(buyerId)));
    const buyers = data.buyers.filter((buyer) => buyerIds.has(buyer.id));
    const plans = data.payment_plans.filter((plan) => plan.puppy_ids?.some((puppyId) => puppyIds.has(puppyId)) || buyerIds.has(plan.buyer_id));
    const planIds = new Set(plans.map((plan) => plan.id));
    const transactions = data.transactions.filter((transaction) => transaction.litter_id === litter.id || (transaction.puppy_id ? puppyIds.has(transaction.puppy_id) : false) || (transaction.payment_plan_id ? planIds.has(transaction.payment_plan_id) : false) || (transaction.buyer_id ? buyerIds.has(transaction.buyer_id) : false)).sort((left, right) => String(right.paid_date || right.due_date || right.created_at).localeCompare(String(left.paid_date || left.due_date || left.created_at)));
    const payments = transactions.filter((transaction) => transaction.type === "Payment" || transaction.type === "Deposit");
    const costs = transactions.filter((transaction) => transaction.type === "Cost");
    const paid = payments.filter((payment) => payment.status === "Paid" || payment.status === "Complete").reduce((sum, payment) => sum + payment.amount_cents, 0);
    const outstanding = payments.filter((payment) => !["Paid", "Complete", "Cancelled", "Voided"].includes(payment.status)).reduce((sum, payment) => sum + payment.amount_cents, 0);
    const expenses = costs.reduce((sum, cost) => sum + cost.amount_cents, 0);
    const events = data.events.filter((event) => (event.related_id === litter.id && (event.related_type || "").toLowerCase().includes("litter")) || (event.related_id ? puppyIds.has(event.related_id) && (event.related_type || "").toLowerCase().includes("puppy") : false)).sort((left, right) => `${left.event_date}${left.event_time || ""}`.localeCompare(`${right.event_date}${right.event_time || ""}`));
    return { dam, sire, puppies, buyers, plans, transactions, payments, costs, paid, outstanding, expenses, net: paid - expenses, events };
  }, [data, litter]);

  if (loading) return <main className="profile-state"><span className="profile-spinner" />Loading litter profile...</main>;
  if (error && !data) return <main className="profile-state"><b>Unable to load this litter</b><p>{error}</p><button onClick={() => void load()}>Try again</button></main>;
  if (!litter || !profile) return <main className="profile-state"><b>Litter not found</b><p>This litter record is not available.</p><Link href="/"><ArrowLeft size={16} /> Return to SWVAOS</Link></main>;

  return <main className="dog-profile-page">
    <header className="profile-topbar"><Link href="/" className="profile-brand"><span><CalendarDays size={20} /></span><b>SWVAOS</b><small>Litter profile</small></Link><div className="profile-top-actions"><Link href="/?view=Breeding"><ArrowLeft size={16} /> Back to breeding</Link></div></header>
    <div className="profile-content">
      <section className="profile-identity"><div className="profile-monogram">{litter.name.slice(0, 1).toUpperCase()}</div><div className="profile-name"><span>Litter #{litter.id}</span><h1>{litter.name}</h1><p>{[profile.dam?.name, profile.sire?.name].filter(Boolean).join(" × ") || "Parents not fully connected"}</p><div><i className={litter.status === "Active" ? "active" : ""}>{litter.status}</i><i>{profile.puppies.length} puppies</i><i>{profile.buyers.length} families</i></div></div></section>
      <section className="profile-stat-grid" aria-label="Litter totals"><article><span>Collected</span><b>{money(profile.paid)}</b><small>Paid transactions</small></article><article><span>Outstanding</span><b>{money(profile.outstanding)}</b><small>Open transactions</small></article><article><span>Expenses</span><b>{money(profile.expenses)}</b><small>Linked costs</small></article><article><span>Net</span><b>{money(profile.net)}</b><small>Collected minus expenses</small></article><article><span>Puppies</span><b>{profile.puppies.length}</b><small>{profile.buyers.length} assigned families</small></article><article><span>Events</span><b>{profile.events.length}</b><small>Care and schedule records</small></article></section>
      <nav className="entity-tabs" aria-label="Litter profile sections">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="profile-layout entity-tab-content">
        {tab === "Overview" && <><section className="profile-section profile-wide"><header><span>Litter record</span><h2>Dates and status</h2></header><div className="profile-facts"><span><small>Breeding date</small><b>{date(litter.breeding_date)}</b></span><span><small>Due date</small><b>{date(litter.due_date)}</b></span><span><small>Birth date</small><b>{date(litter.birth_date)}</b></span><span><small>Expected count</small><b>{litter.expected_count ?? "Not recorded"}</b></span></div><div className="profile-notes"><span><b>Notes</b><p>{litter.notes || "No litter notes recorded."}</p></span><span><b>Placement</b><p>{profile.puppies.filter((puppy) => puppy.buyer_id).length} of {profile.puppies.length} puppies assigned.</p></span><span><b>Financial linkage</b><p>{profile.transactions.length} connected ledger entries across the litter, puppies, families, and payment plans.</p></span></div></section></>}
        {tab === "Parents" && <section className="profile-section profile-wide"><header><span>Breeding pair</span><h2>Dam and sire</h2></header><div className="profile-document-grid">{[profile.dam, profile.sire].map((dog, index) => dog ? <article key={dog.id}><div className="record-icon litter"><Dog size={18} /></div><div><b>{dog.name}</b><p>{index === 0 ? "Dam" : "Sire"} / {dog.status}</p><small>{[dog.registered_name, dog.sex, dog.color].filter(Boolean).join(" / ")}</small></div><div className="profile-row-actions"><Link href={`/dogs/${dog.id}`} title={`Open ${dog.name}`}><ExternalLink size={15} /></Link></div></article> : <article key={index}><div className="record-icon litter"><Dog size={18} /></div><div><b>{index === 0 ? "Dam not connected" : "Sire not connected"}</b><small>Edit the litter from Breeding to connect this parent.</small></div></article>)}</div></section>}
        {tab === "Puppies" && <section className="profile-section profile-wide"><header><span>Offspring</span><h2>Puppies in this litter</h2></header>{profile.puppies.length ? <div className="profile-document-grid">{profile.puppies.map((puppy) => <article key={puppy.id}><div className="record-icon litter"><Dog size={18} /></div><div><b>{puppy.name}</b><p>{[puppy.sex, puppy.color, puppy.status, money(puppy.price_cents)].filter(Boolean).join(" / ")}</p><small>{buyerName(data?.buyers.find((buyer) => buyer.id === puppy.buyer_id))}</small></div><div className="profile-row-actions"><Link href={`/puppies/${puppy.id}`} title={`Open ${puppy.name}`}><ExternalLink size={15} /></Link></div></article>)}</div> : <Empty title="No puppies" text="Puppies connected to this litter will appear here." />}</section>}
        {tab === "Families" && <section className="profile-section profile-wide"><header><span>Placement network</span><h2>Connected families</h2></header>{profile.buyers.length ? <div className="profile-document-grid">{profile.buyers.map((buyer) => { const assigned = profile.puppies.filter((puppy) => puppy.buyer_id === buyer.id); return <article key={buyer.id}><div className="record-icon"><UserRound size={18} /></div><div><b>{buyerName(buyer)}</b><p>{buyer.application_status}</p><small>{assigned.map((puppy) => puppy.name).join(", ")} / {[buyer.email, buyer.phone].filter(Boolean).join(" / ")}</small></div><div className="profile-row-actions"><Link href={`/families/${buyer.id}`} title={`Open ${buyerName(buyer)}`}><ExternalLink size={15} /></Link></div></article>; })}</div> : <Empty title="No assigned families" text="Families assigned to this litter's puppies will appear here." />}</section>}
        {tab === "Payments" && <><section className="profile-section profile-wide"><header><span>Linked sales ledger</span><h2>Payments and deposits</h2></header>{profile.payments.length ? <div className="profile-table"><div className="profile-table-head"><span>Payment</span><span>Family / puppy</span><span>Date</span><span>Status</span><span>Amount</span><span /></div>{profile.payments.map((payment) => { const puppy = data?.puppies.find((candidate) => candidate.id === payment.puppy_id); const buyer = data?.buyers.find((candidate) => candidate.id === payment.buyer_id) || data?.buyers.find((candidate) => candidate.id === puppy?.buyer_id); return <article key={payment.id}><span><b>{payment.description}</b><small>{[payment.type, payment.method].filter(Boolean).join(" / ")}</small></span><span>{[buyerName(buyer), puppy?.name].filter(Boolean).join(" / ")}</span><span>{date(payment.paid_date || payment.due_date)}</span><span>{payment.status}</span><strong>{money(payment.amount_cents)}</strong><div className="profile-row-actions">{puppy ? <Link href={`/puppies/${puppy.id}`}><ExternalLink size={15} /></Link> : buyer ? <Link href={`/families/${buyer.id}`}><ExternalLink size={15} /></Link> : null}</div></article>; })}</div> : <Empty title="No linked payments" text="Payments connected to this litter, its puppies, families, or payment plans will appear here." />}</section><section className="profile-section profile-wide"><header><span>Cost ledger</span><h2>Litter and puppy expenses</h2></header>{profile.costs.length ? <div className="profile-record-list">{profile.costs.map((cost) => <article key={cost.id}><div className="record-icon cost"><ReceiptText size={18} /></div><div><b>{cost.description}</b><p>{money(cost.amount_cents)}</p><small>{[cost.category, cost.method, cost.status, date(cost.paid_date || cost.due_date)].filter(Boolean).join(" / ")}</small></div></article>)}</div> : <Empty title="No linked expenses" text="Costs connected to this litter or its puppies will appear here." />}</section></>}
        {tab === "Care & Events" && <section className="profile-section profile-wide"><header><span>Operational timeline</span><h2>Care, milestones, and events</h2></header>{profile.events.length ? <div className="profile-record-list">{profile.events.map((event) => <article key={event.id}><div className="record-icon"><HeartPulse size={18} /></div><div><b>{event.title}</b><p>{event.event_type} / {event.status}</p><small>{date(event.event_date)} {event.event_time || ""} / {event.location || "No location"}</small></div></article>)}</div> : <Empty title="No connected events" text="Litter and puppy appointments, milestones, and care tasks will appear here." />}</section>}
      </div>
    </div>
  </main>;
}
