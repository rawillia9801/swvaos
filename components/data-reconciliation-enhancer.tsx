"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Database, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";

type Metric = { reviewed: number; added: number; updated?: number; duplicatesSkipped: number; unresolved: number };
type Summary = {
  ranAt: string;
  mode: "preview" | "import";
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

  async function importMissing() {
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/data-reconciliation", { method: "POST" });
      const payload = await response.json() as Summary & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to import missing records.");
      setSummary(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to import missing records.");
    } finally {
      setImporting(false);
    }
  }

  if (!visible) return null;

  const metric = (title: string, data: Metric) => <div className="reconcile-metric"><span>{title}</span><b>{data.added}</b><small>missing found</small><dl><div><dt>Reviewed</dt><dd>{data.reviewed}</dd></div>{typeof data.updated === "number" && <div><dt>Records completed</dt><dd>{data.updated}</dd></div>}<div><dt>Duplicates avoided</dt><dd>{data.duplicatesSkipped}</dd></div><div><dt>Needs review</dt><dd>{data.unresolved}</dd></div></dl></div>;

  return <>
    <button type="button" className="reconciliation-launch" onClick={show}><Database size={17}/><span><b>Connected Data Review</b><small>Buyers, puppies, and payments</small></span></button>
    {open && createPortal(<div className="reconciliation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing) setOpen(false); }}>
      <section className="reconciliation-dialog" role="dialog" aria-modal="true" aria-labelledby="reconciliation-title">
        <header><div><span>SUPABASE RECORD RECONCILIATION</span><h2 id="reconciliation-title">Bring prior records into SWVAOS</h2><p>The review checks current and earlier buyer, puppy, and payment tables. Matching email, phone, puppy identity, source IDs, payment dates, amounts, and references prevent duplicate records.</p></div><button type="button" onClick={() => setOpen(false)} disabled={importing} aria-label="Close"><X size={19}/></button></header>
        {loading && <div className="reconciliation-loading"><LoaderCircle size={24}/><b>Reviewing connected tables…</b></div>}
        {error && <div className="reconciliation-error">{error}</div>}
        {summary && !loading && <>
          <div className="reconciliation-status"><ShieldCheck size={22}/><div><b>{summary.mode === "import" ? "Reconciliation completed" : "Review completed"}</b><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.ranAt))} · {summary.sources.length} available data sources checked</small></div></div>
          <div className="reconciliation-metrics">{metric("Buyers", summary.buyers)}{metric("Puppies", summary.puppies)}{metric("Payments", summary.payments)}</div>
          <div className="reconciliation-sources"><div><span>TABLES FOUND</span><h3>Connected sources</h3></div><div>{summary.sources.map((source) => <span key={`${source.category}-${source.table}`}><b>{source.table}</b><small>{source.category} · {source.rows} rows</small></span>)}</div></div>
          {summary.warnings.length > 0 && <div className="reconciliation-warnings"><b>Items needing attention</b>{summary.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          <div className="reconciliation-explanation"><CheckCircle2 size={18}/><p>Existing SWVAOS records are completed in place when fields are missing. A new record is created only when no matching identity exists. Imported payments receive a source marker and are also compared by buyer, puppy, amount, date, payment method, and reference.</p></div>
        </>}
        <footer><button type="button" className="reconciliation-secondary" onClick={() => void review()} disabled={loading || importing}><RefreshCw size={16}/> Review Again</button><button type="button" className="reconciliation-primary" onClick={() => void importMissing()} disabled={loading || importing}>{importing ? <LoaderCircle className="reconciliation-spin" size={17}/> : <Database size={17}/>} {importing ? "Reconciling…" : "Import Missing Records"}</button></footer>
      </section>
    </div>, document.body)}
  </>;
}
