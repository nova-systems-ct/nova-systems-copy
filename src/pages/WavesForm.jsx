import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import novaLogo from "@/assets/nova logo.png";
import {
  ArrowLeft, ArrowRight, Phone, Clock, Skull, MapPin, Layers,
  Mic, MessageSquare, Mail as MailIcon, Share2, RefreshCcw, ClipboardCheck,
} from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const CT_CITIES = [
  "Waterbury", "Hartford", "New Haven", "Bridgeport", "Stamford", "Danbury",
  "Norwalk", "New Britain", "Bristol", "Meriden", "Milford", "West Haven",
  "Middletown", "Norwich", "Shelton", "Torrington", "Naugatuck", "Enfield", "Other",
];

const INDUSTRIES = [
  "Restaurant", "Barbershop / Salon", "Medical / Dental", "Contractor",
  "Real Estate", "Retail / Boutique", "Legal / Finance", "Fitness / Wellness",
  "Auto Services", "Home Services", "Professional Services", "Other",
];

const PROBLEMS = [
  { key: "Missed Calls", Icon: Phone, desc: "Calls go unanswered and leads disappear." },
  { key: "Slow Follow-Up", Icon: Clock, desc: "Leads go cold before anyone reaches out." },
  { key: "Ignored DMs", Icon: MessageSquare, desc: "Social messages pile up unanswered." },
  { key: "Dead Leads", Icon: Skull, desc: "Old leads sitting in your database, unworked." },
  { key: "Not Found Online", Icon: MapPin, desc: "Customers can't find or don't trust you online." },
  { key: "All of the Above", Icon: Layers, desc: "It's all of it, all the time." },
];

const REVENUE_RANGES = ["Under $10K per month", "$10K to $25K per month", "$25K to $100K per month", "$100K or more per month"];

const ENGINES = [
  { key: "Nova Voice", Icon: Mic, desc: "AI phone agent answering every call 24/7." },
  { key: "Nova Blue", Icon: MessageSquare, desc: "AI SMS agent following up with every lead." },
  { key: "Nova Email", Icon: MailIcon, desc: "AI managing your entire inbox." },
  { key: "Nova Social", Icon: Share2, desc: "AI handling every DM and comment." },
  { key: "Nova Revive", Icon: RefreshCcw, desc: "AI reactivating every dead lead." },
  { key: "Nova Audit", Icon: ClipboardCheck, desc: "Full business intelligence scan." },
];

const STEPS = ["Your Information", "Your Business", "Your Biggest Problem", "Your Revenue", "Your Priorities", "Review & Submit"];

const inputCls = "w-full px-4 py-3.5 text-sm rounded-lg outline-none transition-all border";
const inputStyle = { borderColor: "rgba(0,0,0,0.15)", color: "#0a0a0a" };
const labelCls = "block text-[11px] font-bold tracking-[0.1em] uppercase mb-2";
const labelStyle = { color: "rgba(0,0,0,0.45)" };

function Field({ label, children }) {
  return <div className="mb-5"><label className={labelCls} style={labelStyle}>{label}</label>{children}</div>;
}

function SelectCard({ selected, onClick, Icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-5 rounded-xl transition-all"
      style={{
        border: `2px solid ${selected ? GOLD : "rgba(0,0,0,0.1)"}`,
        background: selected ? `${GOLD}0f` : "#fff",
      }}
    >
      {Icon && <Icon className="w-5 h-5 mb-3" style={{ color: selected ? GOLD : "#999" }} />}
      <p className="text-sm font-bold mb-1" style={{ color: "#0a0a0a" }}>{title}</p>
      {desc && <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.45)" }}>{desc}</p>}
    </button>
  );
}

