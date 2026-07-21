"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Dog as DogIcon,
  ExternalLink,
  FileText,
  HeartPulse,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { uploadDocumentDirect } from "../../../lib/direct-document-upload";

type BaseRecord = { id: number; created_at: string; updated_at: string };
type Dog = BaseRecord & {
  name: string;
  registered_name: string | null;
  sex: string;
  role: string;
  date_of_birth: string | null;
  color: string | null;
  weight: number | null;
  registration_number: string | null;
  microchip_number: string | null;
  health_testing: string | null;
  acquired_from: string | null;
  acquisition_date: string | null;
  purchase_price_cents: number | null;
  acquisition_notes: string | null;
  status: string;
  next_heat_date: string | null;
  notes: string | null;
};
type MedicalRecord = BaseRecord & { dog_id: number; record_type: string; title: string; record_date: string | null; provider: string | null; cost_cents: number; next_due_date: string | null; notes: string | null };
type Registration = BaseRecord & { dog_id: number; registry: string; registration_number: string; registered_name: string | null; issue_date: string | null; notes: string | null };
type Transaction = BaseRecord & { type: string; dog_id: number | null; buyer_id: number | null; litter_id: number | null; puppy_id: number | null; payment_plan_id: number | null; category: string | null; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null; notes: string | null };
type Litter = BaseRecord & { name: string; dam_id: number | null; sire_id: number | null; breeding_date: string | null; due_date: string | null; birth_date: string | null; expected_count: number | null; status: string; notes: string | null };
type Puppy = BaseRecord & { litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null };
type Buyer = BaseRecord & { first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; application_status: string };
type PaymentPlan = BaseRecord & { buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type DogDocument = BaseRecord & { dog_id: number; registration_id: number | null; document_type: string; registry: string | null; registration_number: string | null; title: string; file_name: string; content_type: string; size_bytes: number; notes: string | null };
type DataSet = { dogs: Dog[]; dog_medical_records: MedicalRecord[]; dog_registrations: Registration[]; dog_documents: DogDocument[]; transactions: Transaction[]; litters: Litter[]; puppies: Puppy[]; buyers: Buyer[]; payment_plans: PaymentPlan[] };
type ProfileModal = { kind: "dog" | "registry" | "medical" | "cost" | "document"; record?: Record<string, unknown> } | null;

const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const shortDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Not recorded";
const fileSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const buyerName = (buyer: Buyer | undefined) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Family #${buyer.id}` : "No family assigned";
const fieldValue = (record: Record<string, unknown> | undefined, key: string) => String(record?.[key] ?? "");
const dollarValue = (record: Record<string, unknown> | undefined, key: string) => typeof record?.[key] === "number" ? String((record[key] as number) / 100) : "";
const friendlyError = (value: unknown, fallback: string) => {
  const message = value instanceof Error ? value.message : String(value || fallback);
  if (/schema cache|could not find the table|relation .* does not exist|column .* does not exist/i.test(message)) return "The SWVAOS data structure needs attention.";
  if (/not configured|missing.*key|missing.*url/i.test(message)) return "The SWVAOS data connection is not configured.";
  return message.replace(/supabase/gi, "data service").replace(/vercel/gi, "hosting service").replace(/chatgpt/gi, "previous site");
};

const documentTypes = ["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Medical Documentation", "Other"];

function Field({ label, name, record, type = "text", required = false, defaultValue }: { label: string; name: string; record?: Record<string, unknown>; type?: string; required?: boolean; defaultValue?: string }) {
  return <label><span>{label}</span><input name={name} type={type} required={required} defaultValue={defaultValue ?? fieldValue(record, name)} /></label>;
}

function Notes({ label, name, record, rows = 3 }: { label: string; name: string; record?: Record<string, unknown>; rows?: number }) {
  return <label className="wide"><span>{label}</span><textarea name={name} rows={rows} defaultValue={fieldValue(record, name)} /></label>;
}

function EmptyProfileSection({ title, text }: { title: string; text: string }) {
  return <div className="profile-empty"><b>{title}</b><span>{text}</span></div>;
}

export default function DogProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dogId = Number(id);
  const [data, setData] = useState<DataSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ProfileModal>(null);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this profile.");
      setData(payload);
    } catch (loadError) {
      setError(friendlyError(loadError, "Unable to load this profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const dog = data?.dogs.find((candidate) => candidate.id === dogId) ?? null;
  useEffect(() => { if (dog) document.title = `${dog.name} | SWVAOS`; }, [dog]);

  const profile = useMemo(() => {
    if (!data || !dog) return null;
    const medical = data.dog_medical_records.filter((item) => item.dog_id === dog.id).sort((left, right) => String(right.record_date ?? right.created_at).localeCompare(String(left.record_date ?? left.created_at)));
    const registrations = data.dog_registrations.filter((item) => item.dog_id === dog.id);
    const documents = data.dog_documents.filter((item) => item.dog_id === dog.id);
    const litters = data.litters.filter((item) => item.dam_id === dog.id || item.sire_id === dog.id);
    const litterIds = new Set(litters.map((litter) => litter.id));
    const puppies = data.puppies.filter((puppy) => litterIds.has(puppy.litter_id));
    const puppyIds = new Set(puppies.map((puppy) => puppy.id));
    const buyerIds = new Set(puppies.map((puppy) => puppy.buyer_id).filter((buyerId): buyerId is number => Boolean(buyerId)));
    const buyers = data.buyers.filter((buyer) => buyerIds.has(buyer.id));
    const plans = data.payment_plans.filter((plan) => plan.puppy_ids?.some((puppyId) => puppyIds.has(puppyId)) || buyerIds.has(plan.buyer_id));
    const planIds = new Set(plans.map((plan) => plan.id));
    const relatedTransactions = data.transactions.filter((item) =>
      item.dog_id === dog.id
      || (item.litter_id ? litterIds.has(item.litter_id) : false)
      || (item.puppy_id ? puppyIds.has(item.puppy_id) : false)
      || (item.payment_plan_id ? planIds.has(item.payment_plan_id) : false)
      || (item.buyer_id ? buyerIds.has(item.buyer_id) : false)
    ).sort((left, right) => String(right.paid_date ?? right.due_date ?? right.created_at).localeCompare(String(left.paid_date ?? left.due_date ?? left.created_at)));
    const costs = relatedTransactions.filter((item) => item.type === "Cost");
    const payments = relatedTransactions.filter((item) => item.type === "Payment" || item.type === "Deposit");
    const paidPayments = payments.filter((item) => item.status === "Paid" || item.status === "Complete");
    const outstandingPayments = payments.filter((item) => item.status !== "Paid" && item.status !== "Complete" && item.status !== "Cancelled" && item.status !== "Voided");
    const medicalCost = medical.reduce((sum, item) => sum + (item.cost_cents || 0), 0);
    const otherCost = costs.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
    const totalCost = (dog.purchase_price_cents ?? 0) + medicalCost + otherCost;
    const revenue = paidPayments.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
    const outstanding = outstandingPayments.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
    return { medical, registrations, documents, costs, litters, puppies, buyers, plans, payments, paidPayments, outstandingPayments, medicalCost, otherCost, totalCost, revenue, outstanding, net: revenue - totalCost };
  }, [data, dog]);

  const openModal = (kind: NonNullable<ProfileModal>["kind"], record?: Record<string, unknown>) => {
    setModalError("");
    setModal({ kind, record });
  };

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.kind === "document") return;
    setSaving(true);
    setModalError("");
    const resource = modal.kind === "dog" ? "dogs" : modal.kind === "registry" ? "dog_registrations" : modal.kind === "medical" ? "dog_medical_records" : "transactions";
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/data", {
        method: modal.record?.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, id: modal.record?.id, data: values }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save this record.");
      setModal(null);
      setToast("Profile updated");
      await loadData();
    } catch (saveError) {
      setModalError(friendlyError(saveError, "Unable to save this record."));
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setModalError("");
    try {
      await uploadDocumentDirect(new FormData(event.currentTarget), "dog");
      setModal(null);
      setToast("Document uploaded");
      await loadData();
    } catch (uploadError) {
      setModalError(friendlyError(uploadError, "Unable to upload this document."));
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(resource: "dog_registrations" | "dog_medical_records" | "transactions", recordId: number, label: string) {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/data?resource=${resource}&id=${recordId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(friendlyError(payload.error, "Unable to delete this record."));
      return;
    }
    setToast("Record deleted");
    await loadData();
  }

  async function removeDocument(documentId: number, label: string) {
    if (!window.confirm(`Delete "${label}" from this profile? This cannot be undone.`)) return;
    const response = await fetch(`/api/dog-documents?id=${documentId}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(friendlyError(payload.error, "Unable to delete this document."));
      return;
    }
    setToast("Document deleted");
    await loadData();
  }

  if (loading) return <main className="profile-state"><span className="profile-spinner" />Loading profile...</main>;
  if (error && !data) return <main className="profile-state"><b>Something needs attention</b><p>{error}</p><button onClick={() => void loadData()}>Retry</button></main>;
  if (!dog || !profile) return <main className="profile-state"><b>Profile not found</b><p>This dog record is not available.</p><Link href="/"><ArrowLeft size={16} /> Return to SWVAOS</Link></main>;

  const profileRecord = dog as unknown as Record<string, unknown>;

  return <main className="dog-profile-page">
    <header className="profile-topbar">
      <Link href="/" className="profile-brand"><span><DogIcon size={20} /></span><b>SWVAOS</b><small>Dog profile</small></Link>
      <div className="profile-top-actions"><Link href="/"><ArrowLeft size={16} /> Back to operating system</Link><button onClick={() => openModal("dog", profileRecord)}><Pencil size={16} /> Edit profile</button></div>
    </header>

    <div className="profile-content">
      {error && <div className="profile-error"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
      <section className="profile-identity">
        <div className="profile-monogram">{dog.name.slice(0, 1).toUpperCase()}</div>
        <div className="profile-name"><span>{dog.role || "Breeding dog"}</span><h1>{dog.name}</h1><p>{dog.registered_name || "Registered name not recorded"}</p><div><i className={dog.status === "Active" ? "active" : ""}>{dog.status}</i><i>{dog.sex}</i><i>{dog.color || "Color not recorded"}</i></div></div>
        <div className="profile-command-bar">
          <button onClick={() => openModal("registry")}><ShieldCheck size={17} /> Add registry</button>
          <button onClick={() => openModal("medical")}><HeartPulse size={17} /> Add medical</button>
          <button onClick={() => openModal("cost")}><CircleDollarSign size={17} /> Add cost</button>
          <button className="primary-action" onClick={() => openModal("document")}><Upload size={17} /> Upload file</button>
        </div>
      </section>

      <section className="profile-stat-grid" aria-label="Profile totals">
        <article><span>Sales collected</span><b>{money(profile.revenue)}</b><small>{profile.paidPayments.length} paid transactions</small></article>
        <article><span>Outstanding</span><b>{money(profile.outstanding)}</b><small>{profile.outstandingPayments.length} open transactions</small></article>
        <article><span>Program costs</span><b>{money(profile.totalCost)}</b><small>Purchase, medical, litter, and puppy costs</small></article>
        <article><span>Net contribution</span><b>{money(profile.net)}</b><small>Collected sales minus recorded costs</small></article>
        <article><span>Litters / puppies</span><b>{profile.litters.length} / {profile.puppies.length}</b><small>{profile.buyers.length} connected families</small></article>
        <article><span>Files</span><b>{profile.documents.length}</b><small>Documents attached</small></article>
      </section>

      <div className="profile-layout">
        <section className="profile-section profile-overview">
          <header><span>Core profile</span><h2>Identity and acquisition</h2><button onClick={() => openModal("dog", profileRecord)}><Pencil size={15} /> Edit</button></header>
          <div className="profile-facts">
            <span><small>Date of birth</small><b>{shortDate(dog.date_of_birth)}</b></span>
            <span><small>Weight</small><b>{dog.weight ? `${dog.weight} lb` : "Not recorded"}</b></span>
            <span><small>Microchip</small><b>{dog.microchip_number || "Not recorded"}</b></span>
            <span><small>Primary registration</small><b>{dog.registration_number || "See registry records"}</b></span>
            <span><small>Acquired from</small><b>{dog.acquired_from || "Not recorded"}</b></span>
            <span><small>Acquisition date</small><b>{shortDate(dog.acquisition_date)}</b></span>
            <span><small>Purchase price</small><b>{money(dog.purchase_price_cents)}</b></span>
            <span><small>Next heat</small><b>{shortDate(dog.next_heat_date)}</b></span>
          </div>
          <div className="profile-notes"><span><b>Health testing</b><p>{dog.health_testing || "No health testing summary recorded."}</p></span><span><b>Acquisition notes</b><p>{dog.acquisition_notes || "No acquisition notes recorded."}</p></span><span><b>General notes</b><p>{dog.notes || "No general notes recorded."}</p></span></div>
        </section>

        <section className="profile-section">
          <header><span>Registry center</span><h2>Registries and identifiers</h2><button onClick={() => openModal("registry")}><Plus size={15} /> Add</button></header>
          {profile.registrations.length ? <div className="profile-record-list">{profile.registrations.map((registration) => <article key={registration.id}><div className="record-icon"><ShieldCheck size={18} /></div><div><b>{registration.registry}</b><p>{registration.registration_number}</p><small>{registration.registered_name || dog.registered_name || dog.name} / issued {shortDate(registration.issue_date)}</small></div><div className="profile-row-actions"><button aria-label={`Edit ${registration.registry}`} title="Edit registry" onClick={() => openModal("registry", registration as unknown as Record<string, unknown>)}><Pencil size={15} /></button><button aria-label={`Delete ${registration.registry}`} title="Delete registry" onClick={() => void removeRecord("dog_registrations", registration.id, registration.registry)}><Trash2 size={15} /></button></div></article>)}</div> : <EmptyProfileSection title="No registry records" text="Add AKC, CKC, ACA, UKC, or any other registration connected to this dog." />}
        </section>

        <section className="profile-section profile-wide">
          <header><span>Medical timeline</span><h2>Health, testing, and care</h2><button onClick={() => openModal("medical")}><Plus size={15} /> Add medical</button></header>
          {profile.medical.length ? <div className="profile-table"><div className="profile-table-head"><span>Record</span><span>Provider</span><span>Date</span><span>Next due</span><span>Cost</span><span /></div>{profile.medical.map((record) => <article key={record.id}><span><b>{record.title}</b><small>{record.record_type}</small></span><span>{record.provider || "Not recorded"}</span><span>{shortDate(record.record_date)}</span><span>{shortDate(record.next_due_date)}</span><strong>{money(record.cost_cents)}</strong><div className="profile-row-actions"><button aria-label={`Edit ${record.title}`} title="Edit medical record" onClick={() => openModal("medical", record as unknown as Record<string, unknown>)}><Pencil size={15} /></button><button aria-label={`Delete ${record.title}`} title="Delete medical record" onClick={() => void removeRecord("dog_medical_records", record.id, record.title)}><Trash2 size={15} /></button></div></article>)}</div> : <EmptyProfileSection title="No medical records" text="Track exams, vaccines, genetic testing, medications, procedures, providers, costs, and next due dates." />}
        </section>

        <section className="profile-section">
          <header><span>Cost ledger</span><h2>Expenses and purchases</h2><button onClick={() => openModal("cost")}><Plus size={15} /> Add cost</button></header>
          {profile.costs.length ? <div className="profile-record-list">{profile.costs.map((cost) => <article key={cost.id}><div className="record-icon cost"><ReceiptText size={18} /></div><div><b>{cost.description}</b><p>{money(cost.amount_cents)}</p><small>{[cost.category, cost.method, shortDate(cost.paid_date || cost.due_date), cost.status].filter(Boolean).join(" / ")}</small></div><div className="profile-row-actions"><button aria-label={`Edit ${cost.description}`} title="Edit cost" onClick={() => openModal("cost", cost as unknown as Record<string, unknown>)}><Pencil size={15} /></button><button aria-label={`Delete ${cost.description}`} title="Delete cost" onClick={() => void removeRecord("transactions", cost.id, cost.description)}><Trash2 size={15} /></button></div></article>)}</div> : <EmptyProfileSection title="No additional costs" text="Record food, equipment, transport, grooming, supplies, fees, and any other dog-specific expense." />}
        </section>

        <section className="profile-section">
          <header><span>Breeding history</span><h2>Litters and offspring</h2></header>
          {profile.litters.length ? <div className="profile-record-list">{profile.litters.map((litter) => <article key={litter.id}><div className="record-icon litter"><CalendarDays size={18} /></div><div><b>{litter.name}</b><p>{litter.dam_id === dog.id ? "Dam" : "Sire"} / {litter.status}</p><small>{shortDate(litter.birth_date || litter.due_date)} / {profile.puppies.filter((puppy) => puppy.litter_id === litter.id).length} puppies</small></div><div className="profile-row-actions"><Link href={`/litters/${litter.id}`} aria-label={`Open ${litter.name}`} title="Open litter"><ExternalLink size={15} /></Link></div></article>)}</div> : <EmptyProfileSection title="No breeding history" text="Litters connected to this dog will appear here with dates, role, status, and offspring totals." />}
        </section>

        <section className="profile-section profile-wide">
          <header><span>Connected placement network</span><h2>Puppies and families</h2></header>
          {profile.puppies.length ? <div className="profile-document-grid">{profile.puppies.map((puppy) => { const buyer = data?.buyers.find((candidate) => candidate.id === puppy.buyer_id); return <article key={puppy.id}><div className="record-icon litter"><DogIcon size={18} /></div><div><b>{puppy.name}</b><p>{[puppy.sex, puppy.color, puppy.status, money(puppy.price_cents)].filter(Boolean).join(" / ")}</p><small>{profile.litters.find((litter) => litter.id === puppy.litter_id)?.name || "Unlinked litter"} / {buyerName(buyer)}</small></div><div className="profile-row-actions"><Link href={`/puppies/${puppy.id}`} aria-label={`Open ${puppy.name}`} title="Open puppy"><DogIcon size={15} /></Link>{buyer && <Link href={`/families/${buyer.id}`} aria-label={`Open ${buyerName(buyer)}`} title="Open family"><ExternalLink size={15} /></Link>}</div></article>; })}</div> : <EmptyProfileSection title="No puppies recorded" text="Puppies connected through this dog's litters will appear here with their family, price, and placement status." />}
        </section>

        <section className="profile-section profile-wide">
          <header><span>Linked sales ledger</span><h2>Payments and deposits</h2></header>
          {profile.payments.length ? <div className="profile-table payment-profile-table"><div className="profile-table-head"><span>Payment</span><span>Family / puppy</span><span>Date</span><span>Status</span><span>Amount</span><span /></div>{profile.payments.map((payment) => { const puppy = data?.puppies.find((candidate) => candidate.id === payment.puppy_id); const buyer = data?.buyers.find((candidate) => candidate.id === payment.buyer_id) || data?.buyers.find((candidate) => candidate.id === puppy?.buyer_id); return <article key={payment.id}><span><b>{payment.description}</b><small>{[payment.type, payment.method, payment.category].filter(Boolean).join(" / ")}</small></span><span>{[buyerName(buyer), puppy?.name].filter(Boolean).join(" / ")}</span><span>{shortDate(payment.paid_date || payment.due_date)}</span><span>{payment.status}</span><strong>{money(payment.amount_cents)}</strong><div className="profile-row-actions">{puppy ? <Link href={`/puppies/${puppy.id}`} title="Open puppy"><ExternalLink size={15} /></Link> : buyer ? <Link href={`/families/${buyer.id}`} title="Open family"><ExternalLink size={15} /></Link> : null}</div></article>; })}</div> : <EmptyProfileSection title="No linked payments" text="Payments and deposits connected to this dog, its litters, puppies, payment plans, or families will appear here automatically." />}
        </section>

        <section className="profile-section profile-wide">
          <header><span>Document vault</span><h2>Files and scanned records</h2><button onClick={() => openModal("document")}><Upload size={15} /> Upload file</button></header>
          {profile.documents.length ? <div className="profile-document-grid">{profile.documents.map((document) => <article key={document.id}><div className="record-icon file"><FileText size={18} /></div><div><b>{document.title}</b><p>{document.document_type}</p><small>{[document.registry, document.registration_number, fileSize(document.size_bytes)].filter(Boolean).join(" / ")}</small></div><div className="profile-row-actions"><a href={`/api/dog-documents/${document.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${document.title}`} title="Open document"><ExternalLink size={15} /></a><button aria-label={`Delete ${document.title}`} title="Delete document" onClick={() => void removeDocument(document.id, document.title)}><Trash2 size={15} /></button></div></article>)}</div> : <EmptyProfileSection title="No documents attached" text="Upload registrations, pedigrees, health results, certificates, photos, and other profile files." />}
        </section>
      </div>
    </div>

    {modal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      {modal.kind === "document" ? <form className="modal profile-modal" onSubmit={uploadDocument}>
        <header><span>Document vault</span><h2 id="profile-modal-title">Upload file</h2><button className="icon-button" type="button" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button></header>
        <div className="form-grid">
          <input type="hidden" name="dog_id" value={dog.id} />
          <label><span>Document type</span><select name="document_type" required>{documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label><span>Connected registry</span><select name="registration_id" defaultValue=""><option value="">No registry connection</option>{profile.registrations.map((registration) => <option key={registration.id} value={registration.id}>{registration.registry} / {registration.registration_number}</option>)}</select></label>
          <Field label="Title" name="title" />
          <Field label="Registry" name="registry" />
          <Field label="Registration number" name="registration_number" />
          <label className="wide file-input"><span>PDF or image</span><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required /><small>PDF, JPG, PNG, or WebP. Maximum 20 MB.</small></label>
          <Notes label="Notes" name="notes" />
          {modalError && <div className="inline-error wide">{modalError}</div>}
        </div>
        <footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="primary-action" disabled={saving}><Upload size={16} /> {saving ? "Uploading..." : "Upload file"}</button></footer>
      </form> : <form className="modal profile-modal" onSubmit={saveRecord}>
        <header><span>{modal.record?.id ? "Edit record" : "Add record"}</span><h2 id="profile-modal-title">{modal.kind === "dog" ? "Dog profile" : modal.kind === "registry" ? "Registry" : modal.kind === "medical" ? "Medical record" : "Dog cost"}</h2><button className="icon-button" type="button" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button></header>
        <div className="form-grid">
          {modal.kind === "dog" && <>
            <Field label="Name" name="name" record={modal.record} required /><Field label="Registered name" name="registered_name" record={modal.record} />
            <Field label="Sex" name="sex" record={modal.record} required /><Field label="Role" name="role" record={modal.record} required />
            <Field label="Date of birth" name="date_of_birth" type="date" record={modal.record} /><Field label="Color" name="color" record={modal.record} />
            <Field label="Weight (lb)" name="weight" type="number" record={modal.record} /><Field label="Status" name="status" record={modal.record} />
            <Field label="Microchip number" name="microchip_number" record={modal.record} /><Field label="Primary registration number" name="registration_number" record={modal.record} />
            <Field label="Acquired from" name="acquired_from" record={modal.record} /><Field label="Acquisition date" name="acquisition_date" type="date" record={modal.record} />
            <Field label="Purchase price" name="purchase_price" type="number" record={modal.record} defaultValue={dollarValue(modal.record, "purchase_price_cents")} /><Field label="Next heat" name="next_heat_date" type="date" record={modal.record} />
            <Notes label="Health testing" name="health_testing" record={modal.record} /><Notes label="Acquisition notes" name="acquisition_notes" record={modal.record} /><Notes label="General notes" name="notes" record={modal.record} />
          </>}
          {modal.kind === "registry" && <>
            <input type="hidden" name="dog_id" value={dog.id} />
            <Field label="Registry" name="registry" record={modal.record} required /><Field label="Registration number" name="registration_number" record={modal.record} required />
            <Field label="Registered name" name="registered_name" record={modal.record} defaultValue={fieldValue(modal.record, "registered_name") || dog.registered_name || dog.name} /><Field label="Issue date" name="issue_date" type="date" record={modal.record} />
            <Notes label="Notes" name="notes" record={modal.record} />
          </>}
          {modal.kind === "medical" && <>
            <input type="hidden" name="dog_id" value={dog.id} />
            <Field label="Record type" name="record_type" record={modal.record} required /><Field label="Title" name="title" record={modal.record} required />
            <Field label="Record date" name="record_date" type="date" record={modal.record} /><Field label="Provider or clinic" name="provider" record={modal.record} />
            <Field label="Cost" name="cost" type="number" record={modal.record} defaultValue={dollarValue(modal.record, "cost_cents")} /><Field label="Next due date" name="next_due_date" type="date" record={modal.record} />
            <Notes label="Results, treatment, and notes" name="notes" record={modal.record} rows={5} />
          </>}
          {modal.kind === "cost" && <>
            <input type="hidden" name="type" value="Cost" /><input type="hidden" name="dog_id" value={dog.id} />
            <input type="hidden" name="buyer_id" value={fieldValue(modal.record, "buyer_id")} /><input type="hidden" name="litter_id" value={fieldValue(modal.record, "litter_id")} /><input type="hidden" name="puppy_id" value={fieldValue(modal.record, "puppy_id")} /><input type="hidden" name="payment_plan_id" value={fieldValue(modal.record, "payment_plan_id")} />
            <Field label="Description" name="description" record={modal.record} required /><Field label="Category" name="category" record={modal.record} />
            <Field label="Amount" name="amount" type="number" record={modal.record} required defaultValue={dollarValue(modal.record, "amount_cents")} /><Field label="Status" name="status" record={modal.record} defaultValue={fieldValue(modal.record, "status") || "Paid"} />
            <Field label="Paid date" name="paid_date" type="date" record={modal.record} /><Field label="Due date" name="due_date" type="date" record={modal.record} />
            <Field label="Payment method" name="method" record={modal.record} /><Notes label="Vendor, receipt, purpose, and notes" name="notes" record={modal.record} rows={4} />
          </>}
          {modalError && <div className="inline-error wide">{modalError}</div>}
        </div>
        <footer><button type="button" onClick={() => setModal(null)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving..." : modal.record?.id ? "Save changes" : "Add record"}</button></footer>
      </form>}
    </div>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
