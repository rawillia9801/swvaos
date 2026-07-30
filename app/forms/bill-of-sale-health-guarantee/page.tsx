"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileSignature,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import styles from "./form.module.css";

type BaseRecord = { id: number; created_at?: string; updated_at?: string };
type Buyer = BaseRecord & {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  street_address?: string | null;
  address?: string | null;
  application_status?: string | null;
};
type Puppy = BaseRecord & {
  litter_id?: number | null;
  buyer_id?: number | null;
  name: string;
  sex?: string | null;
  color?: string | null;
  birth_date?: string | null;
  current_weight?: number | null;
  status?: string | null;
  price_cents?: number | null;
  notes?: string | null;
  coat_type?: string | null;
  microchip_number?: string | null;
  registry?: string | null;
  registration_number?: string | null;
};
type Litter = BaseRecord & { name: string; dam_id?: number | null; sire_id?: number | null; birth_date?: string | null };
type Dog = BaseRecord & { name: string; registered_name?: string | null; registration_number?: string | null };
type DogRegistration = BaseRecord & { dog_id: number; registry?: string | null; registration_number?: string | null; registered_name?: string | null };
type Transaction = BaseRecord & { buyer_id?: number | null; puppy_id?: number | null; type?: string | null; category?: string | null; description?: string | null; amount_cents?: number | null; status?: string | null; method?: string | null; paid_date?: string | null };
type KennelEvent = BaseRecord & { title?: string | null; event_type?: string | null; event_date?: string | null; event_time?: string | null; related_type?: string | null; related_id?: number | null; location?: string | null; status?: string | null };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; litters: Litter[]; dogs: Dog[]; dog_registrations: DogRegistration[]; transactions: Transaction[]; events: KennelEvent[] };
type PreparedResult = { portalUrl: string; contracts?: Array<{ id: number; title: string }> };

const emptyData: DataSet = { buyers: [], puppies: [], litters: [], dogs: [], dog_registrations: [], transactions: [], events: [] };
const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
const fullName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;
const dateInput = (value: string | null | undefined) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 10) : "";
const today = () => new Date().toISOString().slice(0, 10);
const settled = (transaction: Transaction) => ["Paid", "Complete"].includes(String(transaction.status ?? ""));
const isPayment = (transaction: Transaction) => ["Payment", "Deposit"].includes(String(transaction.type ?? ""));

