import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_DARK = "#8a6200";
const GOLD_BRIGHT = "#C8921A";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const SERVICE_OPTIONS = ["Website", "Social Media", "AI Automation", "Full Wave One", "Not Sure"];

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
  color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8,
};

function Asterisk() {
  return <span style={{ color: GOLD }}> *</span>;
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={lbl}>{label}{required && <Asterisk />}</label>
      {children}
      {error && <p style={{ color: "#e05252", fontSize: 11, marginTop: 5 }}>{error}</p>}
    </div>
  );
}

export default function Welcome() {
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", company_name: "", service_interest: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useSEO({
    title: "Get Started — Nova Systems",
    description: "Tell us what your business needs and Nova Systems will reach out to get started.",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.full_name) errs.full_name = "This field is required.";
    if (!form.email) errs.email = "This field is required.";
    if (!form.phone) errs.phone = "This field is required.";
    if (!form.service_interest) errs.service_interest = "This field is required.";
    if (!agreed) errs.agreed = "You must agree to the Terms of Service and Privacy Policy.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError("");

    try {
      const r = await fetch("/api/notify?action=welcome-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          company_name: form.company_name,
          service_interest: form.service_interest,
          agreed_to_terms: agreed,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      console.error("[Welcome] Submit error:", err.message);
      setSubmitError(err.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
        <Navbar />
        <div className="flex items-center justify-center px-6 pt-16" style={{ minHeight: "100vh" }}>
          <div className="max-w-md w-full text-center">
            <CheckmarkAnimation />
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginTop: 24, marginBottom: 14 }}>We got your message.</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
              Isaac will personally review your request and get back to you soon. Check your email for confirmation.
            </p>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              Return to nova-systems.app <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <Navbar />
      <div className="px-6 pt-16 pb-14" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="text-center mb-10">
          <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 10 }}>Get Started</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff" }}>Tell Us About Your Business</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Full Name" required error={errors.full_name}>
            <input required value={form.full_name} onChange={set("full_name")} placeholder="Your full name" style={inp} />
          </Field>

          <Field label="Email" required error={errors.email}>
            <input required type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" style={inp} />
          </Field>

          <Field label="Phone Number" required error={errors.phone}>
            <input required type="tel" value={form.phone} onChange={set("phone")} placeholder="(203) 000-0000" style={inp} />
          </Field>

          <Field label="Company Name">
            <input value={form.company_name} onChange={set("company_name")} placeholder="Your business name" style={inp} />
          </Field>

          <Field label="What do you need help with" required error={errors.service_interest}>
            <select required value={form.service_interest} onChange={set("service_interest")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
              <option value="">Select an option</option>
              {SERVICE_OPTIONS.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
            </select>
          </Field>

          <div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <span
                onClick={() => setAgreed((a) => !a)}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
                  background: agreed ? GOLD : "transparent", border: `1px solid ${agreed ? GOLD : "rgba(255,255,255,0.3)"}`,
                }}
              >
                {agreed && <Check style={{ width: 12, height: 12, color: "#0a0800" }} />}
              </span>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ display: "none" }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }}>
                By submitting you agree to our <Link to="/terms" style={{ color: GOLD }}>Terms of Service</Link> and <Link to="/privacy" style={{ color: GOLD }}>Privacy Policy</Link> and consent to be contacted by Nova Systems via phone, text, email, and AI assistant.
              </span>
            </label>
            {errors.agreed && <p style={{ color: "#e05252", fontSize: 11, marginTop: 6 }}>{errors.agreed}</p>}
          </div>

          {submitError && <p style={{ color: "#e05252", fontSize: 12 }}>{submitError}</p>}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "18px", fontSize: 13, fontWeight: 800,
              letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#5a4d1e" : G,
              color: "#0a0800",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.2s", fontFamily: "inherit", marginTop: 4,
            }}>
            {loading ? <>Sending...</> : <><span>Submit</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
          Already filled out the quick form? <Link to="/intake" style={{ color: GOLD }}>Complete your full business intake here.</Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}

function CheckmarkAnimation() {
  return (
    <div style={{ width: 90, height: 90, margin: "0 auto", position: "relative" }}>
      <svg viewBox="0 0 90 90" style={{ width: "100%", height: "100%" }}>
        <circle cx="45" cy="45" r="42" fill="none" stroke={GOLD} strokeWidth="3"
          style={{ strokeDasharray: 264, strokeDashoffset: 264, animation: "novaCircle 0.6s ease-out forwards" }} />
        <path d="M27 46 L40 59 L64 32" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "novaCheck 0.4s ease-out 0.5s forwards" }} />
      </svg>
      <style>{`
        @keyframes novaCircle { to { stroke-dashoffset: 0; } }
        @keyframes novaCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
