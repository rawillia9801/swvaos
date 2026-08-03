"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Plus, Save, Search, Trash2, UserMinus } from "lucide-react";
import type { BuyerMilestoneConfig, BuyerMilestoneRule } from "../lib/milestone-defaults";

type Buyer = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  application_status?: string;
};

const newMilestone = (): BuyerMilestoneRule => ({
  id: `milestone-${crypto.randomUUID()}`,
  title: "New puppy milestone",
  body: "",
  week: 1,
  enabled: true,
  excludedBuyerIds: [],
});

const buyerName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;

export function MilestoneManager() {
  const [config, setConfig] = useState<BuyerMilestoneConfig | null>(null);
  const [original, setOriginal] = useState<BuyerMilestoneConfig | null>(null);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/milestones/config", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json() as BuyerMilestoneConfig & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load milestones.");
        return payload;
      }),
      fetch("/api/data", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json() as { buyers?: Buyer[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load buyers.");
        return payload.buyers || [];
      }),
    ]).then(([milestones, buyerRows]) => {
      if (cancelled) return;
      setConfig(milestones);
      setOriginal(milestones);
      setBuyers([...buyerRows].sort((a, b) => buyerName(a).localeCompare(buyerName(b))));
      setSelectedId(milestones.milestones[0]?.id || "");
    }).catch((failure) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load milestone automation.");
    });
    return () => { cancelled = true; };
  }, []);

  const selected = config?.milestones.find((milestone) => milestone.id === selectedId) || null;
  const changed = Boolean(config && original && JSON.stringify(config) !== JSON.stringify(original));
  const filteredBuyers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return buyers;
    return buyers.filter((buyer) => `${buyerName(buyer)} ${buyer.email || ""} ${buyer.application_status || ""}`.toLowerCase().includes(term));
  }, [buyers, search]);

  function updateSelected(changes: Partial<BuyerMilestoneRule>) {
    if (!config || !selected) return;
    setConfig({
      ...config,
      milestones: config.milestones.map((milestone) => milestone.id === selected.id ? { ...milestone, ...changes } : milestone),
    });
  }

  function addMilestone() {
    if (!config) return;
    const milestone = newMilestone();
    setConfig({ ...config, milestones: [...config.milestones, milestone] });
    setSelectedId(milestone.id);
    setMessage("");
    setError("");
  }

  function deleteMilestone() {
    if (!config || !selected) return;
    if (!window.confirm(`Delete “${selected.title}”? It will stop appearing automatically and will be removed from buyer portals the next time milestones synchronize.`)) return;
    const remaining = config.milestones.filter((milestone) => milestone.id !== selected.id);
    setConfig({ ...config, milestones: remaining });
    setSelectedId(remaining[0]?.id || "");
  }

  function toggleExcludedBuyer(buyerId: number) {
    if (!selected) return;
    const excluded = selected.excludedBuyerIds.includes(buyerId)
      ? selected.excludedBuyerIds.filter((id) => id !== buyerId)
      : [...selected.excludedBuyerIds, buyerId];
    updateSelected({ excludedBuyerIds: excluded });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/milestones/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json() as BuyerMilestoneConfig & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save milestones.");
      setConfig(payload);
      setOriginal(payload);
      setSelectedId((current) => payload.milestones.some((item) => item.id === current) ? current : payload.milestones[0]?.id || "");
      setMessage("Milestones saved. The schedule will synchronize across eligible buyer profiles.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save milestones.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <div className="milestone-loading">{error || "Loading milestone automation…"}</div>;

  return <div className="milestone-manager">
    <div className="milestone-toolbar">
      <div><span>AUTOMATED BUYER MILESTONES</span><h2>Scheduled puppy updates</h2><p>Add, edit, disable, or remove updates that appear at selected puppy ages. Exclusions apply to the buyer account, including every puppy connected to that buyer.</p></div>
      <button type="button" className="milestone-add" onClick={addMilestone}><Plus size={16}/> Add milestone</button>
    </div>

    {error && <div className="inline-error">{error}</div>}
    {message && <div className="template-success"><CheckCircle2 size={17}/>{message}</div>}

    <div className="milestone-workspace">
      <aside className="milestone-list">
        {config.milestones
          .slice()
          .sort((a, b) => a.week - b.week || a.title.localeCompare(b.title))
          .map((milestone) => <button type="button" key={milestone.id} className={selectedId === milestone.id ? "active" : ""} onClick={() => setSelectedId(milestone.id)}>
            <CalendarClock size={17}/><span><b>Week {milestone.week}: {milestone.title}</b><small>{milestone.enabled ? "Active" : "Disabled"}{milestone.excludedBuyerIds.length ? ` · ${milestone.excludedBuyerIds.length} excluded` : ""}</small></span>
          </button>)}
        {!config.milestones.length && <div className="milestone-empty">No milestones are configured.</div>}
      </aside>

      {selected ? <section className="milestone-editor">
        <header>
          <div><span>MILESTONE RULE</span><h2>{selected.title}</h2><p>This update appears when an assigned puppy reaches week {selected.week}, except for the buyers excluded below.</p></div>
          <button type="button" className="milestone-delete" onClick={deleteMilestone}><Trash2 size={15}/> Delete</button>
        </header>

        <div className="milestone-fields">
          <label><span>Milestone title</span><input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })}/></label>
          <label><span>Puppy age</span><div className="week-input"><input type="number" min={1} max={52} value={selected.week} onChange={(event) => updateSelected({ week: Math.max(1, Math.min(52, Number(event.target.value) || 1)) })}/><b>weeks old</b></div></label>
          <label className="milestone-wide"><span>Buyer-facing message</span><textarea rows={6} value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} placeholder="Leave blank when the title alone is enough."/></label>
          <label className="template-switch milestone-wide"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })}/><span>Automatically publish this milestone to eligible buyer profiles</span></label>
        </div>

        <div className="buyer-exclusions">
          <div className="buyer-exclusions-head"><div><span>BUYER EXCLUSIONS</span><h3>Do not publish this milestone for selected buyers</h3><p>Checked buyers are excluded only from this milestone. Their other scheduled updates continue normally.</p></div><div className="exclusion-count"><UserMinus size={16}/>{selected.excludedBuyerIds.length} excluded</div></div>
          <label className="buyer-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyers by name, email, or status"/></label>
          <div className="buyer-checklist">
            {filteredBuyers.map((buyer) => <label key={buyer.id} className={selected.excludedBuyerIds.includes(buyer.id) ? "excluded" : ""}>
              <input type="checkbox" checked={selected.excludedBuyerIds.includes(buyer.id)} onChange={() => toggleExcludedBuyer(buyer.id)}/>
              <span><b>{buyerName(buyer)}</b><small>{[buyer.email, buyer.application_status].filter(Boolean).join(" · ") || `Buyer #${buyer.id}`}</small></span>
            </label>)}
            {!filteredBuyers.length && <div className="buyer-empty">No matching buyers found.</div>}
          </div>
        </div>
      </section> : <section className="milestone-editor milestone-empty-editor"><CalendarClock size={30}/><h3>Add a milestone to begin</h3></section>}
    </div>

    <footer className="milestone-save-bar">
      <span>{changed ? "You have unsaved milestone changes." : config.updatedAt ? `Last saved ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(config.updatedAt))}` : "Using the default milestone schedule."}</span>
      <button type="button" disabled={!changed || saving} onClick={() => void save()}><Save size={16}/>{saving ? "Saving…" : "Save milestone schedule"}</button>
      <button type="button" disabled={!changed || saving || !original} onClick={() => { setConfig(original); setSelectedId(original?.milestones[0]?.id || ""); setError(""); setMessage(""); }}>Discard changes</button>
    </footer>
  </div>;
}