function CheckmarkAnimation() {
  return (
    <div style={{ width: 90, height: 90, margin: "0 auto", position: "relative" }}>
      <svg viewBox="0 0 90 90" style={{ width: "100%", height: "100%" }}>
        <circle cx="45" cy="45" r="42" fill="none" stroke={GOLD} strokeWidth="3"
          style={{ strokeDasharray: 264, strokeDashoffset: 264, animation: "wfCircle 0.6s ease-out forwards" }} />
        <path d="M27 46 L40 59 L64 32" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "wfCheck 0.4s ease-out 0.5s forwards" }} />
      </svg>
      <style>{`
        @keyframes wfCircle { to { stroke-dashoffset: 0; } }
        @keyframes wfCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

const emptyForm = {
  first_name: "", last_name: "", phone: "", email: "",
  company_name: "", website: "", city: "", industry: "",
  biggest_problem: "", revenue_range: "", priority_engines: [], notes: "",
  agree_spots: false, agree_audit: false, agree_contact: false,
};

export default function WavesForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  useSEO({
    title: "Wave One Application — Nova Systems",
    description: "Apply for Wave One — Nova Systems' limited-enrollment AI Revenue Engine for Connecticut businesses.",
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim() || !form.email.trim()) return "Please fill in all required fields.";
    }
    if (step === 1) {
      if (!form.company_name.trim() || !form.city || !form.industry) return "Please fill in all required fields.";
    }
    if (step === 2 && !form.biggest_problem) return "Please select an option.";
    if (step === 3 && !form.revenue_range) return "Please select an option.";
    if (step === 5) {
      if (!form.agree_spots || !form.agree_audit || !form.agree_contact) return "Please agree to all three items before submitting.";
    }
    return "";
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => { setError(""); setStep((s) => Math.max(0, s - 1)); };

  const toggleEngine = (key) => {
    set({ priority_engines: form.priority_engines.includes(key) ? form.priority_engines.filter((e) => e !== key) : [...form.priority_engines, key] });
  };

  const submit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/waves-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setSubmitted(true);
    } catch (e) {
      setError(e.message || "Network error — please try again.");
    }
    setSubmitting(false);
  };

  const shareWaves = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/waves`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: "#fdfcfa" }}>
        <div className="max-w-md w-full text-center">
          <CheckmarkAnimation />
          <p className="text-[10px] tracking-[0.3em] uppercase font-bold mt-8 mb-3" style={{ color: GOLD }}>APPLICATION RECEIVED</p>
          <h1 className="text-3xl font-black mb-6" style={{ color: "#0a0a0a" }}>Your Application Is In, {form.first_name}.</h1>
          <div className="text-left rounded-xl p-6 mb-8" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "rgba(0,0,0,0.4)" }}>What happens next</p>
            <ol className="space-y-3 text-sm" style={{ color: "rgba(0,0,0,0.65)" }}>
              <li className="flex gap-3"><span className="font-black" style={{ color: GOLD }}>1.</span> We review your application within 24 hours.</li>
              <li className="flex gap-3"><span className="font-black" style={{ color: GOLD }}>2.</span> We build your free Nova Audit report.</li>
              <li className="flex gap-3"><span className="font-black" style={{ color: GOLD }}>3.</span> If a spot is open, Isaac reaches out directly to get you live in 14 days.</li>
            </ol>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="https://nova-systems.app" className="flex-1 inline-flex items-center justify-center px-6 py-3.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              Back to Nova Systems
            </a>
            <button onClick={shareWaves} className="flex-1 px-6 py-3.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all" style={{ border: "1px solid rgba(0,0,0,0.15)", color: "#0a0a0a", background: "#fff" }}>
              {copied ? "Link Copied!" : "Share Wave One"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen" style={{ background: "#fdfcfa" }}>
      <style>{`
        @keyframes wfStepIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={novaLogo} alt="Nova Systems" className="h-7 w-7 object-contain" />
          </Link>
          <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(0,0,0,0.4)" }}>Wave One Application</span>
        </div>
        <div style={{ height: 3, background: "rgba(0,0,0,0.06)" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: G, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-14">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase mb-2" style={{ color: GOLD }}>Step {step + 1} of {STEPS.length}</p>

        <div key={step} style={{ animation: "wfStepIn 0.35s ease-out" }}>

          {/* STEP 1 */}
          {step === 0 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-8" style={{ color: "#0a0a0a" }}>Let us know who you are.</h1>
              <div className="grid sm:grid-cols-2 gap-x-4">
                <Field label="First Name *"><input className={inputCls} style={inputStyle} value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Field>
                <Field label="Last Name *"><input className={inputCls} style={inputStyle} value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Field>
              </div>
              <Field label="Direct Mobile *"><input type="tel" className={inputCls} style={inputStyle} value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(203) 000-0000" /></Field>
              <Field label="Email Address *"><input type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@business.com" /></Field>
            </>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-8" style={{ color: "#0a0a0a" }}>Tell us about your business.</h1>
              <Field label="Company Name *"><input className={inputCls} style={inputStyle} value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} /></Field>
              <Field label="Website URL"><input className={inputCls} style={inputStyle} value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="yourwebsite.com or leave blank" /></Field>
              <div className="grid sm:grid-cols-2 gap-x-4">
                <Field label="City *">
                  <select className={inputCls} style={{ ...inputStyle, cursor: "pointer" }} value={form.city} onChange={(e) => set({ city: e.target.value })}>
                    <option value="">Select a city</option>
                    {CT_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Industry *">
                  <select className={inputCls} style={{ ...inputStyle, cursor: "pointer" }} value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                    <option value="">Select an industry</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-2" style={{ color: "#0a0a0a" }}>Where are you losing the most right now?</h1>
              <p className="text-sm mb-8" style={{ color: "rgba(0,0,0,0.45)" }}>Be honest. This shapes everything we build for you.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {PROBLEMS.map((p) => (
                  <SelectCard key={p.key} selected={form.biggest_problem === p.key} onClick={() => set({ biggest_problem: p.key })} Icon={p.Icon} title={p.key} desc={p.desc} />
                ))}
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 3 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-8" style={{ color: "#0a0a0a" }}>Help us understand your business size.</h1>
              <div className="grid sm:grid-cols-2 gap-3">
                {REVENUE_RANGES.map((r) => (
                  <SelectCard key={r} selected={form.revenue_range === r} onClick={() => set({ revenue_range: r })} title={r} />
                ))}
              </div>
            </>
          )}

          {/* STEP 5 */}
          {step === 4 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-2" style={{ color: "#0a0a0a" }}>Which engines matter most to you?</h1>
              <p className="text-sm mb-8" style={{ color: "rgba(0,0,0,0.45)" }}>Select all that apply.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {ENGINES.map((e) => {
                  const selected = form.priority_engines.includes(e.key);
                  return (
                    <button key={e.key} type="button" onClick={() => toggleEngine(e.key)} className="text-left p-5 rounded-xl transition-all flex gap-3"
                      style={{ border: `2px solid ${selected ? GOLD : "rgba(0,0,0,0.1)"}`, background: selected ? `${GOLD}0f` : "#fff" }}>
                      <e.Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: selected ? GOLD : "#999" }} />
                      <div>
                        <p className="text-sm font-bold mb-1" style={{ color: "#0a0a0a" }}>{e.key}</p>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.45)" }}>{e.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Field label="Additional Notes (optional)">
                <textarea rows={4} className={inputCls} style={{ ...inputStyle, resize: "none" }} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything else we should know?" />
              </Field>
            </>
          )}

          {/* STEP 6 */}
          {step === 5 && (
            <>
              <h1 className="text-2xl md:text-3xl font-black mb-8" style={{ color: "#0a0a0a" }}>Review your application.</h1>
              <div className="rounded-xl p-6 mb-6 text-sm" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}>
                {[
                  ["Name", `${form.first_name} ${form.last_name}`],
                  ["Mobile", form.phone],
                  ["Email", form.email],
                  ["Company", form.company_name],
                  ["Website", form.website || "—"],
                  ["City", form.city],
                  ["Industry", form.industry],
                  ["Biggest Problem", form.biggest_problem],
                  ["Revenue Range", form.revenue_range],
                  ["Priority Engines", form.priority_engines.join(", ") || "None selected"],
                  ["Notes", form.notes || "—"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-4 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <span style={{ color: "rgba(0,0,0,0.4)" }}>{label}</span>
                    <span className="text-right font-semibold" style={{ color: "#0a0a0a" }}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mb-8">
                {[
                  ["agree_spots", "I understand spots are limited and allocated first-come first-served."],
                  ["agree_audit", "I am requesting a free business audit and consultation. This is not a purchase commitment."],
                  ["agree_contact", "I agree to receive one SMS confirmation and one email with my audit report."],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: "rgba(0,0,0,0.65)" }}>
                    <input type="checkbox" checked={form[key]} onChange={(e) => set({ [key]: e.target.checked })} className="mt-0.5 w-4 h-4 flex-shrink-0" style={{ accentColor: GOLD }} />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {error && <p className="text-sm mt-6" style={{ color: "#dc2626" }}>{error}</p>}

        <div className="flex items-center justify-between mt-10">
          <button onClick={back} disabled={step === 0} className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all"
            style={{ color: step === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.6)", cursor: step === 0 ? "default" : "pointer" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={next} className="inline-flex items-center gap-2 px-8 py-3.5 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} className="inline-flex items-center justify-center gap-2 px-8 py-4 text-xs font-bold tracking-[0.1em] uppercase rounded-lg transition-all hover:opacity-85 w-full sm:w-auto"
              style={{ background: submitting ? "#e5ddc8" : G, color: "#0a0800" }}>
              {submitting ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" /> : "Submit My Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