function ageAtTransfer(birthValue: string | null | undefined, transferValue: string) {
  const birthDate = dateInput(birthValue);
  if (!birthDate || !transferValue) return "";
  const birth = new Date(`${birthDate}T12:00:00Z`);
  const transfer = new Date(`${transferValue}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(transfer.getTime()) || transfer < birth) return "";
  const days = Math.floor((transfer.getTime() - birth.getTime()) / 86400000);
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return `${weeks} week${weeks === 1 ? "" : "s"}${remainder ? `, ${remainder} day${remainder === 1 ? "" : "s"}` : ""}`;
}

function registrationFor(dogId: number | null | undefined, registrations: DogRegistration[], dog?: Dog) {
  const registration = registrations.filter((item) => Number(item.dog_id) === Number(dogId)).sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")))[0];
  return registration?.registration_number || dog?.registration_number || "";
}

function SelectField({ label, name, defaultValue = "", children, required = false }: { label: string; name: string; defaultValue?: string | number; children: ReactNode; required?: boolean }) {
  return <label><span>{label}</span><select name={name} defaultValue={defaultValue} required={required}>{children}</select></label>;
}

function InputField({ label, name, defaultValue = "", type = "text", required = false, min, step, placeholder, readOnly = false }: { label: string; name: string; defaultValue?: string | number; type?: string; required?: boolean; min?: string | number; step?: string | number; placeholder?: string; readOnly?: boolean }) {
  return <label><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required={required} min={min} step={step} placeholder={placeholder} readOnly={readOnly} /></label>;
}

function TextAreaField({ label, name, defaultValue = "", rows = 3, placeholder }: { label: string; name: string; defaultValue?: string; rows?: number; placeholder?: string }) {
  return <label className={styles.wide}><span>{label}</span><textarea name={name} defaultValue={defaultValue} rows={rows} placeholder={placeholder} /></label>;
}

function FormSection({ title, step, children }: { title: string; step: string; children: ReactNode }) {
  return <section className={styles.formSection}><header><span>STEP {step}</span><h2>{title}</h2></header><div className={styles.grid}>{children}</div></section>;
}

export default function BillOfSaleHealthGuaranteeFormPage() {
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [buyerId, setBuyerId] = useState(0);
  const [puppyId, setPuppyId] = useState(0);
  const [transferDate, setTransferDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [prepared, setPrepared] = useState<PreparedResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as Partial<DataSet> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load SWVAOS records.");
      const nextData: DataSet = {
        buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
        puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
        litters: Array.isArray(payload.litters) ? payload.litters : [],
        dogs: Array.isArray(payload.dogs) ? payload.dogs : [],
        dog_registrations: Array.isArray(payload.dog_registrations) ? payload.dog_registrations : [],
        transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
        events: Array.isArray(payload.events) ? payload.events : [],
      };
      setData(nextData);
      const firstBuyer = nextData.buyers.find((buyer) => nextData.puppies.some((puppy) => Number(puppy.buyer_id) === buyer.id));
      if (firstBuyer) setBuyerId((current) => current || firstBuyer.id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load SWVAOS records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const buyer = useMemo(() => data.buyers.find((item) => item.id === buyerId) ?? null, [buyerId, data.buyers]);
  const assignedPuppies = useMemo(() => data.puppies.filter((puppy) => Number(puppy.buyer_id) === buyerId), [buyerId, data.puppies]);
  useEffect(() => { if (!assignedPuppies.some((puppy) => puppy.id === puppyId)) setPuppyId(assignedPuppies[0]?.id ?? 0); }, [assignedPuppies, puppyId]);
  const puppy = useMemo(() => assignedPuppies.find((item) => item.id === puppyId) ?? assignedPuppies[0] ?? null, [assignedPuppies, puppyId]);
  const litter = useMemo(() => data.litters.find((item) => item.id === Number(puppy?.litter_id)) ?? null, [data.litters, puppy?.litter_id]);
  const dam = useMemo(() => data.dogs.find((item) => item.id === Number(litter?.dam_id)) ?? null, [data.dogs, litter?.dam_id]);
  const sire = useMemo(() => data.dogs.find((item) => item.id === Number(litter?.sire_id)) ?? null, [data.dogs, litter?.sire_id]);

  const paymentSummary = useMemo(() => {
    const payments = data.transactions.filter((item) => Number(item.buyer_id) === buyerId && isPayment(item) && settled(item)).filter((item) => !item.puppy_id || Number(item.puppy_id) === Number(puppy?.id));
    const reservation = payments.filter((item) => /deposit|reservation/i.test(`${item.category ?? ""} ${item.description ?? ""}`)).reduce((sum, item) => sum + Number(item.amount_cents ?? 0), 0);
    const additional = payments.filter((item) => !/deposit|reservation/i.test(`${item.category ?? ""} ${item.description ?? ""}`)).reduce((sum, item) => sum + Number(item.amount_cents ?? 0), 0);
    return { reservation, additional, total: reservation + additional, method: payments[0]?.method || "" };
  }, [buyerId, data.transactions, puppy?.id]);

  const transferEvent = useMemo(() => {
    if (!buyer || !puppy) return null;
    return data.events.filter((event) => /pickup|delivery|transport|go.?home/i.test(`${event.event_type ?? ""} ${event.title ?? ""}`)).filter((event) => (event.related_type === "buyers" && Number(event.related_id) === buyer.id) || (event.related_type === "puppies" && Number(event.related_id) === puppy.id)).filter((event) => !["Completed", "Cancelled"].includes(String(event.status ?? ""))).sort((left, right) => `${left.event_date ?? ""}${left.event_time ?? ""}`.localeCompare(`${right.event_date ?? ""}${right.event_time ?? ""}`))[0] ?? null;
  }, [buyer, data.events, puppy]);

  useEffect(() => { setTransferDate(dateInput(transferEvent?.event_date)); }, [transferEvent?.event_date, puppyId]);
  const salePrice = Number(puppy?.price_cents ?? 0) / 100;
  const cityStateZip = buyer ? [[[buyer.city, buyer.state].filter(Boolean).join(", "), buyer.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(" ") : "";
  const puppyAge = ageAtTransfer(puppy?.birth_date, transferDate);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setSubmitError(""); setPrepared(null);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/contracts/bill-of-sale-health-guarantee", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, buyer_id: buyerId, puppy_id: puppyId }) });
      const payload = await response.json() as PreparedResult & { error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to prepare the agreement.");
      setPrepared(payload); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to prepare the agreement.");
    } finally { setSaving(false); }
  }

  async function copyPortalLink() { if (prepared?.portalUrl) await navigator.clipboard.writeText(prepared.portalUrl); }

  if (loading) return <main className={styles.state}><LoaderCircle className={styles.spin} size={28} /><h1>Loading SWVAOS records</h1><p>Preparing buyer, puppy, payment, litter, and transfer information.</p></main>;

  return <main className={styles.page}>
    <header className={styles.topbar}><Link href="/"><ArrowLeft size={17} /> Back to SWVAOS</Link><span><ShieldCheck size={16} /> Authenticated production form</span></header>
    <div className={styles.shell}>
      <section className={styles.hero}><div><span className={styles.eyebrow}>AUTOMATED FORMS / PRODUCTION AGREEMENT</span><h1>Bill of Sale + One-Year Health Guarantee</h1><p>Select a family and assigned puppy. SWVAOS fills existing buyer, puppy, litter, parent, payment, and scheduled-transfer information; staff completes only details that are not yet stored.</p></div><div className={styles.heroBadge}><FileSignature size={25} /><span><b>One document</b><small>One buyer signature · retained portal copy</small></span></div></section>
      {loadError && <section className={styles.error}><b>Unable to open the form.</b><span>{loadError}</span><button type="button" onClick={() => void load()}><RefreshCw size={15} /> Try again</button></section>}
      {prepared && <section className={styles.success}><CheckCircle2 size={28} /><div><h2>Agreement prepared and saved</h2><p>The pending PDF is in the buyer's portal and ready for electronic signature. The signed PDF will replace the pending copy while retaining the audit record.</p><input readOnly value={prepared.portalUrl} aria-label="Buyer portal URL" /></div><button type="button" onClick={() => void copyPortalLink()}><Copy size={16} /> Copy link</button><a href={prepared.portalUrl} target="_blank" rel="noreferrer">Open portal <ExternalLink size={15} /></a></section>}

      <form className={styles.form} onSubmit={submit}>
        <section className={styles.selectorPanel}>
          <div className={styles.sectionHeading}><ClipboardCheck size={19} /><div><span>STEP 1</span><h2>Choose the family and puppy</h2></div></div>
          <div className={styles.grid}>
            <label><span>Buyer / family</span><select value={buyerId || ""} onChange={(event) => { setBuyerId(Number(event.target.value)); setPrepared(null); }} required><option value="" disabled>Select a buyer</option>{data.buyers.map((item) => <option key={item.id} value={item.id}>{fullName(item)} · {item.application_status || "No status"}</option>)}</select></label>
            <label><span>Assigned puppy</span><select value={puppy?.id || ""} onChange={(event) => { setPuppyId(Number(event.target.value)); setPrepared(null); }} required disabled={!assignedPuppies.length}><option value="" disabled>{assignedPuppies.length ? "Select a puppy" : "No puppy assigned"}</option>{assignedPuppies.map((item) => <option key={item.id} value={item.id}>{item.name} · {[item.sex, item.color, item.status].filter(Boolean).join(" / ")}</option>)}</select></label>
          </div>
          {buyer && !assignedPuppies.length && <p className={styles.notice}>Assign a puppy to this buyer before preparing the production agreement.</p>}
          {buyer && puppy && <div className={styles.autofillSummary}><span><small>Buyer</small><b>{fullName(buyer)}</b></span><span><small>Puppy</small><b>{puppy.name}</b></span><span><small>Recorded price</small><b>{money(puppy.price_cents)}</b></span><span><small>Payments recorded</small><b>{money(paymentSummary.total)}</b></span><span><small>Litter</small><b>{litter?.name || "Not recorded"}</b></span><span><small>Parents</small><b>{[dam?.registered_name || dam?.name, sire?.registered_name || sire?.name].filter(Boolean).join(" / ") || "Not recorded"}</b></span></div>}
        </section>

        {buyer && puppy && <>
          <FormSection title="Agreement and buyer information" step="2">
            <InputField label="Agreement number" name="agreement_number" placeholder="Automatically assigned when left blank" />
            <InputField label="Agreement date" name="agreement_date" type="date" defaultValue={today()} required />
            <InputField label="Buyer legal name" name="buyer_display_name" defaultValue={fullName(buyer)} required readOnly />
            <InputField label="Co-Buyer legal name" name="co_buyer_name" />
            <InputField label="Street address" name="buyer_street_address" defaultValue={buyer.street_address || buyer.address || ""} />
            <InputField label="City / State / ZIP" name="buyer_city_state_zip" defaultValue={cityStateZip} />
            <InputField label="Primary phone" name="buyer_display_phone" defaultValue={buyer.phone || ""} readOnly />
            <InputField label="Email" name="buyer_display_email" type="email" defaultValue={buyer.email || ""} readOnly />
            <InputField label="Emergency contact" name="buyer_emergency_contact" placeholder="Name, relationship, and phone" />
            <SelectField label="Preferred written-notice method" name="buyer_notice_method" defaultValue="Email"><option>Email</option><option>Buyer portal</option><option>Mail</option><option>Text message</option></SelectField>
          </FormSection>

          <FormSection title="Puppy identification and animal history" step="3">
            <InputField label="Puppy name" name="puppy_display_name" defaultValue={puppy.name} required readOnly />
            <InputField label="Sex" name="puppy_display_sex" defaultValue={puppy.sex || ""} readOnly />
            <InputField label="Date of birth" name="puppy_display_birth_date" type="date" defaultValue={dateInput(puppy.birth_date)} readOnly />
            <InputField label="Age at transfer" name="puppy_age_at_transfer" placeholder={puppyAge || "Calculated from DOB and transfer date when prepared"} />
            <InputField label="Color / markings" name="puppy_display_color" defaultValue={puppy.color || ""} readOnly />
            <SelectField label="Coat type" name="puppy_coat_type" defaultValue={puppy.coat_type || ""}><option value="">Not recorded</option><option>Smooth coat / short coat</option><option>Long coat</option></SelectField>
            <InputField label="Current weight" name="puppy_current_weight" defaultValue={puppy.current_weight ? `${puppy.current_weight} lb` : ""} />
            <InputField label="Estimated adult size" name="estimated_adult_size" placeholder="Estimate only; not guaranteed" />
            <InputField label="Microchip number" name="microchip_number" defaultValue={puppy.microchip_number || ""} />
            <InputField label="Registry" name="registry" defaultValue={puppy.registry || ""} placeholder="AKC, CKC, ACA, or other" />
            <InputField label="Registration number / status" name="registration_number" defaultValue={puppy.registration_number || ""} placeholder="Number or Pending" />
            <InputField label="Litter number / internal ID" name="litter_internal_id" defaultValue={litter?.name || (puppy.litter_id ? `Litter #${puppy.litter_id}` : "")} />
            <label className={styles.checkbox}><input name="micro_toy" type="checkbox" /><span>Designate this puppy as very small / Micro-Toy for enhanced care acknowledgments. Adult size is not guaranteed.</span></label>
          </FormSection>

          <FormSection title="Breeder and parent information" step="4">
            <label className={styles.checkbox}><input name="bred_by_seller" type="checkbox" defaultChecked /><span>Puppy was bred by Southwest Virginia Chihuahua.</span></label>
            <InputField label="Person from whom Seller obtained puppy" name="acquired_from" defaultValue="Bred by Seller" />
            <InputField label="Sire" name="sire_display_name" defaultValue={sire?.registered_name || sire?.name || ""} readOnly />
            <InputField label="Sire registration number" name="sire_registration_number" defaultValue={registrationFor(sire?.id, data.dog_registrations, sire || undefined)} />
            <InputField label="Dam" name="dam_display_name" defaultValue={dam?.registered_name || dam?.name || ""} readOnly />
            <InputField label="Dam registration number" name="dam_registration_number" defaultValue={registrationFor(dam?.id, data.dog_registrations, dam || undefined)} />
          </FormSection>

          <FormSection title="Documents and disclosures provided" step="5">
            <SelectField label="Health record / vaccine labels" name="health_record_status" defaultValue="Provided in buyer portal or at transfer"><option>Provided in buyer portal or at transfer</option><option>Attached to agreement</option><option>Pending before transfer</option><option>Not applicable</option></SelectField>
            <SelectField label="Puppy care and feeding guide" name="care_guide_status" defaultValue="Provided"><option>Provided</option><option>Available in buyer portal</option><option>Pending before transfer</option></SelectField>
            <SelectField label="Registration documents" name="registration_documents_status" defaultValue="Pending / as stated below"><option>Delivered</option><option>Pending / as stated below</option><option>Not included</option></SelectField>
            <SelectField label="Microchip instructions" name="microchip_instructions_status" defaultValue="Provided when applicable"><option>Provided when applicable</option><option>Not microchipped</option><option>Pending</option></SelectField>
            <SelectField label="Complimentary insurance information" name="insurance_information_status" defaultValue="30-day Trupanion information provided when eligible"><option>30-day Trupanion information provided when eligible</option><option>Buyer declined</option><option>Not eligible / not included</option></SelectField>
            <SelectField label="Known-condition disclosure" name="known_condition_disclosure_status" defaultValue={puppy.notes ? "Included below" : "No known material condition disclosed"}><option>No known material condition disclosed</option><option>Included below</option><option>Attached separately</option></SelectField>
            <SelectField label="Transport / transfer instructions" name="transport_instructions_status" defaultValue="Provided when applicable"><option>Provided when applicable</option><option>Not applicable</option><option>Pending</option></SelectField>
            <TextAreaField label="Attachments included with this agreement" name="attachments" rows={3} defaultValue="Animal history and health record; puppy care and feeding guidance; registration information when applicable; insurance information when eligible." />
          </FormSection>

          <FormSection title="Sale and payment summary" step="6">
            <InputField label="Cash price of puppy" name="sale_price" type="number" min="0" step="0.01" defaultValue={salePrice.toFixed(2)} required />
            <InputField label="Virginia sales tax, if applicable" name="sales_tax" type="number" min="0" step="0.01" defaultValue="0.00" />
            <InputField label="Transport / delivery charge" name="transport_fee" type="number" min="0" step="0.01" defaultValue="0.00" />
            <InputField label="Other disclosed purchase charges" name="other_charges" type="number" min="0" step="0.01" defaultValue="0.00" />
            <InputField label="Deposit / reservation credit" name="reservation_credit" type="number" min="0" step="0.01" defaultValue={(paymentSummary.reservation / 100).toFixed(2)} />
            <InputField label="Additional payments received" name="additional_payments" type="number" min="0" step="0.01" defaultValue={(paymentSummary.additional / 100).toFixed(2)} />
            <InputField label="Balance due date" name="balance_due_date" type="date" />
            <SelectField label="Payment method" name="payment_method" defaultValue={paymentSummary.method || ""}><option value="">Not recorded</option>{["Good Dog", "Cash", "Check", "Credit card", "Debit card", "Bank transfer / ACH", "PayPal", "Venmo", "Cash App", "Zelle", "Financing", "Other"].map((method) => <option key={method}>{method}</option>)}</SelectField>
          </FormSection>

          <FormSection title="Transfer and delivery record" step="7">
            <label><span>Transfer / pickup date</span><input name="transfer_date" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} required /></label>
            <InputField label="Transfer time" name="transfer_time" type="time" defaultValue={transferEvent?.event_time || ""} />
            <SelectField label="Transfer method" name="transfer_method" defaultValue={transferEvent ? (/deliver|transport/i.test(`${transferEvent.event_type} ${transferEvent.title}`) ? "Ground delivery / transporter" : "Buyer pickup") : "Buyer pickup"}><option>Buyer pickup</option><option>Ground delivery / transporter</option><option>Flight nanny</option><option>Other written arrangement</option></SelectField>
            <InputField label="Transfer location" name="transfer_location" defaultValue={transferEvent?.location || "Marion, Virginia"} />
            <InputField label="Person receiving puppy" name="recipient_name" defaultValue={fullName(buyer)} />
          </FormSection>

          <FormSection title="Transfer-date health disclosure" step="8">
            <TextAreaField label="Known conditions, medications, feeding needs, or disclosures" name="known_conditions" rows={5} defaultValue={puppy.notes || "No known material condition other than information recorded in the attached health record."} />
            <TextAreaField label="Appetite and feeding at transfer" name="appetite_at_transfer" defaultValue="Eating the documented puppy diet and following the provided feeding schedule." />
            <TextAreaField label="Stool / parasite history" name="stool_parasite_history" placeholder="Deworming, testing, treatment, or current findings" />
            <TextAreaField label="Respiratory findings" name="respiratory_findings" defaultValue="No known material respiratory finding unless otherwise disclosed." />
            <TextAreaField label="Skin / coat findings" name="skin_coat_findings" defaultValue="No known material skin or coat finding unless otherwise disclosed." />
            <TextAreaField label="Bite / teeth / hernia findings" name="bite_teeth_hernia_findings" placeholder="Record any bite, retained teeth, umbilical hernia, or inguinal hernia finding" />
            <TextAreaField label="Patella / gait findings" name="patella_gait_findings" placeholder="Record known patella grade, gait issue, or normal observation" />
            <TextAreaField label="Current medication or supplement" name="medication_supplement" placeholder="Name, dose, schedule, and reason, or None" />
            <TextAreaField label="Special feeding instructions" name="special_feeding_instructions" rows={4} placeholder="Meal frequency, overnight feeding, food brand, supplements, and monitoring instructions" />
            <TextAreaField label="Other material health disclosure" name="other_health_disclosure" rows={4} />
          </FormSection>

          <FormSection title="First veterinary examination plan" step="9">
            <InputField label="Veterinary clinic" name="first_vet_clinic" />
            <InputField label="Veterinarian" name="first_vet_name" />
            <InputField label="Appointment date / time" name="first_vet_appointment" type="datetime-local" />
            <InputField label="Clinic phone" name="first_vet_phone" type="tel" />
            <SelectField label="Exam findings" name="first_vet_findings_status" defaultValue="Buyer will provide findings after the examination"><option>Buyer will provide findings after the examination</option><option>Appointment scheduled</option><option>Written findings attached</option><option>Not yet scheduled</option></SelectField>
          </FormSection>

          <FormSection title="Registration, breeding rights, and insurance" step="10">
            <SelectField label="Registration status" name="registration_status" defaultValue={puppy.registration_number ? "Registration number recorded" : "Pending after transfer"}><option>Registration documents delivered</option><option>Registration number recorded</option><option>Pending after transfer</option><option>Not included / pet only without papers</option></SelectField>
            <SelectField label="Registration type" name="registration_type" defaultValue="Limited / pet only"><option>Limited / pet only</option><option>Full registration / breeding rights</option><option>Registration type stated in separate addendum</option><option>Not applicable</option></SelectField>
            <InputField label="Registry promised" name="registry_promised" defaultValue={puppy.registry || ""} />
            <InputField label="Registration documents expected by" name="registration_due_date" type="date" />
            <SelectField label="Spay / neuter term" name="spay_neuter_term" defaultValue="No mandatory procedure date unless separately written"><option>No mandatory procedure date unless separately written</option><option>Spay / neuter required by separate addendum</option><option>Full registration / breeding rights granted</option></SelectField>
            <SelectField label="Separate breeding addendum" name="breeding_addendum" defaultValue="No"><option>No</option><option>Yes - attached</option><option>Yes - retained separately in buyer portal</option></SelectField>
            <SelectField label="Complimentary insurance" name="insurance_selection" defaultValue="30-day Trupanion offer provided when eligible"><option>30-day Trupanion offer provided when eligible</option><option>Buyer accepted / activation information provided</option><option>Buyer declined</option><option>Not eligible / not included</option></SelectField>
            <InputField label="Seller's authorized representative" name="seller_representative" defaultValue="Southwest Virginia Chihuahua LLC" />
          </FormSection>

          {submitError && <div className={styles.errorInline}>{submitError}</div>}
          <footer className={styles.actions}><div><b>Before preparing</b><span>Confirm every prefilled value, complete all material disclosures, and verify the assigned puppy and purchase figures.</span></div><Link href="/"><ArrowLeft size={16} /> Cancel</Link><button type="submit" disabled={saving || !buyer || !puppy}><FileSignature size={17} /> {saving ? "Preparing and saving…" : "Prepare, save, and send to portal"}</button></footer>
        </>}
      </form>
    </div>
  </main>;
}
