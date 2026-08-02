"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Check,
  Circle,
  ClipboardCheck,
  FileSignature,
  HeartPulse,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Agreement = {
  key: string;
  title: string;
  required: boolean;
  status: "Signed" | "Ready to review" | "On file" | "Not yet assigned";
};

type Projection = {
  ageWeeks: number;
  latestWeight: number;
  projectedLow: number;
  projectedHigh: number;
  trend: string;
  entryCount: number;
  disclaimer: string;
};

type Milestone = {
  key: string;
  title: string;
  date: string;
  status: string;
  detail: string;
};

type JourneyPuppy = {
  id: number;
  name: string;
  birthDate: string;
  currentWeight: number;
  projection: Projection | null;
  milestones: Milestone[];
};

type JourneyData = {
  buyer: { name: string; applicationStatus: string };
  application: { status: string; inReview: boolean; headline: string; detail: string };
  agreements: Agreement[];
  progress: { completedAgreements: number; totalAgreements: number; puppyAssigned: boolean };
  puppies: JourneyPuppy[];
};

type DisplayMode = "overview" | "puppy" | null;

const formatDate = (value: string) => value
  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : "Not scheduled";

const weight = (value: number) => `${Number(value || 0).toFixed(value < 2 ? 2 : 1)} lb`;

function currentPortalToken() {
  const match = window.location.pathname.match(/^\/portal\/([^/]+)\/?$/);
  const value = match?.[1] || "";
  return ["account", "login", "setup"].includes(value) ? "" : value;
}

function normalizedButtonText(button: HTMLButtonElement | undefined) {
  return button?.textContent?.trim().toLowerCase().replace(/\d+$/, "").trim() || "";
}

function activePortalMode(): DisplayMode {
  const activeButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".family-nav button"))
    .find((button) => button.classList.contains("active"));
  const active = normalizedButtonText(activeButton);
  if (active.startsWith("overview")) return "overview";
  if (active.startsWith("my puppy")) return "puppy";
  return null;
}

function openPortalTab(label: string) {
  const wanted = label.toLowerCase();
  const target = Array.from(document.querySelectorAll<HTMLButtonElement>(".family-nav button"))
    .find((button) => normalizedButtonText(button).startsWith(wanted));
  target?.click();
}

