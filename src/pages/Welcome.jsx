import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { INDUSTRIES } from "@/pages/intake/constants";

const GOLD = "#C9A84C";
const GOLD_DARK = "#8a6b2a";
const GOLD_BRIGHT = "#E0C476";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

// Phase 1 (2026-09-20): re-pointed from a cross-origin POST to nova-wave-one.vercel.app (a
// different Vercel project, on the .agency domain being decommissioned) to a real local endpoint
// that writes directly into this repo's own `leads` table. See api/welcome.js.
const PLATFORM_API_URL = "/api/welcome";

const COMPANY_SIZES = ["1", "2-5", "6-20", "21-50", "51+"];
const HELP_TOPICS = [
  { key: "more_customers", label: "More customers" },
  { key: "more_leads", label: "More leads" },
  { key: "more_revenue", label: "More revenue" },
  { key: "website", label: "Website" },
  { key: "marketing", label: "Marketing" },
  { key: "phone_calls", label: "Phone/calls" },
  { key: "follow_up", label: "Follow-up" },
  { key: "automation", label: "Automation" },
  { key: "customer_experience", label: "Customer experience" },
  { key: "operations", label: "Operations" },
  { key: "not_sure", label: "Not sure — I want Nova to find the problem" },
];
const HOW_FOUND = ["Google", "TikTok", "Instagram", "Facebook", "YouTube", "LinkedIn", "Yelp", "Referral", "Networking/Event", "Chamber", "Other"];

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
  color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8,
};
const sectionTitle = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase",
  color: GOLD, marginBottom: 16, marginTop: 8,
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

function Checkbox({ checked, onChange, error, children }) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <span
          onClick={() => onChange(!checked)}
          style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
            background: checked ? GOLD : "transparent", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.3)"}`,
          }}
        >
          {checked && <Check style={{ width: 12, height: 12, color: "#0a0800" }} />}
        </span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }}>{children}</span>
      </label>
      {error && <p style={{ color: "#e05252", fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

// Auto-captures UTM params on first load per spec §5's "Also capture UTMs automatically" — read
// once on mount so a visitor navigating within the site afterward doesn't lose the original
// attribution from whichever ad/link brought them here.
function readUtms() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get("utm_source") || "", utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "", utm_content: p.get("utm_content") || "",
    };
  } catch {
    return { utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "" };
  }
}

const emptyForm = {
  first_name: "", last_name: "", email: "", phone: "", preferred_contact: "email",
  company: "", website: "", industry: "", city: "", state: "", company_size: "",
  help_topics: [], biggest_problem: "", goal: "", how_found: "",
  company_website_confirm: "",
};

