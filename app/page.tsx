"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Command as CommandIcon,
  Dog as DogIcon,
  ExternalLink,
  FileText,
  FileSignature,
  FolderOpen,
  HeartPulse,
  Headphones,
  LayoutDashboard,
  ListTree,
  MessagesSquare,
  MonitorSmartphone,
  PackageSearch,
  PawPrint,
  ClipboardCheck,
  MessageSquareText,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Search as SearchIcon,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Voicemail,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { healthGuaranteeTerms } from "../lib/contract-templates";
import { uploadDocumentDirect } from "../lib/direct-document-upload";
import { defaultTemplatesConfig, type TemplatesConfig } from "../lib/template-defaults";
import { TemplatesCenter } from "../components/templates-center";

type Resource = "dogs" | "litters" | "buyers" | "puppies" | "payment_plans" | "transactions" | "events" | "updates" | "dog_medical_records" | "dog_registrations";
type BaseRecord = { id: number; created_at: string; updated_at: string };
type Dog = BaseRecord & { name: string; registered_name: string | null; sex: string; role: string; date_of_birth: string | null; color: string | null; weight: number | null; status: string; registration_number: string | null; microchip_number: string | null; health_testing: string | null; acquired_from: string | null; acquisition_date: string | null; acquisition_notes: string | null; next_heat_date: string | null; notes: string | null; purchase_price_cents: number | null };
type Litter = BaseRecord & { name: string; dam_id: number | null; sire_id: number | null; breeding_date: string | null; due_date: string | null; birth_date: string | null; expected_count: number | null; status: string; notes: string | null };
type Buyer = BaseRecord & { first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null };
type Puppy = BaseRecord & { litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null; notes: string | null };
type PaymentPlan = BaseRecord & { buyer_id: number; name: string; total_amount_cents: number; payment_amount_cents: number; term_count: number; frequency: string; next_due_date: string | null; status: string; puppy_ids: number[] };
type Transaction = BaseRecord & { type: "Payment" | "Deposit" | "Cost"; dog_id: number | null; buyer_id: number | null; litter_id: number | null; puppy_id: number | null; payment_plan_id: number | null; category: string | null; description: string; amount_cents: number; due_date: string | null; paid_date: string | null; status: string; method: string | null; notes: string | null };
type KennelEvent = BaseRecord & { title: string; event_type: string; event_date: string; event_time: string | null; related_type: string | null; related_id: number | null; location: string | null; status: string; notes: string | null };
type PuppyUpdate = BaseRecord & { puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; published: number | boolean };
type DogMedicalRecord = BaseRecord & { dog_id: number; record_type: string; title: string; record_date: string | null; provider: string | null; cost_cents: number; next_due_date: string | null; notes: string | null };
type DogRegistration = BaseRecord & { dog_id: number; registry: string; registration_number: string; registered_name: string | null; issue_date: string | null; notes: string | null };
type StoredDocument = BaseRecord & { title: string; file_name: string; content_type: string; size_bytes: number; document_type: string };
type DogDocument = StoredDocument & { dog_id: number; registration_id: number | null; registry: string | null; registration_number: string | null };
type BuyerDocument = StoredDocument & { buyer_id: number; payment_plan_id: number | null; puppy_ids: number[]; notes?: string | null };
type DataSet = { dogs: Dog[]; litters: Litter[]; buyers: Buyer[]; puppies: Puppy[]; payment_plans: PaymentPlan[]; transactions: Transaction[]; events: KennelEvent[]; updates: PuppyUpdate[]; dog_medical_records: DogMedicalRecord[]; dog_registrations: DogRegistration[]; dog_documents: DogDocument[]; buyer_documents: BuyerDocument[] };
type ModalState = { resource: Resource; record?: Record<string, unknown>; preset?: Record<string, unknown> } | null;
type DocumentKind = "dog" | "buyer";
type DocumentModalState = { kind: DocumentKind; ownerId?: number } | null;
type ContractModalState = { buyerId: number; portalUrl?: string } | null;
type View = "Command" | "Breeding" | "Litters" | "Puppies" | "Care" | "Applications" | "Families" | "Placement" | "Delivery" | "Finance" | "Inventory" | "Comms" | "Portal" | "CRM" | "Calendar" | "Vault" | "Templates" | "Reports";
type ViewGroup = "Daily work" | "Breeding program" | "Placement journey" | "Business" | "Tools";
type ViewDefinition = { id: View; label: string; icon: LucideIcon; group: ViewGroup; shortcut: string };