export function PortalJourneyEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<DisplayMode>(null);
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [selectedPuppyId, setSelectedPuppyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!window.location.pathname.startsWith("/portal/")) return;
    const token = currentPortalToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    try {
      const response = await fetch(`/api/portal/journey${query}`, { cache: "no-store" });
      const payload = await response.json() as JourneyData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load your application journey.");
      setData(payload);
      setSelectedPuppyId((current) => current ?? payload.puppies[0]?.id ?? null);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load your application journey.");
    }
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith("/portal/") || /\/(login|setup)\/?$/.test(window.location.pathname)) return;
    void load();
  }, [load]);

  useEffect(() => {
    if (!window.location.pathname.startsWith("/portal/") || /\/(login|setup)\/?$/.test(window.location.pathname)) return;
    const attach = () => {
      const content = document.querySelector<HTMLElement>(".family-content");
      if (!content) {
        setHost(null);
        setMode(null);
        return;
      }
      let target = content.querySelector<HTMLElement>(":scope > .portal-journey-enhancer-host");
      if (!target) {
        target = document.createElement("div");
        target.className = "portal-journey-enhancer-host";
        const heading = content.querySelector<HTMLElement>(":scope > .family-page-head");
        if (heading?.nextSibling) content.insertBefore(target, heading.nextSibling);
        else content.prepend(target);
      }
      const nextMode = activePortalMode();
      target.hidden = nextMode == null;
      setMode(nextMode);
      setHost(target);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const selectedPuppy = useMemo(() => data?.puppies.find((puppy) => puppy.id === selectedPuppyId) ?? data?.puppies[0] ?? null, [data, selectedPuppyId]);
  if (!host || !mode) return null;

  return createPortal(<div className="portal-journey-enhancer">
    {error && <div className="portal-journey-error">{error}</div>}

    {mode === "overview" && data && <>
      <section className={`portal-application-status ${data.application.inReview ? "review" : "active"}`}>
        <span className="portal-journey-icon"><ClipboardCheck size={24}/></span>
        <div>
          <small>APPLICATION JOURNEY</small>
          <h2>{data.application.headline}</h2>
          <p>{data.application.detail}</p>
        </div>
        <span className="portal-status-badge">{data.application.status}</span>
      </section>

      <section className="portal-onboarding-panel">
        <header>
          <div><small>NEXT STEPS</small><h2>Prepare for the next stage</h2><p>Review each item when it becomes available. Required agreements remain visible until they are completed.</p></div>
          <div className="portal-onboarding-progress"><strong>{data.progress.completedAgreements}/{data.progress.totalAgreements}</strong><span>on file or signed</span></div>
        </header>
        <div className="portal-agreement-grid">
          {data.agreements.map((agreement) => {
            const complete = agreement.status === "Signed" || agreement.status === "On file";
            const ready = agreement.status === "Ready to review";
            return <article key={agreement.key} className={complete ? "complete" : ready ? "ready" : "upcoming"}>
              <span>{complete ? <Check size={16}/> : ready ? <FileSignature size={16}/> : <Circle size={15}/>}</span>
              <div><b>{agreement.title}</b><small>{agreement.required ? "Required for placement" : "Optional when financing is requested"}</small></div>
              <em>{agreement.status}</em>
            </article>;
          })}
        </div>
        <footer>
          <p><ShieldCheck size={15}/> Signing only becomes available after the correct document is prepared and connected to your account.</p>
          <button type="button" onClick={() => openPortalTab("Documents")}>Open documents <ArrowRight size={15}/></button>
        </footer>
      </section>
    </>}

    {mode === "puppy" && data && <section className="portal-growth-panel">
      <header>
        <div><small>GROWTH & DEVELOPMENT</small><h2>{selectedPuppy ? `${selectedPuppy.name}'s growth outlook` : "Your puppy's growth outlook"}</h2><p>Weekly weights entered by the breeder update this section automatically.</p></div>
        {data.puppies.length > 1 && <select value={selectedPuppy?.id ?? ""} onChange={(event) => setSelectedPuppyId(Number(event.target.value))}>{data.puppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name}</option>)}</select>}
      </header>

      {!selectedPuppy ? <div className="portal-growth-empty"><Sparkles size={28}/><b>No puppy has been assigned yet.</b><p>Growth information will appear automatically after placement is confirmed and weights are recorded.</p></div> : <>
        <div className="portal-growth-metrics">
          <article><Scale size={20}/><small>Latest recorded weight</small><strong>{selectedPuppy.projection ? weight(selectedPuppy.projection.latestWeight) : selectedPuppy.currentWeight ? weight(selectedPuppy.currentWeight) : "Not recorded"}</strong></article>
          <article><HeartPulse size={20}/><small>Age at estimate</small><strong>{selectedPuppy.projection ? `${selectedPuppy.projection.ageWeeks} weeks` : "Waiting for weight"}</strong></article>
          <article className="projection"><Sparkles size={20}/><small>Projected adult range</small><strong>{selectedPuppy.projection ? `${weight(selectedPuppy.projection.projectedLow)}–${weight(selectedPuppy.projection.projectedHigh)}` : "Not available"}</strong></article>
        </div>

        {selectedPuppy.projection && <div className="portal-projection-note"><b>Growth trend</b><p>{selectedPuppy.projection.trend}</p><small>{selectedPuppy.projection.disclaimer}</small></div>}

        <div className="portal-milestone-block">
          <header><div><small>DEVELOPMENT TIMELINE</small><h3>Milestones and breeder care checks</h3></div></header>
          <div className="portal-milestone-list">
            {selectedPuppy.milestones.map((milestone) => <article key={milestone.key} className={/reached|completed/i.test(milestone.status) ? "complete" : /due/i.test(milestone.status) ? "due" : "upcoming"}>
              <span>{/reached|completed/i.test(milestone.status) ? <Check size={14}/> : <Circle size={12}/>}</span>
              <div><b>{milestone.title}</b><small>{formatDate(milestone.date)} · {milestone.status}</small>{milestone.detail && <p>{milestone.detail}</p>}</div>
            </article>)}
          </div>
        </div>
      </>}
    </section>}
  </div>, host);
}