export default function Welcome() {
  const [form, setForm] = useState(emptyForm);
  const [utms] = useState(readUtms);
  const [agreeContact, setAgreeContact] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  useSEO({
    title: "Get Started — Nova Systems",
    description: "Tell Nova who you are and what you need. Isaac reviews every request personally.",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleTopic = (key) => setForm((f) => ({
    ...f,
    help_topics: f.help_topics.includes(key) ? f.help_topics.filter((t) => t !== key) : [...f.help_topics, key],
  }));

  const validate = () => {
    const errs = {};
    if (!form.first_name) errs.first_name = "This field is required.";
    if (!form.last_name) errs.last_name = "This field is required.";
    if (!form.email) errs.email = "This field is required.";
    if (!form.phone) errs.phone = "This field is required.";
    if (!form.company) errs.company = "This field is required.";
    if (!agreeContact) errs.agreements = "You must agree to be contacted to continue.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Honeypot — bots that autofill every input get flagged server-side; real visitors never see
    // or fill this field.
    if (form.company_website_confirm.trim()) { setDone(true); return; }

    setLoading(true);
    setSubmitError("");

    try {
      const res = await fetch(PLATFORM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name, last_name: form.last_name,
          business_email: form.email, phone: form.phone, preferred_contact: form.preferred_contact,
          business_name: form.company, website: form.website, industry: form.industry,
          city: form.city, state: form.state, company_size: form.company_size,
          help_topics: form.help_topics,
          main_challenge: form.biggest_problem, primary_goal: form.goal,
          referral_source: form.how_found,
          consent: agreeContact, marketing_consent: agreeMarketing,
          ...utms,
          company_website_confirm: form.company_website_confirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setReferenceNumber(data.reference_number || "");
      setDone(true);
    } catch (err) {
      console.error("[Welcome] Submit error:", err.message);
      setSubmitError(err.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  // Spec §7 — do not imply the audit has started. This has been reviewed by Nova, not started.
  if (done) {
    return (
      <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
        <Navbar />
        <div className="flex items-center justify-center px-6 pt-16 pb-16" style={{ minHeight: "100vh" }}>
          <div className="max-w-md w-full text-center">
            <CheckmarkAnimation />
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginTop: 24, marginBottom: 10 }}>We got it.</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
              Your Nova request has been received. We'll review your business information and determine the best next step.
            </p>
            {referenceNumber && (
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "monospace", marginBottom: 28 }}>
                Reference Number: {referenceNumber}
              </p>
            )}
            <div style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "20px 22px", marginBottom: 28 }}>
              <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>What happens next?</p>
              <ol style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.8, paddingLeft: 18 }}>
                <li>Nova reviews your request.</li>
                <li>We may request additional information.</li>
                <li>If approved for an Audit, you'll receive a secure Business Intake link.</li>
                <li>You can also book a 1-on-1 if you'd like to discuss the business first.</li>
              </ol>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 2026-09-20: was pointing at the decommissioned nova-wave-one.vercel.app/book —
                  VITE_CALCOM_URL already existed as real, configured booking-link infrastructure
                  but was never actually wired into any page. Only render the button when it's
                  configured, rather than link to a dead/placeholder destination either way. */}
              {import.meta.env.VITE_CALCOM_URL && (
                <a href={import.meta.env.VITE_CALCOM_URL} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
                  Book a 1-on-1 <ArrowRight style={{ width: 14, height: 14 }} />
                </a>
              )}
              <Link to="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9 }}>
                Return to Nova
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      <Navbar />
      <div className="px-6 pt-16 pb-14" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="text-center mb-10">
          <p style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 10 }}>Get Started</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff" }}>Tell Us About Your Business</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={sectionTitle}>You</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="First Name" required error={errors.first_name}>
              <input required value={form.first_name} onChange={set("first_name")} style={inp} />
            </Field>
            <Field label="Last Name" required error={errors.last_name}>
              <input required value={form.last_name} onChange={set("last_name")} style={inp} />
            </Field>
          </div>
          <Field label="Business Email" required error={errors.email}>
            <input required type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" style={inp} />
          </Field>
          <Field label="Phone Number" required error={errors.phone}>
            <input required type="tel" value={form.phone} onChange={set("phone")} placeholder="(203) 000-0000" style={inp} />
          </Field>
          <Field label="Preferred Contact">
            <select value={form.preferred_contact} onChange={set("preferred_contact")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
              <option value="email" style={{ background: "#111" }}>Email</option>
              <option value="phone" style={{ background: "#111" }}>Phone</option>
              <option value="sms" style={{ background: "#111" }}>SMS</option>
            </select>
          </Field>

          <p style={sectionTitle}>Company</p>
          <Field label="Company Name" required error={errors.company}>
            <input required value={form.company} onChange={set("company")} placeholder="Your business name" style={inp} />
          </Field>
          <Field label="Website">
            <input value={form.website} onChange={set("website")} placeholder="yourbusiness.com" style={inp} />
          </Field>
          <Field label="Industry">
            <select value={form.industry} onChange={set("industry")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
              <option value="">Select an industry</option>
              {INDUSTRIES.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="City">
              <input value={form.city} onChange={set("city")} style={inp} />
            </Field>
            <Field label="State">
              <input value={form.state} onChange={set("state")} placeholder="CT" style={inp} />
            </Field>
          </div>
          <Field label="Approximate Company Size">
            <select value={form.company_size} onChange={set("company_size")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
              <option value="">Select</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
            </select>
          </Field>

          <p style={sectionTitle}>Why Are You Here?</p>
          <Field label="What do you need help with?">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {HELP_TOPICS.map((t) => (
                <Checkbox key={t.key} checked={form.help_topics.includes(t.key)} onChange={() => toggleTopic(t.key)}>
                  {t.label}
                </Checkbox>
              ))}
            </div>
          </Field>

          <Field label="What's the biggest problem you're trying to solve right now?">
            <textarea rows={3} value={form.biggest_problem} onChange={set("biggest_problem")} style={{ ...inp, resize: "none" }} />
          </Field>
          <Field label="What would a successful result look like for your company?">
            <textarea rows={3} value={form.goal} onChange={set("goal")} style={{ ...inp, resize: "none" }} />
          </Field>

          <Field label="How did you find Nova?">
            <select value={form.how_found} onChange={set("how_found")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
              <option value="">Select</option>
              {HOW_FOUND.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
            </select>
          </Field>

          {/* Honeypot — hidden from real visitors via layout, not the `hidden` attribute (some
              bots skip visibly-hidden inputs but still fill ones only excluded via layout). */}
          <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor="company_website_confirm">Leave this field blank</label>
            <input id="company_website_confirm" name="company_website_confirm" type="text" tabIndex={-1} autoComplete="off"
              value={form.company_website_confirm} onChange={set("company_website_confirm")} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
            <Checkbox checked={agreeContact} onChange={setAgreeContact}>
              I agree that Nova Systems may contact me regarding this request. *
            </Checkbox>
            <Checkbox checked={agreeMarketing} onChange={setAgreeMarketing}>
              I would also like to receive business insights, offers, and marketing communications from Nova Systems.
            </Checkbox>
            {errors.agreements && <p style={{ color: "#e05252", fontSize: 11 }}>{errors.agreements}</p>}
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
            {loading ? <>Sending...</> : <><span>Start My Nova Review</span><ArrowRight className="w-4 h-4" /></>}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            Isaac personally reviews every request. No spam, no bots.
          </p>
        </form>
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
