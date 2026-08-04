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
  title: "A new moment in {{puppy_name}}'s development",
  body: "Share what the puppy is commonly experiencing, learning, or practicing at this age. Keep the wording warm, natural, and personal.",
  day: 7,
  enabled: true,
  excludedBuyerIds: [],
});

const buyerName = (buyer: Buyer) => [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}`;

function ageLabel(day: number) {
  const safeDay = Math.max(1, Math.round(day));
  if (safeDay < 7) return `${safeDay} day${safeDay === 1 ? "" : "s"} old`;
  const weeks = Math.floor(safeDay / 7);
  const days = safeDay % 7;
  if (!days) return `${weeks} week${weeks === 1 ? "" : "s"} old`;
  return `${weeks} week${weeks === 1 ? "" : "s"}, ${days} day${days === 1 ? "" : "s"} old`;
}

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
      if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load the puppy development journey.");
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
    if (!window.confirm(`Delete “${selected.title}”? It will stop appearing on eligible buyer profiles and will be removed when the journey refreshes.`)) return;
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
      setMessage("The puppy development journey was saved. Current placements will receive each update on its scheduled day; past adoptions remain excluded.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save milestones.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <div className="milestone-loading">{error || "Loading the puppy development journey…"}</div>;

  return <div className="milestone-manager">
    <div className="milestone-toolbar">
      <div><span>BUYER DEVELOPMENT JOURNEY</span><h2>Personal puppy updates</h2><p>Create warm, informative updates that appear every few days as each puppy grows. Use <b>{"{{puppy_name}}"}</b> anywhere in the title or message and SWVAOS will place the puppy&apos;s name there.</p></div>
      <button type="button" className="milestone-add" onClick={addMilestone}><Plus size={16}/> Add milestone</button>
    </div>

    {error && <div className="inline-error">{error}</div>}
    {message && <div className="template-success"><CheckCircle2 size={17}/>{message}</div>}

    <section className="milestone-audience">
      <div className="milestone-audience-summary">
        <span className="audience-icon"><ShieldCheck size={22}/></span>
        <div><span>PROFILE AUDIENCE</span><h3>Current placements only</h3><p>Buyers whose puppy is marked Gone Home, Adopted, Delivered, Complete, Completed, Archived, or Closed remain outside this journey. You do not need to manage those buyers milestone by milestone.</p></div>
        <label className="audience-toggle"><input type="checkbox" checked={config.excludePastAdoptions} onChange={(event) => updateAudience({ excludePastAdoptions: event.target.checked })}/><span>Keep past adoptions out of this journey</span></label>
      </div>
      <div className="audience-metrics">
        <div><UserCheck size={17}/><span><b>{audience.includedBuyers.length}</b><small>current buyers included</small></span></div>
        <div><ShieldCheck size={17}/><span><b>{config.excludePastAdoptions ? audience.pastBuyers.length : 0}</b><small>past adoptions left out by status</small></span></div>
        <div><UserMinus size={17}/><span><b>{config.excludedBuyerIds.length}</b><small>additional buyer exclusions</small></span></div>
      </div>
      {audience.pastBuyers.length > 0 && config.excludePastAdoptions && <div className="past-adoption-list"><b>Past adoptions outside this journey:</b><span>{audience.pastBuyers.map((buyer) => <em key={buyer.id}>{buyerName(buyer)}</em>)}</span></div>}
      <div className="buyer-exclusions global-exclusions">
        <div className="buyer-exclusions-head"><div><span>OPTIONAL EXCEPTIONS</span><h3>Exclude an additional current buyer</h3><p>Use this only when one current placement should not receive the development journey. Past adoptions are already handled by puppy status.</p></div><div className="exclusion-count"><UserMinus size={16}/>{config.excludedBuyerIds.length} excluded</div></div>
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
          .sort((a, b) => a.day - b.day || a.title.localeCompare(b.title))
          .map((milestone) => <button type="button" key={milestone.id} className={selectedId === milestone.id ? "active" : ""} onClick={() => setSelectedId(milestone.id)}>
            <CalendarClock size={17}/><span><b>Day {milestone.day}: {milestone.title}</b><small>{ageLabel(milestone.day)} · {milestone.enabled ? "Active" : "Disabled"}</small></span>
          </button>)}
        {!config.milestones.length && <div className="milestone-empty">No milestones are configured.</div>}
      </aside>

      {selected ? <section className="milestone-editor">
        <header>
          <div><span>DEVELOPMENT UPDATE</span><h2>{selected.title}</h2><p>This update appears on eligible current buyer profiles when the puppy is {ageLabel(selected.day)}.</p></div>
          <button type="button" className="milestone-delete" onClick={deleteMilestone}><Trash2 size={15}/> Delete</button>
        </header>

        <div className="milestone-fields">
          <label><span>Milestone title</span><input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })}/></label>
          <label><span>Puppy age</span><div className="week-input"><input type="number" min={1} max={365} value={selected.day} onChange={(event) => updateSelected({ day: Math.max(1, Math.min(365, Number(event.target.value) || 1)) })}/><b>days old</b></div></label>
          <label className="milestone-wide"><span>Message for the buyer</span><textarea rows={7} value={selected.body} onChange={(event) => updateSelected({ body: event.target.value })} placeholder="Describe what the puppy may be seeing, hearing, learning, practicing, or needing at this age."/></label>
          <label className="template-switch milestone-wide"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })}/><span>Publish this development update to eligible current buyer profiles</span></label>
        </div>
      </section> : <section className="milestone-editor milestone-empty-editor"><CalendarClock size={30}/><h3>Add a milestone to begin</h3></section>}
    </div>

    <footer className="milestone-save-bar">
      <span>{changed ? "You have unsaved milestone changes." : config.updatedAt ? `Last saved ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(config.updatedAt))}` : "Using the personal puppy development schedule."}</span>
      <button type="button" disabled={!changed || saving} onClick={() => void save()}><Save size={16}/>{saving ? "Saving…" : "Save development journey"}</button>
      <button type="button" disabled={!changed || saving || !original} onClick={() => { setConfig(original); setSelectedId(original?.milestones[0]?.id || ""); setError(""); setMessage(""); }}>Discard changes</button>
    </footer>
  </div>;
}
