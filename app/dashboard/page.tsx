"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, CalendarDays, ChevronDown, ChevronRight, ClipboardCheck, Dog, FileCheck2,
  FileText, HeartPulse, Home, LayoutDashboard, Route, ShieldCheck, Sparkles, UsersRound,
  WalletCards, XCircle,
} from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; application_status: string };
type Puppy = { id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; status: string; birth_date: string | null; updated_at: string; price_cents: number | null; current_weight: number | null };
type Litter = { id: number; name: string; status: string; due_date: string | null; birth_date: string | null };
type Transaction = { id: number; type: string; amount_cents: number; status: string; paid_date: string | null; due_date: string | null; description: string };
type Event = { id: number; title: string; event_type: string; event_date: string; event_time: string | null; status: string; related_type: string | null; related_id: number | null };
type BuyerDocument = { id: number; buyer_id: number; title: string; document_type: string; file_name: string; created_at: string; updated_at: string; notes?: string | null; puppy_ids?: number[] };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; litters: Litter[]; transactions: Transaction[]; events: Event[]; buyer_documents: BuyerDocument[] };

type NavGroup = { id: string; label: string; icon: typeof LayoutDashboard; children: Array<{ label: string; href?: string; panel?: Panel }> };
type Panel = "overview" | "puppies" | "documents" | "activity";

const nav: NavGroup[] = [
  { id: "command", label: "Command Center", icon: LayoutDashboard, children: [
    { label: "Overview", panel: "overview" }, { label: "Schedule", href: "/?view=Calendar" }, { label: "Reports", href: "/?view=Reports" },
  ]},
  { id: "breeding", label: "Breeding Operations", icon: Dog, children: [
    { label: "Dogs & breeding", href: "/?view=Breeding" }, { label: "Litters", href: "/?view=Litters" },
    { label: "Puppies", panel: "puppies" }, { label: "Health & care", href: "/?view=Care" },
  ]},
  { id: "people", label: "People Operations", icon: UsersRound, children: [
    { label: "Applications", href: "/?view=Applications" }, { label: "Buyers & waitlist", href: "/?view=Families" },
    { label: "Puppy placement", href: "/?view=Placement" }, { label: "Pickup & delivery", href: "/?view=Delivery" },
  ]},
  { id: "business", label: "Business", icon: WalletCards, children: [
    { label: "Payments & sales", href: "/?view=Finance" }, { label: "Communications", href: "/?view=Comms" },
    { label: "Automations & templates", href: "/?view=Templates" },
  ]},
  { id: "admin", label: "Admin & Records", icon: ShieldCheck, children: [
    { label: "Signed documents", panel: "documents" }, { label: "All documents", href: "/?view=Vault" },
    { label: "Recent activity", panel: "activity" }, { label: "Family portal", href: "/?view=Portal" },
  ]},
];

