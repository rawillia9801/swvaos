"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Dog, KeyRound, Mail, ShieldCheck } from "lucide-react";

export default function PortalLoginPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/portal/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send the sign-in link.");
      setMessage(payload.message || "Check your email for a secure sign-in link.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to send the sign-in link.");
    } finally { setBusy(false); }
  }

  return <main className="portal-login-page">
    <section className="portal-login-brand">
      <span className="portal-login-logo"><Dog size={30} /></span><small>SWVA CHIHUAHUA</small><h1>Your puppy journey,<br />all in one place.</h1><p>Updates, contracts, payments, care milestones, pickup planning, and family support—kept private and connected.</p>
      <div><span><ShieldCheck size={18} /><b>Secure family access</b><small>Only the email on your family account can open the portal.</small></span><span><KeyRound size={18} /><b>No password to remember</b><small>We email you a short-lived secure sign-in link.</small></span></div>
    </section>
    <section className="portal-login-panel">
      <div><span>FAMILY ACCESS</span><h2>Sign in to Puppy Portal</h2><p>Enter the email address used on your puppy application or family account.</p></div>
      <form onSubmit={submit}><label htmlFor="portal-email">Email address</label><div><Mail size={18} /><input id="portal-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div><button type="submit" disabled={busy}>{busy ? "Sending secure link…" : "Email my sign-in link"}<ArrowRight size={17} /></button></form>
      {message && <p className="portal-login-success" role="status">{message}</p>}{error && <p className="portal-login-error" role="alert">{error}</p>}
      <footer>Need help? <a href="mailto:support@swvachihuahua.com">support@swvachihuahua.com</a> · <a href="tel:+18555065425">855-506-5425</a></footer>
    </section>
  </main>;
}
