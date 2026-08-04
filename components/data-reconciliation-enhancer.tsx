"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Database, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";

type Metric = { reviewed: number; added: number; updated: number; duplicatesSkipped: number; duplicatesRemoved: number; unresolved: number; linked: number };
type Summary = {
  ranAt: string;
  mode: "preview" | "import";
  scope: "full" | "repair";
  sources: Array<{ table: string; category: "buyers" | "puppies" | "payments"; rows: number }>;
  buyers: Metric;
  puppies: Metric;
  payments: Metric;
  warnings: string[];
};

export function DataReconciliationEnhancer() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const check = () => setVisible(new URLSearchParams(window.location.search).get("view") === "Reports");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", check);
    return () => { observer.disconnect(); window.removeEventListener("popstate", check); };
  }, []);

  const review = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/data-reconciliation", { cache: "no-store" });
      const payload = await response.json() as Summary & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to review connected records.");
      setSummary(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to review connected records.");
    } finally {
      setLoading(false);
    }
  }, []);

  function show() {
    setOpen(true);
    if (!summary) void review();
  }

  async function repairAndImport() {
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/data-reconciliation", { method: "POST" });
      const payload = await response.json() as Summary & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to repair and import the connected records.");
      setSummary(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to repair and import the connected records.");
    } finally {
      setImporting(false);
    }
  }

  if (!visible) return null;

  const metric = (title: string, data: Metric) => {
    const headline = title === "Payments" ? data.added : data.duplicatesRemoved;
    const caption = title === "Payments" ? "payments recovered" : "duplicates repaired";
    return <div className="reconcile-metric"><span>{title}</span><b>{headline}</b><small>{caption}</small><dl><div><dt>Reviewed</dt><dd>{data.reviewed}</dd></div><div><dt>Missing records found</dt><dd>{data.added}</dd></div><div><dt>Records completed</dt><dd>{data.updated}</dd></div><div><dt>Duplicates already avoided</dt><dd>{data.duplicatesSkipped}</dd></div><div><dt>Duplicates to merge</dt><dd>{data.duplicatesRemoved}</dd></div>{title === "Payments" && <div><dt>Connected to a buyer</dt><dd>{data.linked}</dd></div>}<div><dt>Needs review</dt><dd>{data.unresolved}</dd></div></dl></div>;
  };

  return <>
    <button type="button" className="reconciliation-launch" onClick={show}><Database size={17}/><span><b>Connected Data Repair</b><small>Duplicates and missing payments</small></span></button>
    {open && createPortal(<div className="reconciliation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing) setOpen(false); }}>
      <section className="reconciliation-dialog" role="dialog" aria-modal="true" aria-labelledby="reconciliation-title">
        <header><div><span>SUPABASE RECORD RECONCILIATION</span><h2 id="reconciliation-title">Repair duplicates and recover prior payments</h2><p>This review checks the current and earlier buyer, puppy, and payment tables. Buyer records are matched by exact email, or by matching name and telephone/location. Puppies are matched by name and date of birth or their complete litter identity. Payments are linked through the original buyer and puppy source records before they are added.</p></div><button type="button" onClick={() => setOpen(false)} disabled={importing} aria-label="Close"><X size={19}/></button></header>
        {loading && <div className="reconciliation-loading"><LoaderCircle size={24}/><b>Reviewing connected tables…</b></div>}
        {error && <div className="reconciliation-error">{error}</div>}
        {summary && !loading && <>
          <div className="reconciliation-status"><ShieldCheck size={22}/><div><b>{summary.mode === "import" ? "Repair and import completed" : "Review completed"}</b><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.ranAt))} · {summary.sources.length} available data sources checked</small></div></div>
          <div className="reconciliation-metrics">{metric("Buyers", summary.buyers)}{metric("Puppies", summary.puppies)}{metric("Payments", summary.payments)}</div>
          <div className="reconciliation-sources"><div><span>TABLES FOUND</span><h3>Connected sources</h3></div><div>{summary.sources.map((source) => <span key={`${source.category}-${source.table}`}><b>{source.table}</b><small>{source.category} · {source.rows} rows</small></span>)}</div></div>
          {summary.warnings.length > 0 && <div className="reconciliation-warnings"><b>Items needing attention</b>{summary.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          <div className="reconciliation-explanation"><CheckCircle2 size={18}/><p>Duplicate buyer and puppy records are merged into the strongest existing record, and their linked puppies, payments, documents, plans, updates, and events are moved before the duplicate is removed. Application rows may complete an existing buyer, but they do not create another buyer by themselves. Every imported payment is checked by source, buyer, puppy, amount, date, method, and reference before it is saved.</p></div>
        </>}
        <footer><button type="button" className="reconciliation-secondary" onClick={() => void review()} disabled={loading || importing}><RefreshCw size={16}/> Review Again</button><button type="button" className="reconciliation-primary" onClick={() => void repairAndImport()} disabled={loading || importing}>{importing ? <LoaderCircle className="reconciliation-spin" size={17}/> : <Database size={17}/>} {importing ? "Repairing and importing…" : "Repair Duplicates & Import Missing"}</button></footer>
      </section>
    </div>, document.body)}
  </>;
}
