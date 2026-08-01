"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Save, UserRound, X } from "lucide-react";

type Buyer = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  postal_code?: string | null;
  application_status: string;
  preferred_sex: string | null;
  preferred_color: string | null;
  notes: string | null;
};

type BuyerTarget = {
  key: string;
  buyerId: number;
  host: HTMLElement;
  placement: "list" | "profile";
};

type BuyerDataResponse = {
  buyers?: Buyer[];
  error?: string;
};

const applicationStatuses = [
  "Inquiry",
  "Applied",
  "Under Review",
  "Needs Information",
  "Approved",
  "Waitlist",
  "Matched",
  "Placed",
  "Declined",
  "Not Moving Forward",
];

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function findBuyerIdFromHref(value: string | null) {
  const match = String(value || "").match(/\/families\/(\d+)/);
  const id = Number(match?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function BuyerEditEnhancer() {
  const [targets, setTargets] = useState<BuyerTarget[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const scan = useCallback(() => {
    const next: BuyerTarget[] = [];

    document.querySelectorAll<HTMLElement>(".family-record-list article").forEach((article) => {
      const link = article.querySelector<HTMLAnchorElement>('a[href*="/families/"]');
      const buyerId = findBuyerIdFromHref(link?.getAttribute("href") || null);
      if (!buyerId) return;

      let host = article.querySelector<HTMLElement>(":scope > .buyer-edit-host");
      if (!host) {
        host = document.createElement("span");
        host.className = "buyer-edit-host buyer-edit-host-list";
        const contracts = article.querySelector<HTMLElement>(":scope > .family-contract-action");
        article.insertBefore(host, contracts || null);
      }
      next.push({ key: `list-${buyerId}`, buyerId, host, placement: "list" });
    });

    const profileMatch = window.location.pathname.match(/^\/families\/(\d+)\/?$/);
    const profileId = Number(profileMatch?.[1]);
    const hero = document.querySelector<HTMLElement>(".record-hero");
    if (hero && Number.isInteger(profileId) && profileId > 0) {
      let host = hero.querySelector<HTMLElement>(":scope > .buyer-edit-host-profile");
      if (!host) {
        host = document.createElement("span");
        host.className = "buyer-edit-host buyer-edit-host-profile";
        const status = hero.querySelector<HTMLElement>(":scope > .record-status");
        hero.insertBefore(host, status || null);
      }
      next.push({ key: `profile-${profileId}`, buyerId: profileId, host, placement: "profile" });
    }

    setTargets((current) => {
      const currentSignature = current.map((item) => `${item.key}:${item.host.isConnected}`).join("|");
      const nextSignature = next.map((item) => `${item.key}:${item.host.isConnected}`).join("|");
      return currentSignature === nextSignature ? current : next;
    });
  }, []);

  useEffect(() => {
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", scan);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", scan);
    };
  }, [scan]);

  async function openEditor(buyerId: number) {
    setBuyer(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as BuyerDataResponse;
      if (!response.ok) throw new Error(payload.error || "Unable to load this buyer.");
      const found = payload.buyers?.find((item) => item.id === buyerId) || null;
      if (!found) throw new Error("This buyer record could not be found.");
      setBuyer(found);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load this buyer.");
    } finally {
      setLoading(false);
    }
  }

  async function saveBuyer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!buyer) return;

    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("first_name") || "").trim();
    const lastName = String(form.get("last_name") || "").trim();
    if (!firstName || !lastName) {
      setError("Enter the buyer's first and last name.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/data", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resource: "buyers",
          id: buyer.id,
          data: {
            first_name: firstName,
            last_name: lastName,
            email: String(form.get("email") || "").trim(),
            phone: cleanOptional(form.get("phone")),
            city: cleanOptional(form.get("city")),
            state: cleanOptional(form.get("state")),
            postal_code: cleanOptional(form.get("postal_code")),
            application_status: String(form.get("application_status") || "Inquiry").trim() || "Inquiry",
            preferred_sex: cleanOptional(form.get("preferred_sex")),
            preferred_color: cleanOptional(form.get("preferred_color")),
            notes: cleanOptional(form.get("notes")),
          },
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save this buyer.");
      setBuyer(null);
      window.location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save this buyer.");
      setSaving(false);
    }
  }

  const statusOptions = useMemo(() => {
    if (!buyer?.application_status || applicationStatuses.includes(buyer.application_status)) return applicationStatuses;
    return [buyer.application_status, ...applicationStatuses];
  }, [buyer]);

  return <>
    {targets.map((target) => createPortal(
      <button
        type="button"
        className={`buyer-edit-trigger ${target.placement}`}
        onClick={() => void openEditor(target.buyerId)}
        aria-label="Edit buyer"
      >
        <Pencil size={14} />
        <span>{target.placement === "profile" ? "Edit buyer" : "Edit"}</span>
      </button>,
      target.host,
      target.key,
    ))}

    {(loading || buyer || error) && createPortal(
      <div className="buyer-edit-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) {
          setBuyer(null);
          setError("");
        }
      }}>
        <section className="buyer-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="buyer-edit-title">
          <header>
            <span className="buyer-edit-icon"><UserRound size={20} /></span>
            <div><small>FAMILY RECORD</small><h2 id="buyer-edit-title">Edit buyer</h2></div>
            <button type="button" className="buyer-edit-close" onClick={() => { if (!saving) { setBuyer(null); setError(""); } }} aria-label="Close"><X size={18} /></button>
          </header>

          {loading ? <div className="buyer-edit-state">Loading buyer information…</div> : buyer ? <form onSubmit={saveBuyer}>
            <div className="buyer-edit-grid">
              <label><span>First name</span><input name="first_name" defaultValue={buyer.first_name} required /></label>
              <label><span>Last name</span><input name="last_name" defaultValue={buyer.last_name} required /></label>
              <label><span>Email address</span><input name="email" type="email" defaultValue={buyer.email || ""} /></label>
              <label><span>Phone number</span><input name="phone" type="tel" defaultValue={buyer.phone || ""} /></label>
              <label><span>City</span><input name="city" defaultValue={buyer.city || ""} /></label>
              <label><span>State</span><input name="state" defaultValue={buyer.state || ""} /></label>
              <label><span>ZIP code</span><input name="postal_code" defaultValue={buyer.postal_code || ""} /></label>
              <label><span>Application status</span><select name="application_status" defaultValue={buyer.application_status || "Inquiry"}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label><span>Preferred sex</span><select name="preferred_sex" defaultValue={buyer.preferred_sex || ""}><option value="">No preference recorded</option><option value="Male">Male</option><option value="Female">Female</option><option value="Either">Either</option></select></label>
              <label><span>Preferred color</span><input name="preferred_color" defaultValue={buyer.preferred_color || ""} /></label>
              <label className="buyer-edit-wide"><span>Buyer notes</span><textarea name="notes" rows={8} defaultValue={buyer.notes || ""} /></label>
            </div>

            <p className="buyer-edit-note">Changes update the buyer record used throughout SWVAOS. Changing the email does not reveal or change the customer's password.</p>
            {error && <div className="buyer-edit-error" role="alert">{error}</div>}
            <footer>
              <button type="button" className="buyer-edit-cancel" disabled={saving} onClick={() => { setBuyer(null); setError(""); }}>Cancel</button>
              <button type="submit" className="buyer-edit-save" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save buyer changes"}</button>
            </footer>
          </form> : <div className="buyer-edit-state buyer-edit-error">{error || "Unable to load this buyer."}</div>}
        </section>
      </div>,
      document.body,
    )}
  </>;
}
