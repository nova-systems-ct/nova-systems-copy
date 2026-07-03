import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, AlertTriangle, Loader2, Pen, Globe2 } from "lucide-react";
import { generateContractPDF } from "@/utils/generatePdf";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

// ── Translations ──────────────────────────────────────────────────────────
const T = {
  en: {
    step: "Step", of: "of",
    steps: ["Business Info", "Choose Plan", "Website", "Social Media", "Additional Info", "Review & Sign"],
    back: "Back", next: "Continue", start: "Start",
    fullName: "Full Name", businessName: "Business Name", phone: "Phone", email: "Email",
    businessAddress: "Business Address", businessType: "Business Type", currentWebsite: "Current Website (if any)",
    referralSource: "How did you hear about Nova Systems?",
    choosePlan: "Choose Your Plan", included: "Included", addOns: "Add-Ons",
    addOnWarning: "Add-on — additional cost applies. Nova Systems will contact you with pricing.",
    pagesWanted: "Pages Wanted", businessDescription: "Business Description", stylePreference: "Preferred Style",
    brandColors: "Brand Colors", referenceSites: "Reference Websites", logoUpload: "Logo Upload",
    brandPhotos: "Brand Photos", platforms: "Platforms", handles: "Handles", passwords: "Passwords",
    contentVibe: "Content Vibe", postingFrequency: "Posting Frequency", notesForTeam: "Notes for Content Team",
    googleBusiness: "Google Business Credentials (optional)", currentTools: "Current Tools / Software",
    specialRequests: "Special Requests", preferredContact: "Preferred Contact Method", bestTime: "Best Time to Reach",
    reviewTitle: "Review, Sign & Pay", summary: "Summary", contract: "Service Agreement", signHere: "Sign Here",
    agree1: "I understand social media management begins once Nova Systems completes its hiring process.",
    agree2: "I agree to Nova Systems terms of service.",
    payButton: "Sign Contract and Pay First Month",
    clear: "Clear", drawSignature: "Draw your signature above",
    processing: "Processing…",
  },
  es: {
    step: "Paso", of: "de",
    steps: ["Información del Negocio", "Elegir Plan", "Sitio Web", "Redes Sociales", "Información Adicional", "Revisar y Firmar"],
    back: "Atrás", next: "Continuar", start: "Comenzar",
    fullName: "Nombre Completo", businessName: "Nombre del Negocio", phone: "Teléfono", email: "Correo Electrónico",
    businessAddress: "Dirección del Negocio", businessType: "Tipo de Negocio", currentWebsite: "Sitio Web Actual (si existe)",
    referralSource: "¿Cómo se enteró de Nova Systems?",
    choosePlan: "Elija Su Plan", included: "Incluido", addOns: "Complementos",
    addOnWarning: "Complemento — costo adicional aplica. Nova Systems le contactará con el precio.",
    pagesWanted: "Páginas Deseadas", businessDescription: "Descripción del Negocio", stylePreference: "Estilo Preferido",
    brandColors: "Colores de Marca", referenceSites: "Sitios de Referencia", logoUpload: "Subir Logo",
    brandPhotos: "Fotos de Marca", platforms: "Plataformas", handles: "Usuarios", passwords: "Contraseñas",
    contentVibe: "Estilo de Contenido", postingFrequency: "Frecuencia de Publicación", notesForTeam: "Notas para el Equipo",
    googleBusiness: "Credenciales de Google Business (opcional)", currentTools: "Herramientas Actuales",
    specialRequests: "Solicitudes Especiales", preferredContact: "Método de Contacto Preferido", bestTime: "Mejor Hora para Contactar",
    reviewTitle: "Revisar, Firmar y Pagar", summary: "Resumen", contract: "Acuerdo de Servicio", signHere: "Firme Aquí",
    agree1: "Entiendo que la gestión de redes sociales comienza una vez que Nova Systems complete su proceso de contratación.",
    agree2: "Acepto los términos de servicio de Nova Systems.",
    payButton: "Firmar Contrato y Pagar el Primer Mes",
    clear: "Borrar", drawSignature: "Dibuje su firma arriba",
    processing: "Procesando…",
  },
};

