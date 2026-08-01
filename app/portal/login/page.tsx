"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BellRing, Dog, Eye, EyeOff, FileCheck2, HeartPulse, KeyRound, Mail, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

type Mode = "signin" | "register" | "email";

export default function PortalLoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const endpoint = mode === "signin" ? "/api/portal/auth/password" : mode === "register" ? "/api/portal/auth/register" : "/api/portal/auth/request";
      const body = mode === "signin"
        ? { email: form.get("email"), password: form.get("password") }
        : { email: form.get("email") };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; message?: string; redirect?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to continue.");
      if (mode === "signin") {
        window.location.assign(payload.redirect || "/portal/account");
        return;
      }
      setMessage(payload.message || (mode === "register" ? "Check your email for a secure account-setup link." : "Check your email for a secure sign-in link."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="portal-login-page">
    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#eaf3f1;color:#17383d;font-family:Arial,sans-serif}.portal-login-page{min-height:100vh;display:grid;grid-template-columns:minmax(360px,.9fr) minmax(480px,1.1fr);background:radial-gradient(circle at 72% 8%,rgba(29,182,176,.16),transparent 28%),linear-gradient(135deg,#e8f3f0,#f9fbfa 52%,#edf2ec)}.portal-login-brand{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:clamp(40px,7vw,90px);background:linear-gradient(165deg,#08343d,#0b5660);color:white}.portal-login-brand:after{content:"";position:absolute;right:-150px;bottom:-130px;width:390px;height:390px;border-radius:50%;background:linear-gradient(135deg,rgba(48,211,199,.18),rgba(211,164,74,.14))}.portal-login-logo{width:58px;height:58px;display:grid;place-items:center;border-radius:19px;background:linear-gradient(135deg,#24bdb5,#c99f4e);box-shadow:0 16px 36px rgba(0,0,0,.18)}.portal-login-brand>small{margin-top:26px;color:#91d3ce;font-size:11px;font-weight:850;letter-spacing:.17em}.portal-login-brand h1{max-width:600px;margin:12px 0 16px;font-family:Georgia,serif;font-size:clamp(42px,5vw,68px);line-height:1.02;font-weight:500;letter-spacing:-.048em}.portal-login-brand>p{max-width:570px;margin:0;color:#c4e1df;font-size:15px;line-height:1.7}.portal-login-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:34px}.portal-login-features span{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:14px;border:1px solid rgba(255,255,255,.11);border-radius:17px;background:rgba(255,255,255,.055)}.portal-login-features b,.portal-login-features small{display:block}.portal-login-features b{font-size:12px}.portal-login-features small{margin-top:3px;color:#a9cecb;font-size:10px;line-height:1.45}.portal-login-panel{display:grid;place-items:center;padding:34px}.portal-login-card{width:min(560px,100%);padding:34px;border:1px solid rgba(106,151,149,.22);border-radius:30px;background:rgba(255,255,255,.84);box-shadow:0 28px 80px rgba(26,73,74,.12);backdrop-filter:blur(18px)}.portal-login-card>span{color:#087f85;font-size:10px;font-weight:900;letter-spacing:.16em}.portal-login-card h2{margin:8px 0 8px;font-family:Georgia,serif;font-size:36px;font-weight:500;letter-spacing:-.038em}.portal-login-card>p{margin:0 0 22px;color:#6b8284;line-height:1.55}.portal-auth-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:22px;padding:5px;border-radius:15px;background:#edf4f2}.portal-auth-tabs button{padding:10px 8px;border:0;border-radius:11px;background:transparent;color:#688082;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.portal-auth-tabs button.active{background:white;color:#087f84;box-shadow:0 6px 18px rgba(28,73,74,.09)}.portal-login-card form{display:grid;gap:16px}.portal-login-card label>span{display:block;margin-bottom:7px;color:#33595b;font-size:12px;font-weight:800}.portal-input{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:0 13px;border:1px solid #b9cecb;border-radius:14px;background:white}.portal-input input{min-width:0;padding:13px 0;border:0;outline:0;font:inherit}.portal-input button{display:grid;place-items:center;padding:7px;border:0;background:transparent;color:#688486;cursor:pointer}.portal-login-card form>button{display:flex;align-items:center;justify-content:center;gap:9px;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#0d9295,#21b6aa);color:white;font:inherit;font-weight:850;cursor:pointer;box-shadow:0 12px 28px rgba(13,145,146,.22)}.portal-login-card form>button:disabled{opacity:.55;cursor:wait}.portal-login-success,.portal-login-error{margin:16px 0 0;padding:13px 14px;border-radius:13px;font-size:12px;line-height:1.5}.portal-login-success{background:#e8f7ef;color:#176347}.portal-login-error{background:#fff0ef;color:#963d3d}.portal-mode-note{margin-top:16px;padding:13px 14px;border-radius:14px;background:#edf7f5;color:#456d6d;font-size:12px;line-height:1.5}.portal-login-card footer{margin-top:20px;color:#728789;font-size:12px;text-align:center}.portal-login-card footer a{color:#087f84;font-weight:800;text-decoration:none}@media(max-width:930px){.portal-login-page{grid-template-columns:1fr}.portal-login-brand{min-height:500px}.portal-login-panel{padding:22px}.portal-login-card{padding:26px}}@media(max-width:580px){.portal-login-features{grid-template-columns:1fr}.portal-auth-tabs{grid-template-columns:1fr}.portal-login-brand{padding:34px 24px}.portal-login-panel{padding:14px}.portal-login-card{padding:22px;border-radius:22px}}
    `}</style>

    <section className="portal-login-brand">
      <span className="portal-login-logo"><Dog size={31}/></span>
      <small>SOUTHWEST VIRGINIA CHIHUAHUA</small>
      <h1>Your family’s puppy information, together and secure.</h1>
      <p>Follow your puppy’s milestones, review agreements, track payments, manage go-home plans, and reach the team from one private account.</p>
      <div className="portal-login-features">
        <span><HeartPulse size={19}/><div><b>Puppy milestones</b><small>Growth, published updates, care records, and important dates.</small></div></span>
        <span><FileCheck2 size={19}/><div><b>Agreements and files</b><small>Review pending documents and retain completed copies.</small></div></span>
        <span><WalletCards size={19}/><div><b>Payment record</b><small>Recorded payments, balances, and scheduled items.</small></div></span>
        <span><BellRing size={19}/><div><b>Direct support</b><small>Send questions and transportation requests to the team.</small></div></span>
      </div>
    </section>

    <section className="portal-login-panel">
      <div className="portal-login-card">
        <span>PRIVATE FAMILY ACCESS</span>
        <h2>{mode === "signin" ? "Welcome back" : mode === "register" ? "Create your account" : "Use a secure email link"}</h2>
        <p>{mode === "signin" ? "Sign in with the email and password connected to your family record." : mode === "register" ? "Account registration is available to applicants and families whose email is already recorded with us." : "Receive a short-lived sign-in link at the email address on your family record."}</p>

        <div className="portal-auth-tabs" role="tablist">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => changeMode("signin")}>Sign in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create account</button>
          <button type="button" className={mode === "email" ? "active" : ""} onClick={() => changeMode("email")}>Email link</button>
        </div>

        <form onSubmit={submit}>
          <label><span>Email address</span><div className="portal-input"><Mail size={18}/><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required/><span/></div></label>
          {mode === "signin" && <label><span>Password</span><div className="portal-input"><KeyRound size={18}/><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}
          <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Open my Puppy Portal" : mode === "register" ? "Email my account-setup link" : "Email my secure sign-in link"}<ArrowRight size={17}/></button>
        </form>

        {message && <div className="portal-login-success" role="status">{message}</div>}
        {error && <div className="portal-login-error" role="alert">{error}</div>}

        <div className="portal-mode-note">
          {mode === "signin" && <><ShieldCheck size={15} style={{verticalAlign:"middle",marginRight:6}}/>Accounts remain signed in on this browser for up to 30 days unless you sign out.</>}
          {mode === "register" && <><Sparkles size={15} style={{verticalAlign:"middle",marginRight:6}}/>We first email a temporary verification link. You choose your password only after opening that link.</>}
          {mode === "email" && <><KeyRound size={15} style={{verticalAlign:"middle",marginRight:6}}/>The email link is a secure alternative when you cannot remember your password.</>}
        </div>

        <footer>Need assistance? <a href="mailto:support@swvachihuahua.com">support@swvachihuahua.com</a> · <a href="tel:+18555065425">855-506-5425</a></footer>
      </div>
    </section>
  </main>;
}
