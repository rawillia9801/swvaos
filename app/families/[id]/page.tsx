"use client";

import Link from "next/link";
import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Dog, ExternalLink, FileText, Mail, MapPin, MessageSquareText, MonitorSmartphone, ReceiptText, ShieldCheck, Trash2, UserRound, WalletCards } from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null; created_at: string; updated_at: string };
type Puppy = { id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; current_weight: number | null; status: string; price_cents: number | null };
type PaymentPlan = { id: number; buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string };
type Transaction = { id: number; buyer_id: number | null; puppy_id: number | null; payment_plan_id: number | null; type: string; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null };
type BuyerDocument = { id: number; buyer_id: number; payment_plan_id: number | null; puppy_ids: number[]; document_type: string; title: string; file_name: string; size_bytes: number; created_at: string };
type PuppyUpdate = { id: number; puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean; created_at: string };
type Communication = { id: number; title: string; event_type: string; event_date: string; event_time: string | null; related_type: string | null; related_id: number | null; location: string | null; status: string; notes: string | null; created_at: string };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; buyer_documents: BuyerDocument[]; updates: PuppyUpdate[]; events: Communication[] };
type Tab = "Overview" | "Application" | "Puppies" | "Payments" | "Communications" | "Documents" | "Updates" | "Portal Preview";

