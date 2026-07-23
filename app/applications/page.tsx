"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSignature, RefreshCw, Search, ShieldCheck } from "lucide-react";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null; application_status: string; preferred_sex: string | null; preferred_color: string | null; notes: string | null };
type Puppy = { id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; price_cents: number | null; status: string };
type DataSet = { buyers: Buyer[]; puppies: Puppy[] };

const fullName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;
const money = (cents: number | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
const today = () => new Date().toISOString().slice(0, 10);

export default function ApplicationsPage() {
  const [data, setData] = useState<DataSet>({ buyers: [], puppies: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load applications.");
      setData({ buyers: payload.buyers ?? [], puppies: payload.puppies ?? [] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const buyers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...data.buyers]
      .filter((buyer) => !needle || `${fullName(buyer)} ${buyer.email} ${buyer.phone ?? ""} ${buyer.application_status}`.toLowerCase().includes(needle))
      .sort((left, right) => {
        const priority = (status: string) => status === "Approved" ? 2 : ["Declined", "Archived"].includes(status) ? 3 : 1;
        return priority(left.application_status) - priority(right.application_status) || fullName(left).localeCompare(fullName(right));
      });
  }, [data.buyers, query]);

  const selectedBuyer = data.buyers.find((buyer) => buyer.id === selectedBuyerId) ?? null;
  const buyerPuppies = selectedBuyer ? data.puppies.filter((puppy) => puppy.buyer_id === selectedBuyer.id) : [];

  async function approve(buyer: Buyer) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/buyers/${buyer.id}/approve`, { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to approve the application.");
      setToast(`${fullName(buyer)} approved`);
      setSelectedBuyerId(buyer.id);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to approve the application.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(buyer: Buyer, status: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/data", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource: "buyers", id: buyer.id, data: { application_status: status } }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to update the application.");
      setToast(`Application marked ${status}`);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update the application.");
    } finally {
      setSaving(false);
    }
  }

  async function createAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuyer) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, unknown>;
    values.buyer_id = selectedBuyer.id;
    values.autopay_required = form.get("autopay_required") === "on";
    try {
      const response = await fetch("/api/payment-agreements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to create the payment agreement.");
      setShowAgreement(false);
      setToast("Payment agreement created and saved to the buyer vault");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to create the payment agreement.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="applications-page">
    <style jsx global>{`
      body { margin: 0; background: #eef4f2; color: #183536; }
      * { box-sizing: border-box; }
      button, input, select, textarea { font: inherit; }
      .applications-page { min-height: 100vh; padding: 28px; font-family: var(--font-geist-sans), Arial, sans-serif; }
      .applications-shell { width: min(1320px, 100%); margin: 0 auto; }
      .applications-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
      .applications-head > div { display: grid; gap: 5px; }
      .applications-head small { color: #597373; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
      .applications-head h1 { margin: 0; font-size: clamp(28px, 4vw, 46px); letter-spacing: -.04em; }
      .applications-head p { margin: 0; color: #637a7a; }
      .back-link { display: inline-flex; align-items: center; gap: 8px; padding: 11px 14px; border: 1px solid #b8cfca; border-radius: 10px; background: white; color: #24565b; text-decoration: none; font-weight: 750; }
      .applications-tools { display: flex; gap: 12px; margin-bottom: 18px; }
      .applications-search { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid #bfd2ce; border-radius: 12px; background: white; }
      .applications-search input { width: 100%; height: 46px; border: 0; outline: 0; background: transparent; }
      .refresh { min-width: 46px; border: 1px solid #bfd2ce; border-radius: 12px; background: white; color: #24565b; cursor: pointer; }
      .applications-grid { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 18px; align-items: start; }
      .applications-panel { border: 1px solid #bdd0cc; border-radius: 16px; background: rgba(255,255,255,.93); box-shadow: 0 16px 45px rgba(36,79,78,.08); overflow: hidden; }
      .panel-title { padding: 18px 20px; border-bottom: 1px solid #d6e3df; background: #f8fbfa; }
      .panel-title span { display: block; margin-bottom: 4px; color: #57807a; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .panel-title h2 { margin: 0; font-size: 20px; }
      .application-list { display: grid; }
      .application-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 14px; padding: 17px 20px; border-bottom: 1px solid #e0e9e6; }
      .application-card:last-child { border-bottom: 0; }
      .application-main { min-width: 0; border: 0; background: transparent; text-align: left; cursor: pointer; }
      .application-main b { display: block; margin-bottom: 5px; font-size: 16px; }
      .application-main small { display: block; overflow: hidden; color: #6d8381; text-overflow: ellipsis; white-space: nowrap; }
      .application-actions { display: flex; align-items: center; gap: 8px; }
      .application-actions button, .detail-actions button { min-height: 36px; padding: 0 11px; border: 1px solid #b8cfca; border-radius: 8px; background: white; color: #285b5f; font-weight: 750; cursor: pointer; }
      .application-actions .approve, .detail-actions .primary { border-color: #227d68; background: #227d68; color: white; }
      .status { display: inline-flex; width: fit-content; padding: 5px 8px; border-radius: 999px; background: #edf2f1; color: #58706e; font-size: 11px; font-weight: 800; }
      .status.approved { background: #e2f5ec; color: #187052; }
      .detail-body { display: grid; gap: 16px; padding: 20px; }
      .detail-body dl { display: grid; grid-template-columns: 115px minmax(0,1fr); gap: 10px 12px; margin: 0; }
      .detail-body dt { color: #718482; font-size: 12px; font-weight: 750; }
      .detail-body dd { margin: 0; overflow-wrap: anywhere; font-weight: 650; }
      .detail-actions { display: grid; gap: 9px; }
      .detail-actions button { min-height: 42px; }
      .error { margin-bottom: 16px; padding: 13px 15px; border: 1px solid #e3aaa3; border-radius: 10px; background: #fff0ee; color: #8d332c; font-weight: 700; }
      .toast { position: fixed; right: 24px; bottom: 24px; z-index: 50; padding: 13px 16px; border-radius: 10px; background: #183f3e; color: white; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
      .empty { padding: 36px 22px; color: #6c8380; text-align: center; }
      .agreement-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 22px; background: rgba(16,41,40,.58); }
      .agreement-modal { width: min(980px, 100%); max-height: calc(100vh - 44px); overflow: auto; border-radius: 17px; background: white; box-shadow: 0 24px 80px rgba(0,0,0,.28); }
      .agreement-modal header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid #d6e3df; background: #f8fbfa; }
      .agreement-modal header h2 { margin: 0; }
      .agreement-modal header button { border: 1px solid #b8cfca; border-radius: 8px; background: white; padding: 9px 12px; cursor: pointer; }
      .agreement-form { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; padding: 20px; }
      .agreement-form label { display: grid; gap: 6px; color: #496764; font-size: 12px; font-weight: 750; }
      .agreement-form input, .agreement-form select, .agreement-form textarea { width: 100%; min-height: 42px; padding: 9px 10px; border: 1px solid #bdd0cc; border-radius: 8px; background: #fbfdfc; color: #183536; }
      .agreement-form .wide { grid-column: 1 / -1; }
      .agreement-form .check { display: flex; align-items: center; gap: 9px; }
      .agreement-form .check input { width: 18px; min-height: 18px; }
      .agreement-form footer { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; }
      .agreement-form footer button { min-height: 43px; padding: 0 15px; border: 1px solid #b8cfca; border-radius: 9px; background: white; color: #285b5f; font-weight: 800; cursor: pointer; }
      .agreement-form footer .primary { border-color: #227d68; background: #227d68; color: white; }
      @media (max-width: 900px) { .applications-grid { grid-template-columns: 1fr; } .applications-head { align-items: flex-start; flex-direction: column-reverse; } }
      @media (max-width: 650px) { .applications-page { padding: 16px; } .application-card { grid-template-columns: 1fr; } .application-actions { flex-wrap: wrap; } .agreement-form { grid-template-columns: 1fr; } .agreement-form .wide { grid-column: auto; } }
    `}</style>
    <div className="applications-shell">
      <div className="applications-head">
        <div><small>Buyer workflow</small><h1>Applications & Agreements</h1><p>Review applicants, approve placement, and prepare the complete puppy payment agreement.</p></div>
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Back to SWVAOS</Link>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="applications-tools"><label className="applications-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applicants by name, email, phone, or status..." /></label><a className="back-link" href="/api/templates/puppy-application"><Download size={16} /> Puppy application</a><a className="back-link" href="/api/templates/payment-agreement"><Download size={16} /> Payment agreement</a><button className="refresh" onClick={() => void load()} title="Refresh"><RefreshCw size={18} /></button></div>
      <div className="applications-grid">
        <section className="applications-panel"><div className="panel-title"><span>Application queue</span><h2>{buyers.length} families</h2></div>{loading ? <div className="empty">Loading applications...</div> : buyers.length ? <div className="application-list">{buyers.map((buyer) => <article className="application-card" key={buyer.id}><button className="application-main" onClick={() => setSelectedBuyerId(buyer.id)}><b>{fullName(buyer)}</b><small>{[buyer.email, buyer.phone, buyer.city, buyer.state].filter(Boolean).join(" • ") || "No contact information"}</small><span className={`status ${buyer.application_status === "Approved" ? "approved" : ""}`}>{buyer.application_status || "New"}</span></button><div className="application-actions">{buyer.application_status !== "Approved" && <button className="approve" disabled={saving} onClick={() => void approve(buyer)}><CheckCircle2 size={15} /> Approve</button>}<button onClick={() => setSelectedBuyerId(buyer.id)}>Review</button></div></article>)}</div> : <div className="empty">No applications found.</div>}</section>
        <aside className="applications-panel"><div className="panel-title"><span>Selected family</span><h2>{selectedBuyer ? fullName(selectedBuyer) : "Choose an applicant"}</h2></div>{selectedBuyer ? <div className="detail-body"><dl><dt>Status</dt><dd><span className={`status ${selectedBuyer.application_status === "Approved" ? "approved" : ""}`}>{selectedBuyer.application_status}</span></dd><dt>Email</dt><dd>{selectedBuyer.email || "Not recorded"}</dd><dt>Phone</dt><dd>{selectedBuyer.phone || "Not recorded"}</dd><dt>Location</dt><dd>{[selectedBuyer.city, selectedBuyer.state, selectedBuyer.postal_code].filter(Boolean).join(", ") || "Not recorded"}</dd><dt>Preferences</dt><dd>{[selectedBuyer.preferred_sex, selectedBuyer.preferred_color].filter(Boolean).join(" / ") || "Not recorded"}</dd><dt>Assigned puppy</dt><dd>{buyerPuppies.length ? buyerPuppies.map((puppy) => `${puppy.name} (${money(puppy.price_cents)})`).join(", ") : "No puppy assigned"}</dd><dt>Notes</dt><dd>{selectedBuyer.notes || "No notes"}</dd></dl><div className="detail-actions">{selectedBuyer.application_status !== "Approved" && <button className="primary" disabled={saving} onClick={() => void approve(selectedBuyer)}><ShieldCheck size={16} /> Approve application</button>}<button disabled={saving} onClick={() => void changeStatus(selectedBuyer, "Wait list")}>Move to wait list</button><button disabled={saving} onClick={() => void changeStatus(selectedBuyer, "Declined")}>Decline application</button><button className="primary" disabled={saving || selectedBuyer.application_status !== "Approved"} onClick={() => setShowAgreement(true)}><FileSignature size={16} /> Create payment agreement</button></div></div> : <div className="empty">Select a family to review the record and take action.</div>}</aside>
      </div>
    </div>
    {toast && <div className="toast">{toast}</div>}
    {showAgreement && selectedBuyer && <div className="agreement-backdrop"><div className="agreement-modal"><header><div><small>Approved family</small><h2>Payment agreement for {fullName(selectedBuyer)}</h2></div><button onClick={() => setShowAgreement(false)}>Close</button></header><form className="agreement-form" onSubmit={createAgreement}>
      <label><span>Plan name</span><input name="plan_name" defaultValue={`Payment Agreement - ${fullName(selectedBuyer)}`} required /></label>
      <label><span>Puppy</span><select name="puppy_id" defaultValue={buyerPuppies[0]?.id ?? ""}><option value="">Not yet assigned</option>{buyerPuppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name} — {money(puppy.price_cents)}</option>)}</select></label>
      <label><span>Plan type</span><select name="plan_type" defaultValue="Post-transfer financing"><option>Pre-transfer purchase plan</option><option>Post-transfer financing</option></select></label>
      <label><span>Payment processor</span><select name="processor" defaultValue="Good Dog"><option>Good Dog</option><option>Card/ACH processor</option><option>Other approved processor</option></select></label>
      <label><span>Co-buyer / borrower</span><input name="co_buyer_name" /></label>
      <label><span>Billing address</span><input name="billing_address" defaultValue={[selectedBuyer.city, selectedBuyer.state, selectedBuyer.postal_code].filter(Boolean).join(", ")} /></label>
      <label><span>Registry</span><select name="registry" defaultValue="AKC"><option>AKC</option><option>CKC</option><option>ACA</option><option>Not yet determined</option></select></label>
      <label><span>Planned transfer date</span><input name="planned_transfer_date" type="date" /></label>
      <label><span>Cash price of puppy</span><input name="cash_price" type="number" min="0" step="0.01" defaultValue={(buyerPuppies[0]?.price_cents ?? 0) / 100} required /></label>
      <label><span>Sales tax, if applicable</span><input name="sales_tax" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Transport / delivery</span><input name="transport" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Other purchase charges</span><input name="other_charges" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Reservation deposit credit</span><input name="deposit_credit" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Additional down payment</span><input name="down_payment" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Other credit</span><input name="other_credit" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>APR</span><input name="apr" type="number" min="0" step="0.01" defaultValue="0" required /></label>
      <label><span>Finance charge</span><input name="finance_charge" type="number" min="0" step="0.01" defaultValue="0" required /></label>
      <label><span>Number of installments</span><input name="installment_count" type="number" min="1" max="60" defaultValue="6" required /></label>
      <label><span>Installment amount</span><input name="installment_amount" type="number" min="0.01" step="0.01" required /></label>
      <label><span>Payment frequency</span><select name="frequency" defaultValue="Monthly"><option>Weekly</option><option>Biweekly</option><option>Monthly</option></select></label>
      <label><span>First payment due</span><input name="first_due_date" type="date" defaultValue={today()} required /></label>
      <label><span>Final payment due</span><input name="final_due_date" type="date" required /></label>
      <label><span>Monthly admin fee</span><input name="monthly_admin_fee" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Late fee</span><input name="late_fee" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>Grace period in days</span><input name="grace_days" type="number" min="0" defaultValue="0" /></label>
      <label><span>Returned-payment fee</span><input name="returned_payment_fee" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label><span>On-time payment credit</span><input name="on_time_credit" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label className="check"><input name="autopay_required" type="checkbox" defaultChecked /><span>Autopay required</span></label>
      <label className="wide"><span>Additional written terms or conditions</span><textarea name="notes" rows={4} placeholder="Only add terms that have been reviewed and agreed to." /></label>
      <footer><button type="button" onClick={() => setShowAgreement(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating..." : "Create and save agreement"}</button></footer>
    </form></div></div>}
  </main>;
}