const emptyData: DataSet = { dogs: [], litters: [], buyers: [], puppies: [], payment_plans: [], transactions: [], events: [], updates: [], dog_medical_records: [], dog_registrations: [], dog_documents: [], buyer_documents: [] };
const views: ViewDefinition[] = [
  { id: "Command", label: "Today", icon: LayoutDashboard, group: "Daily work", shortcut: "1" },
  { id: "Calendar", label: "Schedule", icon: CalendarDays, group: "Daily work", shortcut: "C" },
  { id: "Breeding", label: "Dogs & breeding", icon: DogIcon, group: "Breeding program", shortcut: "2" },
  { id: "Litters", label: "Litters", icon: ListTree, group: "Breeding program", shortcut: "L" },
  { id: "Puppies", label: "Puppies", icon: PawPrint, group: "Breeding program", shortcut: "P" },
  { id: "Care", label: "Health & care", icon: HeartPulse, group: "Breeding program", shortcut: "4" },
  { id: "Applications", label: "Applications", icon: ClipboardCheck, group: "Placement journey", shortcut: "A" },
  { id: "Families", label: "Buyers & waitlist", icon: UsersRound, group: "Placement journey", shortcut: "3" },
  { id: "Placement", label: "Puppy placement", icon: UserRound, group: "Placement journey", shortcut: "M" },
  { id: "Delivery", label: "Pickup & delivery", icon: Route, group: "Placement journey", shortcut: "D" },
  { id: "Finance", label: "Payments & sales", icon: WalletCards, group: "Business", shortcut: "5" },
  { id: "Inventory", label: "Costs", icon: PackageSearch, group: "Business", shortcut: "6" },
  { id: "Comms", label: "Communications", icon: MessagesSquare, group: "Business", shortcut: "7" },
  { id: "Templates", label: "Automations & templates", icon: MessageSquareText, group: "Business", shortcut: "T" },
  { id: "Reports", label: "Reports", icon: ChartNoAxesCombined, group: "Business", shortcut: "R" },
  { id: "Portal", label: "Family portal", icon: MonitorSmartphone, group: "Tools", shortcut: "8" },
  { id: "CRM", label: "Phone center", icon: Headphones, group: "Tools", shortcut: "9" },
  { id: "Vault", label: "Documents", icon: FolderOpen, group: "Tools", shortcut: "V" },
];
const viewGroups: ViewGroup[] = ["Daily work", "Breeding program", "Placement journey", "Business", "Tools"];

const dogDocumentTypes = ["Registration Certificate", "Pedigree", "Embark Results", "OFA Test Results", "Genetic Test Results", "Health Test Results", "Health Certificate", "Medical Documentation", "Other"];
const buyerDocumentTypes = ["Bill of Sale", "Health Guarantee", "Payment Plan Agreement", "Other"];
const paymentDescriptions = ["Puppy deposit", "Reservation fee", "Installment payment", "Final balance", "Delivery fee", "Registration fee", "Refund", "Other payment"];
const costDescriptions = ["Veterinary care", "Vaccination", "Health testing", "Medication", "Food or supplements", "Kennel supplies", "Equipment", "Grooming", "Registration", "Breeding service", "Travel or delivery", "Payment processing fee", "Refund issued", "Other expense"];
const paymentCategories = ["Puppy sale", "Deposit", "Reservation", "Installment", "Final balance", "Delivery", "Registration", "Refund", "Other income"];
const costCategories = ["Veterinary", "Health testing", "Medication", "Food", "Supplies", "Equipment", "Grooming", "Registration", "Breeding", "Travel and delivery", "Payment processing", "Refund", "Other expense"];
const transactionMethods = ["Cash", "Check", "Credit card", "Debit card", "Bank transfer / ACH", "PayPal", "Venmo", "Cash App", "Zelle", "Financing", "Other"];
const transactionStatuses = ["Pending", "Due", "Partially paid", "Paid", "Overdue", "Refunded", "Reimbursed", "Voided"];
const transactionFeePattern = /^\[Fee charged: \$([0-9]+(?:\.[0-9]{1,2})?)\]\s*/i;
const paymentTypes = new Set(["Payment", "Deposit"]);
const paidStatuses = new Set(["Paid", "Complete"]);

