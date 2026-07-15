import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ArrowLeft, ArrowRight, Check, Plus, X, ExternalLink, Lock } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { useSEO } from "@/hooks/useSEO";
import { generateIntakeSummaryPDF } from "@/utils/generatePdf";

const GOLD = "#D4A030";
const GOLD_DARK = "#8a6200";
const GOLD_BRIGHT = "#C8921A";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const STORAGE_KEY = "nova_intake_progress_v1";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const SECTION_TITLES = [
  "About You",
  "Your Business",
  "Social Media & Online Presence",
  "Goals & Challenges",
  "Budget & Timeline",
  "Agreement & Payment",
];

const BEST_TIMES = ["Morning", "Afternoon", "Evening"];
const CONTACT_METHODS = ["Call", "Text", "WhatsApp", "Email"];
const INDUSTRIES = ["Restaurant", "Barbershop", "Salon", "Medical", "Retail", "Contractor", "Nonprofit", "Technology", "Fitness", "Food and Beverage", "Real Estate", "Law", "Finance", "Other"];
const REVENUE_RANGES = ["$0-$1k", "$1k-$5k", "$5k-$10k", "$10k-$25k", "$25k-$50k", "$50k+"];
const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "Twitter / X" },
];
const BUDGET_RANGES = ["$0-$500", "$500-$1000", "$1000-$2500", "$2500-$5000", "$5000+"];
const TIMELINES = ["Immediately", "Within 30 days", "Within 90 days", "Just exploring"];
const REFERRAL_SOURCES = ["Google", "Instagram", "TikTok", "Referral", "In person", "Other"];

