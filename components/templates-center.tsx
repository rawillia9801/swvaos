"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Download, FileSignature, Mail, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";
import { templateVariables, type DocumentTemplateKey, type EmailTemplateKey, type TemplatesConfig } from "../lib/template-defaults";
import { MilestoneManager } from "./milestone-manager";

type EmailStatus = { configured: boolean; host: string; port: number; secure: boolean; fromEmail: string; fromName: string };

export function TemplatesCenter({ initialConfig, onSaved }: { initialConfig: TemplatesConfig; onSaved: (config: TemplatesConfig) => void }) {
  const [config, setConfig] = useState(initialConfig);
  const [section, setSection] = useState<"documents" | "emails" | "milestones">("documents");
  const [documentKey, setDocumentKey] = useState<DocumentTemplateKey>("puppy_packet");
  const [emailKey, setEmailKey] = useState<EmailTemplateKey>("application_received");
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/email/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setStatus(payload as EmailStatus))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => { setConfig(initialConfig); }, [initialConfig]);

  const document = config.documents[documentKey];
  const email = config.emails[emailKey];
  const changed = useMemo(() => JSON.stringify(config) !== JSON.stringify(initialConfig), [config, initialConfig]);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/templates/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json() as TemplatesConfig & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save templates.");
      setConfig(payload);
      onSaved(payload);
      setMessage("All templates saved. New buyer packets will use this language.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save templates.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testTo, templateKey: emailKey }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send test email.");
      setMessage(`Test email sent to ${testTo}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to send test email.");
    } finally {
      setSaving(false);
    }
  }

  const updateDocument = (changes: Partial<typeof document>) => setConfig((current) => ({
    ...current,
    documents: { ...current.documents, [documentKey]: { ...current.documents[documentKey], ...changes } },
  }));
  const updateEmail = (changes: Partial<typeof email>) => setConfig((current) => ({
    ...current,
    emails: { ...current.emails, [emailKey]: { ...current.emails[emailKey], ...changes } },
  }));

  return <div className="templates-center">
    <section className="template-overview panel-wide">
      <div>
        <span className="eyebrow">AUTOMATED COMMUNICATIONS & DOCUMENTS</span>
        <h2>Prepare the complete buyer package from one workspace</h2>
        <p>The Complete Personalized Puppy Packet includes the binder cover, puppy and family record, table of contents, full Chihuahua care guide, Pup-Lift information, emergency guidance, and go-home checklist. Edit the wording here; SWVAOS fills the selected puppy and buyer throughout the packet.</p>
        <div style={{ marginTop: 16 }}><Link className="primary-action action-link" href="/puppy-packet"><FileSignature size={17} /> Prepare for Buyer</Link></div>
      </div>
      <div className={`smtp-card ${status?.configured ? "ready" : "needs-setup"}`}>
        <span>{status?.configured ? <CheckCircle2 size={20} /> : <ShieldCheck size={20} />}</span>
        <div><b>{status?.configured ? "Hostinger email connected" : "Hostinger email needs its server secret"}</b><small>{status ? `${status.fromName} <${status.fromEmail}> · ${status.host}:${status.port} ${status.secure ? "SSL/TLS" : "STARTTLS"}` : "Checking email connection…"}</small></div>
      </div>
    </section>

    <section className="automation-journey panel-wide" aria-label="Automated family journey"><span>APPLICATION</span><i /><span>APPROVAL</span><i /><span>PAYMENT</span><i /><span>AGREEMENT</span><i /><span>COMPLETE PUPPY PACKET</span><i /><span>GO-HOME</span></section>
    <div className="template-mode-tabs" role="tablist">
      <button className={section === "documents" ? "active" : ""} onClick={() => setSection("documents")}><FileSignature size={17} /> Contract & document templates</button>
      <button className={section === "emails" ? "active" : ""} onClick={() => setSection("emails")}><Mail size={17} /> Automatic email templates</button>
      <button className={section === "milestones" ? "active" : ""} onClick={() => setSection("milestones")}><CalendarClock size={17} /> Buyer milestones</button>
    </div>
    {section !== "milestones" && error && <div className="inline-error">{error}</div>}
    {section !== "milestones" && message && <div className="template-success"><CheckCircle2 size={17} /> {message}</div>}

    {section === "documents" ? <div className="template-workspace">
      <aside className="template-list">{(Object.keys(config.documents) as DocumentTemplateKey[]).map((key) => <button key={key} className={documentKey === key ? "active" : ""} onClick={() => setDocumentKey(key)}><FileSignature size={17} /><span><b>{config.documents[key].name}</b><small>{config.documents[key].enabled ? "Active template" : "Disabled"}</small></span></button>)}</aside>
      <section className="template-editor">
        <header>
          <div><span>DOCUMENT TEMPLATE</span><h2>{document.name}</h2><p>{document.description}</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            {documentKey === "puppy_packet" && <Link href="/puppy-packet"><FileSignature size={16} /> Prepare complete packet</Link>}
            {documentKey !== "puppy_packet" && document.prepareUrl && <a href={document.prepareUrl}><FileSignature size={16} /> Prepare agreement</a>}
            {document.downloadUrl && <a href={document.downloadUrl} target="_blank" rel="noreferrer"><Download size={16} /> Preview current PDF</a>}
          </div>
        </header>
        <div className="template-fields">
          <label><span>Template name</span><input value={document.name} onChange={(event) => updateDocument({ name: event.target.value })} /></label>
          <label><span>Description</span><input value={document.description} onChange={(event) => updateDocument({ description: event.target.value })} /></label>
          <label className="template-switch"><input type="checkbox" checked={document.enabled} onChange={(event) => updateDocument({ enabled: event.target.checked })} /><span>Use this template when documents are prepared</span></label>
          <label><span>Standard language</span><textarea rows={documentKey === "puppy_packet" ? 34 : 24} value={document.content} onChange={(event) => updateDocument({ content: event.target.value })} /></label>
          {documentKey === "puppy_packet" && <div className="template-variables"><b>Personalized fields</b><span>{templateVariables.map((item) => <code key={item}>{item}</code>)}</span></div>}
        </div>
      </section>
    </div> : section === "emails" ? <div className="template-workspace">
      <aside className="template-list">{(Object.keys(config.emails) as EmailTemplateKey[]).map((key) => <button key={key} className={emailKey === key ? "active" : ""} onClick={() => setEmailKey(key)}><Mail size={17} /><span><b>{config.emails[key].name}</b><small>{config.emails[key].enabled ? "Automatic" : "Disabled"}</small></span></button>)}</aside>
      <section className="template-editor">
        <header><div><span>EMAIL AUTOMATION</span><h2>{email.name}</h2><p>{email.trigger}</p></div></header>
        <div className="template-fields">
          <label><span>Template name</span><input value={email.name} onChange={(event) => updateEmail({ name: event.target.value })} /></label>
          <label className="template-switch"><input type="checkbox" checked={email.enabled} onChange={(event) => updateEmail({ enabled: event.target.checked })} /><span>Send this email automatically</span></label>
          <label><span>Subject</span><input value={email.subject} onChange={(event) => updateEmail({ subject: event.target.value })} /></label>
          <label><span>Message</span><textarea rows={18} value={email.body} onChange={(event) => updateEmail({ body: event.target.value })} /></label>
          <div className="template-variables"><b>Available fields</b><span>{templateVariables.map((item) => <code key={item}>{item}</code>)}</span></div>
          <div className="template-test"><label><span>Send a test to</span><input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="your@email.com" /></label><button disabled={saving || !testTo} onClick={() => void sendTest()}><Send size={16} /> Send test</button></div>
        </div>
      </section>
    </div> : <MilestoneManager />}

    {section !== "milestones" && <footer className="template-save-bar">
      <span>{changed ? "You have unsaved template changes." : config.updatedAt ? `Last saved ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(config.updatedAt))}` : "Using the saved business template set."}</span>
      <button type="button" disabled={!changed || saving} onClick={() => void save()}><Save size={16} /> {saving ? "Saving…" : "Save all templates"}</button>
      <button type="button" disabled={!changed || saving} onClick={() => { setConfig(initialConfig); setMessage(""); setError(""); }} title="Discard edits made since the templates were loaded"><RefreshCw size={16} /> Discard edits</button>
    </footer>}
  </div>;
}
