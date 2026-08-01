"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to unlock SWVAOS.");
      const requested = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      window.location.assign(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to unlock SWVAOS.");
      setSubmitting(false);
    }
  }

  return <main className="login-page">
    <section className="login-card">
      <div className="login-mark"><LockKeyhole size={28} /></div>
      <span>SWVAOS</span>
      <h1>Operating system locked</h1>
      <p>Enter the staff password once for this browser session.</p>
      <form onSubmit={submit}>
        <label htmlFor="staff-password">Staff password</label>
        <div><KeyRound size={17} /><input id="staff-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        {error && <small role="alert">{error}</small>}
        <button type="submit" disabled={submitting || !password}>{submitting ? "Unlocking..." : "Unlock SWVAOS"}</button>
      </form>
    </section>
  </main>;
}
