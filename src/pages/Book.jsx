import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { BLACK, WHITE, GOLD, GOLD_GRADIENT } from "@/lib/theme";
import { NOVA_SERVICE_SMS_POLICY } from "../../shared/smsConsent.js";

// Nova's own inquiry form. It runs through Nova Core exactly like a client's form: the request is saved, a worker
// qualifies it against Nova's approved services, and the visitor continues on a private page to choose a real open
// time and confirm. Nothing is booked until the calendar confirms it.
const muted = "rgba(250,250,250,0.62)";
const input = { width: "100%", padding: "12px 14px", background: "rgba(250,250,250,0.04)", border: "1px solid rgba(250,250,250,0.14)", borderRadius: 8, color: WHITE, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 6 };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function Book() {
  useSEO({ title: "Talk to Nova — Nova Systems", description: "Tell Nova what your business needs for calls, messages, bookings and customer follow-up. Send a request to discuss the systems you want connected." });
  const navigate = useNavigate();
  const [params] = useSearchParams(); const campaign = (params.get("c") || "").slice(0, 12); // Demand attribution code
  const [f, setF] = useState({ name: "", business: "", email: "", phone: "", serviceSms: false, message: "I'd like help connecting my business calls, messages, bookings and customer follow-up." });
  const [renderedAt] = useState(Date.now()); const submissionId = useMemo(newId, []);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try {
      const r = await fetch("/api/client?resource=ops&op=web-inquiry&business=nova", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business: "nova", continue_on_web: true, ...(campaign ? { campaign } : {}), submission_id: submissionId, rendered_at: renderedAt, website_url_confirm: f.hp || "", fields: { name: f.name, email: f.email, phone: f.phone, service_sms_consent: f.serviceSms, service_sms_consent_version: NOVA_SERVICE_SMS_POLICY.version, message: `${f.message}${f.business ? `\nBusiness: ${f.business}` : ""}` } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || (j.reason === "phone_or_email_required" ? "Please enter your email." : j.reason === "name_required" ? "Please enter your name." : j.reason === "phone_required_for_sms" ? "Enter a valid phone number or leave service texts unchecked." : j.reason === "sms_consent_disclosure_mismatch" ? "Reload the page to review the current service-text disclosure." : "We couldn't send your request. Please try again."));
      if (j.duplicate) { setDone("This request was already received."); return; }
      if (j.next_url) navigate(j.next_url); else setDone("Thanks — we received your request and will reply shortly.");
    } catch (x) { setError(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen" style={{ background: BLACK, color: WHITE }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>Nova Systems</p>
        <h1 className="font-black leading-tight mb-4" style={{ fontSize: "clamp(1.9rem, 5vw, 2.8rem)" }}>Put your systems to work</h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: muted }}>Tell us what you need for calls, messages, bookings and customer follow-up. Send your request to continue on a private request page. We'll confirm scope and availability before an appointment is booked. Want to see the workflow first? <Link to="/demo" style={{ color: GOLD }}>Try the five-minute demo</Link>.</p>
        {done ? <p role="status" className="text-base">{done}</p> : (
          <form onSubmit={submit} noValidate className="space-y-5" style={{ background: "rgba(250,250,250,0.03)", border: "1px solid rgba(250,250,250,0.09)", borderRadius: 16, padding: 24 }} aria-label="Request help with your systems">
            <div><label style={label} htmlFor="b-name">Your name</label><input id="b-name" autoComplete="name" required value={f.name} onChange={set("name")} style={input} /></div>
            <div><label style={label} htmlFor="b-biz">Business name</label><input id="b-biz" autoComplete="organization" value={f.business} onChange={set("business")} style={input} /></div>
            <div><label style={label} htmlFor="b-email">Email</label><input id="b-email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} style={input} /></div>
            <div><label style={label} htmlFor="b-phone">Phone (optional)</label><input id="b-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} style={input} /><p className="text-xs mt-1" style={{ color: muted }}>Only used to reach you about this request. We won't text you unless you ask us to.</p></div>
            <div><label style={label} htmlFor="b-msg">What would you like help with?</label><textarea id="b-msg" rows={3} value={f.message} onChange={set("message")} style={input} /></div>
            <div style={{border:'1px solid rgba(250,250,250,0.14)',borderRadius:10,padding:16}}>
              <label htmlFor="b-sms-opt-in" style={{display:'flex',alignItems:'flex-start',gap:12,fontSize:13,lineHeight:1.6,color:muted,cursor:'pointer'}}>
                <input id="b-sms-opt-in" type="checkbox" checked={f.serviceSms} onChange={e=>setF({...f,serviceSms:e.target.checked})} style={{marginTop:5,accentColor:GOLD,flexShrink:0}} />
                <span><strong style={{color:WHITE,display:'block',marginBottom:4}}>Service texts (optional)</strong>{NOVA_SERVICE_SMS_POLICY.text}</span>
              </label>
              <p className="text-xs mt-3" style={{color:muted}}>Support: <a href="mailto:isaac@nova-systems.app" style={{color:GOLD}}>isaac@nova-systems.app</a>. Read our <Link to="/privacy" style={{color:GOLD}}>Privacy Policy</Link> and <Link to="/terms" style={{color:GOLD}}>Terms of Service</Link>. Promotional texts require separate permission.</p>
            </div>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp || ""} onChange={set("hp")} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
            {error && <p role="alert" className="text-sm" style={{ color: "#E8B04B" }}>{error} If it keeps failing, email <a href="mailto:isaac@nova-systems.app" style={{ color: GOLD }}>isaac@nova-systems.app</a>.</p>}
            <button type="submit" disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg" style={{ background: GOLD_GRADIENT, color: BLACK, opacity: busy ? 0.6 : 1 }}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <>Send request <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-xs" style={{ color: "rgba(250,250,250,0.45)" }}>Your details are saved in Nova's records to handle this request. See the <Link to="/privacy" style={{ color: GOLD }}>privacy policy</Link>.</p>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
