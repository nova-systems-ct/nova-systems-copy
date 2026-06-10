import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, ArrowRight, Info } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const POSITIONS = [
  { id: "videographer",   label: "Lead Videographer / Content Creator",       open: true },
  { id: "social-media",   label: "Social Media Manager",                       open: true },
  { id: "ambassador",     label: "Brand Ambassador / Sales Representative",    open: true },
  { id: "drone",          label: "Drone Operator / Aerial Cinematographer",    open: true },
  { id: "web-dev",        label: "Web Developer Intern",                       open: false },
  { id: "graphic-designer", label: "Graphic Designer",                         open: false },
  { id: "client-success", label: "Client Success Coordinator",                 open: false },
];

const EDITING_SOFTWARE = ["Adobe Premiere Pro", "Final Cut Pro", "CapCut", "DaVinci Resolve", "iMovie", "Other"];

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
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

function YesNo({ value, onChange }) {
  return (
    <div className="flex gap-3">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt.toLowerCase())}
          className="px-6 py-3 text-xs font-semibold tracking-wider uppercase transition-all duration-150 rounded-lg"
          style={{
            background: value === opt.toLowerCase() ? `${GOLD}20` : "rgba(255,255,255,0.03)",
            border: `1px solid ${value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.1)"}`,
            color: value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.4)",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function ApplicationForm({ preselectedPosition }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", position: preselectedPosition || "",
    canRecord: "", ownsCamera: "", hasDrone: "",
    hasEditingExp: "", editingSoftware: "",
    portfolioUrl: "", resumeFile: null, resumeName: "",
    experience: "", education: "", whyNova: "",
    availability: "", expectedPay: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Update position if parent changes preselectedPosition
  useEffect(() => {
    if (preselectedPosition) {
      setForm((f) => ({ ...f, position: preselectedPosition }));
    }
  }, [preselectedPosition]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setForm((f) => ({ ...f, resumeFile: file, resumeName: file.name }));
  };

  const selectedPosition = POSITIONS.find((p) => p.id === form.position);
  const isFilled = selectedPosition && !selectedPosition.open;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Save to localStorage for Dashboard
    try {
      const existing = JSON.parse(localStorage.getItem("nova_applications") || "[]");
      existing.unshift({
        id: Date.now().toString(),
        name: form.name, email: form.email, phone: form.phone,
        position: selectedPosition?.label || form.position,
        canRecord: form.canRecord, ownsCamera: form.ownsCamera,
        hasDrone: form.hasDrone, hasEditingExp: form.hasEditingExp,
        editingSoftware: form.editingSoftware, portfolioUrl: form.portfolioUrl,
        resumeName: form.resumeName, experience: form.experience,
        education: form.education, whyNova: form.whyNova,
        availability: form.availability, expectedPay: form.expectedPay,
        filledPosition: isFilled,
        status: "new", submittedAt: new Date().toISOString(),
      });
      localStorage.setItem("nova_applications", JSON.stringify(existing));
    } catch {}

    const posLabel = selectedPosition?.label || form.position;
    const body = `
NEW JOB APPLICATION — Nova Systems

POSITION: ${posLabel}${isFilled ? " (FILLED — future consideration)" : ""}

APPLICANT:
Name: ${form.name}
Email: ${form.email}
Phone: ${form.phone}

VIDEO & EQUIPMENT:
Can record video: ${form.canRecord}
Owns camera / 1080p phone: ${form.ownsCamera}
Has drone: ${form.hasDrone}
Video editing experience: ${form.hasEditingExp}${form.hasEditingExp === "yes" ? ` (${form.editingSoftware})` : ""}

Portfolio: ${form.portfolioUrl || "Not provided"}
Resume: ${form.resumeName || "Not attached"}

BACKGROUND:
Previous Experience:
${form.experience}

Education:
${form.education}

Why Nova Systems:
${form.whyNova}

Availability: ${form.availability}
Expected Pay Per Deliverable: ${form.expectedPay}
    `.trim();

    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "Isaac_0427@icloud.com",
          replyTo: form.email,
          subject: `Job Application: ${posLabel} — ${form.name}`,
          body,
          confirmTo: form.email,
          confirmName: form.name,
        }),
      });
    } catch {
      const encoded = encodeURIComponent(body);
      window.open(
        `mailto:Isaac_0427@icloud.com?subject=${encodeURIComponent(`Job Application: ${posLabel} — ${form.name}`)}&body=${encoded}`,
        "_blank"
      );
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <section id="apply" className="py-24 px-6 bg-black">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>APPLICATION RECEIVED</p>
          <h2 className="text-3xl font-black text-white mb-4">You're in the pipeline.</h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Isaac will personally review your application and reach out within a few days. Make sure to check your inbox.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="apply" className="py-16 md:py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>APPLY NOW</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
            Ready to Build With Us?
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Fill out the form below. Isaac reviews every application personally. Be real, be specific.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-8 space-y-7"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Full Name *">
              <input required placeholder="Jane Smith" value={form.name} onChange={set("name")}
                style={inputStyle} onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Phone *">
              <input required type="tel" placeholder="+1 (860) 000-0000" value={form.phone} onChange={set("phone")}
                style={inputStyle} onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <Field label="Email Address *">
            <input required type="email" placeholder="jane@email.com" value={form.email} onChange={set("email")}
              style={inputStyle} onFocus={focus} onBlur={blur} />
          </Field>

          {/* Position dropdown */}
          <Field label="Position Applying For *">
            <select required value={form.position} onChange={set("position")}
              style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select a position</option>
              <optgroup label="Open Positions" style={{ background: "#111", color: GOLD }}>
                {POSITIONS.filter((p) => p.open).map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#111" }}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Filled Positions" style={{ background: "#111", color: "rgba(255,255,255,0.4)" }}>
                {POSITIONS.filter((p) => !p.open).map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#111", color: "rgba(255,255,255,0.5)" }}>{p.label} — FILLED</option>
                ))}
              </optgroup>
            </select>

            {/* Filled position notice */}
            {isFilled && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg p-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  This position is filled. Submit anyway to be considered for future openings.
                </p>
              </div>
            )}
          </Field>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Equipment questions */}
          <Field label="Can you record video? *">
            <YesNo value={form.canRecord} onChange={setVal("canRecord")} />
            {form.canRecord === "no" && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg p-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-400">This role requires video capability. All positions involve filming content.</p>
              </div>
            )}
          </Field>

          <Field label="Do you own a camera or 1080p-capable phone? *">
            <YesNo value={form.ownsCamera} onChange={setVal("ownsCamera")} />
          </Field>

          <Field label="Do you have a drone?">
            <YesNo value={form.hasDrone} onChange={setVal("hasDrone")} />
            {form.hasDrone === "yes" && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg p-3"
                style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}>
                <span className="text-[13px]">★</span>
                <p className="text-xs font-semibold" style={{ color: GOLD }}>Drone operators are highly valued — this gives you a major edge.</p>
              </div>
            )}
          </Field>

          <Field label="Do you have video editing experience?">
            <YesNo value={form.hasEditingExp} onChange={setVal("hasEditingExp")} />
            {form.hasEditingExp === "yes" && (
              <div className="mt-3">
                <label style={{ ...labelStyle, marginBottom: 8 }}>Which software?</label>
                <select value={form.editingSoftware} onChange={set("editingSoftware")}
                  style={{ ...inputStyle, appearance: "none" }} onFocus={focus} onBlur={blur}>
                  <option value="" style={{ background: "#111" }}>Select software</option>
                  {EDITING_SOFTWARE.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
                </select>
              </div>
            )}
          </Field>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Portfolio & Resume */}
          <Field label="Portfolio URL (website, Instagram, TikTok, etc.)">
            <input type="url" placeholder="https://..." value={form.portfolioUrl} onChange={set("portfolioUrl")}
              style={inputStyle} onFocus={focus} onBlur={blur} />
          </Field>

          <Field label="Upload Resume (PDF — optional)">
            <label
              className="flex items-center gap-3 cursor-pointer rounded-lg px-4 py-3 transition-all"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px dashed ${form.resumeName ? GOLD + "60" : "rgba(255,255,255,0.12)"}`,
              }}
            >
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <span className="text-xs" style={{ color: form.resumeName ? GOLD : "rgba(255,255,255,0.35)" }}>
                {form.resumeName ? `✓ ${form.resumeName}` : "Click to upload PDF"}
              </span>
            </label>
          </Field>

          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Background */}
          <Field label="Previous Experience *">
            <textarea required rows={3} placeholder="Describe any relevant work experience..."
              value={form.experience} onChange={set("experience")} onFocus={focus} onBlur={blur}
              style={{ ...inputStyle, resize: "none" }} />
          </Field>

          <Field label="Education">
            <input placeholder="High school diploma, college, certificates..." value={form.education}
              onChange={set("education")} style={inputStyle} onFocus={focus} onBlur={blur} />
          </Field>

          <Field label="Why Nova Systems? *">
            <textarea required rows={4} placeholder="Tell us why you want to work with us and what you'd bring to the team..."
              value={form.whyNova} onChange={set("whyNova")} onFocus={focus} onBlur={blur}
              style={{ ...inputStyle, resize: "none" }} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Availability *">
              <input required placeholder="Part-time, weekdays, weekends..." value={form.availability}
                onChange={set("availability")} style={inputStyle} onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Expected Pay Per Deliverable *">
              <input required placeholder="e.g. $75 per video, $200 per project..." value={form.expectedPay}
                onChange={set("expectedPay")} style={inputStyle} onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2 rounded-lg"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              : <><span>SUBMIT APPLICATION</span><ArrowRight className="w-4 h-4" /></>
            }
          </button>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Isaac personally reviews every application. No spam, no bots.
          </p>
        </form>
      </div>
    </section>
  );
}