const BUSINESS_TYPES = [
  "Restaurant", "Barbershop / Salon", "Retail Store", "Jewelry Store", "Auto Shop / Repair",
  "Liquor Store", "Food Truck", "Print / Graphics Shop", "Convenience Store", "Medical / Dental",
  "Real Estate", "Home Services / Contractor", "Fitness / Gym", "Professional Services", "Other",
];

const REFERRAL_SOURCES = ["Referral", "Instagram", "TikTok", "LinkedIn", "Walk-in", "Other"];

const TIERS = [
  { id: "website", name: "Tier 1 — Website Only", price: 500, hasWebsite: true, hasSocial: false,
    services: ["Custom Website", "SEO Setup", "Hosting & Maintenance"] },
  { id: "social", name: "Tier 2 — Social Media Only", price: 1500, hasWebsite: false, hasSocial: true,
    services: ["Social Media Management", "Content Calendar", "Monthly Reporting"] },
  { id: "website-social", name: "Tier 3 — Website + Social Media", price: 2500, hasWebsite: true, hasSocial: true,
    services: ["Custom Website", "SEO Setup", "Social Media Management", "Content Calendar"] },
  { id: "full-ai", name: "Tier 4 — Full System + AI Agent", price: 3500, hasWebsite: true, hasSocial: true,
    services: ["Custom Website", "SEO Setup", "Social Media Management", "AI Phone Agent", "CRM & Lead Tracking"] },
  { id: "everything", name: "Tier 5 — Everything", price: 5000, hasWebsite: true, hasSocial: true,
    services: ["Custom Website", "SEO Setup", "Social Media Management", "AI Phone Agent", "CRM & Lead Tracking", "Content Creation", "Reputation Management", "Email & SMS Marketing"] },
  { id: "partner", name: "Partner Program", price: 1000, hasWebsite: false, hasSocial: false,
    services: ["Revenue Intelligence Dashboard", "Priority Support", "Quarterly Strategy Session"] },
];

const ADD_ONS = ["Drone Footage", "Vehicle Wrap Coordination", "Billboard & Signage", "Custom Apparel & Uniforms", "Business Cards & Print", "Booking & Scheduling System"];

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 13, background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = { display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 };

function Field({ label, children }) { return <div><label style={lbl}>{label}</label>{children}</div>; }

function SignaturePad({ onChange, t }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e) => { e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); drawing.current = true; setSigned(true); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = GOLD; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const stop = () => { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { canvasRef.current.getContext("2d").clearRect(0, 0, 600, 140); setSigned(false); onChange(""); };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={lbl}><Pen style={{ width: 10, height: 10, display: "inline", marginRight: 5 }} />{t.signHere}</label>
        {signed && <button type="button" onClick={clear} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>{t.clear}</button>}
      </div>
      <canvas ref={canvasRef} width={600} height={140}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        style={{ width: "100%", height: 140, display: "block", cursor: "crosshair", background: "rgba(255,255,255,0.03)", touchAction: "none", border: `1px solid ${signed ? GOLD + "60" : "rgba(255,255,255,0.12)"}`, borderRadius: 8 }} />
      {!signed && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>{t.drawSignature}</p>}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
}

