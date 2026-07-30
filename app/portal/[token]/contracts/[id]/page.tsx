"use client";

import Link from "next/link";
import { FormEvent, use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSignature, ShieldCheck } from "lucide-react";
import type { CombinedAgreementDetails } from "../../../../../lib/combined-agreement";
import { parseContractTerm } from "../../../../../lib/contract-format";

type Snapshot = {
  kind: "bill_of_sale" | "health_guarantee";
  title: string;
  introduction: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerLocation: string;
  puppyName: string;
  puppySex: string;
  puppyColor: string;
  puppyBirthDate: string;
  litterName: string;
  damName: string;
  sireName: string;
  salePriceCents: number;
  depositCents: number;
  balanceCents: number;
  balanceDueDate: string;
  transferDate: string;
  sellerName: string;
  sellerLocation: string;
  microToy?: boolean;
  terms: string[];
  agreementDetails?: CombinedAgreementDetails;
  signature?: { signerName: string; signedAt: string; auditHash: string; electronicConsent?: true; healthAcknowledged?: true };
};
type Contract = { id: number; title: string; status: "pending" | "signed"; signedAt: string | null; signerName: string | null; snapshot: Snapshot };
type PortalData = { buyer: { name: string }; contracts: Contract[] };
type Fact = [string, unknown];

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const date = (value: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`)) : "Not specified";
const display = (value: unknown) => String(value ?? "").trim();
const yesNo = (value: boolean | undefined) => value === true ? "Yes" : value === false ? "No" : "";

function AgreementTerms({ terms }: { terms: string[] }) {
  const parsedTerms = terms.map(parseContractTerm);
  return <div className="contract-term-list">{parsedTerms.map((parsed, index) => {
    if (parsed.kind === "section") return <h3 key={`${index}-${parsed.text}`}>{parsed.text}</h3>;
    if (parsed.kind === "notice") return <div className="contract-statutory-notice" key={`${index}-notice`}>{parsed.text}</div>;
    const clauseNumber = parsedTerms.slice(0, index + 1).filter((term) => term.kind === "clause").length;
    return <div className="contract-clause" key={`${index}-${parsed.text.slice(0, 20)}`}><span>{clauseNumber}</span><p>{parsed.text}</p></div>;
  })}</div>;
}

function FactSection({ title, facts }: { title: string; facts: Fact[] }) {
  const visible = facts.map(([label, value]) => [label, display(value)] as const).filter(([, value]) => value);
  if (!visible.length) return null;
  return <section><h2>{title}</h2><div className="contract-facts">{visible.map(([label, value]) => <span key={`${title}-${label}`}><small>{label}</small><b>{value}</b></span>)}</div></section>;
}

function CombinedAgreementFacts({ snapshot }: { snapshot: Snapshot }) {
  const details = snapshot.agreementDetails;
  if (!details) return null;
  const salesTax = Number(details.salesTaxCents ?? 0), transport = Number(details.transportCents ?? 0), other = Number(details.otherChargesCents ?? 0);
  const total = snapshot.salePriceCents + salesTax + transport + other;

  return <>
    <FactSection title="Transaction summary" facts={[["Agreement number", details.agreementNumber], ["Agreement date", details.agreementDate ? date(details.agreementDate) : ""], ["Scheduled transfer", snapshot.transferDate ? date(snapshot.transferDate) : ""], ["Buyer", snapshot.buyerName], ["Co-Buyer", details.coBuyerName], ["Puppy", snapshot.puppyName], ["Litter / internal ID", details.litterInternalId || snapshot.litterName]]} />
    <FactSection title="Buyer information" facts={[["Buyer legal name", snapshot.buyerName], ["Co-Buyer legal name", details.coBuyerName], ["Street address", details.buyerStreetAddress], ["City / State / ZIP", details.buyerCityStateZip || snapshot.buyerLocation], ["Primary phone", snapshot.buyerPhone], ["Email", snapshot.buyerEmail], ["Emergency contact", details.buyerEmergencyContact], ["Written-notice method", details.buyerNoticeMethod]]} />
    <FactSection title="Puppy description and animal history" facts={[["Puppy", snapshot.puppyName], ["Breed", "Chihuahua"], ["Sex", snapshot.puppySex], ["Date of birth", snapshot.puppyBirthDate ? date(snapshot.puppyBirthDate) : ""], ["Age at transfer", details.puppyAgeAtTransfer], ["Color / markings", snapshot.puppyColor], ["Coat type", details.puppyCoatType], ["Current weight", details.puppyCurrentWeight], ["Estimated adult size", details.estimatedAdultSize], ["Microchip", details.microchipNumber], ["Registry", details.registry], ["Registration number / status", details.registrationNumber], ["Very small / Micro-Toy designation", yesNo(snapshot.microToy)]]} />
    <FactSection title="Breeder and parent information" facts={[["Seller / breeder", `${snapshot.sellerName}, ${snapshot.sellerLocation}`], ["Bred by Seller", yesNo(details.bredBySeller)], ["Acquired from", details.acquiredFrom], ["Sire", snapshot.sireName], ["Sire registration", details.sireRegistrationNumber], ["Dam", snapshot.damName], ["Dam registration", details.damRegistrationNumber]]} />
    <FactSection title="Documents and disclosures" facts={[["Health record / vaccine labels", details.healthRecordStatus], ["Puppy care and feeding guide", details.careGuideStatus], ["Registration documents", details.registrationDocumentsStatus], ["Microchip instructions", details.microchipInstructionsStatus], ["Insurance information", details.insuranceInformationStatus], ["Known-condition disclosure", details.knownConditionDisclosureStatus], ["Transport instructions", details.transportInstructionsStatus], ["Attachments", details.attachments]]} />
    <FactSection title="Sale and payment summary" facts={[["Cash price of puppy", money(snapshot.salePriceCents)], ["Virginia sales tax", money(salesTax)], ["Transport / delivery", money(transport)], ["Other disclosed charges", money(other)], ["Total sale price", money(total)], ["Deposit / reservation credit", money(Number(details.reservationCreditCents ?? 0))], ["Additional payments", money(Number(details.additionalPaymentsCents ?? 0))], ["Total payments recorded", money(snapshot.depositCents)], ["Balance due", money(snapshot.balanceCents)], ["Balance due date", snapshot.balanceDueDate ? date(snapshot.balanceDueDate) : ""], ["Payment method", details.paymentMethod]]} />
    <FactSection title="Transfer record" facts={[["Transfer method", details.transferMethod], ["Transfer location", details.transferLocation], ["Transfer date", snapshot.transferDate ? date(snapshot.transferDate) : ""], ["Transfer time", details.transferTime], ["Person receiving puppy", details.recipientName]]} />
    <FactSection title="Transfer-date health disclosure" facts={[["Known conditions / disclosures", details.knownConditions], ["Appetite and feeding", details.appetiteAtTransfer], ["Stool / parasite history", details.stoolParasiteHistory], ["Respiratory findings", details.respiratoryFindings], ["Skin / coat findings", details.skinCoatFindings], ["Bite / teeth / hernia findings", details.biteTeethHerniaFindings], ["Patella / gait findings", details.patellaGaitFindings], ["Medication / supplement", details.medicationSupplement], ["Special feeding instructions", details.specialFeedingInstructions], ["Other material disclosure", details.otherHealthDisclosure]]} />
    <FactSection title="First veterinary examination plan" facts={[["Veterinary clinic", details.firstVetClinic], ["Veterinarian", details.firstVetName], ["Appointment", details.firstVetAppointment], ["Clinic phone", details.firstVetPhone], ["Findings status", details.firstVetFindingsStatus]]} />
    <FactSection title="Registration, breeding rights, and insurance" facts={[["Registration status", details.registrationStatus], ["Registration type", details.registrationType], ["Registry promised", details.registryPromised], ["Documents expected by", details.registrationDueDate ? date(details.registrationDueDate) : ""], ["Spay / neuter term", details.spayNeuterTerm], ["Breeding addendum", details.breedingAddendum], ["Complimentary insurance", details.insuranceSelection], ["Seller representative", details.sellerRepresentative]]} />
  </>;
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
    } finally { setLoading(false); }
  }, [id, token]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/contracts/${id}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signer_name: form.get("signer_name"), agreed: form.get("agreed") === "on", electronic_consent: form.get("electronic_consent") === "on", health_acknowledged: form.get("health_acknowledged") === "on" }) });
      const payload = await response.json() as Contract & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to sign this agreement.");
      setContract(payload); setSigned(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign this agreement.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="portal-state"><span className="portal-spinner" />Opening agreement...</main>;
  if (!contract) return <main className="portal-state"><ShieldCheck size={30} /><h1>Agreement unavailable</h1><p>{error}</p><Link href={`/portal/${token}`}>Return to puppy portal</Link></main>;
  const snapshot = contract.snapshot;
  const healthGuarantee = snapshot.kind === "health_guarantee";
  const combinedAgreement = Boolean(snapshot.agreementDetails);

  return <main className="contract-sign-page">
    <header className="contract-sign-top"><Link href={`/portal/${token}`}><ArrowLeft size={17} /> Puppy portal</Link><div><ShieldCheck size={16} /> Private agreement</div></header>
    <div className="contract-sign-layout">
      <article className="contract-paper">
        <header><span>{snapshot.sellerName}</span><h1>{snapshot.title}</h1><p>{snapshot.introduction}</p></header>
        {combinedAgreement ? <CombinedAgreementFacts snapshot={snapshot} /> : <>
          <FactSection title="Buyer and puppy" facts={[["Buyer", snapshot.buyerName], ["Puppy", snapshot.puppyName], ["Buyer contact", [snapshot.buyerPhone, snapshot.buyerEmail].filter(Boolean).join(" / ")], ["Sex and color", [snapshot.puppySex, snapshot.puppyColor].filter(Boolean).join(" / ")], ["Buyer location", snapshot.buyerLocation], ["Birth date", snapshot.puppyBirthDate ? date(snapshot.puppyBirthDate) : ""], ["Litter", snapshot.litterName], ["Parents", [snapshot.damName && `Dam: ${snapshot.damName}`, snapshot.sireName && `Sire: ${snapshot.sireName}`].filter(Boolean).join(" / ")]]} />
          {snapshot.kind === "bill_of_sale" && <FactSection title="Sale summary" facts={[["Purchase price", money(snapshot.salePriceCents)], ["Deposit recorded", money(snapshot.depositCents)], ["Balance", money(snapshot.balanceCents)], ["Balance due", snapshot.balanceDueDate ? date(snapshot.balanceDueDate) : ""], ["Transfer date", snapshot.transferDate ? date(snapshot.transferDate) : ""], ["Seller", snapshot.sellerName]]} />}
        </>}
        <section><h2>Agreement terms</h2><AgreementTerms terms={snapshot.terms} /></section>
        {contract.status === "signed" && <section className="signed-audit"><CheckCircle2 size={24} /><div><h2>Electronically signed</h2><p>Signed by <b>{contract.signerName}</b> on {date(contract.signedAt || "")}.</p><small>Audit record: {snapshot.signature?.auditHash}</small></div></section>}
      </article>

      <aside className="signature-panel">
        {contract.status === "signed" || signed ? <><span className="signature-seal"><CheckCircle2 size={28} /></span><h2>Signature complete</h2><p>Your signed PDF has been saved to this puppy portal.</p><a href={`/api/portal/${token}/documents/${contract.id}`} target="_blank" rel="noreferrer"><Download size={17} /> View signed PDF</a><Link href={`/portal/${token}`}><ArrowLeft size={16} /> Return to portal</Link></> : <form onSubmit={sign}><span className="signature-seal"><FileSignature size={28} /></span><h2>Sign this agreement</h2><p>Review every term before signing. Your typed legal name, consent, time, and audit details will be attached to the exact document shown.</p>{error && <div className="inline-error">{error}</div>}<label><span>Full legal name</span><input name="signer_name" autoComplete="name" required minLength={3} placeholder={snapshot.buyerName} /></label><label className="signature-consent"><input name="agreed" type="checkbox" required /><span>I have reviewed this complete agreement and agree to its terms.</span></label>{healthGuarantee && <label className="signature-consent health-consent"><input name="health_acknowledged" type="checkbox" required /><span>I specifically acknowledge the one-year health terms, required Chihuahua care, voluntary limitations, {snapshot.microToy ? "very-small / Micro-Toy designation and provisions, " : "very-small / Micro-Toy provisions when applicable, "}and Virginia Consumer Notice.</span></label>}<label className="signature-consent electronic-consent"><input name="electronic_consent" type="checkbox" required /><span>I separately agree to conduct this transaction electronically and intend my typed legal name to be my electronic signature.</span></label><button disabled={saving}><FileSignature size={17} /> {saving ? "Signing..." : "Sign agreement"}</button><small>Do not sign until all information and terms are correct.</small></form>}
      </aside>
    </div>
  </main>;
}