const emptyBusiness = () => ({
  id: `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  business_name: "", industry: "", address: "", website: "",
  time_in_business: "", employee_count: "", monthly_revenue: "", locations: "",
});

const emptyForm = () => ({
  name: "", email: "", phone: "", best_time: "", preferred_contact: "",
  businesses: [emptyBusiness()],
  social_media: {
    instagram: { handle: "", followers: "" },
    facebook: { handle: "", followers: "" },
    tiktok: { handle: "", followers: "" },
    linkedin: { handle: "", followers: "" },
    youtube: { handle: "", followers: "" },
    twitter: { handle: "", followers: "" },
    paid_ads: { running: false, platforms: "", spend: "" },
    google_business: "", google_rating: "",
  },
  goals: {
    biggest_challenge: "", revenue_goal_12mo: "", dream_vision_3yr: "",
    expansion_goals: "", tried_before: "", why_now: "",
  },
  budget_range: "", timeline: "", referral_source: "", referrer_name: "",
});

// ── Shared field styles ──────────────────────────────────────────────────────
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

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      {label && <label style={lbl}>{label}{required && <Asterisk />}</label>}
      {children}
      {hint && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 5 }}>{hint}</p>}
      {error && <p style={{ color: "#e05252", fontSize: 11, marginTop: 5 }}>{error}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = "Select an option" }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
    </select>
  );
}

function Pill({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 8,
        border: `1px solid ${selected ? GOLD : "rgba(255,255,255,0.15)"}`,
        background: selected ? "rgba(212,160,48,0.12)" : "rgba(255,255,255,0.03)",
        color: selected ? GOLD : "rgba(255,255,255,0.7)",
        cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function CheckmarkAnimation() {
  return (
    <div style={{ width: 90, height: 90, margin: "0 auto", position: "relative" }}>
      <svg viewBox="0 0 90 90" style={{ width: "100%", height: "100%" }}>
        <circle cx="45" cy="45" r="42" fill="none" stroke={GOLD} strokeWidth="3"
          style={{ strokeDasharray: 264, strokeDashoffset: 264, animation: "intakeCircle 0.6s ease-out forwards" }} />
        <path d="M27 46 L40 59 L64 32" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "intakeCheck 0.4s ease-out 0.5s forwards" }} />
      </svg>
      <style>{`
        @keyframes intakeCircle { to { stroke-dashoffset: 0; } }
        @keyframes intakeCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

// ── Payment + final submit (must live inside <Elements>) ────────────────────
function PaymentAndSubmit({ form, agreed, setAgreed, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!agreed) { setError("You must agree to the Terms, Privacy Policy, and Service Agreement to continue."); return; }
    if (!form.businesses.some((b) => b.business_name.trim())) {
      setError("Please go back and add at least one business name.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      let stripe_customer_id = "";
      let stripe_payment_method_id = "";

      if (stripe && elements) {
        const card = elements.getElement(CardElement);
        if (card) {
          const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
            type: "card", card, billing_details: { name: form.name, email: form.email },
          });
          if (pmError) throw new Error(pmError.message || "Your card details could not be verified.");

          const setupRes = await fetch("/api/stripe?action=setup-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, name: form.name, payment_method_id: paymentMethod.id }),
          });
          const setupData = await setupRes.json().catch(() => ({}));
          if (!setupRes.ok || setupData.ok === false) {
            throw new Error(setupData.error || "We could not save your payment method. Please check your card details.");
          }
          stripe_customer_id = setupData.customer_id || "";
          stripe_payment_method_id = setupData.payment_method_id || "";
        }
      }

      let pdf_base64 = "";
      try {
        const doc = generateIntakeSummaryPDF(form);
        pdf_base64 = doc.output("datauristring");
      } catch (err) {
        console.warn("[Intake] PDF generation failed (non-fatal):", err.message);
      }

      const submitRes = await fetch("/api/business-intake?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stripe_customer_id, stripe_payment_method_id,
          agreed_to_terms: true,
          pdf_base64,
        }),
      });
      const submitData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) throw new Error(submitData.error || "Something went wrong submitting your intake. Please try again.");

      onSuccess();
    } catch (err) {
      console.error("[Intake] Submit error:", err.message);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Lock style={{ width: 14, height: 14, color: GOLD }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Secure Payment Method on File</span>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
          We save your payment information securely using Stripe. You will not be charged anything today.
          A charge will only occur after you approve a proposal and sign a contract. This is simply to
          streamline the process when you are ready to move forward.
        </p>

        {stripePromise ? (
          <div style={{ ...inp, padding: "16px" }}>
            <CardElement
              options={{
                style: {
                  base: {
                    color: "#fff", fontSize: "14px", fontFamily: "inherit",
                    "::placeholder": { color: "rgba(255,255,255,0.35)" },
                  },
                  invalid: { color: "#e05252" },
                },
              }}
            />
          </div>
        ) : (
          <p style={{ color: "#e0a552", fontSize: 12 }}>
            Payment collection is not configured yet — you can still complete your intake and we'll follow up to collect payment details.
          </p>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 20 }}>
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
          I have read and agree to the Terms of Service, Privacy Policy, and Service Agreement. I consent to be
          contacted by Nova Systems and its AI systems via phone call, text message, WhatsApp, and email for
          business purposes. I understand I can opt out at any time by replying STOP.
        </span>
      </label>

      {error && <p style={{ color: "#e05252", fontSize: 12.5, marginBottom: 16 }}>{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%", padding: "19px", fontSize: 13, fontWeight: 800,
          letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          background: submitting ? "#5a4d1e" : G,
          color: "#0a0800",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontFamily: "inherit",
        }}
      >
        {submitting ? "Submitting..." : "Complete Intake"}
      </button>
    </div>
  );
}

function DocCard({ title, desc, href }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: 16, marginBottom: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{desc}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: GOLD, textDecoration: "none" }}>
        View Full Document <ExternalLink style={{ width: 11, height: 11 }} />
      </a>
    </div>
  );
}

