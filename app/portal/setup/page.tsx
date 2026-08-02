"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Dog, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";

function SetupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/portal/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password"), confirm_password: form.get("confirm_password") }),
      });
      const payload = await response.json() as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to create your account.");
      window.location.assign(payload.redirect || "/portal/account");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to create your account.");
      setBusy(false);
    }
  }

  return <main className="portal-auth-page">
    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#eaf3f1;color:#17383d;font-family:Arial,sans-serif}.portal-auth-page{min-height:100vh;display:grid;grid-template-columns:minmax(300px,.85fr) minmax(430px,1.15fr);background:radial-gradient(circle at 72% 8%,rgba(29,182,176,.16),transparent 28%),linear-gradient(135deg,#e8f3f0,#f9fbfa 52%,#edf2ec)}.portal-auth-brand{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:clamp(36px,7vw,88px);background:linear-gradient(165deg,#08343d,#0b5660);color:white}.portal-auth-brand:after{content:"";position:absolute;right:-130px;bottom:-120px;width:360px;height:360px;border-radius:50%;background:linear-gradient(135deg,rgba(48,211,199,.18),rgba(211,164,74,.14))}.portal-auth-logo{width:56px;height:56px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(135deg,#24bdb5,#c99f4e);box-shadow:0 16px 36px rgba(0,0,0,.18)}.portal-auth-brand small{margin-top:26px;color:#91d3ce;font-size:11px;font-weight:850;letter-spacing:.17em}.portal-auth-brand h1{max-width:560px;margin:12px 0 16px;font-family:Georgia,serif;font-size:clamp(38px,5vw,66px);line-height:1.03;font-weight:500;letter-spacing:-.045em}.portal-auth-brand p{max-width:540px;margin:0;color:#c4e1df;font-size:15px;line-height:1.7}.portal-auth-benefits{display:grid;gap:13px;margin-top:34px}.portal-auth-benefits span{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;padding:14px;border:1px solid rgba(255,255,255,.11);border-radius:17px;background:rgba(255,255,255,.055)}.portal-auth-benefits b,.portal-auth-benefits small{display:block}.portal-auth-benefits small{margin-top:3px;color:#a9cecb;line-height:1.45}.portal-auth-panel{display:grid;place-items:center;padding:34px}.portal-auth-card{width:min(520px,100%);padding:34px;border:1px solid rgba(106,151,149,.22);border-radius:28px;background:rgba(255,255,255,.82);box-shadow:0 28px 80px rgba(26,73,74,.12);backdrop-filter:blur(18px)}.portal-auth-card>span{color:#087f85;font-size:10px;font-weight:900;letter-spacing:.16em}.portal-auth-card h2{margin:8px 0 8px;font-family:Georgia,serif;font-size:34px;font-weight:500;letter-spacing:-.035em}.portal-auth-card>p{margin:0 0 24px;color:#6b8284;line-height:1.55}.portal-auth-card form{display:grid;gap:16px}.portal-auth-card label>span{display:block;margin-bottom:7px;color:#33595b;font-size:12px;font-weight:800}.password-field{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:0 13px;border:1px solid #b9cecb;border-radius:14px;background:white}.password-field input{min-width:0;padding:13px 0;border:0;outline:0;font:inherit}.password-field button{display:grid;place-items:center;padding:7px;border:0;background:transparent;color:#688486;cursor:pointer}.portal-auth-card form>button{display:flex;align-items:center;justify-content:center;gap:9px;padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#0d9295,#21b6aa);color:white;font:inherit;font-weight:850;cursor:pointer;box-shadow:0 12px 28px rgba(13,145,146,.22)}.portal-auth-card form>button:disabled{opacity:.55;cursor:wait}.portal-auth-error{margin-top:15px;padding:12px 14px;border-radius:13px;background:#fff0ef;color:#963d3d}.portal-auth-note{margin-top:18px;padding:13px 14px;border-radius:14px;background:#edf7f5;color:#456d6d;font-size:12px;line-height:1.5}.portal-auth-card footer{margin-top:20px;color:#728789;font-size:12px;text-align:center}.portal-auth-card footer a{color:#087f84;font-weight:800;text-decoration:none}@media(max-width:850px){.portal-auth-page{grid-template-columns:1fr}.portal-auth-brand{min-height:390px}.portal-auth-panel{padding:20px}.portal-auth-card{padding:25px}}
    `}</style>
    <section className="portal-auth-brand">
      <span className="portal-auth-logo"><Dog size={30}/></span>
      <small>SOUTHWEST VIRGINIA CHIHUAHUA</small>
      <h1>Create your private family account.</h1>
      <p>Choose a secure password for the email address already connected to your application or puppy record.</p>
      <div className="portal-auth-benefits">
        <span><ShieldCheck size={20}/><div><b>Verified setup link</b><small>This page can only be opened from the temporary link sent to the email on file.</small></div></span>
        <span><CheckCircle2 size={20}/><div><b>Connected automatically</b><small>Your application, puppy, updates, agreements, payments, appointments, and messages remain connected to one family record.</small></div></span>
      </div>
    </section>
    <section className="portal-auth-panel">
      <div className="portal-auth-card">
        <span>ACCOUNT SETUP</span>
        <h2>Create your password</h2>
        <p>Use at least 10 characters, including an uppercase letter, lowercase letter, and number.</p>
        {!token ? <div className="portal-auth-error">This setup link is incomplete. Request a new link from the sign-in page.</div> : <form onSubmit={submit}>
          <label><span>New password</span><div className="password-field"><KeyRound size={18}/><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} required/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          <label><span>Confirm password</span><div className="password-field"><KeyRound size={18}/><input name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} required/><span/></div></label>
          <button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account and open portal"}</button>
        </form>}
        {error && <div className="portal-auth-error" role="alert">{error}</div>}
        <div className="portal-auth-note">Setup links are time-limited. The link sent immediately after a new application may remain valid for up to 7 days. A replacement link requested from the sign-in page expires after 30 minutes. Your password is handled by the secure authentication service and is not displayed to staff.</div>
        <footer><Link href="/portal/login">Return to Puppy Portal sign in</Link></footer>
      </div>
    </section>
  </main>;
}

export default function PortalSetupPage() {
  return <Suspense fallback={<main style={{minHeight:"100vh",display:"grid",placeItems:"center"}}>Opening secure account setup…</main>}><SetupForm/></Suspense>;
}
