import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
};
const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
const blur  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", business: "", email: "", password: "", phone: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);

    try {
      const existing = JSON.parse(localStorage.getItem("nova_signups") || "[]");
      existing.push({ name: form.name, business: form.business, email: form.email, phone: form.phone, createdAt: new Date().toISOString() });
      localStorage.setItem("nova_signups", JSON.stringify(existing));
      console.log("[Register] Saved to localStorage. Total signups:", existing.length);
    } catch (err) {
      console.warn("[Register] localStorage save failed:", err.message);
    }

    try {
      const r = await fetch("/api/notify?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `New Registration: ${form.name} - ${form.business}`,
          body: `New account registered on Nova Systems:

Name:     ${form.name}
Business: ${form.business}
Email:    ${form.email}
Phone:    ${form.phone}
Date:     ${new Date().toLocaleString()}`,
          confirmTo: form.email,
          confirmName: form.name,
        }),
      });
      console.log("[Register] Email API response:", r.status);
    } catch (err) {
      console.warn("[Register] Email send failed (non-fatal):", err.message);
    }

    setLoading(false);
    navigate("/book-demo");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-14 overflow-hidden"
        style={{ background: "rgba(212,160,48,0.04)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(212,160,48,0.10) 0%, transparent 65%)" }} />

        <div className="relative flex items-center gap-3 z-10">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="relative z-10">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>GET STARTED</p>
          <h2 className="font-black text-white leading-tight mb-6" style={{ fontSize: "clamp(2rem,3.5vw,3rem)" }}>
            Join businesses<br />recovering revenue.
          </h2>
          {[
            "Full Nova Pulse dashboard access",
            "AI-powered lead tracking",
            "Automated follow-up workflows",
            "Personal onboarding call with Isaac",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>
            No credit card required to start
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-8 md:px-14 py-12">
        <div style={{ width: "100%", maxWidth: 400 }}>

          <div className="flex items-center gap-3 lg:hidden mb-8">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
          </div>

          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-8 text-xs transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-3 mb-5">
            <p className="text-[9px] tracking-[0.35em] uppercase whitespace-nowrap" style={{ color: GOLD }}>CREATE ACCOUNT</p>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${GOLD}60, transparent)` }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Start your free trial</h2>
          <p className="text-xs mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            Create your Nova Systems account and schedule your onboarding call.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { key: "name", label: "Full Name", placeholder: "Jane Smith", type: "text" },
              { key: "business", label: "Business Name", placeholder: "Acme HVAC LLC", type: "text" },
              { key: "email", label: "Email Address", placeholder: "jane@acmehvac.com", type: "email" },
              { key: "phone", label: "Phone Number", placeholder: "+1 (860) 000-0000", type: "tel" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                  {label}
                </label>
                <input required type={type} placeholder={placeholder}
                  value={form[key]} onChange={set(key)}
                  style={inputStyle} onFocus={focus} onBlur={blur} />
              </div>
            ))}

            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input required type={showPw ? "text" : "password"} placeholder="Minimum 8 characters"
                  value={form.password} onChange={set("password")}
                  style={{ ...inputStyle, paddingRight: 44 }} onFocus={focus} onBlur={blur} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 0 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{
                width: "100%", padding: "14px", fontSize: 11, fontWeight: 800,
                letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
                background: GOLD_GRADIENT, color: "#0a0800", border: "none", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.8 : 1, marginTop: 4,
              }}>
              {loading
                ? <div style={{ width: 16, height: 16, border: "2px solid rgba(10,8,0,0.3)", borderTopColor: "#0a0800", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : <><span>CREATE ACCOUNT</span><ArrowRight size={14} /></>
              }
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: GOLD, fontWeight: 700, textDecoration: "none" }}>Log in</Link>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
