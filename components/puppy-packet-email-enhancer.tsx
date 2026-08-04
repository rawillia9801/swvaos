"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, FlaskConical, LoaderCircle, Mail, Send, UserRound, X } from "lucide-react";

type Buyer = { id: number; first_name?: string; last_name?: string; email?: string };
type Puppy = { id: number; name?: string; buyer_id?: number | null };
type DataSet = { buyers?: Buyer[]; puppies?: Puppy[] };
type SendMode = "buyer" | "test";

const buyerName = (buyer: Buyer | null) => buyer ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || `Buyer #${buyer.id}` : "No buyer assigned";

export function PuppyPacketEmailEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DataSet | null>(null);
  const [mode, setMode] = useState<SendMode>("buyer");
  const [testEmail, setTestEmail] = useState("swvachihuahua@gmail.com");
  const [selectedId, setSelectedId] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!window.location.pathname.startsWith("/puppy-packet")) return;
    const attach = () => {
      const toolbar = document.querySelector<HTMLElement>(".packet-page .toolbar");
      if (!toolbar) return;
      let target = toolbar.querySelector<HTMLElement>(":scope > .packet-email-host");
      if (!target) {
        target = document.createElement("div");
        target.className = "packet-email-host";
        toolbar.append(target);
      }
      setHost(target);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const currentPuppyId = useCallback(() => {
    const select = document.querySelector<HTMLSelectElement>(".packet-page .toolbar select");
    const fromSelect = Number(select?.value);
    if (Number.isInteger(fromSelect) && fromSelect > 0) return fromSelect;
    const fromUrl = Number(new URLSearchParams(window.location.search).get("puppyId"));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 0;
  }, []);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setError("");
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load the selected buyer.");
      setData(payload);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load the selected buyer.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  function showDialog() {
    setSelectedId(currentPuppyId());
    setOpen(true);
    setMode("buyer");
    setError("");
    setSuccess("");
    const savedTestEmail = window.localStorage.getItem("swvaos-packet-test-email");
    if (savedTestEmail) setTestEmail(savedTestEmail);
    void loadData();
  }

  const selected = useMemo(() => {
    const puppy = data?.puppies?.find((item) => item.id === selectedId) || null;
    const buyer = puppy?.buyer_id ? data?.buyers?.find((item) => item.id === puppy.buyer_id) || null : null;
    return { puppy, buyer };
  }, [data, selectedId]);

  async function sendPacket() {
    if (!selectedId) {
      setError("Select a puppy before sending the packet.");
      return;
    }
    const recipient = mode === "test" ? testEmail.trim() : String(selected.buyer?.email || "").trim();
    if (!recipient) {
      setError(mode === "test" ? "Enter a test email address." : "This buyer does not have an email address on file.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "test") window.localStorage.setItem("swvaos-packet-test-email", recipient);
      const response = await fetch("/api/puppy-packet/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puppyId: selectedId, recipient, testCopy: mode === "test" }),
      });
      const payload = await response.json() as { error?: string; recipient?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send the packet.");
      setSuccess(`${mode === "test" ? "Test copy" : "Complete packet"} sent to ${payload.recipient || recipient}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to send the packet.");
    } finally {
      setSending(false);
    }
  }

  if (!host) return null;

  return <>
    {createPortal(<button type="button" className="packet-email-button" onClick={showDialog}><Mail size={18}/> Email Complete Packet</button>, host)}
    {open && createPortal(<div className="packet-email-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setOpen(false); }}>
      <section className="packet-email-dialog" role="dialog" aria-modal="true" aria-labelledby="packet-email-title">
        <header>
          <div><span>COMPLETE PERSONALIZED PACKET</span><h2 id="packet-email-title">Email the puppy packet</h2><p>SWVAOS creates a personalized PDF and sends it through the connected Hostinger email account.</p></div>
          <button type="button" className="packet-email-close" aria-label="Close" disabled={sending} onClick={() => setOpen(false)}><X size={19}/></button>
        </header>
        <div className="packet-email-selection">
          <div><span>Puppy</span><b>{selected.puppy?.name || (loadingData ? "Loading…" : "No puppy selected")}</b></div>
          <div><span>Buyer</span><b>{loadingData ? "Loading…" : buyerName(selected.buyer)}</b></div>
          <div><span>Buyer email</span><b>{loadingData ? "Loading…" : selected.buyer?.email || "Not recorded"}</b></div>
        </div>
        <div className="packet-email-modes">
          <button type="button" className={mode === "buyer" ? "active" : ""} onClick={() => { setMode("buyer"); setError(""); setSuccess(""); }}><UserRound size={18}/><span><b>Send to buyer</b><small>Uses the buyer email stored in SWVAOS.</small></span></button>
          <button type="button" className={mode === "test" ? "active" : ""} onClick={() => { setMode("test"); setError(""); setSuccess(""); }}><FlaskConical size={18}/><span><b>Send a test copy</b><small>Choose any email address without changing the buyer record.</small></span></button>
        </div>
        {mode === "test" && <label className="packet-test-email"><span>Test email address</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="name@example.com" autoFocus/></label>}
        <div className="packet-email-preview"><Mail size={20}/><div><b>{selected.puppy?.name || "Puppy"}&apos;s Personalized Puppy Care Packet</b><p>The email includes the complete branded PDF as an attachment. Test copies are clearly marked TEST COPY.</p></div></div>
        {error && <div className="packet-email-error">{error}</div>}
        {success && <div className="packet-email-success"><CheckCircle2 size={17}/>{success}</div>}
        <footer>
          <button type="button" className="packet-email-cancel" disabled={sending} onClick={() => setOpen(false)}>Close</button>
          <button type="button" className="packet-email-send" disabled={sending || loadingData} onClick={() => void sendPacket()}>{sending ? <LoaderCircle className="packet-email-spinner" size={17}/> : <Send size={17}/>} {sending ? "Preparing and sending…" : mode === "test" ? "Send Test Email" : "Send to Buyer"}</button>
        </footer>
      </section>
    </div>, document.body)}
  </>;
}