const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const normalizePhone = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "").slice(-10);
const latestCallEvent = (events: KennelEvent[]) => events
  .filter((event) => event.event_type === "Call")
  .sort((left, right) => `${right.created_at}${right.id}`.localeCompare(`${left.created_at}${left.id}`))[0] ?? null;
const shortDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Not set";
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysUntil = (value: string | null | undefined) => value ? Math.ceil((new Date(`${value}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000) : null;
const fullName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const valueOf = (record: Record<string, unknown> | undefined, key: string, fallback = "") => String(record?.[key] ?? fallback);
const transactionFeeDefault = (record?: Record<string, unknown>, preset?: Record<string, unknown>) => {
  const explicit = valueOf(record, "fee_amount", valueOf(preset, "fee_amount"));
  if (explicit) return explicit;
  return String(record?.notes ?? preset?.notes ?? "").match(transactionFeePattern)?.[1] ?? "";
};
const transactionNotesDefault = (record?: Record<string, unknown>, preset?: Record<string, unknown>) => String(record?.notes ?? preset?.notes ?? "").replace(transactionFeePattern, "");
const transactionFeeCents = (transaction: Transaction) => {
  const fee = transaction.notes?.match(transactionFeePattern)?.[1];
  return fee ? Math.round(Number(fee) * 100) : 0;
};
const transactionNotesWithFee = (notes: unknown, fee: unknown) => {
  const cleanNotes = String(notes ?? "").replace(transactionFeePattern, "").trim();
  const amount = Number(fee);
  if (!Number.isFinite(amount) || amount <= 0) return cleanNotes;
  return `[Fee charged: $${amount.toFixed(2)}]${cleanNotes ? `\n${cleanNotes}` : ""}`;
};
const isPaymentTransaction = (transaction: Transaction) => paymentTypes.has(transaction.type);
const isPaidTransaction = (transaction: Transaction) => isPaymentTransaction(transaction) && paidStatuses.has(transaction.status);
const includesAny = (value: string | null | undefined, terms: string[]) => terms.some((term) => (value ?? "").toLowerCase().includes(term));
const friendlyError = (value: unknown, fallback: string) => {
  const message = value instanceof Error ? value.message : String(value || fallback);
  if (/schema cache|could not find the table|relation .* does not exist|column .* does not exist/i.test(message)) return "The SWVAOS data structure needs attention.";
  if (/not configured|missing.*key|missing.*url/i.test(message)) return "The SWVAOS data connection is not configured.";
  return message.replace(/supabase/gi, "data service").replace(/vercel/gi, "hosting service").replace(/chatgpt/gi, "previous site");
};

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function sumBy<T>(items: T[], amount: (item: T) => number) {
  return items.reduce((total, item) => total + amount(item), 0);
}

function Status({ children, tone = "neutral" }: { children: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

function Section({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="panel"><div className="panel-head"><span>{eyebrow}</span><h2>{title}</h2>{action}</div>{children}</section>;
}

function Empty({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty"><b>{title}</b><p>{text}</p><button onClick={onAction}>{action}</button></div>;
}

function useAnalytics(data: DataSet) {
  return useMemo(() => {
    const activeLitters = data.litters.filter((item) => !["Completed", "Archived"].includes(item.status));
    const payments = data.transactions.filter(isPaymentTransaction);
    const paid = payments.filter(isPaidTransaction).reduce((sum, item) => sum + item.amount_cents, 0);
    const costs = data.transactions.filter((item) => item.type === "Cost").reduce((sum, item) => sum + item.amount_cents, 0);
    const fees = data.transactions.reduce((sum, item) => sum + transactionFeeCents(item), 0);
    const outstanding = payments.filter((item) => !paidStatuses.has(item.status)).reduce((sum, item) => sum + item.amount_cents, 0);
    const overdue = payments.filter((item) => !paidStatuses.has(item.status) && item.due_date && item.due_date < today());
    const dueHealth = data.dog_medical_records.filter((item) => item.next_due_date && item.next_due_date <= today());
    const unmatched = data.puppies.filter((item) => !item.buyer_id && !["Placed", "Retained"].includes(item.status));
    const placed = data.puppies.filter((item) => item.buyer_id || item.status === "Placed");
    const approvedBuyers = data.buyers.filter((item) => item.application_status === "Approved");
    const pendingBuyers = data.buyers.filter((item) => !["Approved", "Declined", "Archived"].includes(item.application_status));
    const registryCoverage = pct(data.dogs.filter((dog) => data.dog_registrations.some((registration) => registration.dog_id === dog.id)).length, data.dogs.length);
    const docs = data.buyer_documents.length + data.dog_documents.length;
    const microchipCoverage = pct(data.dogs.filter((dog) => dog.microchip_number).length, data.dogs.length);
    const activePuppies = data.puppies.filter((item) => !["Placed", "Archived"].includes(item.status));
    const readyPuppies = data.puppies.filter((item) => item.status === "Available");
    const careEvents = data.events.filter((item) => includesAny(`${item.event_type} ${item.title}`, ["vet", "vaccine", "medical", "care", "groom", "task", "pickup", "whelp"]));
    const openTasks = data.events.filter((item) => item.status !== "Completed");
    const upcomingCare = careEvents.filter((item) => item.event_date >= today() && item.event_date <= addDays(30) && item.status !== "Completed");
    const supplyCosts = data.transactions.filter((item) => item.type === "Cost" && includesAny(`${item.category} ${item.description}`, ["food", "supply", "med", "vaccine", "equipment", "groom", "clean"]));
    const inventorySpend = sumBy(supplyCosts, (item) => item.amount_cents);
    const draftUpdates = data.updates.filter((item) => !item.published);
    const publishedUpdates = data.updates.filter((item) => item.published);
    const docsNeeded = Math.max(0, data.dogs.length * 2 + data.buyers.length - docs);
    const documentCoverage = pct(docs, data.dogs.length * 2 + data.buyers.length);
    const hasRecords = data.dogs.length + data.litters.length + data.buyers.length + data.puppies.length + data.transactions.length + data.events.length > 0;
    const readiness = hasRecords ? Math.max(0, Math.min(100, Math.round(
      (data.dogs.length ? 15 : 0)
      + registryCoverage * .2
      + microchipCoverage * .15
      + documentCoverage * .2
      + (data.buyers.length ? 10 : 0)
      + (data.dog_medical_records.length || data.events.length ? 10 : 0)
      + (data.transactions.length ? 10 : 0)
      - overdue.length * 5
      - dueHealth.length * 3
    ))) : 0;
    const upcoming = data.events.filter((item) => item.event_date >= today() && item.status !== "Completed").sort((a, b) => `${a.event_date}${a.event_time ?? ""}`.localeCompare(`${b.event_date}${b.event_time ?? ""}`));
    const activePlanValue = data.payment_plans.filter((item) => item.status === "Active").reduce((sum, item) => sum + item.total_amount_cents, 0);
    return { activeLitters, paid, costs, fees, outstanding, overdue, dueHealth, unmatched, placed, approvedBuyers, pendingBuyers, registryCoverage, microchipCoverage, docs, docsNeeded, readiness, upcoming, activePlanValue, activePuppies, readyPuppies, careEvents, openTasks, upcomingCare, supplyCosts, inventorySpend, draftUpdates, publishedUpdates };
  }, [data]);
}

function CommandView({ data, openCreate, setView }: { data: DataSet; openCreate: (resource: Resource, preset?: Record<string, unknown>) => void; setView: (view: View) => void }) {
  const a = useAnalytics(data);
  const dogName = (dogId: number | null) => data.dogs.find((dog) => dog.id === dogId)?.name ?? "Pairing not complete";
  const paidBuyers = new Set(data.transactions.filter((item) => paymentTypes.has(item.type) && paidStatuses.has(item.status) && item.buyer_id).map((item) => item.buyer_id));
  const contractedBuyers = new Set(data.buyer_documents.filter((item) => /bill of sale|health guarantee|agreement/i.test(item.document_type)).map((item) => item.buyer_id));
  const deliveryEvents = data.events.filter((item) => /pickup|delivery|transport/i.test(`${item.event_type} ${item.title}`) && item.status !== "Completed");
  const lifecycle = [
    { label: "Applications", count: a.pendingBuyers.length, view: "Applications" as View, note: "awaiting review" },
    { label: "Approved", count: a.approvedBuyers.length, view: "Families" as View, note: "on the waitlist" },
    { label: "Matched", count: a.placed.length, view: "Placement" as View, note: "puppies assigned" },
    { label: "Paid", count: paidBuyers.size, view: "Finance" as View, note: "buyer accounts" },
    { label: "Contracted", count: contractedBuyers.size, view: "Templates" as View, note: "documented homes" },
    { label: "Go-home", count: deliveryEvents.length, view: "Delivery" as View, note: "scheduled next" },
  ];
  const attention = [
    ...a.overdue.map((item) => ({ title: item.description, detail: `${money(item.amount_cents)} overdue`, view: "Finance" as View, tone: "bad" as const })),
    ...a.dueHealth.map((item) => ({ title: item.title, detail: `${item.record_type} due for ${dogName(item.dog_id)}`, view: "Care" as View, tone: "warn" as const })),
    ...a.unmatched.map((item) => ({ title: `${item.name} needs a family`, detail: "Available puppy is not matched to a buyer", …31080 tokens truncated…rror(refreshError, "Live call refresh failed."));
    } finally {
      activityRequestInFlight.current = false;
      setActivityRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);
  useEffect(() => {
    if (view !== "CRM") return;
    void refreshActivity();
    const interval = window.setInterval(() => void refreshActivity(), 5000);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refreshActivity(); };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshActivity, view]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setSearch("");
        return;
      }
      if (event.altKey && /^[1-9a-z]$/i.test(event.key)) {
        const target = views.find((item) => item.shortcut === event.key.toUpperCase());
        if (target) {
          event.preventDefault();
          navigateTo(target.id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [navigateTo]);

  const openCreate = (resource: Resource, preset: Record<string, unknown> = {}) => setModal({ resource, preset });
  const openEdit = (resource: Resource, record: Record<string, unknown>) => setModal({ resource, record });
  const openDocumentUpload = (kind: DocumentKind, ownerId?: number) => {
    setUploadError("");
    setDocumentModal({ kind, ownerId });
  };
  const openContracts = (buyerId: number) => {
    setContractError("");
    setContractModal({ buyerId });
  };
  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, unknown>;
    if (modal.resource === "updates") values.published = form.get("published") === "on";
    if (modal.resource === "transactions") {
      values.notes = transactionNotesWithFee(values.notes, values.fee_amount);
      delete values.fee_amount;
    }
    try {
      const response = await fetch("/api/data", { method: modal.record?.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource: modal.resource, id: modal.record?.id, data: values }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save record.");
      setModal(null);
      setToast("Record saved");
      await loadData();
    } catch (saveError) {
      setError(friendlyError(saveError, "Unable to save record."));
    } finally {
      setSaving(false);
    }
  }
  async function remove(resource: Resource, id: number, label: string) {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/data?resource=${resource}&id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || "Unable to delete record.");
      return;
    }
    setToast("Record deleted");
    await loadData();
  }
  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentModal) return;
    setSaving(true);
    setUploadError("");
    try {
      await uploadDocumentDirect(new FormData(event.currentTarget), documentModal.kind);
      setDocumentModal(null);
      setToast("Document uploaded");
      await loadData();
    } catch (uploadFailure) {
      setUploadError(friendlyError(uploadFailure, "Unable to upload the document."));
    } finally {
      setSaving(false);
    }
  }
  async function removeDocument(kind: DocumentKind, id: number, label: string) {
    if (!window.confirm(`Delete "${label}" from the document vault? This cannot be undone.`)) return;
    const endpoint = kind === "dog" ? "/api/dog-documents" : "/api/documents";
    const response = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || "Unable to delete the document.");
      return;
    }
    setToast("Document deleted");
    await loadData();
  }
  async function submitContracts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractModal) return;
    setSaving(true);
    setContractError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/contracts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, buyer_id: contractModal.buyerId }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to prepare the contract package.");
      setContractModal({ ...contractModal, portalUrl: payload.portalUrl });
      setToast("Contracts prepared");
      await loadData();
    } catch (contractFailure) {
      setContractError(friendlyError(contractFailure, "Unable to prepare the contract package."));
    } finally {
      setSaving(false);
    }
  }
  async function openExistingPortal() {
    if (!contractModal) return;
    setSaving(true);
    setContractError("");
    try {
      const response = await fetch("/api/contracts/portal-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer_id: contractModal.buyerId }) });
      const payload = await response.json() as { portalUrl?: string; error?: string };
      if (!response.ok || !payload.portalUrl) throw new Error(payload.error || "Unable to open the puppy portal.");
      setContractModal({ ...contractModal, portalUrl: payload.portalUrl });
    } catch (portalFailure) {
      setContractError(friendlyError(portalFailure, "Unable to open the puppy portal."));
    } finally {
      setSaving(false);
    }
  }

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length < 2) return [];
    return [
      ...data.dogs.map((item) => ({ label: item.name, detail: `${item.role} / ${item.status}`, view: "Breeding" as View })),
      ...data.litters.map((item) => ({ label: item.name, detail: `Litter / ${item.status}`, view: "Litters" as View })),
      ...data.buyers.map((item) => ({ label: fullName(item), detail: `${item.application_status} / ${[item.phone, item.email].filter(Boolean).join(" / ")}`, view: ["Approved", "Waitlist", "Matched", "Placed"].includes(item.application_status) ? "Families" as View : "Applications" as View })),
      ...data.puppies.map((item) => ({ label: item.name, detail: `Puppy / ${item.status}`, view: "Puppies" as View })),
      ...data.transactions.map((item) => ({ label: item.description, detail: `${item.type} / ${money(item.amount_cents)}`, view: "Finance" as View })),
      ...data.events.map((item) => ({ label: item.title, detail: shortDate(item.event_date), view: /pickup|delivery|transport|go.home/i.test(`${item.event_type} ${item.title}`) ? "Delivery" as View : "Calendar" as View })),
      ...data.dog_medical_records.map((item) => ({ label: item.title, detail: `${item.record_type} / ${shortDate(item.next_due_date)}`, view: "Care" as View })),
      ...data.updates.map((item) => ({ label: item.title, detail: item.published ? "Published update" : "Draft update", view: "Comms" as View })),
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [data, search]);

  const activeViewProps = { data, openCreate, openEdit, openDocumentUpload, remove, removeDocument, openContracts };
  const quickResource = view === "Litters" ? "litters" : view === "Puppies" || view === "Placement" ? "puppies" : view === "Calendar" || view === "Care" || view === "CRM" || view === "Delivery" ? "events" : view === "Applications" || view === "Families" || view === "Comms" || view === "Portal" ? "buyers" : view === "Breeding" ? "dogs" : view === "Finance" || view === "Inventory" || view === "Reports" ? "transactions" : "events";
  const viewCopy: Record<View, { title: string; text: string }> = {
    Command: { title: "Today’s breeder desk", text: "The next care, placement, payment, communication, and go-home work across the program." },
    Breeding: { title: "Dogs & breeding", text: "Manage breeding dogs, pairings, heat dates, registrations, and program records." },
    Litters: { title: "Litters", text: "Track every litter from planned pairing and due date through whelping and puppy roster." },
    Puppies: { title: "Puppies", text: "Keep identity, growth, care, availability, pricing, and family assignment on one record." },
    Care: { title: "Health & care", text: "Run medical schedules, puppy milestones, recurring care, and kennel work." },
    Applications: { title: "Applications", text: "Screen families, record preferences, approve the right homes, and build the waitlist." },
    Families: { title: "Buyers & waitlist", text: "Open the complete family relationship: contact, preferences, puppies, payments, documents, and portal." },
    Placement: { title: "Puppy placement", text: "Match approved families to puppies and carry every placement into payment and contract work." },
    Delivery: { title: "Pickup & delivery", text: "Control final balances, signed documents, handoff schedules, and go-home readiness." },
    Finance: { title: "Payments & sales", text: "Credit every payment to the right buyer and puppy, then manage balances and sale revenue." },
    Inventory: { title: "Costs & expenses", text: "See veterinary, breeding, supply, travel, and program costs against recorded sales." },
    Comms: { title: "Family communications", text: "Manage family updates, calls, messages, requests, and communication history." },
    Portal: { title: "Puppy Portal simulator", text: "See exactly what each customer sees and manage secure family access." },
    CRM: { title: "Caller CRM", text: "Identify callers and surface their account, assigned puppy, payment, update, and conversation records." },
    Calendar: { title: "Schedule", text: "Schedule breeding, whelping, care, family calls, pickup, delivery, and follow-up work." },
    Vault: { title: "Documents", text: "Access buyer files, dog records, certificates, signed agreements, and reports." },
    Templates: { title: "Automations & templates", text: "Control the saved business language and automatic emails used across each family journey." },
    Reports: { title: "Reports and intelligence", text: "Review performance, compliance, profitability, and export an operating snapshot." },
  };
  const ActiveViewIcon = views.find((item) => item.id === view)?.icon ?? LayoutDashboard;
  const activeViewDefinition = views.find((item) => item.id === view) ?? views[0];
  const coreRecordCount = data.dogs.length + data.litters.length + data.buyers.length + data.puppies.length;
  const viewBadges: Partial<Record<View, number>> = {
    Breeding: analytics.activeLitters.length,
    Litters: analytics.activeLitters.length,
    Puppies: analytics.unmatched.length,
    Applications: analytics.pendingBuyers.length,
    Families: analytics.approvedBuyers.length,
    Placement: analytics.unmatched.length,
    Delivery: data.events.filter((item) => /pickup|delivery|transport|go.home/i.test(`${item.event_type} ${item.title}`) && item.status !== "Completed").length,
    Care: analytics.upcomingCare.length,
    Finance: analytics.overdue.length,
    Comms: analytics.draftUpdates.length,
    CRM: data.events.filter((item) => item.event_type === "Call" && item.status !== "Completed").length,
    Calendar: analytics.openTasks.length,
    Vault: analytics.docs,
  };

  return <div className="breeder-shell">
    <aside className="breeder-sidebar">
      <button className="breeder-brand" onClick={() => navigateTo("Command")}><span><DogIcon size={23} /></span><b>Southwest Virginia Chihuahua</b><small>Breeder operating system</small></button>
      <button className="breeder-new-record" onClick={() => openCreate(quickResource)}><Plus size={17} /> Add to {activeViewDefinition.label}</button>
      <div className="breeder-nav-groups">{viewGroups.map((group) => <section key={group}><span>{group}</span><nav aria-label={group}>{views.filter((item) => item.group === group).map((item) => { const Icon = item.icon; const badge = viewBadges[item.id]; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigateTo(item.id)} title={`Alt+${item.shortcut}`}><Icon size={18} /><b>{item.label}</b>{Boolean(badge) && <em>{Number(badge) > 99 ? "99+" : badge}</em>}</button>; })}</nav></section>)}</div>
      <footer className="breeder-sidebar-footer"><span><i className={error ? "offline" : ""} />{error ? "Data needs attention" : "Records connected"}</span><small>{coreRecordCount} dogs, litters, puppies, and families · {analytics.docs} documents</small></footer>
    </aside>
    <main className="breeder-workspace">
      <header className="breeder-topbar">
        <div className="breeder-mobile-brand"><DogIcon size={18} /><b>SWVAOS</b></div>
        <div className="breeder-global-search"><SearchIcon size={18} /><input ref={searchInputRef} aria-label="Search SWVAOS" value={search} onFocus={() => setCommandOpen(true)} onChange={(event) => { setSearch(event.target.value); setCommandOpen(true); }} placeholder="Search a dog, litter, puppy, family, payment, or task…" /><kbd><CommandIcon size={11} />K</kbd>{commandOpen && <div className="breeder-search-menu"><header><span>Search and quick actions</span><button onClick={() => { setCommandOpen(false); setSearch(""); }} aria-label="Close search"><X size={15} /></button></header>{search.trim() ? searchResults.length ? <div className="command-results">{searchResults.map((item) => <button key={`${item.view}-${item.label}`} onClick={() => navigateTo(item.view)}><span><b>{item.label}</b><small>{item.detail}</small></span><ChevronRight size={15} /></button>)}</div> : <div className="command-empty"><SearchIcon size={19} /><b>No matching records</b><small>Try a family name, puppy, transaction, or event.</small></div> : <><span className="command-section-label">Go to workspace</span><div className="breeder-search-links">{views.slice(0, 12).map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => navigateTo(item.id)}><Icon size={16} /><span>{item.label}</span></button>; })}</div><span className="command-section-label">Create</span><div className="command-actions"><button onClick={() => { setCommandOpen(false); openCreate("transactions", { type: "Payment" }); }}><ReceiptText size={16} /><span><b>Record payment</b><small>Credit a buyer account</small></span></button><button onClick={() => { setCommandOpen(false); openCreate("buyers", { application_status: "New" }); }}><ClipboardCheck size={16} /><span><b>New application</b><small>Start family screening</small></span></button><button onClick={() => { setCommandOpen(false); openCreate("events", { event_type: "Pickup", status: "Scheduled" }); }}><Route size={16} /><span><b>Schedule go-home</b><small>Pickup or delivery</small></span></button></div></>}</div>}</div>
        <div className="breeder-top-actions"><span suppressHydrationWarning>{now ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now) : "Today"}</span><button onClick={() => openCreate("transactions", { type: "Payment" })}><ReceiptText size={16} /> Record payment</button><button className="primary-action" onClick={() => openCreate(quickResource)}><Plus size={16} /> Add record</button></div>
      </header>
      <div className="breeder-content">
        {view !== "Command" && <header className="breeder-page-head"><span className="breeder-page-icon"><ActiveViewIcon size={22} /></span><div><small>{activeViewDefinition.group}</small><h1>{viewCopy[view].title}</h1><p>{viewCopy[view].text}</p></div><span className="breeder-page-date" suppressHydrationWarning>{now ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now) : "Today"}</span></header>}
        {error && <div className="error-banner"><b>Something needs attention</b><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
        {loading ? <div className="loading"><span />Loading records...</div> : <>
          {view === "Command" && <CommandView data={data} openCreate={openCreate} setView={navigateTo} />}
          {view === "Breeding" && <BreedingView {...activeViewProps} />}
          {view === "Litters" && <LittersView {...activeViewProps} />}
          {view === "Puppies" && <PuppiesView {...activeViewProps} />}
          {view === "Care" && <CareView {...activeViewProps} />}
          {view === "Applications" && <ApplicationsView {...activeViewProps} />}
          {view === "Families" && <FamiliesView {...activeViewProps} />}
          {view === "Placement" && <PlacementView {...activeViewProps} />}
          {view === "Delivery" && <DeliveryView {...activeViewProps} />}
          {view === "Finance" && <FinanceView {...activeViewProps} />}
          {view === "Inventory" && <InventoryView {...activeViewProps} />}
          {view === "Comms" && <CommunicationsView {...activeViewProps} />}
          {view === "Portal" && <PortalPreviewView data={data} />}
          {view === "CRM" && <CallerCrmView {...activeViewProps} refreshActivity={refreshActivity} activityRefreshing={activityRefreshing} activitySyncedAt={activitySyncedAt} activityError={activityError} newCallId={newCallId} />}
          {view === "Calendar" && <CalendarView {...activeViewProps} />}
          {view === "Vault" && <VaultView data={data} openDocumentUpload={openDocumentUpload} removeDocument={removeDocument} />}
          {view === "Templates" && <TemplatesCenter initialConfig={templates} onSaved={setTemplates} />}
          {view === "Reports" && <ReportsView data={data} openCreate={openCreate} />}
        </>}
      </div>
    </main>
    {modal && <RecordModal modal={modal} data={data} saving={saving} onClose={() => setModal(null)} onSubmit={submitRecord} />}
    {documentModal && <DocumentUploadModal modal={documentModal} data={data} saving={saving} error={uploadError} onClose={() => setDocumentModal(null)} onKindChange={(kind) => setDocumentModal({ kind })} onSubmit={submitDocument} />}
    {contractModal && <ContractModal modal={contractModal} data={data} templates={templates} saving={saving} error={contractError} onClose={() => setContractModal(null)} onSubmit={submitContracts} onOpenPortal={() => void openExistingPortal()} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
