"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, FileSignature, Printer } from "lucide-react";
import type { TemplatesConfig } from "../../lib/template-defaults";

type Buyer = { id: number; first_name: string; last_name: string; email: string; phone: string | null; city: string | null; state: string | null; postal_code?: string | null };
type Puppy = { id: number; litter_id: number; buyer_id: number | null; name: string; sex: string | null; color: string | null; birth_date: string | null; birth_weight: number | null; current_weight: number | null; status: string; price_cents: number | null };
type Litter = { id: number; name: string; dam_id: number | null; sire_id: number | null; birth_date: string | null };
type Dog = { id: number; name: string; registered_name: string | null; registration_number: string | null };
type PuppyUpdate = { id: number; puppy_id: number; title: string; body: string; week_number: number | null; weight: number | null; created_at: string };
type KennelEvent = { id: number; title: string; event_type: string; event_date: string; related_type: string | null; related_id: number | null; status: string; notes: string | null };
type DataSet = { buyers: Buyer[]; puppies: Puppy[]; litters: Litter[]; dogs: Dog[]; updates: PuppyUpdate[]; events: KennelEvent[] };
type PacketSection = { title: string; lines: string[] };

const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Not recorded";
const buyerName = (buyer: Buyer | null) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email : "Not assigned";
const displayWeight = (value: number | null | undefined) => value ? `${value} lb` : "Not recorded";

function Field({ label, value }: { label: string; value: string }) {
  return <div className="field"><span>{label}</span><strong>{value || "Not recorded"}</strong></div>;
}

function replaceVariables(content: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value || "Not recorded"), content);
}

function splitSections(content: string): PacketSection[] {
  const sections: PacketSection[] = [];
  let current: PacketSection | null = null;
  for (const raw of content.replaceAll("\r", "").split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      if (current) sections.push(current);
      current = { title: line.slice(2).trim(), lines: [] };
      continue;
    }
    if (!current) current = { title: "Important Puppy Information", lines: [] };
    current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.lines.some(Boolean));
}

function renderSectionLines(lines: string[]) {
  const nodes: ReactNode[] = [];
  let bulletItems: string[] = [];
  let numberItems: string[] = [];
  let paragraph: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length) nodes.push(<ul key={`ul-${nodes.length}`}>{bulletItems.map((item, index) => <li key={index}>{item}</li>)}</ul>);
    bulletItems = [];
  };
  const flushNumbers = () => {
    if (numberItems.length) nodes.push(<ol key={`ol-${nodes.length}`}>{numberItems.map((item, index) => <li key={index}>{item}</li>)}</ol>);
    numberItems = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(" ")}</p>);
    paragraph = [];
  };
  const flushAll = () => { flushParagraph(); flushBullets(); flushNumbers(); };

  for (const line of lines) {
    if (!line.trim()) { flushAll(); continue; }
    if (line.startsWith("## ")) {
      flushAll();
      nodes.push(<h3 key={`h3-${nodes.length}`}>{line.slice(3).trim()}</h3>);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph(); flushNumbers(); bulletItems.push(line.slice(2).trim()); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      flushParagraph(); flushBullets(); numberItems.push(line.replace(/^\d+\.\s*/, "").trim()); continue;
    }
    flushBullets(); flushNumbers(); paragraph.push(line.trim());
  }
  flushAll();
  return nodes;
}

