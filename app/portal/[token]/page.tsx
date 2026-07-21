"use client";

import Link from "next/link";
import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Clock3,
  Dog,
  Download,
  FileSignature,
  FileText,
  HeartPulse,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";

type Puppy = { id: number; name: string; sex: string; color: string; birthDate: string; birthWeight: number; currentWeight: number; status: string; priceCents: number; notes: string; litterName: string; damName: string; sireName: string };
type Update = { id: number; puppyId: number; title: string; body: string; weekNumber: number | null; weight: number | null; createdAt: string };
type Contract = { id: number; title: string; documentType: string; status: "pending" | "signed"; kind: string; puppyId: number; puppyName: string; createdAt: string; signedAt: string | null; signerName: string | null };
type Payment = { id: number; description: string; category: string; method: string; amountCents: number; status: string; dueDate: string; paidDate: string };
type PortalDocument = { id: number; title: string; documentType: string; fileName: string; createdAt: string; isContract: boolean; puppyIds: number[] };
type PortalEvent = { id: number; title: string; eventType: string; date: string; time: string; location: string; status: string; puppyName: string };
type PortalRequest = { id: number; kind: "support" | "transportation"; subject: string; status: string; requestedDate: string; createdAt: string };
type PortalData = {
  buyer: { id: number; name: string; email: string; phone: string; location: string; applicationStatus: string; preferredSex: string; preferredColor: string };
  puppies: Puppy[];
  updates: Update[];
  contracts: Contract[];
  documents: PortalDocument[];
  upcomingEvents: PortalEvent[];
  requests: PortalRequest[];
  support: { phone: string; email: string };
  payments: { saleTotalCents: number; paidCents: number; outstandingCents: number; items: Payment[] };
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const shortDate = (value: string) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`)) : "Not set";
const settled = (status: string) => ["Paid", "Complete"].includes(status);

function PortalRequestForm({ token, kind, onCreated }: { token: string; kind: "support" | "transportation"; onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const transportation = kind === "transportation";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          subject: form.get("subject"),
          message: form.get("message"),
          requestedDate: form.get("requested_date"),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send this request.");
      formElement.reset();
      setFeedback(transportation ? "Your transportation request is now with the team." : "Your message is now with the team.");
      await onCreated();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to send this request.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="portal-request-form" onSubmit={submit}>
    <label><span>{transportation ? "Request" : "Subject"}</span><select name="subject" defaultValue="" required><option value="" disabled>Choose one</option>{(transportation ? ["Schedule puppy pickup", "Ask about delivery", "Change transportation details", "Transportation question"] : ["Puppy update question", "Payment question", "Document question", "Care question", "Account help", "Other question"]).map((option) => <option key={option}>{option}</option>)}</select></label>
    {transportation && <label><span>Preferred date</span><input name="requested_date" type="date" /></label>}
    <label className="portal-request-message"><span>Details</span><textarea name="message" required minLength={5} placeholder={transportation ? "Tell us where you are traveling from and what arrangement you need." : "Tell us how we can help."} /></label>
    <button type="submit" disabled={busy}><Send size={15} /> {busy ? "Sending..." : "Send request"}</button>
    {feedback && <p role="status">{feedback}</p>}
  </form>;
}

export function PuppyPortalExperience({ token, accountMode = false }: { token: string; accountMode?: boolean }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this puppy portal.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this puppy portal.");
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const journey = useMemo(() => {
    if (!data) return [];
    const pickupScheduled = data.upcomingEvents.some((event) => /pickup|delivery|transport/i.test(`${event.eventType} ${event.title}`));
    return [
      { label: "Family account active", complete: Boolean(data.buyer.name) },
      { label: "Puppy assigned", complete: data.puppies.length > 0 },
      { label: "Agreements signed", complete: data.contracts.length > 0 && data.contracts.every((contract) => contract.status === "signed") },
      { label: "Deposit recorded", complete: data.payments.items.some((payment) => settled(payment.status) && /deposit|reservation/i.test(`${payment.category} ${payment.description}`)) },
      { label: "Pickup or delivery scheduled", complete: pickupScheduled },
    ];
  }, [data]);

  if (loading) return <main className="portal-state"><span className="portal-spinner" />Opening your puppy portal...</main>;
  if (error || !data) return <main className="portal-state"><ShieldCheck size={30} /><h1>Portal unavailable</h1><p>{error || "This private link is not available."}</p><button onClick={() => void load()}>Try again</button></main>;

  const signed = data.contracts.filter((contract) => contract.status === "signed").length;
  const pending = data.contracts.filter((contract) => contract.status === "pending").length;
  const additionalDocuments = data.documents.filter((document) => !document.isContract);
  const nextEvent = data.upcomingEvents[0];
  const completedJourney = journey.filter((step) => step.complete).length;
  const journeyPercent = Math.round((completedJourney / journey.length) * 100);
  const firstName = data.buyer.name.split(/\s+/)[0] || data.buyer.name;
  const transportationEvents = data.upcomingEvents.filter((event) => /pickup|delivery|transport/i.test(`${event.eventType} ${event.title}`));

  return <main className="puppy-portal">
    <header className="portal-topbar">
      <Link href={accountMode ? "/portal/account" : `/portal/${token}`}><span><Dog size={21} /></span><b>SWVA Chihuahua</b><small>Puppy portal</small></Link>
      <nav aria-label="Puppy portal sections"><a href="#puppy">My puppy</a><a href="#documents">Documents</a><a href="#payments">Payments</a><a href="#schedule">Schedule</a><a href="#support">Support</a></nav>
      <div className="portal-security"><ShieldCheck size={16} /> Private family access{accountMode && <form action="/api/portal/auth/logout" method="post"><button type="submit">Sign out</button></form>}</div>
    </header>
    <div className="portal-content">
      <section className="portal-journey-hero">
        <div><span>YOUR PUPPY JOURNEY</span><h1>Welcome, {firstName}.</h1><p>Follow every milestone from your family account through puppy updates, signed agreements, payments, and go-home day.</p></div>
        <div className="portal-hero-progress"><b>{journeyPercent}%</b><span>Journey ready</span><small>{completedJourney} of {journey.length} milestones complete</small></div>
      </section>

      <section className="portal-metrics" aria-label="Portal summary"><article><Dog size={19} /><span><b>{data.puppies.length}</b><small>Assigned puppies</small></span></article><article><HeartPulse size={19} /><span><b>{data.updates.length}</b><small>Family updates</small></span></article><article><FileSignature size={19} /><span><b>{signed}</b><small>Signed documents</small></span></article><article><CircleDollarSign size={19} /><span><b>{money(data.payments.outstandingCents)}</b><small>Outstanding</small></span></article></section>

      <section className="portal-journey-band" aria-label="Puppy journey progress">
        <header><span>JOURNEY PLAN</span><h2>Your next steps</h2></header>
        <div>{journey.map((step) => <span key={step.label} className={step.complete ? "complete" : ""}>{step.complete ? <Check size={15} /> : <Circle size={15} />}<b>{step.label}</b></span>)}</div>
      </section>

      <div className="portal-grid">
        <section id="puppy" className="portal-section portal-puppies"><header><span>MY PUPPY</span><h2>Assigned puppy records</h2></header>{data.puppies.length ? data.puppies.map((puppy) => {
          const updates = data.updates.filter((update) => update.puppyId === puppy.id);
          return <article key={puppy.id} className="portal-puppy"><div className="portal-puppy-head"><span className="portal-avatar">{puppy.name.slice(0, 1).toUpperCase()}</span><div><h3>{puppy.name}</h3><p>{[puppy.sex, puppy.color, puppy.status].filter(Boolean).join(" / ")}</p></div><i>{puppy.status}</i></div><div className="portal-puppy-facts"><span><small>Birthday</small><b>{shortDate(puppy.birthDate)}</b></span><span><small>Birth weight</small><b>{puppy.birthWeight ? `${puppy.birthWeight} lb` : "Not recorded"}</b></span><span><small>Latest weight</small><b>{puppy.currentWeight ? `${puppy.currentWeight} lb` : "Not recorded"}</b></span><span><small>Litter</small><b>{puppy.litterName || "Not recorded"}</b></span><span><small>Parents</small><b>{[puppy.damName && `Dam: ${puppy.damName}`, puppy.sireName && `Sire: ${puppy.sireName}`].filter(Boolean).join(" / ") || "Not recorded"}</b></span><span><small>Recorded price</small><b>{money(puppy.priceCents)}</b></span></div>{puppy.notes && <div className="portal-puppy-notes"><b>Profile notes</b><p>{puppy.notes}</p></div>}{updates.length > 0 ? <div className="portal-update-list"><h4>Latest updates</h4>{updates.slice(0, 6).map((update) => <div key={update.id}><span><Sparkles size={15} /><b>{update.title}</b><small>{shortDate(update.createdAt)}</small></span><p>{update.body}</p>{(update.weekNumber || update.weight) && <i>{[update.weekNumber ? `Week ${update.weekNumber}` : "", update.weight ? `${update.weight} lb` : ""].filter(Boolean).join(" / ")}</i>}</div>)}</div> : <div className="portal-empty compact">The next puppy update will appear here.</div>}</article>;
        }) : <div className="portal-empty">No puppy is assigned to this family account yet.</div>}</section>

        <section id="documents" className="portal-section portal-contracts"><header><span>DOCUMENTS</span><h2>Agreements and signatures</h2>{pending > 0 && <i>{pending} awaiting signature</i>}</header>{data.contracts.length ? <div>{data.contracts.map((contract) => <article key={contract.id}><span className={contract.status === "signed" ? "signed" : "pending"}>{contract.status === "signed" ? <CheckCircle2 size={18} /> : <FileSignature size={18} />}</span><div><b>{contract.title}</b><small>{contract.status === "signed" ? `Signed ${shortDate(contract.signedAt || "")}` : `Prepared ${shortDate(contract.createdAt)}`}</small></div>{contract.status === "pending" ? <Link href={`/portal/${token}/contracts/${contract.id}`}>Review and sign <ArrowRight size={15} /></Link> : <a href={`/api/portal/${token}/documents/${contract.id}`} target="_blank" rel="noreferrer">View signed PDF <Download size={15} /></a>}</article>)}</div> : <div className="portal-empty">No agreements have been prepared yet.</div>}</section>

        <section id="payments" className="portal-section portal-payments"><header><span>ACCOUNT</span><h2>Payment record</h2></header><div className="portal-balance"><span><small>Purchase total</small><b>{money(data.payments.saleTotalCents)}</b></span><span><small>Payments recorded</small><b>{money(data.payments.paidCents)}</b></span><span><small>Outstanding</small><b>{money(data.payments.outstandingCents)}</b></span></div>{data.payments.items.length > 0 ? <div className="portal-payment-list">{data.payments.items.slice(0, 10).map((payment) => <span key={payment.id}><i className={settled(payment.status) ? "paid" : ""}>{payment.status}</i><b>{payment.description}</b><small>{[payment.category, payment.method, shortDate(payment.paidDate || payment.dueDate)].filter(Boolean).join(" / ")}</small><strong>{money(payment.amountCents)}</strong></span>)}</div> : <div className="portal-empty compact">No payments have been recorded yet.</div>}</section>

        <section className="portal-section portal-files"><header><span>FAMILY FILES</span><h2>Additional documents</h2></header>{additionalDocuments.length ? <div>{additionalDocuments.map((document) => <a key={document.id} href={`/api/portal/${token}/documents/${document.id}`} target="_blank" rel="noreferrer"><FileText size={18} /><span><b>{document.title}</b><small>{document.documentType} / added {shortDate(document.createdAt)}</small></span><Download size={15} /></a>)}</div> : <div className="portal-empty compact">No additional family files are stored yet.</div>}</section>

        <section id="schedule" className="portal-section portal-schedule"><header><span>SCHEDULE</span><h2>Upcoming dates and next steps</h2></header>{data.upcomingEvents.length ? <div>{data.upcomingEvents.map((event) => <article key={event.id}><time><b>{new Date(`${event.date}T12:00:00`).getDate()}</b><small>{new Date(`${event.date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></time><span><b>{event.title}</b><small>{[event.puppyName, event.eventType, event.time, event.location].filter(Boolean).join(" / ")}</small></span><i>{event.status}</i></article>)}</div> : <div className="portal-empty compact">There are no upcoming family or puppy events on the schedule.</div>}</section>

        <section className="portal-section portal-transport"><header><span>GO-HOME PLANNING</span><h2>Pickup and transportation</h2></header>{transportationEvents.length > 0 && <div className="portal-request-history">{transportationEvents.map((event) => <span key={event.id}><Truck size={16} /><b>{event.title}</b><small>{shortDate(event.date)} / {event.status}</small></span>)}</div>}<PortalRequestForm token={token} kind="transportation" onCreated={load} /></section>

        <section id="support" className="portal-section portal-support"><header><span>FAMILY SUPPORT</span><h2>Messages and requests</h2></header><PortalRequestForm token={token} kind="support" onCreated={load} />{data.requests.length > 0 && <div className="portal-request-history"><h3>Recent requests</h3>{data.requests.map((request) => <span key={request.id}>{request.kind === "transportation" ? <Route size={16} /> : <MessageSquareText size={16} />}<b>{request.subject}</b><small>{shortDate(request.requestedDate)} / {request.status}</small></span>)}</div>}</section>

        <section className="portal-section portal-resources"><header><span>RESOURCE CENTER</span><h2>Ready for home</h2></header><div>{[
          ["First 72 hours", "Keep the first days calm, predictable, and centered around food, water, rest, and potty routines."],
          ["Puppy-safe home", "Secure cords, small objects, unsafe plants, medication, open stairs, and spaces a tiny puppy can enter."],
          ["Care records", "Keep vaccination, deworming, microchip, registration, and veterinary paperwork together in Family Files."],
          ["Arrival planning", "Confirm transportation, feeding instructions, a carrier, bedding, and your first veterinary appointment."],
        ].map(([title, text]) => <article key={title}><BookOpen size={17} /><span><b>{title}</b><small>{text}</small></span></article>)}</div></section>

        <section className="portal-section portal-profile"><header><span>FAMILY ACCOUNT</span><h2>Family account details</h2></header><div className="portal-account-strip"><span><UserRound size={16} /><small>Status</small><b>{data.buyer.applicationStatus}</b></span><span><Mail size={16} /><small>Email</small><b>{data.buyer.email || "Not recorded"}</b></span><span><Phone size={16} /><small>Phone</small><b>{data.buyer.phone || "Not recorded"}</b></span><span><MapPin size={16} /><small>Location</small><b>{data.buyer.location || "Not recorded"}</b></span><span><Dog size={16} /><small>Preferences</small><b>{[data.buyer.preferredSex, data.buyer.preferredColor].filter(Boolean).join(" / ") || "Not recorded"}</b></span><span><Clock3 size={16} /><small>Next scheduled item</small><b>{nextEvent ? `${shortDate(nextEvent.date)} - ${nextEvent.title}` : "Nothing scheduled"}</b></span></div>{(data.support.phone || data.support.email) && <div className="portal-contact-actions">{data.support.phone && <a href={`tel:${data.support.phone}`}><Phone size={15} /> Call support</a>}{data.support.email && <a href={`mailto:${data.support.email}`}><Mail size={15} /> Email support</a>}</div>}</section>
      </div>
    </div>
  </main>;
}

export default function PuppyPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <PuppyPortalExperience token={token} />;
}
