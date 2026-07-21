"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Dog, ExternalLink, FileText, Mail, MapPin, Phone, ReceiptText, UserRound, WalletCards } from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null; created_at: string; updated_at: string };
type Puppy = { id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; current_weight: number | null; status: string; price_cents: number | null };
type PaymentPlan = { id: number; buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string };
type Transaction = { id: number; buyer_id: number | null; puppy_id: number | null; payment_plan_id: number | null; type: string; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null };
type BuyerDocument = { id: number; buyer_id: number; payment_plan_id: number | null; puppy_ids: number[]; document_type: string; title: string; file_name: string; size_bytes: number; created_at: string };
type PuppyUpdate = { id: number; puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean; created_at: string };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; buyer_documents: BuyerDocument[]; updates: PuppyUpdate[] };
type Tab = "Overview" | "Application" | "Puppies" | "Payments" | "Documents" | "Updates";

const tabs: Tab[] = ["Overview", "Application", "Puppies", "Payments", "Documents", "Updates"];
const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const fullName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Family #${buyer.id}`;
const fileSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="record-empty"><b>{title}</b><p>{text}</p></div>;
}

export default function FamilyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const familyId = Number(id);
  const [data, setData] = useState<DataSet | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this family.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this family.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const family = data?.buyers.find((buyer) => buyer.id === familyId) ?? null;
  useEffect(() => { if (family) document.title = `${fullName(family)} | SWVAOS`; }, [family]);

  const profile = useMemo(() => {
    if (!data || !family) return null;
    const puppies = data.puppies.filter((puppy) => puppy.buyer_id === family.id);
    const puppyIds = new Set(puppies.map((puppy) => puppy.id));
    const plans = data.payment_plans.filter((plan) => plan.buyer_id === family.id);
    const transactions = data.transactions.filter((transaction) => transaction.buyer_id === family.id || (transaction.puppy_id ? puppyIds.has(transaction.puppy_id) : false)).sort((left, right) => String(right.paid_date || right.due_date || "").localeCompare(String(left.paid_date || left.due_date || "")));
    const documents = data.buyer_documents.filter((document) => document.buyer_id === family.id).sort((left, right) => right.id - left.id);
    const updates = data.updates.filter((update) => puppyIds.has(update.puppy_id)).sort((left, right) => right.id - left.id);
    const paid = transactions.filter((transaction) => ["Paid", "Completed", "Cleared"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const outstanding = transactions.filter((transaction) => !["Paid", "Completed", "Cleared", "Cancelled", "Voided"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    return { puppies, plans, transactions, documents, updates, paid, outstanding };
  }, [data, family]);

  if (loading) return <main className="record-state">Loading family profile...</main>;
  if (error && !data) return <main className="record-state"><b>Unable to load this family</b><p>{error}</p><button onClick={() => void load()}>Try again</button></main>;
  if (!family || !profile) return <main className="record-state"><b>Family not found</b><p>This family record is not available.</p><Link href="/?view=Families"><ArrowLeft size={16} /> Return to Families</Link></main>;

  const location = [family.city, family.state, family.postal_code].filter(Boolean).join(", ") || "Not recorded";
  return <main className="record-page">
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
      .record-notes { margin: 0; color: #49686c; line-height: 1.65; white-space: pre-wrap; }
      .record-empty, .record-state { padding: 52px 20px; color: #617c7e; text-align: center; }
      .record-empty b, .record-state b { display: block; margin-bottom: 7px; color: #24464c; }
      .record-state a, .record-state button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 13px; border: 1px solid #aacbc7; border-radius: 8px; background: white; color: #1c646b; text-decoration: none; }
      @media (max-width: 760px) { .record-page { padding: 14px; } .record-hero { grid-template-columns: auto 1fr; } .record-status { grid-column: 1/-1; width: fit-content; } .record-grid, .record-facts { grid-template-columns: 1fr; } .record-stats { grid-template-columns: repeat(2,1fr); } .record-content { padding: 14px; } }
    `}</style>
    <div className="record-shell">
      <Link className="record-back" href="/?view=Families"><ArrowLeft size={16} /> Back to Families and placement</Link>
      <header className="record-hero"><div className="record-avatar"><UserRound size={30} /></div><div><small>Family profile #{family.id}</small><h1>{fullName(family)}</h1><p>{family.email || family.phone || location}</p></div><span className="record-status">{family.application_status || "Inquiry"}</span></header>
      <nav className="record-tabs" aria-label="Family profile sections">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <div className="record-content">
        {tab === "Overview" && <div className="record-grid"><section className="record-panel wide"><div className="record-stats"><div className="record-stat"><small>Assigned puppies</small><b>{profile.puppies.length}</b></div><div className="record-stat"><small>Payment plans</small><b>{profile.plans.length}</b></div><div className="record-stat"><small>Paid</small><b>{money(profile.paid)}</b></div><div className="record-stat"><small>Outstanding</small><b>{money(profile.outstanding)}</b></div></div></section><section className="record-panel"><header><Mail size={18} /><h2>Contact</h2></header><div className="record-facts"><span><small>Email</small><b>{family.email || "Not recorded"}</b></span><span><small>Phone</small><b>{family.phone || "Not recorded"}</b></span><span><small>Location</small><b>{location}</b></span><span><small>Added</small><b>{date(family.created_at)}</b></span></div></section><section className="record-panel"><header><Dog size={18} /><h2>Placement summary</h2></header><div className="record-facts"><span><small>Preferred sex</small><b>{family.preferred_sex || "Flexible"}</b></span><span><small>Preferred color</small><b>{family.preferred_color || "Flexible"}</b></span><span><small>Status</small><b>{family.application_status || "Inquiry"}</b></span><span><small>Last updated</small><b>{date(family.updated_at)}</b></span></div></section><section className="record-panel wide"><header><FileText size={18} /><h2>Family notes</h2></header><p className="record-notes">{family.notes || "No notes have been added for this family."}</p></section></div>}
        {tab === "Application" && <div className="record-grid"><section className="record-panel"><header><UserRound size={18} /><h2>Applicant information</h2></header><div className="record-facts"><span><small>Applicant</small><b>{fullName(family)}</b></span><span><small>Application status</small><b>{family.application_status || "Inquiry"}</b></span><span><small>Email</small><b>{family.email || "Not recorded"}</b></span><span><small>Phone</small><b>{family.phone || "Not recorded"}</b></span><span><small>Location</small><b>{location}</b></span><span><small>Submitted/created</small><b>{date(family.created_at)}</b></span></div></section><section className="record-panel"><header><MapPin size={18} /><h2>Preferences</h2></header><div className="record-facts"><span><small>Preferred sex</small><b>{family.preferred_sex || "Flexible"}</b></span><span><small>Preferred color</small><b>{family.preferred_color || "Flexible"}</b></span></div><p className="record-notes">{family.notes || "No additional application responses are stored on this record."}</p></section></div>}
        {tab === "Puppies" && (profile.puppies.length ? <div className="record-list">{profile.puppies.map((puppy) => <Link className="record-row" href={`/puppies/${puppy.id}`} key={puppy.id}><span><b>{puppy.name}</b><small>{[puppy.sex, puppy.color, date(puppy.birth_date), puppy.status].filter(Boolean).join(" / ")}</small></span><strong>{money(puppy.price_cents)}</strong></Link>)}</div> : <Empty title="No puppy assigned" text="Puppies assigned to this family will appear here." />)}
        {tab === "Payments" && <div className="record-grid"><section className="record-panel wide"><header><WalletCards size={18} /><h2>Payment plans</h2></header>{profile.plans.length ? <div className="record-list">{profile.plans.map((plan) => <div className="record-row" key={plan.id}><span><b>{plan.name}</b><small>{plan.term_count} × {money(plan.payment_amount_cents)} {plan.frequency.toLowerCase()} / next due {date(plan.next_due_date)}</small></span><strong>{plan.status} · {money(plan.total_amount_cents)}</strong></div>)}</div> : <Empty title="No payment plans" text="Payment plans connected to this family will appear here." />}</section><section className="record-panel wide"><header><ReceiptText size={18} /><h2>Transaction ledger</h2></header>{profile.transactions.length ? <div className="record-list">{profile.transactions.map((transaction) => <div className="record-row" key={transaction.id}><span><b>{transaction.description}</b><small>{[transaction.type, transaction.method, transaction.status, date(transaction.paid_date || transaction.due_date)].filter(Boolean).join(" / ")}</small></span><strong>{money(transaction.amount_cents)}</strong></div>)}</div> : <Empty title="No transactions" text="Payments, deposits, charges, and scheduled amounts will appear here." />}</section></div>}
        {tab === "Documents" && (profile.documents.length ? <div className="record-list">{profile.documents.map((document) => <a className="record-row" href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer" key={document.id}><span><b>{document.title}</b><small>{document.document_type} / {fileSize(document.size_bytes)} / added {date(document.created_at)}</small></span><ExternalLink size={17} /></a>)}</div> : <Empty title="No documents" text="Contracts, health guarantees, payment agreements, and uploaded records will appear here." />)}
        {tab === "Updates" && (profile.updates.length ? <div className="record-list">{profile.updates.map((update) => <article className="record-row" key={update.id}><span><b>{update.title}</b><small>{profile.puppies.find((puppy) => puppy.id === update.puppy_id)?.name || `Puppy #${update.puppy_id}`} / Week {update.week_number ?? "—"} / {update.published ? "Published" : "Draft"}</small><p className="record-notes">{update.body}</p></span><strong>{update.weight ? `${update.weight} lb` : date(update.created_at)}</strong></article>)}</div> : <Empty title="No family updates" text="Updates connected to this family's puppies will appear here." />)}
      </div>
    </div>
  </main>;
}
