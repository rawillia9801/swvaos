"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Dog, ExternalLink, FileText, HeartPulse, ReceiptText, Scale, UserRound, WalletCards } from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; application_status: string };
type Litter = { id: number; name: string; dam_id: number | null; sire_id: number | null; birth_date: string | null; status: string };
type Puppy = { id: number; litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null; notes: string | null; created_at: string; updated_at: string };
type PaymentPlan = { id: number; buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type Transaction = { id: number; buyer_id: number | null; puppy_id: number | null; payment_plan_id: number | null; type: string; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null };
type BuyerDocument = { id: number; buyer_id: number; payment_plan_id: number | null; puppy_ids: number[]; document_type: string; title: string; size_bytes: number; created_at: string };
type PuppyUpdate = { id: number; puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean; created_at: string };
type KennelEvent = { id: number; title: string; event_type: string; event_date: string; event_time: string | null; related_type: string | null; related_id: number | null; location: string | null; status: string; notes: string | null };
type DataSet = { buyers: Buyer[]; litters: Litter[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; buyer_documents: BuyerDocument[]; updates: PuppyUpdate[]; events: KennelEvent[] };
type Tab = "Overview" | "Growth & Care" | "Family" | "Payments" | "Documents" | "Updates";

const tabs: Tab[] = ["Overview", "Growth & Care", "Family", "Payments", "Documents", "Updates"];
const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const familyName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Family #${buyer.id}`;
const fileSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="record-empty"><b>{title}</b><p>{text}</p></div>;
}

export default function PuppyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const puppyId = Number(id);
  const [data, setData] = useState<DataSet | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this puppy.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this puppy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const puppy = data?.puppies.find((candidate) => candidate.id === puppyId) ?? null;
  useEffect(() => { if (puppy) document.title = `${puppy.name} | SWVAOS`; }, [puppy]);

  const profile = useMemo(() => {
    if (!data || !puppy) return null;
    const buyer = puppy.buyer_id ? data.buyers.find((candidate) => candidate.id === puppy.buyer_id) ?? null : null;
    const litter = data.litters.find((candidate) => candidate.id === puppy.litter_id) ?? null;
    const plans = data.payment_plans.filter((plan) => plan.puppy_ids?.includes(puppy.id) || (buyer && plan.buyer_id === buyer.id));
    const planIds = new Set(plans.map((plan) => plan.id));
    const transactions = data.transactions.filter((transaction) => transaction.puppy_id === puppy.id || (transaction.payment_plan_id ? planIds.has(transaction.payment_plan_id) : false)).sort((left, right) => String(right.paid_date || right.due_date || "").localeCompare(String(left.paid_date || left.due_date || "")));
    const documents = data.buyer_documents.filter((document) => document.puppy_ids?.includes(puppy.id)).sort((left, right) => right.id - left.id);
    const updates = data.updates.filter((update) => update.puppy_id === puppy.id).sort((left, right) => right.id - left.id);
    const events = data.events.filter((event) => event.related_id === puppy.id && (event.related_type || "").toLowerCase().includes("puppy")).sort((left, right) => eventDate(left).localeCompare(eventDate(right)));
    const paid = transactions.filter((transaction) => ["Paid", "Completed", "Cleared"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const balance = Math.max(0, (puppy.price_cents ?? 0) - paid);
    return { buyer, litter, plans, transactions, documents, updates, events, paid, balance };
  }, [data, puppy]);

  if (loading) return <main className="record-state">Loading puppy profile...</main>;
  if (error && !data) return <main className="record-state"><b>Unable to load this puppy</b><p>{error}</p><button onClick={() => void load()}>Try again</button></main>;
  if (!puppy || !profile) return <main className="record-state"><b>Puppy not found</b><p>This puppy record is not available.</p><Link href="/?view=Families"><ArrowLeft size={16} /> Return to Puppies</Link></main>;

  return <main className="record-page puppy-record-page">
    <style jsx global>{`
      body { margin: 0; background: #eef7f5; color: #102f38; }
      * { box-sizing: border-box; }
      button, a { font: inherit; }
      .record-page { min-height: 100vh; padding: 26px; font-family: var(--font-geist-sans), Arial, sans-serif; background-image: linear-gradient(rgba(42,116,113,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(42,116,113,.045) 1px, transparent 1px); background-size: 32px 32px; }
      .record-shell { width: min(1240px, 100%); margin: 0 auto; }
      .record-back { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 18px; color: #28656d; font-weight: 750; text-decoration: none; }
      .record-hero { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 18px; align-items: center; padding: 24px; border: 1px solid #bfd8d4; border-radius: 15px 15px 0 0; background: rgba(255,255,255,.95); box-shadow: 0 18px 50px rgba(26,74,73,.08); }
      .record-avatar { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 14px; background: #d9f1ed; color: #087c88; }
      .record-hero small { color: #5e7b7d; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .record-hero h1 { margin: 4px 0 5px; font-size: clamp(28px,4vw,42px); letter-spacing: -.035em; }
      .record-hero p { margin: 0; color: #59767a; }
      .record-status { padding: 7px 11px; border: 1px solid #96d3c2; border-radius: 999px; background: #e7f8f1; color: #137357; font-size: 11px; font-weight: 850; text-transform: uppercase; }
      .record-tabs { position: sticky; top: 0; z-index: 10; display: flex; gap: 3px; padding: 0 14px; overflow-x: auto; border: 1px solid #bfd8d4; border-top: 0; background: rgba(247,252,251,.97); backdrop-filter: blur(14px); }
      .record-tabs button { min-height: 54px; padding: 0 16px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: #5b7478; font-weight: 750; cursor: pointer; white-space: nowrap; }
      .record-tabs button.active { border-bottom-color: #008fa3; color: #075e69; }
      .record-content { min-height: 430px; padding: 22px; border: 1px solid #bfd8d4; border-top: 0; border-radius: 0 0 15px 15px; background: rgba(255,255,255,.92); }
      .record-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
      .record-panel { padding: 19px; border: 1px solid #d1e1df; border-radius: 12px; background: #fbfdfd; }
      .record-panel.wide { grid-column: 1/-1; }
      .record-panel > header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: #137884; }
      .record-panel h2 { margin: 0; color: #173b43; font-size: 18px; }
      .record-facts { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
      .record-facts span { min-width: 0; padding: 12px; border-radius: 9px; background: #f0f7f6; }
      .record-facts small, .record-stat small { display: block; margin-bottom: 4px; color: #6c8587; font-size: 11px; font-weight: 750; text-transform: uppercase; }
      .record-facts b { display: block; overflow-wrap: anywhere; }
      .record-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; }
      .record-stat { padding: 14px; border: 1px solid #d3e4e1; border-radius: 10px; background: white; }
      .record-stat b { font-size: 21px; }
      .record-list { display: grid; gap: 9px; }
      .record-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; align-items: center; padding: 14px; border: 1px solid #d4e3e1; border-radius: 10px; background: #f8fbfa; color: inherit; text-decoration: none; }
      .record-row:hover { border-color: #83c2bb; background: #f1faf8; }
      .record-row b, .record-row small { display: block; }
      .record-row small { margin-top: 4px; color: #6a8184; }
      .record-row strong { color: #176c60; }
      .record-notes { margin: 8px 0 0; color: #49686c; line-height: 1.65; white-space: pre-wrap; }
      .record-empty, .record-state { padding: 52px 20px; color: #617c7e; text-align: center; }
      .record-empty b, .record-state b { display: block; margin-bottom: 7px; color: #24464c; }
      .record-state a, .record-state button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 13px; border: 1px solid #aacbc7; border-radius: 8px; background: white; color: #1c646b; text-decoration: none; }
      @media (max-width: 760px) { .record-page { padding: 14px; } .record-hero { grid-template-columns: auto 1fr; } .record-status { grid-column: 1/-1; width: fit-content; } .record-grid, .record-facts { grid-template-columns: 1fr; } .record-stats { grid-template-columns: repeat(2,1fr); } .record-content { padding: 14px; } }
    `}</style>
    <div className="record-shell">
      <Link className="record-back" href="/?view=Families"><ArrowLeft size={16} /> Back to Families and placement</Link>
      <header className="record-hero"><div className="record-avatar"><Dog size={31} /></div><div><small>Puppy profile #{puppy.id}</small><h1>{puppy.name}</h1><p>{[puppy.sex, puppy.color, profile.litter?.name].filter(Boolean).join(" / ") || "Puppy record"}</p></div><span className="record-status">{puppy.status}</span></header>
      <nav className="record-tabs" aria-label="Puppy profile sections">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="record-content">
        {tab === "Overview" && <div className="record-grid"><section className="record-panel wide"><div className="record-stats"><div className="record-stat"><small>Price</small><b>{money(puppy.price_cents)}</b></div><div className="record-stat"><small>Paid</small><b>{money(profile.paid)}</b></div><div className="record-stat"><small>Est. balance</small><b>{money(profile.balance)}</b></div><div className="record-stat"><small>Updates</small><b>{profile.updates.length}</b></div></div></section><section className="record-panel"><header><Dog size={18} /><h2>Identity</h2></header><div className="record-facts"><span><small>Sex</small><b>{puppy.sex || "Not recorded"}</b></span><span><small>Color</small><b>{puppy.color || "Not recorded"}</b></span><span><small>Date of birth</small><b>{date(puppy.birth_date)}</b></span><span><small>Status</small><b>{puppy.status}</b></span></div></section><section className="record-panel"><header><CalendarDays size={18} /><h2>Placement</h2></header><div className="record-facts"><span><small>Litter</small><b>{profile.litter?.name || "Not connected"}</b></span><span><small>Family</small><b>{profile.buyer ? familyName(profile.buyer) : "Not assigned"}</b></span><span><small>Price</small><b>{money(puppy.price_cents)}</b></span><span><small>Last updated</small><b>{date(puppy.updated_at)}</b></span></div></section><section className="record-panel wide"><header><FileText size={18} /><h2>Notes</h2></header><p className="record-notes">{puppy.notes || "No notes have been added for this puppy."}</p></section></div>}
        {tab === "Growth & Care" && <div className="record-grid"><section className="record-panel"><header><Scale size={18} /><h2>Growth</h2></header><div className="record-facts"><span><small>Birth weight</small><b>{puppy.birth_weight ? `${puppy.birth_weight} lb` : "Not recorded"}</b></span><span><small>Current weight</small><b>{puppy.current_weight ? `${puppy.current_weight} lb` : "Not recorded"}</b></span><span><small>Date of birth</small><b>{date(puppy.birth_date)}</b></span><span><small>Recorded updates</small><b>{profile.updates.length}</b></span></div></section><section className="record-panel"><header><HeartPulse size={18} /><h2>Care schedule</h2></header>{profile.events.length ? <div className="record-list">{profile.events.map((event) => <div className="record-row" key={event.id}><span><b>{event.title}</b><small>{event.event_type} / {date(event.event_date)} {event.event_time || ""} / {event.location || "No location"}</small><p className="record-notes">{event.notes || ""}</p></span><strong>{event.status}</strong></div>)}</div> : <Empty title="No care events" text="Puppy-related appointments and care tasks will appear here." />}</section></div>}
        {tab === "Family" && (profile.buyer ? <div className="record-grid"><section className="record-panel wide"><header><UserRound size={18} /><h2>{familyName(profile.buyer)}</h2></header><div className="record-facts"><span><small>Email</small><b>{profile.buyer.email || "Not recorded"}</b></span><span><small>Phone</small><b>{profile.buyer.phone || "Not recorded"}</b></span><span><small>Location</small><b>{[profile.buyer.city, profile.buyer.state].filter(Boolean).join(", ") || "Not recorded"}</b></span><span><small>Application status</small><b>{profile.buyer.application_status}</b></span></div><Link className="record-row" href={`/families/${profile.buyer.id}`}><span><b>Open complete family profile</b><small>Application, payments, documents, puppies, and updates</small></span><ExternalLink size={17} /></Link></section></div> : <Empty title="No family assigned" text="Once this puppy is connected to a buyer, the complete family profile will appear here." />)}
        {tab === "Payments" && <div className="record-grid"><section className="record-panel wide"><header><WalletCards size={18} /><h2>Payment plans</h2></header>{profile.plans.length ? <div className="record-list">{profile.plans.map((plan) => <div className="record-row" key={plan.id}><span><b>{plan.name}</b><small>{plan.term_count} × {money(plan.payment_amount_cents)} {plan.frequency.toLowerCase()} / next due {date(plan.next_due_date)}</small></span><strong>{plan.status} · {money(plan.total_amount_cents)}</strong></div>)}</div> : <Empty title="No connected payment plans" text="Plans assigned to this puppy or its family will appear here." />}</section><section className="record-panel wide"><header><ReceiptText size={18} /><h2>Transaction ledger</h2></header>{profile.transactions.length ? <div className="record-list">{profile.transactions.map((transaction) => <div className="record-row" key={transaction.id}><span><b>{transaction.description}</b><small>{[transaction.type, transaction.method, transaction.status, date(transaction.paid_date || transaction.due_date)].filter(Boolean).join(" / ")}</small></span><strong>{money(transaction.amount_cents)}</strong></div>)}</div> : <Empty title="No connected transactions" text="Payments, deposits, charges, and scheduled amounts will appear here." />}</section></div>}
        {tab === "Documents" && (profile.documents.length ? <div className="record-list">{profile.documents.map((document) => <a className="record-row" href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer" key={document.id}><span><b>{document.title}</b><small>{document.document_type} / {fileSize(document.size_bytes)} / added {date(document.created_at)}</small></span><ExternalLink size={17} /></a>)}</div> : <Empty title="No puppy documents" text="Contracts, health guarantees, payment agreements, and uploaded records linked to this puppy will appear here." />)}
        {tab === "Updates" && (profile.updates.length ? <div className="record-list">{profile.updates.map((update) => <article className="record-row" key={update.id}><span><b>{update.title}</b><small>Week {update.week_number ?? "—"} / {update.published ? "Published" : "Draft"} / {date(update.created_at)}</small><p className="record-notes">{update.body}</p></span><strong>{update.weight ? `${update.weight} lb` : ""}</strong></article>)}</div> : <Empty title="No puppy updates" text="Growth notes, milestones, weights, and family-facing updates will appear here." />)}
      </div>
    </div>
  </main>;
}

function eventDate(event: KennelEvent) {
  return `${event.event_date || ""}${event.event_time || ""}`;
}