export default function PuppyPacketPage() {
  const [data, setData] = useState<DataSet | null>(null);
  const [templates, setTemplates] = useState<TemplatesConfig | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [dataResponse, templateResponse] = await Promise.all([
        fetch("/api/data", { cache: "no-store" }),
        fetch("/api/templates/config", { cache: "no-store" }),
      ]);
      const dataPayload = await dataResponse.json() as DataSet & { error?: string };
      const templatePayload = await templateResponse.json() as TemplatesConfig & { error?: string };
      if (!dataResponse.ok) throw new Error(dataPayload.error || "Unable to load puppy records.");
      if (!templateResponse.ok) throw new Error(templatePayload.error || "Unable to load the puppy packet template.");
      setData(dataPayload);
      setTemplates(templatePayload);
      const requested = Number(new URLSearchParams(window.location.search).get("puppyId"));
      const requestedPuppy = Number.isInteger(requested) ? dataPayload.puppies.find((puppy) => puppy.id === requested) : null;
      setSelectedId((current) => current ?? requestedPuppy?.id ?? dataPayload.puppies.find((puppy) => puppy.buyer_id)?.id ?? dataPayload.puppies[0]?.id ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load the puppy packet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const packet = useMemo(() => {
    if (!data || !templates || !selectedId) return null;
    const puppy = data.puppies.find((item) => item.id === selectedId) ?? null;
    if (!puppy) return null;
    const buyer = puppy.buyer_id ? data.buyers.find((item) => item.id === puppy.buyer_id) ?? null : null;
    const litter = data.litters.find((item) => item.id === puppy.litter_id) ?? null;
    const dam = litter?.dam_id ? data.dogs.find((item) => item.id === litter.dam_id) ?? null : null;
    const sire = litter?.sire_id ? data.dogs.find((item) => item.id === litter.sire_id) ?? null : null;
    const updates = data.updates.filter((item) => item.puppy_id === puppy.id).sort((a, b) => b.id - a.id);
    const events = data.events.filter((item) => item.related_id === puppy.id && String(item.related_type || "").toLowerCase().includes("puppy")).sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
    const family = buyerName(buyer);
    const variables: Record<string, string> = {
      puppy_name: puppy.name,
      buyer_name: family,
      family_name: family,
      birth_date: formatDate(puppy.birth_date),
      sex: puppy.sex || "Not recorded",
      color: puppy.color || "Not recorded",
      litter_name: litter?.name || "Not recorded",
      dam_name: dam?.registered_name || dam?.name || "Not recorded",
      sire_name: sire?.registered_name || sire?.name || "Not recorded",
      birth_weight: displayWeight(puppy.birth_weight),
      current_weight: displayWeight(puppy.current_weight),
      buyer_phone: buyer?.phone || "Not recorded",
      buyer_email: buyer?.email || "Not recorded",
      buyer_location: buyer ? [buyer.city, buyer.state, buyer.postal_code].filter(Boolean).join(", ") || "Not recorded" : "Not recorded",
      packet_date: formatDate(new Date().toISOString()),
      business_name: "Southwest Virginia Chihuahua",
      business_website: "swvachihuahua.com",
      pup_lift_website: "pup-lift.com",
      pup_lift_phone: "1-715-888-9526",
    };
    const personalizedContent = replaceVariables(templates.documents.puppy_packet.content, variables);
    return { puppy, buyer, litter, dam, sire, updates, events, variables, sections: splitSections(personalizedContent) };
  }, [data, templates, selectedId]);

  function choosePuppy(id: number) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("puppyId", String(id));
    window.history.replaceState({}, "", url);
  }

  if (loading) return <main className="screen-state">Preparing the complete puppy packet...</main>;
  if (error || !data || !templates) return <main className="screen-state"><b>Unable to prepare the packet</b><p>{error}</p></main>;

  return <main className="packet-page">
    <style jsx global>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #e8f1f0; color: #173941; font-family: Arial, sans-serif; }
      .toolbar { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #bdd5d1; background: rgba(255,255,255,.97); box-shadow: 0 5px 22px rgba(18,66,68,.08); }
      .toolbar a { display: inline-flex; align-items: center; gap: 7px; color: #155f69; font-weight: 750; text-decoration: none; }
      .toolbar select { min-width: 320px; padding: 10px 12px; border: 1px solid #9dbfba; border-radius: 10px; background: white; color: #173941; }
      .toolbar button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 10px; background: #087f8c; color: white; font-weight: 800; cursor: pointer; }
      .toolbar .secondary { background: #e8f4f2; color: #146b71; }
      .packet { width: 8.5in; margin: 24px auto; padding: .55in .62in; background: white; box-shadow: 0 18px 55px rgba(15,55,58,.14); }
      .binder-cover { min-height: 9.8in; display: flex; flex-direction: column; justify-content: center; padding: .45in; border: 1px solid #bed7d3; border-top: 14px solid #0794a3; text-align: center; background: linear-gradient(160deg,#ffffff 0%,#f3faf8 58%,#fff9ed 100%); }
      .brand { color: #087885; font-size: 12px; font-weight: 850; letter-spacing: .15em; text-transform: uppercase; }
      .binder-cover h1 { margin: 30px 0 12px; color: #103a44; font-family: Georgia,serif; font-size: 42px; line-height: 1.05; font-weight: 500; }
      .subtitle { max-width: 6.3in; margin: 0 auto 30px; color: #59767b; font-size: 16px; line-height: 1.55; }
      .cover-seal { width: 82px; height: 82px; display: grid; place-items: center; margin: 0 auto 20px; border-radius: 50%; background: linear-gradient(135deg,#0a8e97,#20b8ae); color:white; font-family:Georgia,serif; font-size:30px; box-shadow:0 14px 35px rgba(8,126,132,.2); }
      .identity { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 24px auto; max-width: 6.8in; text-align: left; }
      .field { padding: 10px 12px; border: 1px solid #d2e2df; border-radius: 9px; background: #f6faf9; }
      .field span { display: block; margin-bottom: 4px; color: #638083; font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      .field strong { display: block; overflow-wrap: anywhere; font-size: 12px; }
      .packet-section { margin: 22px 0; }
      .packet-section h2 { margin: 0 0 14px; padding: 11px 0 8px; border-top: 6px solid #0794a3; color: #103a44; font-family: Georgia,serif; font-size: 25px; font-weight: 500; }
      .packet-section h3 { margin: 17px 0 7px; color: #076d78; font-size: 15px; }
      p, li { font-size: 11px; line-height: 1.58; }
      ul, ol { margin: 7px 0 13px; padding-left: 22px; }
      li { margin: 5px 0; }
      .notice { margin: 12px 0; padding: 13px 15px; border-left: 5px solid #c68b24; background: #fff7e8; font-size: 11px; line-height: 1.55; }
      .toc { columns: 2; column-gap: 38px; }
      .toc li { break-inside: avoid; }
      .log { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .log th, .log td { min-height: 30px; padding: 7px; border: 1px solid #bad0cd; text-align: left; font-size: 10px; }
      .log th { background: #e8f3f2; color: #075f69; }
      .page-start { break-before: page; page-break-before: always; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      .footer-note { margin-top: 28px; color: #627b7e; font-size: 9px; text-align: center; }
      .screen-state { min-height: 100vh; display:grid; place-items:center; align-content:center; padding: 60px 20px; text-align: center; }
      .notes-lines p { height: 24px; margin:0; border-bottom:1px solid #c8d8d5; }
      @page { size: Letter; margin: .5in; }
      @media print {
        body { background: white; }
        .toolbar { display: none !important; }
        .packet { width: auto; margin: 0; padding: 0; box-shadow: none; }
        .binder-cover { min-height: 9.7in; }
        a { color: inherit; text-decoration: none; }
      }
      @media (max-width: 900px) { .packet { width: calc(100% - 24px); padding: 24px; } .identity { grid-template-columns: 1fr; } .toc { columns:1; } }
    `}</style>

    <div className="toolbar">
      <Link href="/?view=Templates"><ArrowLeft size={17} /> Automations & Templates</Link>
      <select value={selectedId ?? ""} onChange={(event) => choosePuppy(Number(event.target.value))} aria-label="Select puppy and buyer">
        {data.puppies.map((puppy) => <option key={puppy.id} value={puppy.id}>{puppy.name} — {puppy.buyer_id ? buyerName(data.buyers.find((buyer) => buyer.id === puppy.buyer_id) ?? null) : "No family assigned"}</option>)}
      </select>
      <button type="button" onClick={() => window.print()}><Printer size={18} /> Print Complete Puppy Packet</button>
      <Link className="secondary" href="/forms/bill-of-sale-health-guarantee"><FileSignature size={17} /> Prepare Agreement</Link>
    </div>

    {packet && <article className="packet">
      <section className="binder-cover">
        <div className="brand">Southwest Virginia Chihuahua</div>
        <div className="cover-seal">SW</div>
        <h1>{packet.puppy.name}&apos;s<br />Puppy Care Binder</h1>
        <p className="subtitle">Prepared especially for {buyerName(packet.buyer)} with personalized Chihuahua care, emergency readiness, Pup-Lift information, training guidance, records, and go-home resources.</p>
        <div className="identity">
          <Field label="Puppy" value={packet.puppy.name} />
          <Field label="Family" value={buyerName(packet.buyer)} />
          <Field label="Date of birth" value={formatDate(packet.puppy.birth_date)} />
          <Field label="Go-home packet date" value={formatDate(new Date().toISOString())} />
        </div>
        <div className="footer-note">Marion, Virginia · swvachihuahua.com · Pup-Lift: pup-lift.com · 1-715-888-9526</div>
      </section>

      <section className="packet-section page-start">
        <h2>Table of Contents</h2>
        <ol className="toc"><li>Personalized Puppy and Family Record</li>{packet.sections.map((section) => <li key={section.title}>{section.title}</li>)}<li>Health and Care Logs</li><li>Notes and Records</li></ol>
        <div className="notice">This complete packet is personalized for {packet.puppy.name} and {buyerName(packet.buyer)}. The signed Bill of Sale, Animal History Certificate, Health Guarantee, puppy-specific medical record, and veterinarian&apos;s directions control whenever they differ from general educational guidance.</div>
      </section>

      <section className="packet-section page-start">
        <h2>Personalized Puppy and Family Record</h2>
        <div className="identity">
          <Field label="Puppy name" value={packet.puppy.name} /><Field label="Family" value={buyerName(packet.buyer)} />
          <Field label="Date of birth" value={formatDate(packet.puppy.birth_date)} /><Field label="Sex" value={packet.puppy.sex || "Not recorded"} />
          <Field label="Color" value={packet.puppy.color || "Not recorded"} /><Field label="Status" value={packet.puppy.status || "Not recorded"} />
          <Field label="Litter" value={packet.litter?.name || "Not recorded"} /><Field label="Birth weight" value={displayWeight(packet.puppy.birth_weight)} />
          <Field label="Dam" value={packet.dam?.registered_name || packet.dam?.name || "Not recorded"} /><Field label="Sire" value={packet.sire?.registered_name || packet.sire?.name || "Not recorded"} />
          <Field label="Current weight" value={displayWeight(packet.puppy.current_weight)} /><Field label="Buyer phone" value={packet.buyer?.phone || "Not recorded"} />
          <Field label="Buyer email" value={packet.buyer?.email || "Not recorded"} /><Field label="Buyer location" value={packet.variables.buyer_location} />
        </div>
        {packet.events.length > 0 && <div className="avoid-break"><h3>Recent Puppy Care Records</h3><ul>{packet.events.slice(0, 10).map((event) => <li key={event.id}><strong>{event.title}</strong> — {formatDate(event.event_date)} — {event.status}</li>)}</ul></div>}
        {packet.updates.length > 0 && <div className="avoid-break"><h3>Recent Puppy Updates</h3><ul>{packet.updates.slice(0, 6).map((update) => <li key={update.id}><strong>{update.title}</strong>{update.weight ? ` — ${update.weight} lb` : ""}</li>)}</ul></div>}
      </section>

      {packet.sections.map((section, index) => <section className="packet-section page-start" key={`${section.title}-${index}`}><h2>{section.title}</h2>{renderSectionLines(section.lines)}</section>)}

      <section className="packet-section page-start">
        <h2>Health and Care Logs</h2>
        <h3>Weight Log</h3>
        <table className="log"><thead><tr><th>Date</th><th>Weight</th><th>Time / Scale</th><th>Notes</th></tr></thead><tbody>{Array.from({ length: 8 }).map((_, index) => <tr key={index}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}</tbody></table>
        <h3>Medication and Prevention Log</h3>
        <table className="log"><thead><tr><th>Date</th><th>Product / Medication</th><th>Dose</th><th>Next Due / Notes</th></tr></thead><tbody>{Array.from({ length: 8 }).map((_, index) => <tr key={index}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}</tbody></table>
      </section>

      <section className="packet-section page-start">
        <h2>Notes and Records for {packet.puppy.name}</h2>
        <p>Use this section for questions, veterinary instructions, insurance information, registration records, receipts, and additional notes for {buyerName(packet.buyer)} and {packet.puppy.name}.</p>
        <div className="notes-lines">{Array.from({ length: 22 }).map((_, index) => <p key={index}>&nbsp;</p>)}</div>
        <div className="footer-note">Southwest Virginia Chihuahua · swvachihuahua.com · Pup-Lift: pup-lift.com · 1-715-888-9526</div>
      </section>
    </article>}
  </main>;
}