export default function Welcome() {
  const navigate = useNavigate();
  const [lang, setLang] = useState("en");
  const t = T[lang];
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [savingIntake, setSavingIntake] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "", business_name: "", phone: "", email: "", business_address: "",
    business_type: "", current_website: "", referral_source: "",
    tier_id: "", add_ons: [],
    pages_wanted: [], business_description: "", style_preference: "", brand_colors: "", reference_sites: "",
    logo_file: null, brand_photos: [],
    platforms: [], handles: {}, social_passwords: {}, content_vibe: "", posting_frequency: "", team_notes: "",
    google_business_email: "", google_business_password: "", current_tools: "", special_requests: "",
    preferred_contact: [], best_time: "",
    signature: "",
    agree1: false, agree2: false,
  });

  const tier = TIERS.find((x) => x.id === form.tier_id);
  const totalSteps = 6;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleArr = (k, val) => setForm((f) => ({ ...f, [k]: f[k].includes(val) ? f[k].filter((v) => v !== val) : [...f[k], val] }));

  const canNext = () => {
    if (step === 1) return form.full_name && form.business_name && form.phone && form.email && form.business_type;
    if (step === 2) return !!form.tier_id;
    if (step === 6) return form.signature && form.agree1 && form.agree2;
    return true;
  };

  const skipWebsite = tier && !tier.hasWebsite;
  const skipSocial = tier && !tier.hasSocial;

  const goNext = () => {
    let n = step + 1;
    if (n === 3 && skipWebsite) n++;
    if (n === 4 && skipSocial) n++;
    setStep(Math.min(n, totalSteps));
  };
  const goBack = () => {
    let n = step - 1;
    if (n === 4 && skipSocial) n--;
    if (n === 3 && skipWebsite) n--;
    setStep(Math.max(n, 1));
  };

  const saveIntakeAndGetPaymentIntent = async () => {
    setSavingIntake(true);
    setError("");
    try {
      const saveRes = await fetch("/api/intake?action=save-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId, full_name: form.full_name, business_name: form.business_name,
          phone: form.phone, email: form.email, business_address: form.business_address,
          business_type: form.business_type, current_website: form.current_website,
          referral_source: form.referral_source, tier_name: tier?.name, tier_price: tier?.price,
          signature_data_url: form.signature, language: lang,
          intake_data: { add_ons: form.add_ons, pages_wanted: form.pages_wanted, business_description: form.business_description,
            style_preference: form.style_preference, brand_colors: form.brand_colors, reference_sites: form.reference_sites,
            platforms: form.platforms, handles: form.handles, content_vibe: form.content_vibe,
            posting_frequency: form.posting_frequency, team_notes: form.team_notes, current_tools: form.current_tools,
            special_requests: form.special_requests, preferred_contact: form.preferred_contact, best_time: form.best_time },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save your information");
      setClientId(saveData.client_id);

      const piRes = await fetch("/api/stripe?action=payment-intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: tier.price, client_email: form.email, tier_name: tier.name, client_id: saveData.client_id }),
      });
      const piData = await piRes.json();
      if (!piRes.ok) throw new Error(piData.error || "Payment is not available right now");
      setClientSecret(piData.client_secret);
    } catch (e) {
      setError(e.message);
    }
    setSavingIntake(false);
  };

  const handlePaymentSuccess = async () => {
    try {
      const doc = generateContractPDF({
        clientName: form.full_name, businessName: form.business_name, tierName: tier.name,
        tierPrice: tier.price, includedServices: tier.services, signatureDataUrl: form.signature,
        date: new Date().toLocaleDateString(),
      });
      const contract_pdf_base64 = doc.output("datauristring");

      await fetch("/api/intake?action=welcome-complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId, full_name: form.full_name, business_name: form.business_name,
          email: form.email, phone: form.phone, tier_name: tier.name, tier_price: tier.price,
          contract_pdf_base64,
        }),
      });
    } catch {}
    navigate(`/welcome/success?client_id=${clientId}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 0", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: "0.2em" }}>NOVA SYSTEMS</span>
          </div>
          <button onClick={() => setLang(lang === "en" ? "es" : "en")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Globe2 style={{ width: 13, height: 13 }} /> {lang === "en" ? "ES" : "EN"}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{t.step} {step} {t.of} {totalSteps}</span>
          <span style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>{t.steps[step - 1]}</span>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 36 }}>
          <div style={{ height: "100%", width: `${(step / totalSteps) * 100}%`, background: G, transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 100px" }}>
        {step === 1 && <Step1 form={form} setForm={setForm} set={set} t={t} />}
        {step === 2 && <Step2 form={form} setForm={setForm} toggleArr={toggleArr} t={t} />}
        {step === 3 && !skipWebsite && <Step3 form={form} setForm={setForm} toggleArr={toggleArr} set={set} t={t} />}
        {step === 4 && !skipSocial && <Step4 form={form} setForm={setForm} toggleArr={toggleArr} set={set} t={t} />}
        {step === 5 && <Step5 form={form} setForm={setForm} toggleArr={toggleArr} set={set} t={t} />}
        {step === 6 && (
          <Step6
            form={form} setForm={setForm} t={t} tier={tier}
            clientSecret={clientSecret} savingIntake={savingIntake} error={error}
            onStartPayment={saveIntakeAndGetPaymentIntent}
            onPaymentSuccess={handlePaymentSuccess}
          />
        )}

        {/* Nav buttons (hidden once payment form is mounted) */}
        {!(step === 6 && clientSecret) && (
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            {step > 1 && (
              <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 22px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <ChevronLeft style={{ width: 14, height: 14 }} /> {t.back}
              </button>
            )}
            {step < totalSteps && (
              <button onClick={goNext} disabled={!canNext()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 22px", background: canNext() ? G : "rgba(255,255,255,0.06)", border: "none", borderRadius: 9, color: canNext() ? "#0a0800" : "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 700, cursor: canNext() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {t.next} <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            )}
            {step === totalSteps && !clientSecret && (
              <button onClick={saveIntakeAndGetPaymentIntent} disabled={!canNext() || savingIntake} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px 22px", background: canNext() ? G : "rgba(255,255,255,0.06)", border: "none", borderRadius: 9, color: canNext() ? "#0a0800" : "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 700, cursor: canNext() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {savingIntake ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : <>{t.payButton} — ${tier?.price}</>}
              </button>
            )}
          </div>
        )}
        {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Step 1 ──────────────────────────────────────────────────────────────
function Step1({ form, set, t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t.fullName}><input value={form.full_name} onChange={set("full_name")} style={inp} /></Field>
        <Field label={t.businessName}><input value={form.business_name} onChange={set("business_name")} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t.phone}><input value={form.phone} onChange={set("phone")} style={inp} /></Field>
        <Field label={t.email}><input type="email" value={form.email} onChange={set("email")} style={inp} /></Field>
      </div>
      <Field label={t.businessAddress}><input value={form.business_address} onChange={set("business_address")} style={inp} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t.businessType}>
          <select value={form.business_type} onChange={set("business_type")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
            <option value="" style={{ background: "#111" }}>—</option>
            {BUSINESS_TYPES.map((b) => <option key={b} value={b} style={{ background: "#111" }}>{b}</option>)}
          </select>
        </Field>
        <Field label={t.referralSource}>
          <select value={form.referral_source} onChange={set("referral_source")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
            <option value="" style={{ background: "#111" }}>—</option>
            {REFERRAL_SOURCES.map((r) => <option key={r} value={r} style={{ background: "#111" }}>{r}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t.currentWebsite}><input value={form.current_website} onChange={set("current_website")} style={inp} /></Field>
    </div>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────
function Step2({ form, setForm, toggleArr, t }) {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>{t.choosePlan}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
        {TIERS.map((tier) => {
          const selected = form.tier_id === tier.id;
          return (
            <div key={tier.id} onClick={() => setForm((f) => ({ ...f, tier_id: tier.id }))}
              style={{ padding: 20, borderRadius: 12, cursor: "pointer", background: selected ? `${GOLD}12` : "rgba(255,255,255,0.025)", border: `1.5px solid ${selected ? GOLD : "rgba(255,255,255,0.08)"}`, transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: selected ? GOLD : "#fff" }}>{tier.name}</p>
                {selected && <Check style={{ width: 16, height: 16, color: GOLD }} />}
              </div>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10 }}>${tier.price}<span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>/mo</span></p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{t.included}</p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tier.services.map((s) => <li key={s} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>• {s}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>{t.addOns}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ADD_ONS.map((a) => {
          const checked = form.add_ons.includes(a);
          return (
            <button key={a} type="button" onClick={() => toggleArr("add_ons", a)}
              style={{ padding: "9px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: checked ? `${GOLD}18` : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.1)"}`, color: checked ? GOLD : "rgba(255,255,255,0.5)" }}>
              {a}
            </button>
          );
        })}
      </div>
      {form.add_ons.length > 0 && (
        <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 8, background: "rgba(212,160,48,0.08)", border: `1px solid ${GOLD}35`, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle style={{ width: 14, height: 14, color: GOLD, flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: GOLD, lineHeight: 1.6 }}>{t.addOnWarning}</p>
        </div>
      )}
    </div>
  );
}

