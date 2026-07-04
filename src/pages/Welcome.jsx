import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_DARK = "#8a6200";
const GOLD_BRIGHT = "#C8921A";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const BUSINESS_TYPES = [
  "Restaurant", "Barbershop/Salon", "Retail Store", "Jewelry Store", "Auto Shop",
  "Liquor Store", "Food Truck", "Print/Graphics Shop", "Convenience Store",
  "Medical/Dental Office", "Law/Finance", "Real Estate", "Contractor/Trade",
  "E-Commerce", "Agency/Consultant", "Other",
];

const NEEDS = [
  "Website", "Social Media", "AI Phone System", "Branding & Identity",
  "CRM & Lead Tracking", "Email Marketing", "Video & Content Creation",
  "Drone Footage", "Signage & Uniforms", "Full Business System", "Not Sure Yet",
];

const REFERRAL_SOURCES = ["Google Search", "Instagram", "TikTok", "LinkedIn", "Referral from someone", "Walk-in", "Other"];

const TIME_SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];

const T = {
  en: {
    tellUs: "Tell Us About Your Business",
    fullName: "Full Name", fullNamePh: "Your full name",
    businessName: "Business Name", businessNamePh: "Your business name",
    phone: "Phone Number", phonePh: "(203) 000-0000",
    email: "Email Address", emailPh: "your@email.com",
    businessType: "Business Type", businessTypePh: "Select your business type",
    needs: "What do you need help with", notes: "Tell us about your business and goals",
    notesPh: "Describe your business, your biggest challenges, and what you are hoping to achieve. The more detail the better.",
    referral: "How did you hear about Nova Systems", referralPh: "Select an option",
    pickDateTime: "Pick a Date & Time",
    pickSubtitle: "Free 30-minute strategy meeting. No obligation. No pressure.",
    selectTime: "Select a Time",
    summary: "Meeting Summary", date: "Date", time: "Time",
    submit: "Schedule My Free Strategy Meeting",
    submitting: "Booking your meeting...",
    required: "This field is required.",
    needDateTime: "Please select a date and time for your meeting.",
    successTitle: "Your Meeting Is Booked!",
    successCheck: "Check your email for confirmation details. We look forward to speaking with you.",
    returnHome: "Return to nova-systems.app",
  },
  es: {
    tellUs: "Cuéntanos Sobre Tu Negocio",
    fullName: "Nombre Completo", fullNamePh: "Tu nombre completo",
    businessName: "Nombre del Negocio", businessNamePh: "Nombre de tu negocio",
    phone: "Número de Teléfono", phonePh: "(203) 000-0000",
    email: "Correo Electrónico", emailPh: "tu@correo.com",
    businessType: "Tipo de Negocio", businessTypePh: "Selecciona tu tipo de negocio",
    needs: "¿Con qué necesitas ayuda?", notes: "Cuéntanos sobre tu negocio y tus metas",
    notesPh: "Describe tu negocio, tus mayores desafíos y lo que esperas lograr. Cuantos más detalles, mejor.",
    referral: "¿Cómo te enteraste de Nova Systems?", referralPh: "Selecciona una opción",
    pickDateTime: "Elige Fecha y Hora",
    pickSubtitle: "Reunión de estrategia gratuita de 30 minutos. Sin obligación. Sin presión.",
    selectTime: "Selecciona una Hora",
    summary: "Resumen de la Reunión", date: "Fecha", time: "Hora",
    submit: "Agendar Mi Reunión de Estrategia Gratuita",
    submitting: "Agendando tu reunión...",
    required: "Este campo es obligatorio.",
    needDateTime: "Por favor selecciona una fecha y hora para tu reunión.",
    successTitle: "¡Tu Reunión Está Agendada!",
    successCheck: "Revisa tu correo electrónico para los detalles de confirmación. Esperamos hablar contigo pronto.",
    returnHome: "Volver a nova-systems.app",
  },
};

const MONTH_NAMES = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
};
const DAY_NAMES = {
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  es: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
};

function isPast(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return date < today;
}
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}
function sameDate(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "#fff", border: "1px solid #e0ddd5", borderRadius: 8,
  color: "#111", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "#555", marginBottom: 8,
};

