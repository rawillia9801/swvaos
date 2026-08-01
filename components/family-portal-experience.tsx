"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDollarSign,
  Clock3,
  Dog,
  Download,
  FileCheck2,
  FilePlus2,
  FileSignature,
  FileText,
  HeartPulse,
  HelpCircle,
  Home,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Phone,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UploadCloud,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

type Puppy = { id: number; name: string; sex: string; color: string; birthDate: string; birthWeight: number; currentWeight: number; status: string; priceCents: number; litterName: string; damName: string; sireName: string };
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

type Tab = "overview" | "puppy" | "updates" | "documents" | "payments" | "schedule" | "transportation" | "messages" | "account";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const shortDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T12:00:00`)) : "Not set";
const settled = (status: string) => /paid|complete|completed|cleared/i.test(status || "");
const statusClass = (status: string) => settled(status) || /signed|approved|ready/i.test(status || "") ? "good" : /overdue|late|failed|declined/i.test(status || "") ? "bad" : "neutral";

const navigation: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "puppy", label: "My Puppy", icon: Dog },
  { id: "updates", label: "Updates", icon: Sparkles },
  { id: "documents", label: "Documents", icon: FileCheck2 },
  { id: "payments", label: "Payments", icon: WalletCards },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "transportation", label: "Pickup & Delivery", icon: Truck },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "account", label: "Account", icon: UserRound },
];

function RequestForm({ token, kind, onCreated }: { token: string; kind: "support" | "transportation"; onCreated: () => Promise<void> }) {
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
        body: JSON.stringify({ kind, subject: form.get("subject"), message: form.get("message"), requestedDate: form.get("requested_date") }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send this request.");
      formElement.reset();
      setFeedback(transportation ? "Your transportation request was sent to the team." : "Your message was sent to the team.");
      await onCreated();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to send this request.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="family-request-form" onSubmit={submit}>
    <div className="portal-form-grid">
      <label><span>{transportation ? "Request type" : "Subject"}</span><select name="subject" defaultValue="" required><option value="" disabled>Choose one</option>{(transportation ? ["Schedule puppy pickup", "Ask about delivery", "Change transportation details", "Transportation question"] : ["Puppy update question", "Payment question", "Document question", "Care question", "Account help", "Other question"]).map((option) => <option key={option}>{option}</option>)}</select></label>
      {transportation && <label><span>Preferred date</span><input name="requested_date" type="date" /></label>}
    </div>
    <label><span>Details</span><textarea name="message" required minLength={5} rows={6} placeholder={transportation ? "Tell us where you are traveling from and the arrangement you need." : "Tell us how we can help."} /></label>
    <button type="submit" disabled={busy}><Send size={16}/>{busy ? "Sending…" : transportation ? "Send transportation request" : "Send message"}</button>
    {feedback && <p className="portal-form-feedback" role="status">{feedback}</p>}
  </form>;
}

function UploadDocumentForm({ token, onUploaded }: { token: string; onUploaded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const form = event.currentTarget;
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/documents/upload`, { method: "POST", body: new FormData(form) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to upload the document.");
      form.reset();
      setFeedback("Your document was securely added to your family file.");
      await onUploaded();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to upload the document.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="family-upload-form" onSubmit={submit}>
    <div className="portal-form-grid">
      <label><span>Document title</span><input name="title" required placeholder="Example: Insurance confirmation" /></label>
      <label><span>Category</span><select name="category" defaultValue="Other"><option>Veterinary record</option><option>Insurance</option><option>Registration</option><option>Transportation</option><option>Other</option></select></label>
    </div>
    <label className="file-drop"><UploadCloud size={24}/><span><b>Choose a PDF or image</b><small>PDF, JPG, PNG, or WebP · maximum 20 MB</small></span><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required /></label>
    <button type="submit" disabled={busy}><FilePlus2 size={16}/>{busy ? "Uploading…" : "Add document to my file"}</button>
    {feedback && <p className="portal-form-feedback" role="status">{feedback}</p>}
  </form>;
}

