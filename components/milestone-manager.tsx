"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Plus, Save, Search, ShieldCheck, Trash2, UserCheck, UserMinus } from "lucide-react";
import { isPastAdoptionPuppyStatus, type BuyerMilestoneConfig, type BuyerMilestoneRule } from "../lib/milestone-defaults";

type Buyer = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  application_status?: string;
};

type Puppy = {
  id: number;
  name?: string;
  buyer_id?: number | null;
  status?: string;
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
  const [puppies, setPuppies] = useState<Puppy[]>([]);
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
        const payload = await response.json() as { buyers?: Buyer[]; puppies?: Puppy[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load buyers and puppies.");
        return { buyers: payload.buyers || [], puppies: payload.puppies || [] };
      }),
    ]).then(([milestones, records]) => {
      if (cancelled) return;
      setConfig(milestones);
      setOriginal(milestones);
      setBuyers([...records.buyers].sort((a, b) => buyerName(a).localeCompare(buyerName(b))));
      setPuppies(records.puppies);
      setSelectedId(milestones.milestones[0]?.id || "");
    }).catch((failure) => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load milestone automation.");
    });
    return () => { cancelled = true; };
  }, []);

  const selected = config?.milestones.find((milestone) => milestone.id === selectedId) || null;
  const changed = Boolean(config && original && JSON.stringify(config) !== JSON.stringify(original));

  const audience = useMemo(() => {
    const activeBuyerIds = new Set<number>();
    const pastBuyerIds = new Set<number>();
    const assignedBuyerIds = new Set<number>();

    for (const puppy of puppies) {
      const buyerId = Number(puppy.buyer_id) || 0;
      if (!buyerId) continue;
      assignedBuyerIds.add(buyerId);
      if (isPastAdoptionPuppyStatus(puppy.status)) pastBuyerIds.add(buyerId);
      else activeBuyerIds.add(buyerId);
    }

    const pastOnlyBuyerIds = new Set([...pastBuyerIds].filter((buyerId) => !activeBuyerIds.has(buyerId)));
    const activeBuyers = buyers.filter((buyer) => activeBuyerIds.has(buyer.id));
    const pastBuyers = buyers.filter((buyer) => pastOnlyBuyerIds.has(buyer.id));
    const assignedBuyers = buyers.filter((buyer) => assignedBuyerIds.has(buyer.id));
    const manualCandidates = config?.excludePastAdoptions ? activeBuyers : assignedBuyers;
    const manuallyExcluded = new Set(config?.excludedBuyerIds || []);
    const includedBuyers = manualCandidates.filter((buyer) => !manuallyExcluded.has(buyer.id));

    return { activeBuyers, pastBuyers, assignedBuyers, manualCandidates, includedBuyers };
  }, [buyers, config?.excludePastAdoptions, config?.excludedBuyerIds, puppies]);

  const filteredBuyers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return audience.manualCandidates;
    return audience.manualCandidates.filter((buyer) => `${buyerName(buyer)} ${buyer.email || ""} ${buyer.application_status || ""}`.toLowerCase().includes(term));
  }, [audience.manualCandidates, search]);

  function updateSelected(changes: Partial<BuyerMilestoneRule>) {
    if (!config || !selected) return;
    setConfig({
      ...config,
      milestones: config.milestones.map((milestone) => milestone.id === selected.id ? { ...milestone, ...changes } : milestone),
    });
  }

  function updateAudience(changes: Partial<Pick<BuyerMilestoneConfig, "excludePastAdoptions" | "excludedBuyerIds">>) {
    if (!config) return;
    setConfig({ ...config, ...changes });
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
    if (!config) return;
    const excludedBuyerIds = config.excludedBuyerIds.includes(buyerId)
      ? config.excludedBuyerIds.filter((id) => id !== buyerId)
      : [...config.excludedBuyerIds, buyerId];
    updateAudience({ excludedBuyerIds });
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
      setMessage("Milestones saved. Current placements will receive scheduled updates; past adoptions remain excluded.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save milestones.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <div className="milestone-loading">{error || "Loading milestone automation…"}</div>;

  return <div className="milestone-manager">
    <div className="milestone-toolbar">
      <div><span>AUTOMATED BUYER MILESTONES</span><h2>Scheduled puppy updates</h2><p>Add, edit, disable, or remove updates that appear at selected puppy ages. The audience is controlled once for the entire schedule—not separately every week.</p></div>
      <button type="button" className="milestone-add" onClick={addMilestone}><Plus size={16}/> Add milestone</button>
    </div>

    {error && <div className="inline-error">{error}</div>}
    {message && <div className="template-success"><CheckCircle2 size={17}/>{message}</div>}

    <section className="milestone-audience">
      <div className="milestone-audience-summary">
        <span className="audience-icon"><ShieldCheck size={22}/></span>
        <div><span>AUTOMATIC AUDIENCE</span><h3>Current placements only</h3><p>Buyers whose puppy is marked Gone Home, Adopted, Delivered, Complete, Completed, Archived, or Closed are automatically excluded. You do not need to select them for every milestone.</p></div>
        <label className="audience-toggle"><input type="checkbox" checked={config.excludePastAdoptions} onChange={(event) => updateAudience({ excludePastAdoptions: event.target.checked })}/><span>Exclude past adoptions automatically</span></label>
      </div>
      <div className="audience-metrics">
        <div><UserCheck size={17}/><span><b>{audience.includedBuyers.length}</b><small>current buyers included</small></span></div>
        <div><ShieldCheck size={17}/><span><b>{config.excludePastAdoptions ? audience.pastBuyers.length : 0}</b><small>past adoptions excluded automatically</small></span></div>
        <div><UserMinus size={17}/><span><b>{config.excludedBuyerIds.length}</b><small>additional buyer exclusions</small></span></div>
      </div>
      {audience.pastBuyers.length > 0 && config.excludePastAdoptions && <div className="past-adoption-list"><b>Automatically excluded past adoptions:</b><span>{audience.pastBuyers.map((buyer) => <em key={buyer.id}>{buyerName(buyer)}</em>)}</span></div>}
      <div className="buyer-exclusions global-exclusions">
        <div className="buyer-exclusions-head"><div><span>OPTIONAL EXCEPTIONS</span><h3>Exclude an additional current buyer</h3><p>This is a one-time exclusion from all milestone automation. Past adoptions are already handled automatically above.</p></div><div className="exclusion-count"><UserMinus size={16}/>{config.excludedBuyerIds.length} excluded</div></div>
        <label className="buyer-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search current buyers by name, email, or status"/></label>
        <div className="buyer-checklist">
          {filteredBuyers.map((buyer) => <label key={buyer.id} className={config.excludedBuyerIds.includes(buyer.id) ? "excluded" : ""}>
            <input type="checkbox" checked={config.excludedBuyerIds.includes(buyer.id)} onChange={() => toggleExcludedBuyer(buyer.id)}/>
            <span><b>{buyerName(buyer)}</b><small>{[buyer.email, buyer.application_status].filter(Boolean).join(" · ") || `Buyer #${buyer.id}`}</small></span>
          </label>)}
          {!filteredBuyers.length && <div className="buyer-empty">No current assigned buyers match this search.</div>}
        </div>
      </div>
    </section>

    <div className="milestone-workspace">
      <aside className="milestone-list">
        {config.milestones
          .slice()
          .sort((a, b) => a.week - b.week || a.title.localeCompare(b.title))
          .map((milestone) => <button type="button" key={milestone.id} className={selectedId === milestone.id ? "active" : ""} onClick={() => setSelectedId(milestone.id)}>
            <CalendarClock size={17}/><span><b>Week {milestone.week}: {milestone.title}</b><small>{milestone.enabled ? "Active" : "Disabled"}</small></span>
          </button>)}
        {!config.milestones.length && <div className="milestone-empty">No milestones are configured.</div>}
      </aside>

      {selected ? <section className="milestone-editor">
        <header>
          <div><span>MILESTONE RULE</span><h2>{selected.title}</h2><p>This update appears when an eligible current-placement puppy reaches week {selected.week}.</p></div>
          <button type="button" className="milestone-delete" onClick={deleteMilestone}><Trash2 size={15}/> Delete</button>
        </header>

        <div className="milestone-fields">
          <label><span>Milestone title</span><input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })}/></label>
          <label><span>Puppy age</span><div className="week-input"><input type="number" min={1} max={52} value={selected.week} onChange={(event) => updateSelected({ week: Math.max(1, Math.min(52, Number(event.target.value) || 1)) })}/><b>weeks old</b></div></label>
          <label className="milestone-wide"><span>Buyer-facing message</span><textarea rows={6} value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} placeholder="Leave blank when the title alone is enough."/></label>
          <label className="template-switch milestone-wide"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })}/><span>Automatically publish this milestone to eligible current buyer profiles</span></label>
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