const money = (value: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((value ?? 0) / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const fullName = (buyer: Buyer | undefined) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email : "Unassigned";

export default function DashboardPage() {
  const [data, setData] = useState<DataSet | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState("command");
  const [panel, setPanel] = useState<Panel>("overview");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load SWVAOS.");
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load SWVAOS.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const activePuppies = data.puppies.filter((p) => !["Gone Home", "Placed", "Archived"].includes(p.status));
    const goneHome = data.puppies.filter((p) => p.status === "Gone Home");
    const needsReview = data.buyers.filter((b) => /review|complete|submitted/i.test(b.application_status || ""));
    const paid = data.transactions.filter((t) => ["Paid", "Complete", "Completed", "Cleared"].includes(t.status)).reduce((sum, t) => sum + t.amount_cents, 0);
    const signed = data.buyer_documents.filter((d) => /^signed\s/i.test(d.title) || /"status":"signed"/.test(d.notes || ""));
    const upcoming = data.events.filter((e) => e.event_date >= new Date().toISOString().slice(0, 10) && e.status !== "Completed").sort((a,b) => `${a.event_date}${a.event_time || ""}`.localeCompare(`${b.event_date}${b.event_time || ""}`));
    return { activePuppies, goneHome, needsReview, paid, signed, upcoming };
  }, [data]);

  async function markGoneHome(puppy: Puppy) {
    if (!window.confirm(`Mark ${puppy.name} as Gone Home?`)) return;
    setUpdatingId(puppy.id);
    setError("");
    try {
      const response = await fetch("/api/data", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource: "puppies", id: puppy.id, data: {
          litter_id: (puppy as Puppy & { litter_id?: number }).litter_id,
          buyer_id: puppy.buyer_id, name: puppy.name, sex: puppy.sex, color: puppy.color,
          birth_date: puppy.birth_date, current_weight: puppy.current_weight,
          status: "Gone Home", price_cents: puppy.price_cents,
        }}),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to update puppy status.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update puppy status."); }
    finally { setUpdatingId(null); }
  }

  if (loading) return <main className="dash-state">Loading command center...</main>;

  return <main className="swva-dashboard">
    <style jsx global>{`
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #eaf3f2; color: #10313a; }
      .swva-dashboard { min-height: 100vh; display: grid; grid-template-columns: 286px minmax(0,1fr); font-family: var(--font-geist-sans), Arial, sans-serif; background:
        radial-gradient(circle at 78% 8%, rgba(24,188,184,.16), transparent 28%),
        radial-gradient(circle at 62% 88%, rgba(215,170,84,.12), transparent 24%),
        linear-gradient(135deg,#edf7f5 0%,#f9fbfa 48%,#e7f1f1 100%); }
      .side-rail { position: sticky; top: 0; height: 100vh; padding: 24px 18px; overflow-y: auto; color: #dff7f3; background: linear-gradient(175deg,#092f39 0%,#0a4650 52%,#07313a 100%); box-shadow: 18px 0 50px rgba(5,40,47,.14); }
      .brand { display:flex; align-items:center; gap:12px; padding: 4px 8px 24px; border-bottom:1px solid rgba(255,255,255,.11); }
      .brand-mark { width:44px; height:44px; display:grid; place-items:center; border-radius:15px; background:linear-gradient(135deg,#20c1bd,#cfa353); color:white; box-shadow:0 10px 28px rgba(19,190,184,.24); }
      .brand strong,.brand small { display:block; } .brand strong { font-size:17px; letter-spacing:-.02em; } .brand small { margin-top:2px; color:#91c9c5; font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
      .rail-nav { display:grid; gap:8px; margin-top:20px; }
      .nav-group > button { width:100%; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:11px; padding:13px 12px; border:0; border-radius:14px; color:#d9eeec; background:transparent; font:inherit; font-weight:760; text-align:left; cursor:pointer; }
      .nav-group > button:hover,.nav-group.open > button { background:rgba(255,255,255,.09); color:white; }
      .subnav { display:grid; gap:3px; margin:4px 0 8px 35px; padding-left:10px; border-left:1px solid rgba(126,220,212,.24); }
      .subnav a,.subnav button { display:flex; align-items:center; width:100%; min-height:35px; padding:7px 10px; border:0; border-radius:9px; color:#9fc9c6; background:transparent; font:inherit; font-size:12px; font-weight:680; text-decoration:none; text-align:left; cursor:pointer; }
      .subnav a:hover,.subnav button:hover,.subnav button.active { color:white; background:rgba(46,205,194,.12); }
      .rail-footer { margin-top:26px; padding:14px; border:1px solid rgba(255,255,255,.1); border-radius:16px; background:rgba(255,255,255,.055); }
      .rail-footer small { color:#8fc2bf; line-height:1.5; }
      .workspace { min-width:0; padding:30px clamp(22px,4vw,58px) 60px; }
      .topline { display:flex; justify-content:space-between; gap:20px; align-items:center; margin-bottom:25px; }
      .eyebrow { display:flex; align-items:center; gap:7px; margin:0 0 6px; color:#098b91; font-size:11px; font-weight:850; letter-spacing:.13em; text-transform:uppercase; }
      .topline h1 { margin:0; font-family:Georgia,serif; font-size:clamp(30px,4vw,50px); font-weight:500; letter-spacing:-.045em; }
      .topline p { margin:7px 0 0; color:#668083; }
      .live-pill { display:flex; align-items:center; gap:8px; padding:10px 13px; border:1px solid rgba(7,139,145,.2); border-radius:999px; background:rgba(255,255,255,.62); color:#08767a; font-size:12px; font-weight:800; backdrop-filter:blur(14px); }
      .live-pill i { width:8px; height:8px; border-radius:50%; background:#16aa76; box-shadow:0 0 0 5px rgba(22,170,118,.12); }
      .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:15px; margin-bottom:18px; }
      .metric { position:relative; overflow:hidden; min-height:142px; padding:20px; border:1px solid rgba(120,158,157,.22); border-radius:25px; background:rgba(255,255,255,.66); box-shadow:0 18px 55px rgba(28,73,74,.08); backdrop-filter:blur(18px); }
      .metric::after { content:""; position:absolute; width:95px; height:95px; right:-30px; top:-32px; border-radius:50%; background:linear-gradient(135deg,rgba(20,178,176,.2),rgba(210,164,74,.1)); }
      .metric svg { color:#0b9094; } .metric small { display:block; margin-top:17px; color:#71898b; font-weight:750; } .metric strong { display:block; margin-top:3px; font-family:Georgia,serif; font-size:28px; font-weight:500; }
      .flow-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr); gap:18px; }
      .glass-panel { padding:22px; border:1px solid rgba(118,158,157,.22); border-radius:27px; background:rgba(255,255,255,.68); box-shadow:0 20px 60px rgba(28,73,74,.075); backdrop-filter:blur(18px); }
      .panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; margin-bottom:16px; }
      .panel-head h2 { margin:0; font-family:Georgia,serif; font-size:22px; font-weight:500; } .panel-head p { margin:5px 0 0; color:#6b8385; font-size:13px; }
      .soft-link { color:#087f84; font-size:12px; font-weight:800; text-decoration:none; }
      .stream { display:grid; gap:9px; }
      .stream-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:12px; align-items:center; padding:13px 14px; border-radius:17px; background:rgba(236,246,244,.78); }
      .stream-icon { width:37px; height:37px; display:grid; place-items:center; border-radius:13px; background:white; color:#0a8b91; box-shadow:0 7px 20px rgba(19,90,92,.08); }
      .stream-row b,.stream-row small { display:block; } .stream-row small { margin-top:3px; color:#71898a; }
      .status { padding:6px 9px; border-radius:999px; background:#e0f5ed; color:#137257; font-size:10px; font-weight:850; text-transform:uppercase; }
      .danger-action { padding:8px 10px; border:1px solid #93cfc5; border-radius:10px; background:white; color:#0b746f; font:inherit; font-size:11px; font-weight:850; cursor:pointer; }
      .danger-action:hover { background:#e9f8f4; } .danger-action:disabled { opacity:.5; cursor:wait; }
      .empty { padding:34px 15px; color:#73898b; text-align:center; }
      .error { margin-bottom:15px; padding:12px 14px; border-radius:14px; background:#fff0ef; color:#9a3333; }
      .document-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .document-card { display:flex; align-items:center; gap:13px; padding:16px; border-radius:19px; background:rgba(238,247,246,.82); color:inherit; text-decoration:none; }
      .document-card:hover { background:#e5f5f2; transform:translateY(-1px); }
      .document-card b,.document-card small { display:block; } .document-card small { margin-top:4px; color:#708789; }
      .doc-seal { width:42px; height:42px; display:grid; place-items:center; flex:0 0 auto; border-radius:14px; background:linear-gradient(135deg,#0c8f92,#18b8a2); color:white; }
      .dash-state { min-height:100vh; display:grid; place-items:center; background:#edf7f5; color:#45686c; font-family:Arial,sans-serif; }
      @media(max-width:1050px){ .metric-grid{grid-template-columns:repeat(2,1fr)} .flow-grid{grid-template-columns:1fr} }
      @media(max-width:780px){ .swva-dashboard{grid-template-columns:1fr}.side-rail{position:relative;height:auto}.workspace{padding:22px 15px 45px}.metric-grid,.document-grid{grid-template-columns:1fr}.topline{align-items:flex-start}.live-pill{display:none} }
    `}</style>

    <aside className="side-rail">
      <div className="brand"><div className="brand-mark"><Sparkles size={23}/></div><div><strong>SWVAOS</strong><small>Breeder Command Portal</small></div></div>
      <nav className="rail-nav" aria-label="SWVAOS sections">
        {nav.map((group) => { const Icon = group.icon; const open = openGroup === group.id; return <div className={`nav-group ${open ? "open" : ""}`} key={group.id}>
          <button onClick={() => setOpenGroup(open ? "" : group.id)} aria-expanded={open}><Icon size={18}/><span>{group.label}</span>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>
          {open && <div className="subnav">{group.children.map((item) => item.href ? <Link href={item.href} key={item.label}>{item.label}</Link> : <button key={item.label} className={panel === item.panel ? "active" : ""} onClick={() => setPanel(item.panel!)}>{item.label}</button>)}</div>}
        </div>})}
      </nav>
      <div className="rail-footer"><small>Main sections stay on the left. Open a section to reveal only the related tools underneath it.</small></div>
    </aside>

    <section className="workspace">
      <header className="topline"><div><p className="eyebrow"><Activity size={14}/> Live operations</p><h1>{panel === "overview" ? "Command Center" : panel === "puppies" ? "Puppy Placement" : panel === "documents" ? "Signed Documents" : "Recent Activity"}</h1><p>Southwest Virginia Chihuahua operations, organized around what needs attention now.</p></div><div className="live-pill"><i/> Connected</div></header>
      {error && <div className="error"><XCircle size={15}/> {error}</div>}

      {panel === "overview" && metrics && <>
        <div className="metric-grid">
          <article className="metric"><Dog size={21}/><small>Active puppies</small><strong>{metrics.activePuppies.length}</strong></article>
          <article className="metric"><ClipboardCheck size={21}/><small>Applications needing review</small><strong>{metrics.needsReview.length}</strong></article>
          <article className="metric"><FileCheck2 size={21}/><small>Signed documents</small><strong>{metrics.signed.length}</strong></article>
          <article className="metric"><WalletCards size={21}/><small>Recorded payments</small><strong>{money(metrics.paid)}</strong></article>
        </div>
        <div className="flow-grid">
          <section className="glass-panel"><div className="panel-head"><div><h2>Puppy movement</h2><p>Current placements and go-home status.</p></div><button className="soft-link" onClick={() => setPanel("puppies")}>View all</button></div>
            <div className="stream">{data?.puppies.slice(0,6).map((puppy) => <div className="stream-row" key={puppy.id}><div className="stream-icon"><Dog size={18}/></div><div><b>{puppy.name}</b><small>{[puppy.sex, puppy.color, fullName(data.buyers.find((b) => b.id === puppy.buyer_id))].filter(Boolean).join(" · ")}</small></div><span className="status">{puppy.status}</span></div>)}</div>
          </section>
          <section className="glass-panel"><div className="panel-head"><div><h2>Next up</h2><p>Upcoming appointments and tasks.</p></div><Link className="soft-link" href="/?view=Calendar">Calendar</Link></div>
            <div className="stream">{metrics.upcoming.slice(0,5).map((event) => <div className="stream-row" key={event.id}><div className="stream-icon"><CalendarDays size={18}/></div><div><b>{event.title}</b><small>{date(event.event_date)} {event.event_time || ""}</small></div><span className="status">{event.status}</span></div>)}{!metrics.upcoming.length && <div className="empty">No upcoming events recorded.</div>}</div>
          </section>
        </div>
      </>}

      {panel === "puppies" && data && <section className="glass-panel"><div className="panel-head"><div><h2>Puppy files</h2><p>Mark a puppy as Gone Home directly from the operational file.</p></div><Link className="soft-link" href="/?view=Puppies">Open full puppy workspace</Link></div>
        <div className="stream">{data.puppies.map((puppy) => <div className="stream-row" key={puppy.id}><div className="stream-icon"><Home size={18}/></div><div><Link href={`/puppies/${puppy.id}`}><b>{puppy.name}</b></Link><small>{fullName(data.buyers.find((b) => b.id === puppy.buyer_id))} · {puppy.sex || "Sex not recorded"} · {puppy.color || "Color not recorded"}</small></div>{puppy.status === "Gone Home" ? <span className="status">Gone Home</span> : <button className="danger-action" disabled={updatingId === puppy.id} onClick={() => void markGoneHome(puppy)}>{updatingId === puppy.id ? "Updating..." : "Mark Gone Home"}</button>}</div>)}</div>
      </section>}

      {panel === "documents" && data && <section className="glass-panel"><div className="panel-head"><div><h2>Signed document administration</h2><p>Staff view of buyer-signed agreements and completed records.</p></div><Link className="soft-link" href="/?view=Vault">Document vault</Link></div>
        <div className="document-grid">{metrics?.signed.map((doc) => <a className="document-card" href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" key={doc.id}><div className="doc-seal"><FileCheck2 size={20}/></div><div><b>{doc.title}</b><small>{doc.document_type} · {fullName(data.buyers.find((b) => b.id === doc.buyer_id))} · updated {date(doc.updated_at || doc.created_at)}</small></div></a>)}{!metrics?.signed.length && <div className="empty">No signed documents were found.</div>}</div>
      </section>}

      {panel === "activity" && data && <section className="glass-panel"><div className="panel-head"><div><h2>Recent operational activity</h2><p>Contracts, appointments, pickup activity, and other recorded events.</p></div></div>
        <div className="stream">{[...data.events].sort((a,b) => `${b.event_date}${b.event_time || ""}`.localeCompare(`${a.event_date}${a.event_time || ""}`)).slice(0,30).map((event) => <div className="stream-row" key={event.id}><div className="stream-icon">{event.event_type === "Contract" ? <FileText size={18}/> : event.event_type === "Transportation" ? <Route size={18}/> : <HeartPulse size={18}/>}</div><div><b>{event.title}</b><small>{event.event_type} · {date(event.event_date)} {event.event_time || ""}</small></div><span className="status">{event.status}</span></div>)}</div>
      </section>}
    </section>
  </main>;
}