export function FamilyPortalExperience({ token, accountMode = false }: { token: string; accountMode?: boolean }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load this Puppy Portal.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this Puppy Portal.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (navigation.some((item) => item.id === hash)) setActiveTab(hash);
  }, []);

  function chooseTab(tab: Tab) {
    setActiveTab(tab);
    setMobileNavOpen(false);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${tab}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const view = useMemo(() => {
    if (!data) return null;
    const signed = data.contracts.filter((contract) => contract.status === "signed");
    const pending = data.contracts.filter((contract) => contract.status === "pending");
    const additionalDocuments = data.documents.filter((document) => !document.isContract);
    const paid = data.payments.items.filter((payment) => settled(payment.status));
    const upcoming = [...data.upcomingEvents].sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));
    const transportation = upcoming.filter((event) => /pickup|delivery|transport/i.test(`${event.eventType} ${event.title}`));
    const journey = [
      { label: "Family account active", complete: Boolean(data.buyer.name) },
      { label: "Puppy assigned", complete: data.puppies.length > 0 },
      { label: "Agreements complete", complete: data.contracts.length > 0 && pending.length === 0 },
      { label: "Deposit recorded", complete: paid.some((payment) => /deposit|reservation/i.test(`${payment.category} ${payment.description}`)) },
      { label: "Go-home scheduled", complete: transportation.length > 0 },
    ];
    return { signed, pending, additionalDocuments, upcoming, transportation, journey, journeyComplete: journey.filter((item) => item.complete).length };
  }, [data]);

  if (loading) return <main className="family-portal-state"><span/><b>Opening your private Puppy Portal…</b></main>;
  if (error || !data || !view) return <main className="family-portal-state"><ShieldCheck size={34}/><h1>Portal unavailable</h1><p>{error || "This private account is not available."}</p><button onClick={() => void load()}>Try again</button></main>;

  const firstName = data.buyer.name.split(/\s+/)[0] || data.buyer.name;
  const primaryPuppy = data.puppies[0];
  const progress = Math.round((view.journeyComplete / view.journey.length) * 100);

  return <main className="family-portal-shell">
    <style jsx global>{`
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#eef5f3;color:#17373c;font-family:Arial,sans-serif}.family-portal-shell{min-height:100vh;display:grid;grid-template-columns:282px minmax(0,1fr);background:radial-gradient(circle at 78% 2%,rgba(25,180,174,.13),transparent 25%),linear-gradient(135deg,#edf5f3,#fbfcfb 52%,#eaf1ef)}.family-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow-y:auto;padding:22px 16px;background:linear-gradient(175deg,#08323c,#0a4c56 58%,#07313a);color:#e8faf7;box-shadow:18px 0 55px rgba(5,43,49,.13)}.family-brand{display:grid;grid-template-columns:46px 1fr;align-items:center;gap:11px;padding:2px 7px 20px;border-bottom:1px solid rgba(255,255,255,.11)}.family-brand>span{width:46px;height:46px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(135deg,#25bdb5,#c99f4f);box-shadow:0 12px 28px rgba(22,172,166,.18)}.family-brand b,.family-brand small{display:block}.family-brand b{font-family:Georgia,serif;font-size:16px;font-weight:500}.family-brand small{margin-top:3px;color:#91c7c3;font-size:8px;letter-spacing:.12em}.family-profile{display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;margin:17px 2px 12px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.055)}.family-avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:rgba(255,255,255,.1);color:#60d6cd;font-family:Georgia,serif;font-size:20px}.family-profile b,.family-profile small{display:block}.family-profile b{font-size:11px}.family-profile small{margin-top:3px;color:#8fbab7;font-size:8px}.family-nav{display:grid;gap:4px;padding:5px 0 14px}.family-nav button{width:100%;min-height:42px;display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:9px;padding:9px 11px;border:0;border-radius:11px;background:transparent;color:#a9ceca;font:inherit;font-size:10px;font-weight:760;text-align:left;cursor:pointer}.family-nav button:hover,.family-nav button.active{background:rgba(255,255,255,.09);color:white}.family-nav button.active{box-shadow:inset 3px 0 #42cec4}.nav-count{min-width:22px;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.1);font-size:8px;text-align:center}.family-sidebar-footer{margin-top:auto;display:grid;gap:8px;padding-top:15px;border-top:1px solid rgba(255,255,255,.1)}.family-sidebar-footer a,.family-sidebar-footer button{display:flex;align-items:center;gap:8px;padding:10px 11px;border:0;border-radius:10px;background:rgba(255,255,255,.06);color:#b9d8d5;font:inherit;font-size:9px;text-decoration:none;cursor:pointer}.family-sidebar-footer form{margin:0}.family-sidebar-footer form button{width:100%}.family-content{min-width:0;padding:28px clamp(20px,4vw,58px) 60px}.family-mobile-head{display:none}.family-page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;margin-bottom:20px}.family-page-head>div>span{color:#07858a;font-size:9px;font-weight:880;letter-spacing:.16em}.family-page-head h1{margin:6px 0 5px;font-family:Georgia,serif;font-size:clamp(31px,4vw,49px);font-weight:500;letter-spacing:-.045em}.family-page-head p{margin:0;color:#6c8587;font-size:12px;line-height:1.55}.family-security-pill{display:flex;align-items:center;gap:7px;padding:10px 12px;border:1px solid rgba(8,130,134,.18);border-radius:999px;background:rgba(255,255,255,.7);color:#08767a;font-size:9px;font-weight:850;white-space:nowrap}.portal-panel{padding:21px;border:1px solid rgba(95,141,139,.2);border-radius:24px;background:rgba(255,255,255,.77);box-shadow:0 18px 54px rgba(27,72,73,.07);backdrop-filter:blur(16px)}.portal-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:16px}.portal-panel-head>div>span{color:#07858a;font-size:8px;font-weight:880;letter-spacing:.14em}.portal-panel-head h2{margin:5px 0 4px;font-family:Georgia,serif;font-size:23px;font-weight:500}.portal-panel-head p{margin:0;color:#708789;font-size:10px;line-height:1.45}.portal-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:16px}.portal-metric{position:relative;overflow:hidden;min-height:137px;padding:17px;border:1px solid rgba(95,141,139,.18);border-radius:21px;background:rgba(255,255,255,.76);box-shadow:0 15px 45px rgba(27,72,73,.06)}.portal-metric:after{content:"";position:absolute;right:-34px;top:-36px;width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,rgba(25,178,172,.16),rgba(204,159,75,.09))}.portal-metric svg{color:#078b90}.portal-metric small,.portal-metric b{display:block}.portal-metric small{margin-top:15px;color:#70878a;font-size:9px;font-weight:750}.portal-metric b{margin-top:4px;font-family:Georgia,serif;font-size:26px;font-weight:500}.portal-two-column{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr);gap:16px}.journey-list{display:grid;gap:8px}.journey-step{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:#f0f7f5}.journey-step.complete{background:#e9f7ef}.journey-step>span{width:31px;height:31px;display:grid;place-items:center;border-radius:10px;background:white;color:#6c8787}.journey-step.complete>span{color:#17845e}.journey-step b{font-size:10px}.journey-step small{color:#6f8788;font-size:8px}.journey-progress{display:grid;place-items:center;align-content:center;text-align:center;min-height:100%}.progress-ring{width:128px;height:128px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(#16a79f calc(var(--progress)*1%),#dce8e6 0);box-shadow:inset 0 0 0 12px rgba(255,255,255,.9)}.progress-ring span{width:88px;height:88px;display:grid;place-items:center;border-radius:50%;background:white;font-family:Georgia,serif;font-size:25px}.journey-progress b{margin-top:14px;font-size:11px}.journey-progress small{margin-top:4px;color:#708789;font-size:9px}.content-list{display:grid;gap:9px}.content-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center;padding:13px;border-radius:16px;background:#f0f7f5}.row-icon{width:39px;height:39px;display:grid;place-items:center;border-radius:13px;background:white;color:#078b90;box-shadow:0 7px 20px rgba(26,78,78,.07)}.content-row b,.content-row small{display:block}.content-row b{font-size:10px}.content-row small{margin-top:4px;color:#6f8587;font-size:8px;line-height:1.45}.status-pill{padding:5px 8px;border-radius:999px;font-size:7px;font-weight:880;text-transform:uppercase}.status-pill.good{background:#dcf3e8;color:#176c4f}.status-pill.bad{background:#fde6e3;color:#943f3f}.status-pill.neutral{background:#e7efee;color:#557073}.puppy-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:17px;padding:20px;border-radius:21px;background:linear-gradient(135deg,#0b7f86,#17aaa3);color:white;box-shadow:0 18px 45px rgba(9,123,127,.2)}.puppy-avatar{width:72px;height:72px;display:grid;place-items:center;border-radius:22px;background:rgba(255,255,255,.15);font-family:Georgia,serif;font-size:34px}.puppy-hero h2{margin:0;font-family:Georgia,serif;font-size:28px;font-weight:500}.puppy-hero p{margin:5px 0 0;color:#cdebe8;font-size:10px}.puppy-hero>span{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.15);font-size:8px;font-weight:850}.facts-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:13px}.fact{padding:13px;border-radius:15px;background:#f0f7f5}.fact small,.fact b{display:block}.fact small{color:#718789;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.fact b{margin-top:5px;font-size:10px;overflow-wrap:anywhere}.updates-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.update-card{padding:17px;border:1px solid rgba(95,141,139,.17);border-radius:18px;background:#f7fbfa}.update-card header{display:flex;justify-content:space-between;gap:10px}.update-card header span{display:flex;align-items:center;gap:7px;color:#078b90}.update-card h3{margin:10px 0 6px;font-family:Georgia,serif;font-size:18px;font-weight:500}.update-card p{margin:0;color:#556f72;font-size:10px;line-height:1.6;white-space:pre-wrap}.update-card footer{margin-top:12px;color:#708789;font-size:8px}.document-actions{display:flex;gap:8px;align-items:center}.document-actions a{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:10px;background:#0a8c91;color:white;font-size:8px;font-weight:800;text-decoration:none}.document-actions a.secondary{background:#e4f1ef;color:#0a7378}.payment-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.payment-summary span{padding:15px;border-radius:17px;background:#edf6f4}.payment-summary small,.payment-summary b{display:block}.payment-summary small{color:#718789;font-size:8px}.payment-summary b{margin-top:5px;font-family:Georgia,serif;font-size:21px;font-weight:500}.portal-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.family-request-form,.family-upload-form{display:grid;gap:13px}.family-request-form label>span,.family-upload-form label>span{display:block;margin-bottom:6px;color:#365b5d;font-size:9px;font-weight:800}.family-request-form input,.family-request-form select,.family-request-form textarea,.family-upload-form input,.family-upload-form select{width:100%;padding:11px 12px;border:1px solid #b7cfcb;border-radius:12px;background:white;color:#17373c;font:inherit;font-size:10px;outline:none}.family-request-form textarea{resize:vertical}.family-request-form>button,.family-upload-form>button{justify-self:start;display:flex;align-items:center;gap:7px;padding:11px 14px;border:0;border-radius:12px;background:linear-gradient(135deg,#0a8c91,#19aca2);color:white;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.family-request-form>button:disabled,.family-upload-form>button:disabled{opacity:.55;cursor:wait}.portal-form-feedback{margin:0;padding:10px 12px;border-radius:11px;background:#e8f6ef;color:#176347;font-size:9px}.file-drop{position:relative;display:grid!important;grid-template-columns:auto 1fr;align-items:center;gap:11px;padding:15px;border:1px dashed #86b8b2;border-radius:15px;background:#f2f8f7;color:#0c777b;cursor:pointer}.file-drop b,.file-drop small{display:block}.file-drop small{margin-top:3px;color:#6d8587}.file-drop input{position:absolute!important;inset:0;opacity:0;cursor:pointer}.empty-state{padding:34px 16px;color:#708789;text-align:center}.empty-state svg{margin-bottom:8px;color:#86a6a4}.contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.contact-card{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:16px;border-radius:17px;background:#edf6f4;text-decoration:none;color:inherit}.contact-card span{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:white;color:#078b90}.contact-card b,.contact-card small{display:block}.contact-card b{font-size:10px}.contact-card small{margin-top:3px;color:#708789;font-size:8px}.family-account-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.account-field{padding:14px;border-radius:15px;background:#eef6f4}.account-field small,.account-field b{display:block}.account-field small{color:#718789;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.account-field b{margin-top:5px;font-size:10px;overflow-wrap:anywhere}.family-portal-state{min-height:100vh;display:grid;place-items:center;align-content:center;gap:10px;padding:30px;background:#edf5f3;color:#426568;text-align:center}.family-portal-state>span{width:36px;height:36px;border:4px solid #c8dcd8;border-top-color:#0b9294;border-radius:50%;animation:portal-spin .8s linear infinite}.family-portal-state button{padding:10px 14px;border:0;border-radius:10px;background:#0a8c91;color:white}@keyframes portal-spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.portal-dashboard-grid{grid-template-columns:repeat(2,1fr)}.portal-two-column{grid-template-columns:1fr}.updates-grid{grid-template-columns:1fr}}@media(max-width:820px){.family-portal-shell{grid-template-columns:1fr}.family-sidebar{position:fixed;z-index:100;inset:0 auto 0 0;width:282px;transform:translateX(-105%);transition:transform .22s ease}.family-sidebar.open{transform:translateX(0)}.family-content{padding:18px 14px 45px}.family-mobile-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.family-mobile-head button{width:42px;height:42px;display:grid;place-items:center;border:0;border-radius:12px;background:#0a4a54;color:white}.family-mobile-head b{font-family:Georgia,serif;font-weight:500}.family-page-head{align-items:flex-start}.family-security-pill{display:none}.facts-grid,.payment-summary,.contact-grid,.family-account-grid{grid-template-columns:1fr}.portal-form-grid{grid-template-columns:1fr}}@media(max-width:540px){.portal-dashboard-grid{grid-template-columns:1fr}.puppy-hero{grid-template-columns:auto 1fr}.puppy-hero>span{grid-column:1/-1;justify-self:start}.family-page-head h1{font-size:32px}}
    `}</style>

    <aside className={`family-sidebar ${mobileNavOpen ? "open" : ""}`}>
      <div className="family-brand"><span><Dog size={24}/></span><div><b>SWVA Chihuahua</b><small>PRIVATE PUPPY PORTAL</small></div></div>
      <div className="family-profile"><span className="family-avatar">{firstName.slice(0,1).toUpperCase()}</span><div><b>{data.buyer.name}</b><small>{primaryPuppy ? `${primaryPuppy.name} · ${primaryPuppy.status}` : data.buyer.applicationStatus}</small></div></div>
      <nav className="family-nav" aria-label="Puppy Portal sections">
        {navigation.map((item) => { const Icon = item.icon; const count = item.id === "updates" ? data.updates.length : item.id === "documents" ? data.contracts.length + view.additionalDocuments.length : item.id === "messages" ? data.requests.length : 0; return <button type="button" key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => chooseTab(item.id)}><Icon size={17}/><span>{item.label}</span>{count > 0 ? <em className="nav-count">{count}</em> : <ChevronRight size={14}/>}</button>; })}
      </nav>
      <div className="family-sidebar-footer">
        <a href="mailto:support@swvachihuahua.com"><Mail size={15}/>Email support</a>
        {accountMode && <form action="/api/portal/auth/logout" method="post"><button type="submit"><LogOut size={15}/>Sign out</button></form>}
      </div>
    </aside>

    <section className="family-content">
      <div className="family-mobile-head"><button type="button" onClick={() => setMobileNavOpen((value) => !value)}>{mobileNavOpen ? <X/> : <Menu/>}</button><b>SWVA Chihuahua Puppy Portal</b></div>
      <header className="family-page-head"><div><span>PRIVATE FAMILY PORTAL</span><h1>{activeTab === "overview" ? `Welcome, ${firstName}` : navigation.find((item) => item.id === activeTab)?.label}</h1><p>{activeTab === "overview" ? "Everything connected to your puppy journey, organized around what comes next." : `Review and manage your ${navigation.find((item) => item.id === activeTab)?.label.toLowerCase()} information.`}</p></div><div className="family-security-pill"><ShieldCheck size={15}/>Secure family access</div></header>

      {activeTab === "overview" && <>
        <div className="portal-dashboard-grid">
          <article className="portal-metric"><Dog size={20}/><small>Assigned puppies</small><b>{data.puppies.length}</b></article>
          <article className="portal-metric"><Sparkles size={20}/><small>Published updates</small><b>{data.updates.length}</b></article>
          <article className="portal-metric"><FileSignature size={20}/><small>Awaiting signature</small><b>{view.pending.length}</b></article>
          <article className="portal-metric"><CircleDollarSign size={20}/><small>Outstanding balance</small><b>{money(data.payments.outstandingCents)}</b></article>
        </div>
        <div className="portal-two-column">
          <section className="portal-panel"><div className="portal-panel-head"><div><span>YOUR JOURNEY</span><h2>Placement milestones</h2><p>A live view of the steps connected to your family record.</p></div></div><div className="journey-list">{view.journey.map((step) => <div key={step.label} className={`journey-step ${step.complete ? "complete" : ""}`}><span>{step.complete ? <Check size={15}/> : <Circle size={15}/>}</span><b>{step.label}</b><small>{step.complete ? "Complete" : "Upcoming"}</small></div>)}</div></section>
          <section className="portal-panel journey-progress"><div className="progress-ring" style={{"--progress": progress} as React.CSSProperties}><span>{progress}%</span></div><b>{view.journeyComplete} of {view.journey.length} milestones complete</b><small>Your portal updates automatically as records are completed.</small></section>
        </div>
        <div className="portal-two-column" style={{marginTop:16}}>
          <section className="portal-panel"><div className="portal-panel-head"><div><span>LATEST</span><h2>Recent puppy updates</h2></div><button type="button" onClick={() => chooseTab("updates")} style={{border:0,background:"transparent",color:"#087f84",fontWeight:800,cursor:"pointer"}}>View all</button></div><div className="content-list">{data.updates.slice(0,4).map((update) => <div className="content-row" key={update.id}><span className="row-icon"><BellRing size={17}/></span><div><b>{update.title}</b><small>{shortDate(update.createdAt)}{update.weight ? ` · ${update.weight} lb` : ""}</small></div><ChevronRight size={15}/></div>)}{!data.updates.length && <div className="empty-state"><Sparkles/><p>The next published puppy update will appear here.</p></div>}</div></section>
          <section className="portal-panel"><div className="portal-panel-head"><div><span>NEXT UP</span><h2>Schedule</h2></div><button type="button" onClick={() => chooseTab("schedule")} style={{border:0,background:"transparent",color:"#087f84",fontWeight:800,cursor:"pointer"}}>Open schedule</button></div><div className="content-list">{view.upcoming.slice(0,4).map((event) => <div className="content-row" key={event.id}><span className="row-icon"><CalendarDays size={17}/></span><div><b>{event.title}</b><small>{shortDate(event.date)}{event.time ? ` · ${event.time}` : ""}</small></div><span className={`status-pill ${statusClass(event.status)}`}>{event.status}</span></div>)}{!view.upcoming.length && <div className="empty-state"><CalendarDays/><p>No upcoming appointments are recorded yet.</p></div>}</div></section>
        </div>
      </>}

      {activeTab === "puppy" && <section className="portal-panel">{data.puppies.length ? data.puppies.map((puppy) => <div key={puppy.id} style={{marginBottom:18}}><div className="puppy-hero"><span className="puppy-avatar">{puppy.name.slice(0,1).toUpperCase()}</span><div><h2>{puppy.name}</h2><p>{[puppy.sex,puppy.color,puppy.litterName].filter(Boolean).join(" · ")}</p></div><span>{puppy.status}</span></div><div className="facts-grid"><div className="fact"><small>Birthday</small><b>{shortDate(puppy.birthDate)}</b></div><div className="fact"><small>Birth weight</small><b>{puppy.birthWeight ? `${puppy.birthWeight} lb` : "Not recorded"}</b></div><div className="fact"><small>Latest weight</small><b>{puppy.currentWeight ? `${puppy.currentWeight} lb` : "Not recorded"}</b></div><div className="fact"><small>Dam</small><b>{puppy.damName || "Not recorded"}</b></div><div className="fact"><small>Sire</small><b>{puppy.sireName || "Not recorded"}</b></div><div className="fact"><small>Recorded price</small><b>{money(puppy.priceCents)}</b></div></div></div>) : <div className="empty-state"><Dog size={30}/><h3>No puppy assigned yet</h3><p>Your assigned puppy will appear here when placement is confirmed.</p></div>}</section>}

      {activeTab === "updates" && <section className="portal-panel"><div className="portal-panel-head"><div><span>PUPPY UPDATES</span><h2>Milestones and family notes</h2><p>Updates published by Southwest Virginia Chihuahua for your assigned puppy.</p></div></div><div className="updates-grid">{data.updates.map((update) => <article className="update-card" key={update.id}><header><span><Sparkles size={16}/><b>{update.weekNumber ? `Week ${update.weekNumber}` : "Puppy update"}</b></span><small>{shortDate(update.createdAt)}</small></header><h3>{update.title}</h3><p>{update.body}</p><footer>{update.weight ? `Recorded weight: ${update.weight} lb` : ""}</footer></article>)}{!data.updates.length && <div className="empty-state"><BellRing size={30}/><h3>No published updates yet</h3><p>New puppy updates will appear here when they are released.</p></div>}</div></section>}

      {activeTab === "documents" && <div style={{display:"grid",gap:16}}>
        <section className="portal-panel"><div className="portal-panel-head"><div><span>AGREEMENTS</span><h2>Review and retain your documents</h2><p>Pending agreements and completed signed copies remain connected to your family record.</p></div></div><div className="content-list">{data.contracts.map((contract) => <div className="content-row" key={contract.id}><span className="row-icon">{contract.status === "signed" ? <CheckCircle2 size={18}/> : <FileSignature size={18}/>}</span><div><b>{contract.title}</b><small>{contract.status === "signed" ? `Signed ${shortDate(contract.signedAt)}` : `Prepared ${shortDate(contract.createdAt)}`} · {contract.puppyName}</small></div><div className="document-actions">{contract.status === "pending" ? <Link href={`/portal/${token}/contracts/${contract.id}`}>Review & sign <ChevronRight size={13}/></Link> : <a className="secondary" href={`/api/portal/${token}/documents/${contract.id}`} target="_blank" rel="noreferrer">View PDF <Download size={13}/></a>}</div></div>)}{!data.contracts.length && <div className="empty-state"><FileSignature size={30}/><p>No agreements have been prepared yet.</p></div>}</div></section>
        <section className="portal-panel"><div className="portal-panel-head"><div><span>FAMILY FILES</span><h2>Additional documents</h2><p>Insurance, veterinary, registration, transportation, and other family records.</p></div></div><div className="content-list">{view.additionalDocuments.map((document) => <div className="content-row" key={document.id}><span className="row-icon"><FileText size={18}/></span><div><b>{document.title}</b><small>{document.documentType} · added {shortDate(document.createdAt)}</small></div><div className="document-actions"><a className="secondary" href={`/api/portal/${token}/documents/${document.id}`} target="_blank" rel="noreferrer">Open <Download size={13}/></a></div></div>)}{!view.additionalDocuments.length && <div className="empty-state"><FileText size={28}/><p>No additional files are stored yet.</p></div>}</div></section>
        <section className="portal-panel"><div className="portal-panel-head"><div><span>SECURE UPLOAD</span><h2>Add a document</h2><p>Upload a record directly to your private family file.</p></div></div><UploadDocumentForm token={token} onUploaded={load}/></section>
      </div>}

      {activeTab === "payments" && <section className="portal-panel"><div className="portal-panel-head"><div><span>PAYMENT RECORD</span><h2>Account summary</h2><p>Payments recorded by Southwest Virginia Chihuahua and scheduled account items.</p></div></div><div className="payment-summary"><span><small>Purchase total</small><b>{money(data.payments.saleTotalCents)}</b></span><span><small>Payments recorded</small><b>{money(data.payments.paidCents)}</b></span><span><small>Outstanding</small><b>{money(data.payments.outstandingCents)}</b></span></div><div className="content-list">{data.payments.items.map((payment) => <div className="content-row" key={payment.id}><span className="row-icon"><CircleDollarSign size={18}/></span><div><b>{payment.description}</b><small>{[payment.category,payment.method,shortDate(payment.paidDate || payment.dueDate)].filter(Boolean).join(" · ")}</small></div><div style={{textAlign:"right"}}><b>{money(payment.amountCents)}</b><span className={`status-pill ${statusClass(payment.status)}`} style={{display:"inline-block",marginTop:4}}>{payment.status}</span></div></div>)}{!data.payments.items.length && <div className="empty-state"><WalletCards size={30}/><p>No payments are recorded yet.</p></div>}</div></section>}

      {activeTab === "schedule" && <section className="portal-panel"><div className="portal-panel-head"><div><span>SCHEDULE</span><h2>Appointments and next steps</h2><p>Upcoming dates connected to your family or assigned puppy.</p></div></div><div className="content-list">{view.upcoming.map((event) => <div className="content-row" key={event.id}><span className="row-icon"><CalendarDays size={18}/></span><div><b>{event.title}</b><small>{shortDate(event.date)}{event.time ? ` · ${event.time}` : ""}{event.location ? ` · ${event.location}` : ""}{event.puppyName ? ` · ${event.puppyName}` : ""}</small></div><span className={`status-pill ${statusClass(event.status)}`}>{event.status}</span></div>)}{!view.upcoming.length && <div className="empty-state"><Clock3 size={30}/><p>No upcoming appointments are recorded yet.</p></div>}</div></section>}

      {activeTab === "transportation" && <div style={{display:"grid",gap:16}}><section className="portal-panel"><div className="portal-panel-head"><div><span>GO-HOME PLANNING</span><h2>Pickup and delivery</h2><p>Review transportation records and send a request for the team to review.</p></div></div><div className="content-list">{view.transportation.map((event) => <div className="content-row" key={event.id}><span className="row-icon"><Route size={18}/></span><div><b>{event.title}</b><small>{shortDate(event.date)}{event.time ? ` · ${event.time}` : ""}{event.location ? ` · ${event.location}` : ""}</small></div><span className={`status-pill ${statusClass(event.status)}`}>{event.status}</span></div>)}{!view.transportation.length && <div className="empty-state"><Truck size={30}/><p>No pickup or delivery event has been scheduled yet.</p></div>}</div></section><section className="portal-panel"><div className="portal-panel-head"><div><span>REQUEST</span><h2>Transportation request</h2><p>Send your preferred date and arrangement details.</p></div></div><RequestForm token={token} kind="transportation" onCreated={load}/></section></div>}

      {activeTab === "messages" && <div style={{display:"grid",gap:16}}><section className="portal-panel"><div className="portal-panel-head"><div><span>CONTACT</span><h2>Reach the team</h2><p>Use the portal form for account-specific questions so the message remains connected to your family record.</p></div></div><div className="contact-grid"><a className="contact-card" href="mailto:support@swvachihuahua.com"><span><Mail size={19}/></span><div><b>Email support</b><small>{data.support.email || "support@swvachihuahua.com"}</small></div></a><a className="contact-card" href="tel:+18555065425"><span><Phone size={19}/></span><div><b>Telephone</b><small>{data.support.phone || "855-506-5425"}</small></div></a></div></section><section className="portal-panel"><div className="portal-panel-head"><div><span>NEW MESSAGE</span><h2>Send a private message</h2><p>Your message will be added to SWVAOS and the team will receive an email notification.</p></div></div><RequestForm token={token} kind="support" onCreated={load}/></section><section className="portal-panel"><div className="portal-panel-head"><div><span>REQUEST HISTORY</span><h2>Recent requests</h2></div></div><div className="content-list">{data.requests.map((request) => <div className="content-row" key={request.id}><span className="row-icon"><MessageSquareText size={18}/></span><div><b>{request.subject}</b><small>{request.kind === "transportation" ? "Transportation" : "Support"} · {shortDate(request.createdAt)}</small></div><span className={`status-pill ${statusClass(request.status)}`}>{request.status}</span></div>)}{!data.requests.length && <div className="empty-state"><HelpCircle size={28}/><p>No portal requests have been sent yet.</p></div>}</div></section></div>}

      {activeTab === "account" && <div style={{display:"grid",gap:16}}><section className="portal-panel"><div className="portal-panel-head"><div><span>FAMILY ACCOUNT</span><h2>Contact and placement record</h2><p>Contact the team when information needs to be corrected.</p></div></div><div className="family-account-grid"><div className="account-field"><small>Family name</small><b>{data.buyer.name}</b></div><div className="account-field"><small>Email</small><b>{data.buyer.email}</b></div><div className="account-field"><small>Telephone</small><b>{data.buyer.phone || "Not recorded"}</b></div><div className="account-field"><small>Location</small><b>{data.buyer.location || "Not recorded"}</b></div><div className="account-field"><small>Application status</small><b>{data.buyer.applicationStatus || "Not recorded"}</b></div><div className="account-field"><small>Recorded preferences</small><b>{[data.buyer.preferredSex,data.buyer.preferredColor].filter(Boolean).join(" · ") || "Not recorded"}</b></div></div></section><section className="portal-panel"><div className="portal-panel-head"><div><span>ACCOUNT SECURITY</span><h2>Private access</h2><p>Your password is managed by the secure authentication service and is not visible in SWVAOS.</p></div></div><div className="content-list"><div className="content-row"><span className="row-icon"><ShieldCheck size={18}/></span><div><b>Password-protected account</b><small>Your browser remains signed in for up to 30 days unless you sign out.</small></div><span className="status-pill good">Active</span></div><div className="content-row"><span className="row-icon"><Mail size={18}/></span><div><b>Secure email-link backup</b><small>Use the Puppy Portal sign-in page to request a temporary email link when needed.</small></div><ChevronRight size={15}/></div></div>{accountMode && <form action="/api/portal/auth/logout" method="post" style={{marginTop:14}}><button type="submit" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"11px 14px",border:0,borderRadius:12,background:"#173f46",color:"white",fontWeight:800,cursor:"pointer"}}><LogOut size={16}/>Sign out of this browser</button></form>}</section></div>}
    </section>
  </main>;
}