function Field({ label, error, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
      {error && <p style={{ color: "#c0392b", fontSize: 11, marginTop: 5 }}>{error}</p>}
    </div>
  );
}

export default function Welcome() {
  const [lang, setLang] = useState("en");
  const t = T[lang];

  const [form, setForm] = useState({
    full_name: "", business_name: "", phone: "", email: "", business_type: "",
    needs: [], notes: "", referral_source: "",
  });
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useSEO({
    title: "Schedule a Strategy Meeting — Nova Systems",
    description: "Tell us what your business needs and book a free strategy meeting with Nova Systems — Waterbury, Connecticut's AI and technology agency.",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleNeed = (need) => setForm((f) => ({
    ...f, needs: f.needs.includes(need) ? f.needs.filter((n) => n !== need) : [...f.needs, need],
  }));

  const canSubmit = form.full_name && form.business_name && form.phone && form.email && form.business_type && selectedDate && selectedTime;

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = firstDay.getDay();
    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMonth]);

  const changeMonth = (delta) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name) errs.full_name = t.required;
    if (!form.business_name) errs.business_name = t.required;
    if (!form.phone) errs.phone = t.required;
    if (!form.email) errs.email = t.required;
    if (!form.business_type) errs.business_type = t.required;
    if (!selectedDate || !selectedTime) errs.meeting = t.needDateTime;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const meeting_date = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    try {
      await fetch("/api/book-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.full_name,
          business_name: form.business_name,
          phone: form.phone,
          email: form.email,
          business_type: form.business_type,
          needs: form.needs,
          notes: form.notes,
          referral_source: form.referral_source,
          meeting_date,
          meeting_time: selectedTime,
        }),
      });
    } catch (err) {
      console.error("[Welcome] Network error:", err.message);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    const meeting_date = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return (
      <div className="min-h-screen" style={{ background: "#fff" }}>
        <Navbar />
        <div className="flex items-center justify-center px-6 pt-16" style={{ minHeight: "100vh" }}>
          <div className="max-w-md w-full text-center">
            <CheckmarkAnimation />
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#0a0a0a", marginTop: 24, marginBottom: 14 }}>{t.successTitle}</h1>
            <p style={{ color: GOLD, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{meeting_date}</p>
            <p style={{ color: GOLD, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{selectedTime}</p>
            <p style={{ color: "#333", fontSize: 14, marginBottom: 4 }}>{form.full_name}</p>
            <p style={{ color: "#777", fontSize: 13, marginBottom: 28 }}>{form.email}</p>
            <p style={{ color: "#777", fontSize: 13, lineHeight: 1.7, marginBottom: 32 }}>{t.successCheck}</p>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              {t.returnHome} <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <Navbar />
      <div className="px-6 pt-16 pb-14" style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Language toggle */}
        <div className="flex justify-end mb-8">
          <div style={{ display: "inline-flex", border: `1px solid ${GOLD}`, borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setLang("en")} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", border: "none", background: lang === "en" ? GOLD : "#fff", color: lang === "en" ? "#0a0800" : "#555" }}>EN</button>
            <button onClick={() => setLang("es")} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", border: "none", background: lang === "es" ? GOLD : "#fff", color: lang === "es" ? "#0a0800" : "#555" }}>ES</button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-[55%_45%] gap-10">

            {/* LEFT — form fields */}
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0a0a0a", marginBottom: 24 }}>{t.tellUs}</h2>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <Field label={`${t.fullName} *`} error={errors.full_name}>
                  <input required value={form.full_name} onChange={set("full_name")} placeholder={t.fullNamePh} style={inp} />
                </Field>
                <Field label={`${t.businessName} *`} error={errors.business_name}>
                  <input required value={form.business_name} onChange={set("business_name")} placeholder={t.businessNamePh} style={inp} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <Field label={`${t.phone} *`} error={errors.phone}>
                  <input required type="tel" value={form.phone} onChange={set("phone")} placeholder={t.phonePh} style={inp} />
                </Field>
                <Field label={`${t.email} *`} error={errors.email}>
                  <input required type="email" value={form.email} onChange={set("email")} placeholder={t.emailPh} style={inp} />
                </Field>
              </div>

              <div className="mb-5">
                <Field label={`${t.businessType} *`} error={errors.business_type}>
                  <select required value={form.business_type} onChange={set("business_type")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                    <option value="">{t.businessTypePh}</option>
                    {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
              </div>

              <div className="mb-5">
                <label style={lbl}>{t.needs}</label>
                <div className="grid grid-cols-2 gap-2">
                  {NEEDS.map((need) => {
                    const active = form.needs.includes(need);
                    return (
                      <button key={need} type="button" onClick={() => toggleNeed(need)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12,
                          borderRadius: 7, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          background: active ? `${GOLD}15` : "#fff",
                          border: `1px solid ${active ? GOLD : "#e0ddd5"}`, color: "#222",
                        }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: active ? GOLD : "#fff", border: `1px solid ${active ? GOLD : "#ccc"}`,
                        }}>
                          {active && <Check style={{ width: 11, height: 11, color: "#0a0800" }} />}
                        </span>
                        {need}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <Field label={t.notes}>
                  <textarea rows={4} value={form.notes} onChange={set("notes")} placeholder={t.notesPh} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
                </Field>
              </div>

              <Field label={t.referral}>
                <select value={form.referral_source} onChange={set("referral_source")} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                  <option value="">{t.referralPh}</option>
                  {REFERRAL_SOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            {/* RIGHT — calendar + time slots */}
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0a0a0a", marginBottom: 6 }}>{t.pickDateTime}</h2>
              <p style={{ color: "#777", fontSize: 13, marginBottom: 20 }}>{t.pickSubtitle}</p>

              <div style={{ border: "1px solid #e0ddd5", borderRadius: 12, padding: 20 }}>
                <div className="flex items-center justify-between mb-4">
                  <button type="button" onClick={() => changeMonth(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                    <ChevronLeft style={{ width: 18, height: 18, color: "#555" }} />
                  </button>
                  <p style={{ fontWeight: 800, fontSize: 14, color: "#0a0a0a" }}>
                    {MONTH_NAMES[lang][viewMonth.getMonth()]} {viewMonth.getFullYear()}
                  </p>
                  <button type="button" onClick={() => changeMonth(1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                    <ChevronRight style={{ width: 18, height: 18, color: "#555" }} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_NAMES[lang].map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#999", padding: "4px 0" }}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((date, i) => {
                    if (!date) return <div key={i} />;
                    const disabled = isPast(date) || isWeekend(date);
                    const selected = sameDate(date, selectedDate);
                    return (
                      <button key={i} type="button" disabled={disabled}
                        onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                        style={{
                          aspectRatio: "1", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
                          background: selected ? GOLD : "#fff",
                          color: disabled ? "#ccc" : selected ? "#0a0800" : "#222",
                          border: `1px solid ${selected ? GOLD : "#e8e5dd"}`,
                          transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = GOLD; }}
                        onMouseLeave={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = "#e8e5dd"; }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDate && (
                <div className="mt-6">
                  <p style={lbl}>{t.selectTime}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button key={slot} type="button" onClick={() => setSelectedTime(slot)}
                        style={{
                          padding: "10px 6px", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                          background: selectedTime === slot ? GOLD : "#fff",
                          color: selectedTime === slot ? "#0a0800" : "#333",
                          border: `1px solid ${selectedTime === slot ? GOLD : "#e0ddd5"}`,
                        }}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedDate && selectedTime && (
                <div className="mt-6" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}35`, borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", marginBottom: 8 }}>{t.summary}</p>
                  <p style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>
                    {t.date}: {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <p style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{t.time}: {selectedTime}</p>
                </div>
              )}

              {errors.meeting && <p style={{ color: "#c0392b", fontSize: 12, marginTop: 12 }}>{errors.meeting}</p>}
            </div>
          </div>

          {/* Submit — full width */}
          <div className="mt-10">
            <button type="submit" disabled={loading}
              style={{
                width: "100%", padding: "20px", fontSize: 13, fontWeight: 800,
                letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
                cursor: (!canSubmit || loading) ? "not-allowed" : "pointer",
                background: loading ? "#eee" : G,
                opacity: !canSubmit && !loading ? 0.55 : 1,
                color: "#0a0800",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s", fontFamily: "inherit",
              }}>
              {loading
                ? <>{t.submitting}</>
                : <><span>{t.submit}</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
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
