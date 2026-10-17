import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { BLACK, WHITE, GOLD, GOLD_GRADIENT } from "@/lib/theme";

// Nova's own inquiry form. It runs through Nova Core exactly like a client's form: the request is saved, a worker
// qualifies it against Nova's approved services, and the visitor continues on a private page to choose a real open
// time and confirm. Nothing is booked until the calendar confirms it.
const muted = "rgba(250,250,250,0.62)";
const input = { width: "100%", padding: "12px 14px", background: "rgba(250,250,250,0.04)", border: "1px solid rgba(250,250,250,0.14)", borderRadius: 8, color: WHITE, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 6 };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function Book() {
  useSEO({ title: "Request Your Nova Audit — Nova Systems", description: "Book a short call to scope your Nova Audit. Choose a time from Nova's calendar; the audit itself is delivered within 48–72 hours once scope, access and inputs are confirmed." });
  const navigate = useNavigate();
  const [params] = useSearchParams(); const campaign = (params.get("c") || "").slice(0, 12); // Demand attribution code
  const [f, setF] = useState({ name: "", business: "", email: "", phone: "", message: "I'd like a Nova Audit consultation." });
  const [renderedAt] = useState(Date.now()); const submissionId = useMemo(newId, []);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try {
      const r = await fetch("/api/client?resource=ops&op=web-inquiry&business=nova", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business: "nova", continue_on_web: true, ...(campaign ? { campaign } : {}), submission_id: submissionId, rendered_at: renderedAt, website_url_confirm: f.hp || "", fields: { name: f.name, email: f.email, phone: f.phone, message: `${f.message}${f.business ? `\nBusiness: ${f.business}` : ""}` } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || (j.reason === "phone_or_email_required" ? "Please enter your email." : j.reason === "name_required" ? "Please enter your name." : "We couldn't send your request. Please try again."));
      if (j.duplicate) { setDone("This request was already received."); return; }
      if (j.next_url) navigate(j.next_url); else setDone("Thanks — we received your request and will reply shortly.");
    } catch (x) { setError(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen" style={{ background: BLACK, color: WHITE }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>Nova Audit</p>
        <h1 className="font-black leading-tight mb-4" style={{ fontSize: "clamp(1.9rem, 5vw, 2.8rem)" }}>Request your audit</h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: muted }}>Tell us about your business, then choose a time for a short scoping call. The full audit is delivered within 48–72 hours once scope, access and inputs are confirmed. Want a preview first? <Link to="/demo" style={{ color: GOLD }}>Try the five-minute demo</Link>.</p>
        {done ? <p role="status" className="text-base">{done}</p> : (
          <form onSubmit={submit} noValidate className="space-y-5" style={{ background: "rgba(250,250,250,0.03)", border: "1px solid rgba(250,250,250,0.09)", borderRadius: 16, padding: 24 }} aria-label="Request your audit">
            <div><label style={label} htmlFor="b-name">Your name</label><input id="b-name" autoComplete="name" required value={f.name} onChange={set("name")} style={input} /></div>
            <div><label style={label} htmlFor="b-biz">Business name</label><input id="b-biz" autoComplete="organization" value={f.business} onChange={set("business")} style={input} /></div>
            <div><label style={label} htmlFor="b-email">Email</label><input id="b-email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} style={input} /></div>
            <div><label style={label} htmlFor="b-phone">Phone (optional)</label><input id="b-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} style={input} /><p className="text-xs mt-1" style={{ color: muted }}>Only used to reach you about this request. We won't text you unless you ask us to.</p></div>
            <div><label style={label} htmlFor="b-msg">What would you like help with?</label><textarea id="b-msg" rows={3} value={f.message} onChange={set("message")} style={input} /></div>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp || ""} onChange={set("hp")} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
            {error && <p role="alert" className="text-sm" style={{ color: "#E8B04B" }}>{error} If it keeps failing, email <a href="mailto:hello@nova-systems.app" style={{ color: GOLD }}>hello@nova-systems.app</a>.</p>}
            <button type="submit" disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg" style={{ background: GOLD_GRADIENT, color: BLACK, opacity: busy ? 0.6 : 1 }}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <>Continue to choose a time <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-xs" style={{ color: "rgba(250,250,250,0.45)" }}>Your details are saved in Nova's records to handle this request. See the <Link to="/privacy" style={{ color: GOLD }}>privacy policy</Link>.</p>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
