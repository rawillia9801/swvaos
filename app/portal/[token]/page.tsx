"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Dog, Download, FileSignature, FileText, HeartPulse, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

type Puppy = { id: number; name: string; sex: string; color: string; birthDate: string; birthWeight: number; currentWeight: number; status: string; priceCents: number; notes: string; litterName: string; damName: string; sireName: string };
type Update = { id: number; puppyId: number; title: string; body: string; weekNumber: number | null; weight: number | null; createdAt: string };
type Contract = { id: number; title: string; documentType: string; status: "pending" | "signed"; kind: string; puppyId: number; puppyName: string; createdAt: string; signedAt: string | null; signerName: string | null };
type Payment = { id: number; description: string; category: string; method: string; amountCents: number; status: string; dueDate: string; paidDate: string };
type PortalDocument = { id: number; title: string; documentType: string; fileName: string; createdAt: string; isContract: boolean; puppyIds: number[] };
type PortalEvent = { id: number; title: string; eventType: string; date: string; time: string; location: string; status: string; puppyName: string };
type PortalData = { buyer: { id: number; name: string; email: string; phone: string; location: string }; puppies: Puppy[]; updates: Update[]; contracts: Contract[]; documents: PortalDocument[]; upcomingEvents: PortalEvent[]; payments: { saleTotalCents: number; paidCents: number; outstandingCents: number; items: Payment[] } };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const shortDate = (value: string) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`)) : "Not set";

export default function PuppyPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
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

  if (loading) return <main className="portal-state"><span className="portal-spinner" />Opening your puppy portal...</main>;
  if (error || !data) return <main className="portal-state"><ShieldCheck size={30} /><h1>Portal unavailable</h1><p>{error || "This private link is not available."}</p><button onClick={() => void load()}>Try again</button></main>;
  const signed = data.contracts.filter((contract) => contract.status === "signed").length;
  const pending = data.contracts.filter((contract) => contract.status === "pending").length;
  const additionalDocuments = data.documents.filter((document) => !document.isContract);
  const nextEvent = data.upcomingEvents[0];

  return <main className="puppy-portal">
    <header className="portal-topbar"><Link href={`/portal/${token}`}><span><Dog size={21} /></span><b>SWVA Chihuahua</b><small>Puppy portal</small></Link><div><ShieldCheck size={16} /> Private family access</div></header>
    <div className="portal-content">
      <section className="portal-welcome"><div><span>WELCOME BACK</span><h1>{data.buyer.name}</h1><p>Your puppy records, family updates, payments, and signed agreements are collected here.</p></div><div className="portal-family"><b>{data.puppies.length}</b><span>{data.puppies.length === 1 ? "Assigned puppy" : "Assigned puppies"}</span><small>{data.buyer.location || data.buyer.phone || "Family account"}</small></div></section>

      <section className="portal-metrics" aria-label="Portal summary"><article><Dog size={19} /><span><b>{data.puppies.length}</b><small>Puppies</small></span></article><article><HeartPulse size={19} /><span><b>{data.updates.length}</b><small>Updates</small></span></article><article><FileSignature size={19} /><span><b>{signed}</b><small>Signed documents</small></span></article><article><CircleDollarSign size={19} /><span><b>{money(data.payments.outstandingCents)}</b><small>Outstanding</small></span></article></section>

      <section className="portal-account-strip" aria-label="Family account details">
        <span><Mail size={16} /><small>Email</small><b>{data.buyer.email || "Not recorded"}</b></span>
        <span><Phone size={16} /><small>Phone</small><b>{data.buyer.phone || "Not recorded"}</b></span>
        <span><MapPin size={16} /><small>Location</small><b>{data.buyer.location || "Not recorded"}</b></span>
        <span><Clock3 size={16} /><small>Next scheduled item</small><b>{nextEvent ? `${shortDate(nextEvent.date)} - ${nextEvent.title}` : "Nothing scheduled"}</b></span>
      </section>

      <div className="portal-grid">
        <section className="portal-section portal-puppies"><header><span>MY PUPPY</span><h2>Assigned puppy records</h2></header>{data.puppies.length ? data.puppies.map((puppy) => {
          const updates = data.updates.filter((update) => update.puppyId === puppy.id);
          return <article key={puppy.id} className="portal-puppy"><div className="portal-puppy-head"><span className="portal-avatar">{puppy.name.slice(0, 1).toUpperCase()}</span><div><h3>{puppy.name}</h3><p>{[puppy.sex, puppy.color, puppy.status].filter(Boolean).join(" / ")}</p></div><i>{puppy.status}</i></div><div className="portal-puppy-facts"><span><small>Birthday</small><b>{shortDate(puppy.birthDate)}</b></span><span><small>Birth weight</small><b>{puppy.birthWeight ? `${puppy.birthWeight} lb` : "Not recorded"}</b></span><span><small>Latest weight</small><b>{puppy.currentWeight ? `${puppy.currentWeight} lb` : "Not recorded"}</b></span><span><small>Litter</small><b>{puppy.litterName || "Not recorded"}</b></span><span><small>Parents</small><b>{[puppy.damName && `Dam: ${puppy.damName}`, puppy.sireName && `Sire: ${puppy.sireName}`].filter(Boolean).join(" / ") || "Not recorded"}</b></span><span><small>Recorded price</small><b>{money(puppy.priceCents)}</b></span></div>{puppy.notes && <div className="portal-puppy-notes"><b>Profile notes</b><p>{puppy.notes}</p></div>}{updates.length > 0 && <div className="portal-update-list">{updates.slice(0, 5).map((update) => <div key={update.id}><span><CalendarDays size={15} /><b>{update.title}</b><small>{shortDate(update.createdAt)}</small></span><p>{update.body}</p>{(update.weekNumber || update.weight) && <i>{[update.weekNumber ? `Week ${update.weekNumber}` : "", update.weight ? `${update.weight} lb` : ""].filter(Boolean).join(" / ")}</i>}</div>)}</div>}</article>;
        }) : <div className="portal-empty">No puppy is assigned to this family account yet.</div>}</section>

        <section className="portal-section portal-contracts"><header><span>DOCUMENTS</span><h2>Agreements and signatures</h2>{pending > 0 && <i>{pending} awaiting signature</i>}</header>{data.contracts.length ? <div>{data.contracts.map((contract) => <article key={contract.id}><span className={contract.status === "signed" ? "signed" : "pending"}>{contract.status === "signed" ? <CheckCircle2 size={18} /> : <FileSignature size={18} />}</span><div><b>{contract.title}</b><small>{contract.status === "signed" ? `Signed ${shortDate(contract.signedAt || "")}` : `Prepared ${shortDate(contract.createdAt)}`}</small></div>{contract.status === "pending" ? <Link href={`/portal/${token}/contracts/${contract.id}`}>Review and sign <ArrowRight size={15} /></Link> : <a href={`/api/portal/${token}/documents/${contract.id}`} target="_blank" rel="noreferrer">View signed PDF <Download size={15} /></a>}</article>)}</div> : <div className="portal-empty">No agreements have been prepared yet.</div>}</section>

        <section className="portal-section portal-payments"><header><span>ACCOUNT</span><h2>Payment record</h2></header><div className="portal-balance"><span><small>Purchase total</small><b>{money(data.payments.saleTotalCents)}</b></span><span><small>Payments recorded</small><b>{money(data.payments.paidCents)}</b></span><span><small>Outstanding</small><b>{money(data.payments.outstandingCents)}</b></span></div>{data.payments.items.length > 0 ? <div className="portal-payment-list">{data.payments.items.slice(0, 8).map((payment) => <span key={payment.id}><i className={payment.status === "Paid" ? "paid" : ""}>{payment.status}</i><b>{payment.description}</b><small>{[payment.category, payment.method, shortDate(payment.paidDate || payment.dueDate)].filter(Boolean).join(" / ")}</small><strong>{money(payment.amountCents)}</strong></span>)}</div> : <div className="portal-empty compact">No payments have been recorded yet.</div>}</section>

        <section className="portal-section portal-files"><header><span>FAMILY FILES</span><h2>Additional documents</h2></header>{additionalDocuments.length ? <div>{additionalDocuments.map((document) => <a key={document.id} href={`/api/portal/${token}/documents/${document.id}`} target="_blank" rel="noreferrer"><FileText size={18} /><span><b>{document.title}</b><small>{document.documentType} / added {shortDate(document.createdAt)}</small></span><Download size={15} /></a>)}</div> : <div className="portal-empty compact">No additional family files are stored yet.</div>}</section>

        <section className="portal-section portal-schedule"><header><span>SCHEDULE</span><h2>Upcoming dates and next steps</h2></header>{data.upcomingEvents.length ? <div>{data.upcomingEvents.map((event) => <article key={event.id}><time><b>{new Date(`${event.date}T12:00:00`).getDate()}</b><small>{new Date(`${event.date}T12:00:00`).toLocaleString("en-US", { month: "short" })}</small></time><span><b>{event.title}</b><small>{[event.puppyName, event.eventType, event.time, event.location].filter(Boolean).join(" / ")}</small></span><i>{event.status}</i></article>)}</div> : <div className="portal-empty compact">There are no upcoming family or puppy events on the schedule.</div>}</section>
      </div>
    </div>
  </main>;
}
