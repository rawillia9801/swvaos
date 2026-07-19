"use client";

import Link from "next/link";
import { FormEvent, use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSignature, ShieldCheck } from "lucide-react";
import { parseContractTerm } from "../../../../../lib/contract-format";

type Snapshot = { kind: "bill_of_sale" | "health_guarantee"; title: string; introduction: string; buyerName: string; buyerEmail: string; buyerPhone: string; buyerLocation: string; puppyName: string; puppySex: string; puppyColor: string; puppyBirthDate: string; litterName: string; damName: string; sireName: string; salePriceCents: number; depositCents: number; balanceCents: number; balanceDueDate: string; transferDate: string; sellerName: string; sellerLocation: string; microToy?: boolean; terms: string[]; signature?: { signerName: string; signedAt: string; auditHash: string; electronicConsent?: true; healthAcknowledged?: true } };
type Contract = { id: number; title: string; status: "pending" | "signed"; signedAt: string | null; signerName: string | null; snapshot: Snapshot };
type PortalData = { buyer: { name: string }; contracts: Contract[] };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`)) : "Not specified";

function AgreementTerms({ terms }: { terms: string[] }) {
  const parsedTerms = terms.map(parseContractTerm);
  return <div className="contract-term-list">{parsedTerms.map((parsed, index) => {
    if (parsed.kind === "section") return <h3 key={`${index}-${parsed.text}`}>{parsed.text}</h3>;
    if (parsed.kind === "notice") return <div className="contract-statutory-notice" key={`${index}-notice`}>{parsed.text}</div>;
    const clauseNumber = parsedTerms.slice(0, index + 1).filter((term) => term.kind === "clause").length;
    return <div className="contract-clause" key={`${index}-${parsed.text.slice(0, 20)}`}><span>{clauseNumber}</span><p>{parsed.text}</p></div>;
  })}</div>;
}

export default function SignContractPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this agreement.");
      const found = payload.contracts.find((item) => item.id === Number(id));
      if (!found) throw new Error("This agreement is not available in the puppy portal.");
      setContract(found);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this agreement.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/contracts/${id}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signer_name: form.get("signer_name"), agreed: form.get("agreed") === "on", electronic_consent: form.get("electronic_consent") === "on", health_acknowledged: form.get("health_acknowledged") === "on" }) });
      const payload = await response.json() as Contract & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to sign this agreement.");
      setContract(payload);
      setSigned(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign this agreement.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="portal-state"><span className="portal-spinner" />Opening agreement...</main>;
  if (!contract) return <main className="portal-state"><ShieldCheck size={30} /><h1>Agreement unavailable</h1><p>{error}</p><Link href={`/portal/${token}`}>Return to puppy portal</Link></main>;
  const snapshot = contract.snapshot;
  const healthGuarantee = snapshot.kind === "health_guarantee";

  return <main className="contract-sign-page">
    <header className="contract-sign-top"><Link href={`/portal/${token}`}><ArrowLeft size={17} /> Puppy portal</Link><div><ShieldCheck size={16} /> Private agreement</div></header>
    <div className="contract-sign-layout">
      <article className="contract-paper">
        <header><span>{snapshot.sellerName}</span><h1>{snapshot.title}</h1><p>{snapshot.introduction}</p></header>
        <section><h2>Buyer and puppy</h2><div className="contract-facts"><span><small>Buyer</small><b>{snapshot.buyerName}</b></span><span><small>Puppy</small><b>{snapshot.puppyName}</b></span><span><small>Buyer contact</small><b>{[snapshot.buyerPhone, snapshot.buyerEmail].filter(Boolean).join(" / ") || "Not recorded"}</b></span><span><small>Sex and color</small><b>{[snapshot.puppySex, snapshot.puppyColor].filter(Boolean).join(" / ") || "Not recorded"}</b></span><span><small>Buyer location</small><b>{snapshot.buyerLocation || "Not recorded"}</b></span><span><small>Birth date</small><b>{date(snapshot.puppyBirthDate)}</b></span><span><small>Litter</small><b>{snapshot.litterName || "Not recorded"}</b></span><span><small>Parents</small><b>{[snapshot.damName && `Dam: ${snapshot.damName}`, snapshot.sireName && `Sire: ${snapshot.sireName}`].filter(Boolean).join(" / ") || "Not recorded"}</b></span></div></section>
        {snapshot.title.startsWith("Bill of Sale") && <section><h2>Sale summary</h2><div className="contract-facts"><span><small>Purchase price</small><b>{money(snapshot.salePriceCents)}</b></span><span><small>Deposit recorded</small><b>{money(snapshot.depositCents)}</b></span><span><small>Balance</small><b>{money(snapshot.balanceCents)}</b></span><span><small>Balance due</small><b>{date(snapshot.balanceDueDate)}</b></span><span><small>Transfer date</small><b>{date(snapshot.transferDate)}</b></span><span><small>Seller</small><b>{snapshot.sellerName}</b></span></div></section>}
        <section><h2>Agreement terms</h2><AgreementTerms terms={snapshot.terms} /></section>
        {contract.status === "signed" && <section className="signed-audit"><CheckCircle2 size={24} /><div><h2>Electronically signed</h2><p>Signed by <b>{contract.signerName}</b> on {date(contract.signedAt || "")}.</p><small>Audit record: {snapshot.signature?.auditHash}</small></div></section>}
      </article>

      <aside className="signature-panel">
        {contract.status === "signed" || signed ? <><span className="signature-seal"><CheckCircle2 size={28} /></span><h2>Signature complete</h2><p>Your signed PDF has been saved to this puppy portal.</p><a href={`/api/portal/${token}/documents/${contract.id}`} target="_blank" rel="noreferrer"><Download size={17} /> View signed PDF</a><Link href={`/portal/${token}`}><ArrowLeft size={16} /> Return to portal</Link></> : <form onSubmit={sign}><span className="signature-seal"><FileSignature size={28} /></span><h2>Sign this agreement</h2><p>Review every term before signing. Your typed legal name, consent, time, and audit details will be attached to the exact document shown.</p>{error && <div className="inline-error">{error}</div>}<label><span>Full legal name</span><input name="signer_name" autoComplete="name" required minLength={3} placeholder={snapshot.buyerName} /></label><label className="signature-consent"><input name="agreed" type="checkbox" required /><span>I have reviewed this agreement and agree to its terms.</span></label>{healthGuarantee && <label className="signature-consent health-consent"><input name="health_acknowledged" type="checkbox" required /><span>I specifically acknowledge the health terms, required care, voluntary limitations, {snapshot.microToy ? "Micro-Toy designation and exclusion, " : "Micro-Toy provisions when applicable, "}and Virginia Consumer Notice.</span></label>}<label className="signature-consent electronic-consent"><input name="electronic_consent" type="checkbox" required /><span>I separately agree to conduct this transaction electronically and intend my typed legal name to be my electronic signature.</span></label><button disabled={saving}><FileSignature size={17} /> {saving ? "Signing..." : "Sign agreement"}</button><small>Do not sign until all information and terms are correct.</small></form>}
      </aside>
    </div>
  </main>;
}
