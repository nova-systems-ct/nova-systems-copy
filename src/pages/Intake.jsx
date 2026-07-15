import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { ArrowLeft, ArrowRight, Download, Check } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { useSEO } from "@/hooks/useSEO";
import { generateIntakeSummaryPDF } from "@/utils/generatePdf";

import { GOLD, G, Field, TextInput, PillGroup, CheckmarkAnimation, useSavedFlash } from "./intake/ui";
import {
  SECTION_TITLES, BEST_TIMES, CONTACT_METHODS, INDUSTRIES, emptyForm,
  MARKETING_PLATFORMS, TECH_TOOLS, COMM_CHANNELS,
} from "./intake/constants";
import {
  STORY_FIELDS, GOALS_FIELDS, CUSTOMERS_FIELDS, SALES_PROCESS_FIELDS, TEAM_FIELDS,
  REPUTATION_FIELDS, FINANCIALS_FIELDS, AI_KNOWLEDGE_FIELDS, FINAL_QUESTIONS_FIELDS,
  MARKETING_DETAIL_FIELDS, TECHNOLOGY_DETAIL_FIELDS, COMMUNICATION_DETAIL_FIELDS,
} from "./intake/sectionConfigs";
import SimpleSection from "./intake/SimpleSection";
import BusinessesSection from "./intake/BusinessesSection";
import ServicesSection from "./intake/ServicesSection";
import ChecklistSection from "./intake/ChecklistSection";
import CompetitorsSection from "./intake/CompetitorsSection";
import DocumentUploadSection from "./intake/DocumentUploadSection";
import ReviewSection from "./intake/ReviewSection";
import PaymentSection from "./intake/PaymentSection";
import AgreementSection from "./intake/AgreementSection";

const STORAGE_KEY = "nova_intake_progress_v2";
const AUTOSAVE_MS = 30_000;

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const REVIEW_STEP = SECTION_TITLES.indexOf("Review Your Submission");
const PAYMENT_STEP = SECTION_TITLES.indexOf("Reserve Your Spot");
const AGREEMENT_STEP = SECTION_TITLES.indexOf("Agreements & Signature");

const TIMELINE_STEPS = [
  "Assessment Received", "Nova Audit Running", "Research and Analysis",
  "Proposal Being Prepared", "Strategy Meeting", "Launch",
];

function SuccessScreen({ form }) {
  const downloadPdf = () => {
    try {
      const doc = generateIntakeSummaryPDF(form);
      doc.save(`Nova-Systems-Assessment-${(form.name || "client").replace(/[^a-z0-9]+/gi, "-")}.pdf`);
    } catch (err) {
      console.error("[Intake] PDF download failed:", err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: "#0a0a0a" }}>
      <style>{`@keyframes pulseGold { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      <div className="max-w-lg w-full text-center">
        <img src={novaLogo} alt="Nova Systems" style={{ width: 44, height: 44, objectFit: "contain", margin: "0 auto 20px" }} />
        <CheckmarkAnimation />
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginTop: 22, marginBottom: 10 }}>You Are Officially In.</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.7, marginBottom: 36 }}>
          Your Business Intelligence Assessment has been received and your spot is reserved.
        </p>

        <div style={{ textAlign: "left", marginBottom: 32 }}>
          {TIMELINE_STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i === 0 ? GOLD : i === 1 ? "rgba(200,169,110,0.25)" : "rgba(255,255,255,0.06)",
                  border: i <= 1 ? `1px solid ${GOLD}` : "1px solid rgba(255,255,255,0.15)",
                  animation: i === 1 ? "pulseGold 1.6s ease-in-out infinite" : "none",
                }}>
                  {i === 0 && <Check style={{ width: 12, height: 12, color: "#0a0800" }} />}
                </div>
                {i < TIMELINE_STEPS.length - 1 && <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.12)" }} />}
              </div>
              <span style={{ fontSize: 13, color: i <= 1 ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: i <= 1 ? 700 : 500, paddingBottom: 20 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "left", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>What happens now</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "rgba(255,255,255,0.55)" }}>
            Within 3 to 5 business days our team will analyze your website, review your online presence,
            identify revenue opportunities, research your competitors, build your custom implementation
            roadmap, and prepare your proposal and service agreement.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={downloadPdf}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 9, fontSize: 12, fontWeight: 700, background: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Download style={{ width: 14, height: 14 }} /> Download PDF of Your Responses
          </button>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            Go to nova-systems.app <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function IntroScreen({ onBegin }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0a0a0a" }}>
      <style>{`@keyframes introFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ maxWidth: 620, animation: "introFadeUp 0.7s ease-out" }}>
        <img src={novaLogo} alt="Nova Systems" style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 32px" }} />
        <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 18 }}>
          The Nova Business Intelligence Assessment.
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.7, marginBottom: 32, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
          This assessment gives our team and AI everything needed to analyze your business, identify every
          revenue leak, and build your complete custom growth plan. Be as detailed as possible. The more you
          share the better we build.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, alignItems: "center" }}>
          {["Takes 30 to 60 minutes.", "Your progress saves automatically.", "Your information is 100% secure and confidential."].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onBegin}
          style={{
            padding: "18px 44px", fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
            borderRadius: 10, border: "none", cursor: "pointer", background: G, color: "#0a0800",
            display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "inherit",
          }}
        >
          Begin Assessment <ArrowRight style={{ width: 15, height: 15 }} />
        </button>

        <p style={{ marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          This assessment is for businesses interested in Nova Systems services. Completing it does not
          guarantee services will be provided. All information is used solely to prepare your custom proposal.
        </p>
      </div>
    </div>
  );
}

