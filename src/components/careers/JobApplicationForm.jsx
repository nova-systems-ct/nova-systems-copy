import React, { useState, useRef } from "react";
import { CheckCircle, ArrowRight, Eye, EyeOff, Upload, X } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

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

function YesNo({ value, onChange, options = ["Yes", "No"] }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt.toLowerCase())}
          style={{
            padding: "10px 22px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
            background: value === opt.toLowerCase() ? `${GOLD}20` : "rgba(255,255,255,0.03)",
            border: `1px solid ${value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.1)"}`,
            color: value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.4)",
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function Checkboxes({ value = [], onChange, options }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          style={{
            padding: "10px 18px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            borderRadius: 7, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            background: value.includes(opt) ? `${GOLD}20` : "rgba(255,255,255,0.03)",
            border: `1px solid ${value.includes(opt) ? GOLD : "rgba(255,255,255,0.1)"}`,
            color: value.includes(opt) ? GOLD : "rgba(255,255,255,0.4)",
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function JobApplicationForm({ job }) {
  const fileRef = useRef(null);
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const initialFields = Object.fromEntries(job.fields.map((f) => [f.column, f.type === "checkboxes" ? [] : ""]));
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [values, setValues] = useState(initialFields);
  const [password, setPassword] = useState({ password: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [portfolioLinks, setPortfolioLinks] = useState("");
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const setContactField = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const setFieldValue = (column) => (v) => setValues((s) => ({ ...s, [column]: v }));

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setError("Portfolio file must be under 4MB — for larger files, use the portfolio links field instead."); return; }
    setPortfolioFile(f);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (job.hasPassword) {
      if (password.password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (password.password !== password.confirmPassword) { setError("Passwords do not match."); return; }
    }

    setLoading(true);

    const password_hash = job.hasPassword ? await hashPassword(password.password) : "";
    const appId = crypto.randomUUID();

    let portfolio_file_base64 = "";
    let portfolio_file_name = "";
    if (portfolioFile) {
      portfolio_file_base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(portfolioFile);
      });
      portfolio_file_name = portfolioFile.name;
    }

    const fieldValues = {};
    for (const f of job.fields) {
      const v = values[f.column];
      fieldValues[f.column] = f.type === "checkboxes" ? (v || []).join(", ") : v;
    }

    const payload = {
      id: appId,
      name: contact.name, email: contact.email, phone: contact.phone,
      position: job.title, status: "new",
      password_hash,
      ...fieldValues,
      portfolio_links: job.hasPortfolio ? portfolioLinks : (fieldValues.portfolio_links || ""),
      portfolio_file_name,
      submittedAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    existing.unshift(payload);
    localStorage.setItem("nova_applications", JSON.stringify(existing));

    try {
      const res = await fetch("/api/intake?action=submit-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, portfolio_file_base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[JobApplicationForm] API error:", err);
      }
    } catch (e) {
      console.error("[JobApplicationForm] Network error:", e.message);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center py-10">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}>
          <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
        </div>
        <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 16 }}>
          APPLICATION RECEIVED
        </p>
        <h3 className="text-2xl font-black text-white mb-4">You're in the pipeline.</h3>
        <p className="text-sm leading-relaxed mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
          Isaac will personally review your application. A confirmation email was sent to <strong style={{ color: "rgba(255,255,255,0.6)" }}>{contact.email}</strong>.
        </p>
        {job.hasPassword && (
          <a href="/application-status"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-lg hover:opacity-85 transition-all"
            style={{ background: G, color: "#0a0800" }}>
            CHECK APPLICATION STATUS <ArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionDivider title="Contact Info" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Full Name *">
          <input required value={contact.name} onChange={setContactField("name")} style={inp} placeholder="Jane Smith" onFocus={focus} onBlur={blur} />
        </Field>
        <Field label="Phone *">
          <input required type="tel" value={contact.phone} onChange={setContactField("phone")} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
        </Field>
      </div>
      <Field label={`Email Address *${job.hasPassword ? " (used to log in to check status)" : ""}`}>
        <input required type="email" value={contact.email} onChange={setContactField("email")} style={inp} placeholder="jane@email.com" onFocus={focus} onBlur={blur} />
      </Field>

      {job.hasPassword && (
        <>
          <SectionDivider title="Create Account Password" />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: -10, lineHeight: 1.6 }}>
            This password lets you log in at <span style={{ color: GOLD }}>nova-systems.app/application-status</span> to track your application status.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Password * (min 8 characters)">
              <div style={{ position: "relative" }}>
                <input required type={showPw ? "text" : "password"} minLength={8} value={password.password}
                  onChange={(e) => setPassword((p) => ({ ...p, password: e.target.value }))} style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" onFocus={focus} onBlur={blur} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password *">
              <input required type={showPw ? "text" : "password"} value={password.confirmPassword}
                onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))} style={inp} placeholder="••••••••" onFocus={focus} onBlur={blur} />
            </Field>
          </div>
        </>
      )}

      <SectionDivider title="Position Details" />
      {job.fields.map((f) => (
        <Field key={f.column} label={`${f.label}${f.required ? " *" : ""}`}>
          {f.type === "textarea" && (
            <textarea required={f.required} rows={f.rows || 3} value={values[f.column]} onChange={(e) => setFieldValue(f.column)(e.target.value)}
              onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder={f.placeholder} />
          )}
          {(f.type === "text" || f.type === "url" || f.type === "email" || f.type === "tel") && (
            <input required={f.required} type={f.type === "url" ? "url" : f.type} value={values[f.column]} onChange={(e) => setFieldValue(f.column)(e.target.value)}
              style={inp} placeholder={f.placeholder} onFocus={focus} onBlur={blur} />
          )}
          {f.type === "select" && (
            <select required={f.required} value={values[f.column]} onChange={(e) => setFieldValue(f.column)(e.target.value)}
              style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select</option>
              {f.options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
            </select>
          )}
          {f.type === "yesno" && (
            <YesNo value={values[f.column]} onChange={setFieldValue(f.column)} options={f.options} />
          )}
          {f.type === "checkboxes" && (
            <Checkboxes value={values[f.column]} onChange={setFieldValue(f.column)} options={f.options} />
          )}
        </Field>
      ))}

      {job.hasPortfolio && (
        <>
          <SectionDivider title="Portfolio" />
          <Field label={job.portfolioLabel || "Portfolio"}>
            <textarea rows={2} value={portfolioLinks} onChange={(e) => setPortfolioLinks(e.target.value)} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="https://…  (one per line — Instagram, TikTok, YouTube, Vimeo, GitHub, website…)" />
          </Field>
          <Field label="Or upload a file — optional (max 4MB, larger files use links above)">
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "24px 20px", border: `2px dashed ${portfolioFile ? GOLD : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                background: portfolioFile ? `${GOLD}08` : "rgba(255,255,255,0.02)",
              }}>
              {portfolioFile ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{portfolioFile.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setPortfolioFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Click to upload</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="video/*,image/*,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
          </Field>
        </>
      )}

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
          ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
          : <><span>SUBMIT APPLICATION</span><ArrowRight className="w-4 h-4" /></>}
      </button>

      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
        Isaac personally reviews every application. No spam, no bots.
      </p>
    </form>
  );
}