export default function Intake() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const loadedFromStorage = useRef(false);

  useSEO({
    title: "Business Intake — Nova Systems",
    description: "Complete your full Nova Systems business intake so our team and AI can prepare your custom growth plan.",
  });

  // Load saved progress on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.form) setForm({ ...emptyForm(), ...saved.form });
        if (typeof saved.step === "number") setStep(saved.step);
        if (saved.started) setStarted(true);
      }
    } catch {
      // ignore corrupt storage
    }
    loadedFromStorage.current = true;
  }, []);

  // Autosave progress
  useEffect(() => {
    if (!loadedFromStorage.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step, started }));
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, [form, step, started]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSocial = (patch) => setForm((f) => ({ ...f, social_media: { ...f.social_media, ...patch } }));
  const setPlatform = (key, patch) => setForm((f) => ({
    ...f, social_media: { ...f.social_media, [key]: { ...f.social_media[key], ...patch } },
  }));
  const setGoals = (patch) => setForm((f) => ({ ...f, goals: { ...f.goals, ...patch } }));

  const updateBusiness = (id, patch) => setForm((f) => ({
    ...f, businesses: f.businesses.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  }));
  const addBusiness = () => setForm((f) => ({ ...f, businesses: [...f.businesses, emptyBusiness()] }));
  const removeBusiness = (id) => setForm((f) => ({ ...f, businesses: f.businesses.filter((b) => b.id !== id) }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return "Please fill in your name, email, and phone number.";
    }
    if (step === 1) {
      if (!form.businesses.some((b) => b.business_name.trim())) return "Please add at least one business name.";
    }
    return "";
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(SECTION_TITLES.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSuccess = () => {
    setSubmitted(true);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
  };

  useEffect(() => {
    document.body.style.background = "#0a0a0a";
    return () => { document.body.style.background = ""; };
  }, []);

  // ── Submitted screen ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
        <div className="max-w-md w-full text-center">
          <CheckmarkAnimation />
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginTop: 24, marginBottom: 14 }}>
            Your Intake Is Complete.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            Thank you, {form.name.split(" ")[0] || "there"}. Our team and AI are reviewing everything you shared.
            Within 24 to 48 hours we'll send you your custom growth plan and reach out to schedule a time to
            review it together. Check your email for a copy of your submission.
          </p>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            Return to nova-systems.app <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </div>
    );
  }

  // ── Intro screen ─────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0a0a0a" }}>
        <style>{`@keyframes introFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={{ maxWidth: 620, animation: "introFadeUp 0.6s ease-out" }}>
          <img src={novaLogo} alt="Nova Systems" style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 32px" }} />
          <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>
            Before We Build Anything We Need To Understand Everything.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.7, marginBottom: 32, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            This intake form helps our team and AI analyze your business, identify growth opportunities, and
            prepare your custom proposal before we ever meet. Your information is secure and will never be shared.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 40, alignItems: "center" }}>
            {["Takes about 30 minutes.", "Be as detailed as possible.", "The more we know the better we build."].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStarted(true)}
            style={{
              padding: "18px 44px", fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
              borderRadius: 10, border: "none", cursor: "pointer", background: G, color: "#0a0800",
              display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "inherit",
            }}
          >
            Get Started <ArrowRight style={{ width: 15, height: 15 }} />
          </button>

          <p style={{ marginTop: 28, fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>
            If you need to stop and come back your progress is saved automatically.
          </p>
        </div>
      </div>
    );
  }

  const progressPct = ((step + 1) / SECTION_TITLES.length) * 100;

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <style>{`@keyframes intakeStepIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* Sticky header + progress bar */}
      <div className="sticky top-0 z-40" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={novaLogo} alt="Nova Systems" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </Link>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD }}>
            {step + 1} of {SECTION_TITLES.length}
          </span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: G, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-14">
        <p style={{ color: GOLD, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>
          Section {step + 1} of {SECTION_TITLES.length}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 32 }}>{SECTION_TITLES[step]}</h1>

        <div key={step} style={{ animation: "intakeStepIn 0.35s ease-out", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Section 1: About You ── */}
          {step === 0 && (
            <>
              <Field label="Full Name" required>
                <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your full name" style={inp} />
              </Field>
              <Field label="Email Address" required>
                <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="your@email.com" style={inp} />
              </Field>
              <Field label="Phone Number" required>
                <input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(203) 000-0000" style={inp} />
              </Field>
              <Field label="Best Time to Contact">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {BEST_TIMES.map((t) => <Pill key={t} selected={form.best_time === t} onClick={() => set({ best_time: t })}>{t}</Pill>)}
                </div>
              </Field>
              <Field label="Preferred Contact Method">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CONTACT_METHODS.map((m) => <Pill key={m} selected={form.preferred_contact === m} onClick={() => set({ preferred_contact: m })}>{m}</Pill>)}
                </div>
              </Field>
            </>
          )}

          {/* ── Section 2: Your Business ── */}
          {step === 1 && (
            <>
              {form.businesses.map((biz, i) => (
                <div key={biz.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, position: "relative" }}>
                  {form.businesses.length > 1 && (
                    <button type="button" onClick={() => removeBusiness(biz.id)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
                    Business {i + 1}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Field label="Business Name" required={i === 0}>
                      <input value={biz.business_name} onChange={(e) => updateBusiness(biz.id, { business_name: e.target.value })} placeholder="Your business name" style={inp} />
                    </Field>
                    <Field label="Industry">
                      <Select value={biz.industry} onChange={(e) => updateBusiness(biz.id, { industry: e.target.value })} options={INDUSTRIES} />
                    </Field>
                    <Field label="Business Address">
                      <input value={biz.address} onChange={(e) => updateBusiness(biz.id, { address: e.target.value })} placeholder="Street, City, State" style={inp} />
                    </Field>
                    <Field label="Website URL">
                      <input value={biz.website} onChange={(e) => updateBusiness(biz.id, { website: e.target.value })} placeholder="yourbusiness.com" style={inp} />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="How Long In Business">
                        <input value={biz.time_in_business} onChange={(e) => updateBusiness(biz.id, { time_in_business: e.target.value })} placeholder="e.g. 3 years" style={inp} />
                      </Field>
                      <Field label="Number of Employees">
                        <input value={biz.employee_count} onChange={(e) => updateBusiness(biz.id, { employee_count: e.target.value })} placeholder="e.g. 5" style={inp} />
                      </Field>
                    </div>
                    <Field label="Monthly Revenue Range">
                      <Select value={biz.monthly_revenue} onChange={(e) => updateBusiness(biz.id, { monthly_revenue: e.target.value })} options={REVENUE_RANGES} />
                    </Field>
                    <Field label="Number of Locations">
                      <input value={biz.locations} onChange={(e) => updateBusiness(biz.id, { locations: e.target.value })} placeholder="e.g. 1" style={inp} />
                    </Field>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addBusiness}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "13px", borderRadius: 8, border: `1px dashed rgba(212,160,48,0.4)`,
                  background: "transparent", color: GOLD, fontSize: 12.5, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Plus style={{ width: 14, height: 14 }} /> Add Another Business
              </button>
            </>
          )}

          {/* ── Section 3: Social Media ── */}
          {step === 2 && (
            <>
              {SOCIAL_PLATFORMS.map((p) => (
                <div key={p.key} className="grid sm:grid-cols-2 gap-4">
                  <Field label={`${p.label} Handle`}>
                    <input value={form.social_media[p.key].handle} onChange={(e) => setPlatform(p.key, { handle: e.target.value })} placeholder="@yourbusiness" style={inp} />
                  </Field>
                  <Field label="Approx. Followers">
                    <input value={form.social_media[p.key].followers} onChange={(e) => setPlatform(p.key, { followers: e.target.value })} placeholder="e.g. 2,500" style={inp} />
                  </Field>
                </div>
              ))}

              <Field label="Do You Currently Run Paid Ads?">
                <div style={{ display: "flex", gap: 8 }}>
                  <Pill selected={form.social_media.paid_ads.running === true} onClick={() => setSocial({ paid_ads: { ...form.social_media.paid_ads, running: true } })}>Yes</Pill>
                  <Pill selected={form.social_media.paid_ads.running === false} onClick={() => setSocial({ paid_ads: { ...form.social_media.paid_ads, running: false } })}>No</Pill>
                </div>
              </Field>

              {form.social_media.paid_ads.running && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Which Platforms">
                    <input value={form.social_media.paid_ads.platforms} onChange={(e) => setSocial({ paid_ads: { ...form.social_media.paid_ads, platforms: e.target.value } })} placeholder="e.g. Facebook, Google" style={inp} />
                  </Field>
                  <Field label="Monthly Ad Spend">
                    <input value={form.social_media.paid_ads.spend} onChange={(e) => setSocial({ paid_ads: { ...form.social_media.paid_ads, spend: e.target.value } })} placeholder="e.g. $500" style={inp} />
                  </Field>
                </div>
              )}

              <Field label="Do You Have a Google Business Profile?">
                <div style={{ display: "flex", gap: 8 }}>
                  {["Yes", "No", "Not Sure"].map((o) => (
                    <Pill key={o} selected={form.social_media.google_business === o} onClick={() => setSocial({ google_business: o })}>{o}</Pill>
                  ))}
                </div>
              </Field>

              <Field label="Current Google Rating (if known)">
                <input value={form.social_media.google_rating} onChange={(e) => setSocial({ google_rating: e.target.value })} placeholder="e.g. 4.6 stars" style={inp} />
              </Field>
            </>
          )}

          {/* ── Section 4: Goals & Challenges ── */}
          {step === 3 && (
            <>
              <Field label="What is your biggest business challenge right now?">
                <textarea rows={4} value={form.goals.biggest_challenge} onChange={(e) => setGoals({ biggest_challenge: e.target.value })} style={{ ...inp, resize: "vertical" }} />
              </Field>
              <Field label="What is your revenue goal in the next 12 months?">
                <input value={form.goals.revenue_goal_12mo} onChange={(e) => setGoals({ revenue_goal_12mo: e.target.value })} style={inp} />
              </Field>
              <Field label="What does your dream business look like in 3 years?">
                <textarea rows={4} value={form.goals.dream_vision_3yr} onChange={(e) => setGoals({ dream_vision_3yr: e.target.value })} style={{ ...inp, resize: "vertical" }} />
              </Field>
              <Field label="Where do you want to expand geographically?">
                <input value={form.goals.expansion_goals} onChange={(e) => setGoals({ expansion_goals: e.target.value })} style={inp} />
              </Field>
              <Field label="What have you tried before that did not work?">
                <textarea rows={4} value={form.goals.tried_before} onChange={(e) => setGoals({ tried_before: e.target.value })} style={{ ...inp, resize: "vertical" }} />
              </Field>
              <Field label="Why are you reaching out to Nova Systems now?">
                <textarea rows={4} value={form.goals.why_now} onChange={(e) => setGoals({ why_now: e.target.value })} style={{ ...inp, resize: "vertical" }} />
              </Field>
            </>
          )}

          {/* ── Section 5: Budget & Timeline ── */}
          {step === 4 && (
            <>
              <Field label="Monthly Budget Range for Nova Systems Services">
                <Select value={form.budget_range} onChange={(e) => set({ budget_range: e.target.value })} options={BUDGET_RANGES} />
              </Field>
              <Field label="When Do You Want to Get Started?">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TIMELINES.map((t) => <Pill key={t} selected={form.timeline === t} onClick={() => set({ timeline: t })}>{t}</Pill>)}
                </div>
              </Field>
              <Field label="How Did You Hear About Nova Systems?">
                <Select value={form.referral_source} onChange={(e) => set({ referral_source: e.target.value })} options={REFERRAL_SOURCES} />
              </Field>
              {form.referral_source === "Referral" && (
                <Field label="Who Referred You?">
                  <input value={form.referrer_name} onChange={(e) => set({ referrer_name: e.target.value })} style={inp} />
                </Field>
              )}
            </>
          )}

          {/* ── Section 6: Agreement & Payment ── */}
          {step === 5 && (
            <>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: -12, marginBottom: 4 }}>
                Almost done. Two final steps.
              </p>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Step 1 — Review &amp; Agree</p>
                <DocCard title="Terms of Service" desc="The rules and guidelines for working with Nova Systems." href="/terms" />
                <DocCard title="Privacy Policy" desc="How we collect, use, and protect your information." href="/privacy" />
                <DocCard title="Service Agreement" desc="The standard agreement for Nova Systems client engagements." href="/service-agreement" />
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Step 2 — Payment Method</p>
                {stripePromise ? (
                  <Elements stripe={stripePromise}>
                    <PaymentAndSubmit form={form} agreed={agreed} setAgreed={setAgreed} onSuccess={handleSuccess} />
                  </Elements>
                ) : (
                  <PaymentAndSubmit form={form} agreed={agreed} setAgreed={setAgreed} onSuccess={handleSuccess} />
                )}
              </div>
            </>
          )}
        </div>

        {error && <p style={{ color: "#e05252", fontSize: 12.5, marginTop: 20 }}>{error}</p>}

        {step < SECTION_TITLES.length - 1 && (
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={back}
              disabled={step === 0}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px",
                fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 8, border: "none", background: "none", fontFamily: "inherit",
                color: step === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
                cursor: step === 0 ? "default" : "pointer",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back
            </button>
            <button
              onClick={next}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px",
                fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 9, border: "none", background: G, color: "#0a0800", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Next <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="mt-10">
            <button
              onClick={back}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 0",
                fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 8, border: "none", background: "none", fontFamily: "inherit",
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
