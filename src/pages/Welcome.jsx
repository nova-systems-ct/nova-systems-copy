import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const NEEDS = ["Website", "AI Automation", "Social Media", "Branding", "Full System", "Something Custom"];
const BUDGETS = ["Under $1,000/month", "$1,000-$2,500/month", "$2,500-$5,000/month", "$5,000+/month", "Not sure"];

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 9, fontWeight: 700,
  letterSpacing: "0.22em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", marginBottom: 8,
};

function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

function SectionDivider({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

const initialForm = { name: "", business_name: "", email: "", phone: "", needs: [], budget: "" };

export default function Welcome() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useSEO({
    title: "Schedule a Strategy Meeting — Nova Systems",
    description: "Tell us what your business needs and book a free strategy meeting with Nova Systems — Waterbury, Connecticut's AI and technology agency.",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const toggleNeed = (need) => {
    setForm((f) => ({
      ...f,
      needs: f.needs.includes(need) ? f.needs.filter((n) => n !== need) : [...f.needs, need],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name || !form.business_name) { setError("Name and business name are required."); return; }
    if (!form.email && !form.phone) { setError("Email or phone is required."); return; }

    setLoading(true);

    const body = [
      "New Strategy Meeting Request — Nova Systems",
      "",
      `Name: ${form.name}`,
      `Business: ${form.business_name}`,
      `Email: ${form.email || "N/A"}`,
      `Phone: ${form.phone || "N/A"}`,
      `What they need: ${form.needs.length ? form.needs.join(", ") : "Not specified"}`,
      `Estimated budget: ${form.budget || "Not specified"}`,
    ].join("\n");

    try {
      await fetch("/api/notify?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Strategy Meeting Request: ${form.name} — ${form.business_name}`,
          body,
          name: form.name,
          email: form.email,
          confirmTo: form.email,
          confirmName: form.name,
        }),
      });
    } catch (err) {
      console.error("[Welcome] Network error:", err.message);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${GOLD}15`, border: `2px solid ${GOLD}60`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <CheckCircle style={{ width: 32, height: 32, color: GOLD }} />
          </div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>REQUEST RECEIVED</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 14 }}>You're on the calendar.</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            Isaac will personally reach out within 24 hours to schedule your strategy meeting. A confirmation has been sent to your inbox.
          </p>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            BACK TO HOME <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "'Inter',system-ui,sans-serif", padding: "60px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 40, textDecoration: "none" }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD }}>NOVA SYSTEMS</span>
        </Link>

        <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>GET STARTED</p>
        <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>Let's build something real.</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.7, marginBottom: 36 }}>
          Tell us a bit about your business and what you need. Isaac reviews every request personally.
        </p>

        <form onSubmit={handleSubmit} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 22 }}>

          <SectionDivider title="About Your Business" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Your Name *">
              <input required value={form.name} onChange={set("name")} style={inp} placeholder="Jane Smith" onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Business Name *">
              <input required value={form.business_name} onChange={set("business_name")} style={inp} placeholder="Smith & Co." onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <SectionDivider title="Contact Info" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Email">
              <input type="email" value={form.email} onChange={set("email")} style={inp} placeholder="jane@email.com" onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={set("phone")} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <SectionDivider title="What Do You Need?" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {NEEDS.map((need) => (
              <button key={need} type="button" onClick={() => toggleNeed(need)}
                style={{
                  padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit", transition: "all 0.15s",
                  background: form.needs.includes(need) ? `${GOLD}20` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${form.needs.includes(need) ? GOLD : "rgba(255,255,255,0.1)"}`,
                  color: form.needs.includes(need) ? GOLD : "rgba(255,255,255,0.5)",
                }}>
                {need}
              </button>
            ))}
          </div>

          <SectionDivider title="Estimated Budget" />
          <Field label="Monthly Budget Range">
            <select value={form.budget} onChange={set("budget")} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select a range</option>
              {BUDGETS.map((b) => <option key={b} value={b} style={{ background: "#111" }}>{b}</option>)}
            </select>
          </Field>

          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "16px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.2em", textTransform: "uppercase", borderRadius: 10, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(255,255,255,0.06)" : G,
              color: loading ? "rgba(255,255,255,0.25)" : "#0a0800",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>
            {loading
              ? <div style={{ width: 16, height: 16, border: "2px solid rgba(10,8,0,0.3)", borderTopColor: "#0a0800", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              : <><span>SCHEDULE MY STRATEGY MEETING</span><ArrowRight className="w-4 h-4" /></>}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            Isaac personally reviews every request. No spam, no bots.
          </p>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