// ── Step 3 — Website ─────────────────────────────────────────────────────
const PAGE_OPTIONS = ["Home", "About", "Services", "Menu", "Gallery", "Contact", "Booking", "Online Ordering", "Online Payment", "Other"];
const STYLE_OPTIONS = ["Modern/Luxury", "Bold/Energetic", "Clean/Minimal", "Traditional"];

function Step3({ form, setForm, toggleArr, set, t }) {
  const handleLogo = async (e) => { const f = e.target.files?.[0]; if (f && f.size < 3 * 1024 * 1024) { const encoded = await fileToBase64(f); setForm((s) => ({ ...s, logo_file: encoded })); } };
  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const encoded = await Promise.all(files.filter((f) => f.size < 3 * 1024 * 1024).map(fileToBase64));
    setForm((s) => ({ ...s, brand_photos: encoded }));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={lbl}>{t.pagesWanted}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PAGE_OPTIONS.map((p) => {
            const checked = form.pages_wanted.includes(p);
            return <button key={p} type="button" onClick={() => toggleArr("pages_wanted", p)} style={{ padding: "8px 13px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: checked ? `${GOLD}18` : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.1)"}`, color: checked ? GOLD : "rgba(255,255,255,0.5)" }}>{p}</button>;
          })}
        </div>
      </div>
      <Field label={t.businessDescription}><textarea rows={3} value={form.business_description} onChange={set("business_description")} style={{ ...inp, resize: "none" }} /></Field>
      <Field label={t.stylePreference}>
        <select value={form.style_preference} onChange={set("style_preference")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
          <option value="" style={{ background: "#111" }}>—</option>
          {STYLE_OPTIONS.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t.brandColors}><input value={form.brand_colors} onChange={set("brand_colors")} style={inp} placeholder="Gold, black, navy…" /></Field>
        <Field label={t.referenceSites}><input value={form.reference_sites} onChange={set("reference_sites")} style={inp} placeholder="https://…" /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t.logoUpload}>
          <input type="file" accept="image/*" onChange={handleLogo} style={inp} />
        </Field>
        <Field label={t.brandPhotos}>
          <input type="file" accept="image/*" multiple onChange={handlePhotos} style={inp} />
        </Field>
      </div>
    </div>
  );
}

// ── Step 4 — Social ──────────────────────────────────────────────────────
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "YouTube"];
const VIBES = ["Professional", "Fun/Energetic", "Luxury", "Street/Urban", "Family-Friendly"];
const FREQUENCIES = ["Daily", "3x/week", "Weekly"];

function Step4({ form, setForm, toggleArr, set, t }) {
  const [showPw, setShowPw] = useState({});
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={lbl}>{t.platforms}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLATFORMS.map((p) => {
            const checked = form.platforms.includes(p);
            return <button key={p} type="button" onClick={() => toggleArr("platforms", p)} style={{ padding: "8px 13px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: checked ? `${GOLD}18` : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.1)"}`, color: checked ? GOLD : "rgba(255,255,255,0.5)" }}>{p}</button>;
          })}
        </div>
      </div>
      {form.platforms.map((p) => (
        <div key={p} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={`${p} ${t.handles}`}>
            <input value={form.handles[p] || ""} onChange={(e) => setForm((f) => ({ ...f, handles: { ...f.handles, [p]: e.target.value } }))} style={inp} placeholder="@handle" />
          </Field>
          <Field label={`${p} ${t.passwords}`}>
            <div style={{ position: "relative" }}>
              <input type={showPw[p] ? "text" : "password"} value={form.social_passwords[p] || ""} onChange={(e) => setForm((f) => ({ ...f, social_passwords: { ...f.social_passwords, [p]: e.target.value } }))} style={{ ...inp, paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw((s) => ({ ...s, [p]: !s[p] }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)" }}>
                {showPw[p] ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </Field>
        </div>
      ))}
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Passwords are stored securely and only used to manage your accounts.</p>
      <Field label={t.contentVibe}>
        <select value={form.content_vibe} onChange={set("content_vibe")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
          <option value="" style={{ background: "#111" }}>—</option>
          {VIBES.map((v) => <option key={v} value={v} style={{ background: "#111" }}>{v}</option>)}
        </select>
      </Field>
      <Field label={t.postingFrequency}>
        <select value={form.posting_frequency} onChange={set("posting_frequency")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
          <option value="" style={{ background: "#111" }}>—</option>
          {FREQUENCIES.map((f) => <option key={f} value={f} style={{ background: "#111" }}>{f}</option>)}
        </select>
      </Field>
      <Field label={t.notesForTeam}><textarea rows={3} value={form.team_notes} onChange={set("team_notes")} style={{ ...inp, resize: "none" }} /></Field>
    </div>
  );
}

// ── Step 5 — Additional ──────────────────────────────────────────────────
const CONTACT_METHODS = ["Phone", "Text", "Email", "WhatsApp"];
const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"];

function Step5({ form, toggleArr, set, t }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{t.googleBusiness}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <input value={form.google_business_email} onChange={set("google_business_email")} style={inp} placeholder="Email" />
        <div style={{ position: "relative" }}>
          <input type={showPw ? "text" : "password"} value={form.google_business_password} onChange={set("google_business_password")} style={{ ...inp, paddingRight: 40 }} placeholder="Password" />
          <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)" }}>
            {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
          </button>
        </div>
      </div>
      <Field label={t.currentTools}><input value={form.current_tools} onChange={set("current_tools")} style={inp} /></Field>
      <Field label={t.specialRequests}><textarea rows={3} value={form.special_requests} onChange={set("special_requests")} style={{ ...inp, resize: "none" }} /></Field>
      <div>
        <label style={lbl}>{t.preferredContact}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CONTACT_METHODS.map((c) => {
            const checked = form.preferred_contact.includes(c);
            return <button key={c} type="button" onClick={() => toggleArr("preferred_contact", c)} style={{ padding: "8px 13px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: checked ? `${GOLD}18` : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.1)"}`, color: checked ? GOLD : "rgba(255,255,255,0.5)" }}>{c}</button>;
          })}
        </div>
      </div>
      <Field label={t.bestTime}>
        <select value={form.best_time} onChange={set("best_time")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
          <option value="" style={{ background: "#111" }}>—</option>
          {BEST_TIMES.map((b) => <option key={b} value={b} style={{ background: "#111" }}>{b}</option>)}
        </select>
      </Field>
    </div>
  );
}

// ── Step 6 — Review, Sign, Pay ───────────────────────────────────────────
function Step6({ form, setForm, t, tier, clientSecret, onPaymentSuccess }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800 }}>{t.reviewTitle}</h2>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 22 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>{t.summary}</p>
        {[["Name", form.full_name], ["Business", form.business_name], ["Email", form.email], ["Phone", form.phone], ["Plan", tier?.name], ["Price", tier ? `$${tier.price}/mo` : ""]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{k}</span>
            <span style={{ fontSize: 12, color: "#fff" }}>{v || "—"}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 22, maxHeight: 220, overflowY: "auto" }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>{t.contract}</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>
          This agreement is entered into between Nova Systems ("Provider") and {form.business_name || form.full_name} ("Client") for the {tier?.name} plan at ${tier?.price}/month.
          Included services: {tier?.services.join(", ")}. Payment is billed monthly. Either party may cancel with 30 days written notice.
          Services not listed above are out of scope and billed separately. Client owns final deliverables upon full payment. Applicable CT sales tax applies where required by law.
        </p>
      </div>

      <SignaturePad t={t} onChange={(sig) => setForm((f) => ({ ...f, signature: sig }))} />

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={form.agree1} onChange={(e) => setForm((f) => ({ ...f, agree1: e.target.checked }))} style={{ marginTop: 3 }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{t.agree1}</span>
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={form.agree2} onChange={(e) => setForm((f) => ({ ...f, agree2: e.target.checked }))} style={{ marginTop: 3 }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{t.agree2}</span>
      </label>

      {clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: GOLD, colorBackground: "#141210", colorText: "#fff", borderRadius: "8px" } } }}>
          <PaymentForm t={t} amount={tier?.price} onSuccess={onPaymentSuccess} />
        </Elements>
      )}
      {clientSecret && !stripePromise && (
        <p style={{ color: "#f87171", fontSize: 12 }}>Stripe is not configured (missing VITE_STRIPE_PUBLISHABLE_KEY) — payment cannot be completed yet.</p>
      )}
    </div>
  );
}

function PaymentForm({ t, amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErr("");
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      await onSuccess();
    } else {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PaymentElement />
      {err && <p style={{ color: "#f87171", fontSize: 12 }}>{err}</p>}
      <button type="submit" disabled={!stripe || loading} style={{ padding: 15, background: G, border: "none", borderRadius: 9, color: "#0a0800", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> {t.processing}</> : <>{t.payButton} — ${amount}</>}
      </button>
    </form>
  );
}
