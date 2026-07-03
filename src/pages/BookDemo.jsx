import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const INDUSTRIES = ["HVAC / Plumbing / Electrical", "Legal / Law Firm", "Healthcare / Med Spa", "Auto / Dealership", "Real Estate", "Contractor / Construction", "Restaurant / Food Service", "Retail / E-commerce", "Other"];
const REVENUES = ["Under $10K/mo", "$10K - $25K/mo", "$25K - $50K/mo", "$50K - $100K/mo", "$100K - $250K/mo", "$250K+/mo", "Prefer not to say"];
const CHALLENGES = ["Missed Calls", "Slow Follow-Up", "No CRM System", "Lead Tracking", "Low Conversion Rate", "Other"];
const TIMES = ["Morning (8am - 12pm)", "Afternoon (12pm - 5pm)", "Evening (5pm - 8pm)", "Flexible / Any time"];

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
};

const labelStyle = {
  display: "block", fontSize: 9, fontWeight: 700,
  letterSpacing: "0.22em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", marginBottom: 8,
};

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function BookDemo() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", business: "", industry: "", phone: "", email: "",
    revenue: "", challenge: "", time: "", message: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const entry = { ...form, id: `demo-${Date.now()}`, submittedAt: new Date().toISOString(), status: 'pending' };

    try {
      await fetch("/api/notify?action=book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      const body = `New Demo Request from ${form.name}\n\nBusiness: ${form.business}\nIndustry: ${form.industry}\nPhone: ${form.phone}\nEmail: ${form.email}\nRevenue: ${form.revenue}\nChallenge: ${form.challenge}\nTime: ${form.time}\n\n${form.message}`;
      window.open(`mailto:Isaac_0427@icloud.com?subject=Demo%20Request%3A%20${encodeURIComponent(form.name)}&body=${encodeURIComponent(body)}`, "_blank");
    }

    try {
      const existing = JSON.parse(localStorage.getItem("nova_demo_requests") || "[]");
      localStorage.setItem("nova_demo_requests", JSON.stringify([entry, ...existing]));
    } catch {}

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="min-h-screen flex items-center justify-center px-6 pt-16">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
              style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}>
              <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
            </div>
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>REQUEST RECEIVED</p>
            <h2 className="text-3xl font-black text-white mb-4">You're on the list.</h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
              Isaac will reach out within 24 hours to confirm your demo time. Check your inbox for a confirmation email.
            </p>
            <button onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              BACK TO HOME
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <section className="relative py-20 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,160,48,0.07) 0%, transparent 60%)" }} />
          <div className="max-w-2xl mx-auto relative">

            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <p className="text-[9px] tracking-[0.35em] uppercase mb-3" style={{ color: GOLD }}>BOOK A DEMO</p>
            <h1 className="text-4xl font-black text-white mb-3 leading-tight">Let's build your system.</h1>
            <p className="text-sm mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              Fill out the form below and Isaac will personally reach out to schedule your 30-minute strategy call.
            </p>

            <form onSubmit={handleSubmit}
              className="rounded-2xl p-8 space-y-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Full Name *">
                  <input required placeholder="Jane Smith" value={form.name} onChange={set("name")}
                    style={inputStyle} onFocus={focus} onBlur={blur} />
                </Field>
                <Field label="Business Name *">
                  <input required placeholder="Acme HVAC LLC" value={form.business} onChange={set("business")}
                    style={inputStyle} onFocus={focus} onBlur={blur} />
                </Field>
              </div>

              <Field label="Industry *">
                <select required value={form.industry} onChange={set("industry")}
                  style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
                  <option value="" style={{ background: "#111" }}>Select your industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i} style={{ background: "#111" }}>{i}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Phone *">
                  <input required type="tel" placeholder="+1 (860) 000-0000" value={form.phone} onChange={set("phone")}
                    style={inputStyle} onFocus={focus} onBlur={blur} />
                </Field>
                <Field label="Email Address *">
                  <input required type="email" placeholder="jane@acmehvac.com" value={form.email} onChange={set("email")}
                    style={inputStyle} onFocus={focus} onBlur={blur} />
                </Field>
              </div>

              <Field label="Monthly Revenue">
                <select value={form.revenue} onChange={set("revenue")}
                  style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
                  <option value="" style={{ background: "#111" }}>Select range</option>
                  {REVENUES.map((r) => <option key={r} value={r} style={{ background: "#111" }}>{r}</option>)}
                </select>
              </Field>

              <Field label="Biggest Challenge *">
                <select required value={form.challenge} onChange={set("challenge")}
                  style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
                  <option value="" style={{ background: "#111" }}>What's your biggest pain point?</option>
                  {CHALLENGES.map((c) => <option key={c} value={c} style={{ background: "#111" }}>{c}</option>)}
                </select>
              </Field>

              <Field label="Best Time to Meet *">
                <select required value={form.time} onChange={set("time")}
                  style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
                  <option value="" style={{ background: "#111" }}>When works best for you?</option>
                  {TIMES.map((t) => <option key={t} value={t} style={{ background: "#111" }}>{t}</option>)}
                </select>
              </Field>

              <Field label="Anything else we should know?">
                <textarea rows={4} placeholder="Tell us about your business, current tools, or specific goals..."
                  value={form.message} onChange={set("message")} onFocus={focus} onBlur={blur}
                  style={{ ...inputStyle, resize: "none" }} />
              </Field>

              <button type="submit" disabled={loading}
                className="w-full py-4 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                {loading
                  ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
                  : <><span>BOOK MY DEMO</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>

              <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                No spam. No commitment. Isaac personally reviews every request.
              </p>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