export default function Intake() {
  const [searchParams] = useSearchParams();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const loadedFromStorage = useRef(false);
  const [savedFlashVisible, flashSaved] = useSavedFlash();

  useSEO({
    title: "Business Intelligence Assessment — Nova Systems",
    description: "Complete the Nova Business Intelligence Assessment so our team and AI can prepare your custom growth plan.",
  });

  // Load saved progress, else prefill from /welcome handoff query params.
  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.form) { setForm({ ...emptyForm(), ...saved.form }); restored = true; }
        if (typeof saved.step === "number") setStep(saved.step);
        if (saved.started) setStarted(true);
      }
    } catch {
      // ignore corrupt storage
    }

    if (!restored) {
      const name = searchParams.get("name");
      const email = searchParams.get("email");
      const phone = searchParams.get("phone");
      const company = searchParams.get("company");
      const website = searchParams.get("website");
      const industry = searchParams.get("industry");
      const lead_id = searchParams.get("lead_id");
      if (name || email || phone || company || lead_id) {
        setForm((f) => ({
          ...f,
          name: name || f.name, email: email || f.email, phone: phone || f.phone,
          lead_id: lead_id || f.lead_id,
          businesses: f.businesses.map((b, i) => (i === 0 ? {
            ...b,
            business_name: company || b.business_name,
            website: website || b.website,
            industry: INDUSTRIES.includes(industry) ? industry : b.industry,
          } : b)),
        }));
      }
    }
    loadedFromStorage.current = true;
  }, [searchParams]);

  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step, started }));
      flashSaved();
    } catch {
      // storage full or unavailable — non-fatal
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step, started]);

  // Autosave every 30s while the assessment is in progress.
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(saveProgress, AUTOSAVE_MS);
    return () => clearInterval(interval);
  }, [started, saveProgress]);

  // Also persist immediately whenever the step changes (covers back/forward nav + tab close).
  useEffect(() => {
    if (!loadedFromStorage.current) return;
    saveProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, started]);

  useEffect(() => {
    document.body.style.background = "#0a0a0a";
    return () => { document.body.style.background = ""; };
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSection = (key) => (patch) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return "Please fill in your name, email, and phone number.";
    }
    if (step === 1) {
      if (!form.businesses.some((b) => b.business_name.trim())) return "Please add at least one business name.";
    }
    if (step === 2 && form.story.business_story.trim().length < 500) {
      return "Please write at least 500 characters about your business story.";
    }
    if (step === 6 && form.sales_process.journey.trim().length < 200) {
      return "Please write at least 200 characters describing your sales process.";
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
  const goToStep = (idx) => {
    setError("");
    setStep(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePaymentContinue = (paymentPatch) => {
    set(paymentPatch);
    setStep(AGREEMENT_STEP);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinalSubmit = async () => {
    const missingRequired = !form.agree_terms || !form.agree_privacy || !form.agree_audit_authorization
      || !form.agree_no_services_until_signed || !form.agree_no_charge_today || !form.agree_cancellation_policy
      || !form.ai_authorization;
    if (missingRequired) { setError("Please check all required agreements before submitting."); return; }
    if (!form.digital_signature.trim()) { setError("Please type your full legal name to sign."); return; }

    setSubmitting(true);
    setError("");

    const submissionForm = { ...form, signature_date: new Date().toISOString().slice(0, 10) };

    let pdf_base64 = "";
    try {
      const doc = generateIntakeSummaryPDF(submissionForm);
      pdf_base64 = doc.output("datauristring");
    } catch (err) {
      console.warn("[Intake] PDF generation failed (non-fatal):", err.message);
    }

    try {
      const res = await fetch("/api/business-intake?action=submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submissionForm, pdf_base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong submitting your assessment. Please try again.");

      setForm(submissionForm);
      setSubmitted(true);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) return <SuccessScreen form={form} />;
  if (!started) return <IntroScreen onBegin={() => setStarted(true)} />;

  const progressPct = ((step + 1) / SECTION_TITLES.length) * 100;
  const minutesRemaining = Math.max(2, (SECTION_TITLES.length - step) * 2);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <style>{`@keyframes intakeStepIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      <div className="sticky top-0 z-40" style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={novaLogo} alt="Nova Systems" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", transition: "opacity 0.3s", opacity: savedFlashVisible ? 1 : 0 }}>
              Saved
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD }}>
              Step {step + 1} of {SECTION_TITLES.length}
            </span>
          </div>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: G, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-14">
        <p style={{ color: GOLD, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>
          Step {step + 1} of {SECTION_TITLES.length} &middot; ~{minutesRemaining} min remaining
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 32 }}>{SECTION_TITLES[step]}</h1>

        <div key={step} style={{ animation: "intakeStepIn 0.35s ease-out", display: "flex", flexDirection: "column", gap: 20 }}>

          {step === 0 && (
            <>
              <Field label="Full Name" required>
                <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your full name" />
              </Field>
              <Field label="Email Address" required>
                <TextInput type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="your@email.com" />
              </Field>
              <Field label="Phone Number" required>
                <TextInput type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(203) 000-0000" />
              </Field>
              <Field label="Best Time to Contact">
                <PillGroup value={form.best_time} onChange={(v) => set({ best_time: v })} options={BEST_TIMES} />
              </Field>
              <Field label="Preferred Contact Method">
                <PillGroup value={form.preferred_contact} onChange={(v) => set({ preferred_contact: v })} options={CONTACT_METHODS} />
              </Field>
            </>
          )}

          {step === 1 && <BusinessesSection businesses={form.businesses} onChange={(list) => set({ businesses: list })} />}
          {step === 2 && <SimpleSection config={STORY_FIELDS} data={form.story} onChange={setSection("story")} />}
          {step === 3 && <SimpleSection config={GOALS_FIELDS} data={form.goals} onChange={setSection("goals")} />}
          {step === 4 && <SimpleSection config={CUSTOMERS_FIELDS} data={form.customers} onChange={setSection("customers")} />}
          {step === 5 && <ServicesSection services={form.services} onChange={(list) => set({ services: list })} />}
          {step === 6 && <SimpleSection config={SALES_PROCESS_FIELDS} data={form.sales_process} onChange={setSection("sales_process")} />}

          {step === 7 && (
            <ChecklistSection options={MARKETING_PLATFORMS} data={form.marketing} onChange={(v) => set({ marketing: v })} detailFields={MARKETING_DETAIL_FIELDS} />
          )}
          {step === 8 && (
            <ChecklistSection options={TECH_TOOLS} data={form.technology} onChange={(v) => set({ technology: v })} detailFields={TECHNOLOGY_DETAIL_FIELDS} />
          )}
          {step === 9 && (
            <ChecklistSection options={COMM_CHANNELS} data={form.communication} onChange={(v) => set({ communication: v })} detailFields={COMMUNICATION_DETAIL_FIELDS} />
          )}

          {step === 10 && <SimpleSection config={TEAM_FIELDS} data={form.team} onChange={setSection("team")} />}
          {step === 11 && <SimpleSection config={REPUTATION_FIELDS} data={form.reputation} onChange={setSection("reputation")} />}
          {step === 12 && (
            <SimpleSection
              config={FINANCIALS_FIELDS} data={form.financials} onChange={setSection("financials")}
              hint="These are optional ranges only. No exact numbers required."
            />
          )}
          {step === 13 && <CompetitorsSection competitors={form.competitors} onChange={(v) => set({ competitors: v })} />}
          {step === 14 && (
            <SimpleSection
              config={AI_KNOWLEDGE_FIELDS} data={form.ai_knowledge} onChange={setSection("ai_knowledge")}
              hint="Help us train your AI. This information will be used to set up your Nova AI agents so they answer exactly like your business would."
            />
          )}
          {step === 15 && <DocumentUploadSection documentUrls={form.document_urls} onChange={(v) => set({ document_urls: v })} email={form.email} />}
          {step === 16 && (
            <SimpleSection
              config={FINAL_QUESTIONS_FIELDS} data={form.final_questions} onChange={setSection("final_questions")}
              hint="The most important questions. These reveal where the biggest opportunities are."
            />
          )}

          {step === REVIEW_STEP && <ReviewSection form={form} goToStep={goToStep} />}

          {step === PAYMENT_STEP && (
            <Elements stripe={stripePromise}>
              <PaymentSection form={form} onContinue={handlePaymentContinue} />
            </Elements>
          )}

          {step === AGREEMENT_STEP && (
            <AgreementSection form={form} onChange={set} onSubmit={handleFinalSubmit} submitting={submitting} error={error} />
          )}
        </div>

        {error && step !== AGREEMENT_STEP && <p style={{ color: "#e05252", fontSize: 12.5, marginTop: 20 }}>{error}</p>}

        {step < REVIEW_STEP && (
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
              {step === REVIEW_STEP - 1 ? "Review" : "Next"} <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {step === REVIEW_STEP && (
          <div className="flex items-center justify-between mt-10">
            <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 8, border: "none", background: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back
            </button>
            <button onClick={next} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 9, border: "none", background: G, color: "#0a0800", cursor: "pointer", fontFamily: "inherit" }}>
              Continue to Payment <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {(step === PAYMENT_STEP || step === AGREEMENT_STEP) && (
          <div className="mt-6">
            <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 0", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", border: "none", background: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