const tabs: Tab[] = ["Overview", "Application", "Puppies", "Payments", "Communications", "Documents", "Updates", "Portal Preview"];
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
  const [savingCommunication, setSavingCommunication] = useState(false);
  const [communicationError, setCommunicationError] = useState("");
  const [toast, setToast] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [portalDevice, setPortalDevice] = useState<"desktop" | "mobile">("desktop");
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState("");

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

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
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
    const communications = data.events.filter((event) => event.related_id === family.id && ["buyer", "family"].some((type) => (event.related_type || "").toLowerCase().includes(type)) && event.event_type.toLowerCase().startsWith("communication")).sort((left, right) => `${right.event_date}${right.event_time || ""}${right.id}`.localeCompare(`${left.event_date}${left.event_time || ""}${left.id}`));
    const paid = transactions.filter((transaction) => ["Paid", "Completed", "Cleared"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    const outstanding = transactions.filter((transaction) => !["Paid", "Completed", "Cleared", "Cancelled", "Voided"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
    return { puppies, plans, transactions, documents, updates, communications, paid, outstanding };
  }, [data, family]);

  async function addCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family) return;
    const formElement = event.currentTarget;
    setSavingCommunication(true);
    setCommunicationError("");
    const form = new FormData(formElement);
    const channel = String(form.get("channel") || "Other");
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: "events",
        data: {
          title: String(form.get("subject") || `${channel} communication`),
          event_type: `Communication: ${channel}`,
          event_date: String(form.get("event_date") || new Date().toISOString().slice(0, 10)),
          event_time: String(form.get("event_time") || "") || null,
          related_type: "Buyer",
          related_id: family.id,
          location: String(form.get("direction") || "Outgoing"),
          status: String(form.get("outcome") || "Completed"),
          notes: String(form.get("notes") || "") || null,
        },
      }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setCommunicationError(payload.error || "Unable to save this communication.");
      setSavingCommunication(false);
      return;
    }
    formElement.reset();
    setToast("Communication saved to this family");
    await load();
    setSavingCommunication(false);
  }

  async function removeCommunication(communication: Communication) {
    if (!window.confirm(`Delete "${communication.title}" from this family's communication history?`)) return;
    const response = await fetch(`/api/data?resource=events&id=${communication.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setCommunicationError(payload.error || "Unable to delete this communication.");
      return;
    }
    setToast("Communication deleted");
    await load();
  }

  async function loadPortalPreview() {
    if (!family) return;
    setPortalBusy(true); setPortalError("");
    try {
      const response = await fetch("/api/contracts/portal-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer_id: family.id }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to prepare this portal preview.");
      setPortalUrl(payload.portalUrl);
    } catch (failure) { setPortalError(failure instanceof Error ? failure.message : "Unable to prepare this portal preview."); }
    finally { setPortalBusy(false); }
  }

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
      .communication-form { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }
      .communication-form label { min-width: 0; display: grid; gap: 6px; color: #526f73; font-size: 11px; font-weight: 750; }
      .communication-form label.wide { grid-column: 1/-1; }
      .communication-form input, .communication-form select, .communication-form textarea { width: 100%; min-width: 0; min-height: 42px; padding: 9px 11px; border: 1px solid #bdd5d1; border-radius: 8px; background: #f6fbfa; color: #173b43; font: inherit; }
      .communication-form textarea { min-height: 110px; resize: vertical; }
      .communication-form footer { grid-column: 1/-1; display: flex; justify-content: flex-end; }
      .communication-form footer button { min-height: 42px; padding: 0 16px; border: 1px solid #087c88; border-radius: 8px; background: #087c88; color: white; font-weight: 800; cursor: pointer; }
      .communication-form footer button:disabled { opacity: .6; cursor: wait; }
      .communication-error { grid-column: 1/-1; padding: 11px 13px; border: 1px solid #e1a9a2; border-radius: 8px; background: #fff0ed; color: #963d35; }
      .communication-row { align-items: start; }
      .communication-copy { min-width: 0; }
      .communication-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
      .communication-meta i { padding: 4px 7px; border-radius: 999px; background: #e6f2f0; color: #3f686c; font-size: 10px; font-style: normal; font-weight: 750; }
      .communication-actions { display: flex; align-items: center; gap: 9px; }
      .communication-actions button { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #d8b0ac; border-radius: 7px; background: #fff2f0; color: #a34b42; cursor: pointer; }
      .record-toast { position: fixed; right: 22px; bottom: 22px; z-index: 50; padding: 13px 16px; border-radius: 9px; background: #143f42; color: white; box-shadow: 0 12px 36px rgba(0,0,0,.2); }
      .record-empty, .record-state { padding: 52px 20px; color: #617c7e; text-align: center; }
      .record-empty b, .record-state b { display: block; margin-bottom: 7px; color: #24464c; }
      .record-state a, .record-state button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 13px; border: 1px solid #aacbc7; border-radius: 8px; background: white; color: #1c646b; text-decoration: none; }
      .family-portal-console { display: grid; grid-template-columns: 290px minmax(0,1fr); gap: 18px; }
      .family-portal-tools { display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid #a5c6cf; border-radius: 12px; background: linear-gradient(160deg,#0a2635,#123d50); color: #dff5f8; }
      .family-portal-tools > span { color: #54dce9; font: 800 10px var(--font-geist-mono),monospace; letter-spacing: .12em; }
      .family-portal-tools h2 { margin: -5px 0 0; color: white; }
      .family-portal-tools p { margin: 0; color: #91b6bf; line-height: 1.55; }
      .family-portal-tools button, .family-portal-tools a { min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid #42bfd0; border-radius: 8px; background: #0c8096; color: white; font-weight: 800; text-decoration: none; cursor: pointer; }
      .family-portal-tools button:disabled { opacity: .55; cursor: wait; }
      .family-portal-security { display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding: 12px; border: 1px solid rgba(94,218,230,.22); border-radius: 9px; background: rgba(8,31,44,.52); }
      .family-portal-security small { display: block; margin-top: 4px; color: #86aab3; line-height: 1.45; }
      .family-portal-error { padding: 10px; border-radius: 8px; background: #572633; color: #ffd8df; }
      .family-portal-stage { overflow: hidden; min-width: 0; border: 1px solid #a5c6cf; border-radius: 12px; background: #092231; box-shadow: 0 20px 55px rgba(5,28,40,.18); }
      .family-portal-stage > header { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #214b5b; color: #99bdc6; }
      .family-portal-stage > header span { font: 700 11px var(--font-geist-mono),monospace; }
      .family-portal-stage nav { display: flex; gap: 5px; }
      .family-portal-stage nav button { min-height: 31px; padding: 0 10px; border: 1px solid #315c6b; border-radius: 6px; background: #103444; color: #95b8c1; cursor: pointer; }
      .family-portal-stage nav button.active { border-color: #4ed9e7; background: #0b788e; color: white; }
      .family-portal-device { min-height: 620px; display: grid; place-items: center; padding: 18px; background: radial-gradient(circle at 50% 0,rgba(41,145,170,.2),transparent 50%),#061b28; }
      .family-portal-device iframe { width: 100%; height: 680px; border: 0; border-radius: 7px; background: white; }
      .family-portal-device.mobile iframe { width: min(390px,100%); border: 8px solid #06131c; border-radius: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.36); }
      .family-portal-placeholder { max-width: 420px; color: #7fa3ad; text-align: center; }
      .family-portal-placeholder b { display: block; margin-top: 12px; color: #d9eff3; font-size: 17px; }
      .family-portal-placeholder p { line-height: 1.55; }
      @media (max-width: 900px) { .communication-form { grid-template-columns: repeat(2,minmax(0,1fr)); } }
      @media (max-width: 900px) { .family-portal-console { grid-template-columns: 1fr; } }
      @media (max-width: 760px) { .record-page { padding: 14px; } .record-hero { grid-template-columns: auto 1fr; } .record-status { grid-column: 1/-1; width: fit-content; } .record-grid, .record-facts, .communication-form { grid-template-columns: 1fr; } .record-stats { grid-template-columns: repeat(2,1fr); } .record-content { padding: 14px; } .communication-form label.wide, .communication-form footer { grid-column: auto; } .family-portal-device { padding: 8px; min-height: 560px; } .family-portal-device iframe { height: 600px; } }
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
        {tab === "Communications" && <div className="record-grid"><section className="record-panel wide"><header><MessageSquareText size={18} /><h2>Log a communication</h2></header><form className="communication-form" onSubmit={addCommunication}><label><span>Method</span><select name="channel" required defaultValue="Text message"><option>Text message</option><option>Email</option><option>Phone call</option><option>In person</option><option>Word of mouth</option><option>Client portal</option><option>Social media</option><option>Other</option></select></label><label><span>Direction</span><select name="direction" required defaultValue="Outgoing"><option>Outgoing</option><option>Incoming</option><option>Internal note</option></select></label><label><span>Date</span><input name="event_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label><span>Time</span><input name="event_time" type="time" /></label><label className="wide"><span>Subject or short summary</span><input name="subject" required placeholder="What was discussed?" /></label><label><span>Outcome</span><select name="outcome" required defaultValue="Completed"><option>Completed</option><option>Waiting for reply</option><option>Follow-up needed</option><option>No response</option><option>Resolved</option></select></label><label className="wide"><span>Notes</span><textarea name="notes" placeholder="Record the conversation, commitments, questions, follow-up steps, or other relevant details." /></label>{communicationError && <div className="communication-error">{communicationError}</div>}<footer><button disabled={savingCommunication}>{savingCommunication ? "Saving..." : "Save communication"}</button></footer></form></section><section className="record-panel wide"><header><MessageSquareText size={18} /><h2>Communication history</h2></header>{profile.communications.length ? <div className="record-list">{profile.communications.map((communication) => <article className="record-row communication-row" key={communication.id}><div className="communication-copy"><div className="communication-meta"><i>{communication.event_type.replace(/^Communication:\s*/i, "")}</i><i>{communication.location || "Direction not recorded"}</i><i>{communication.status}</i></div><b>{communication.title}</b><small>{date(communication.event_date)}{communication.event_time ? ` at ${new Date(`2000-01-01T${communication.event_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</small>{communication.notes && <p className="record-notes">{communication.notes}</p>}</div><div className="communication-actions"><button onClick={() => void removeCommunication(communication)} aria-label={`Delete ${communication.title}`} title="Delete communication"><Trash2 size={15} /></button></div></article>)}</div> : <Empty title="No communications recorded" text="Text messages, emails, phone calls, in-person conversations, word-of-mouth notes, and other contact will appear here." />}</section></div>}
        {tab === "Documents" && (profile.documents.length ? <div className="record-list">{profile.documents.map((document) => <a className="record-row" href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer" key={document.id}><span><b>{document.title}</b><small>{document.document_type} / {fileSize(document.size_bytes)} / added {date(document.created_at)}</small></span><ExternalLink size={17} /></a>)}</div> : <Empty title="No documents" text="Contracts, health guarantees, payment agreements, and uploaded records will appear here." />)}
        {tab === "Updates" && (profile.updates.length ? <div className="record-list">{profile.updates.map((update) => <article className="record-row" key={update.id}><span><b>{update.title}</b><small>{profile.puppies.find((puppy) => puppy.id === update.puppy_id)?.name || `Puppy #${update.puppy_id}`} / Week {update.week_number ?? "—"} / {update.published ? "Published" : "Draft"}</small><p className="record-notes">{update.body}</p></span><strong>{update.weight ? `${update.weight} lb` : date(update.created_at)}</strong></article>)}</div> : <Empty title="No family updates" text="Updates connected to this family's puppies will appear here." />)}
        {tab === "Portal Preview" && <div className="family-portal-console"><aside className="family-portal-tools"><span>CLIENT EXPERIENCE</span><h2>{fullName(family)}’s portal</h2><p>Inspect the same updates, documents, payments, schedule, and support tools this family receives.</p><div className="family-portal-security"><ShieldCheck size={19} /><span><b>Email sign-in</b><small>{family.email ? `Access is tied to ${family.email}.` : "Add an email address before customer sign-in can be used."}</small></span></div><button onClick={() => void loadPortalPreview()} disabled={portalBusy}><MonitorSmartphone size={17} /> {portalBusy ? "Loading…" : "Load customer view"}</button>{portalUrl && <a href={portalUrl} target="_blank" rel="noreferrer">Open full screen <ExternalLink size={15} /></a>}{portalError && <p className="family-portal-error">{portalError}</p>}</aside><section className="family-portal-stage"><header><span>SWVAOS PORTAL SIMULATOR</span><nav><button className={portalDevice === "desktop" ? "active" : ""} onClick={() => setPortalDevice("desktop")}>Desktop</button><button className={portalDevice === "mobile" ? "active" : ""} onClick={() => setPortalDevice("mobile")}>Mobile</button></nav></header><div className={`family-portal-device ${portalDevice}`}>{portalUrl ? <iframe src={portalUrl} title={`Puppy Portal preview for ${fullName(family)}`} /> : <div className="family-portal-placeholder"><MonitorSmartphone size={38} /><b>Customer view not loaded</b><p>Load the portal to preview this family’s complete experience.</p></div>}</div></section></div>}
      </div>
    </div>
    {toast && <div className="record-toast">{toast}</div>}
  </main>;
}
