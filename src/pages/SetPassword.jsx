import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Eye, EyeOff, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
};

export default function SetPassword() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) return;
    setToken(t);
    const accounts = JSON.parse(localStorage.getItem("nova_employee_accounts") || "[]");
    const found = accounts.find((a) => a.token === t);
    setAccount(found || null);
  }, []);

  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    const accounts = JSON.parse(localStorage.getItem("nova_employee_accounts") || "[]");
    const updated = accounts.map((a) =>
      a.token === token ? { ...a, password, token: null } : a
    );
    localStorage.setItem("nova_employee_accounts", JSON.stringify(updated));

    // Auto-login
    const updatedAccount = updated.find((a) => a.id === account.id);
    localStorage.setItem("nova_applicant_session", JSON.stringify({
      id: updatedAccount.id,
      email: updatedAccount.email,
      applicationId: updatedAccount.applicationId,
      isEmployee: updatedAccount.isEmployee,
    }));

    setDone(true);
    setTimeout(() => navigate(updatedAccount.isEmployee ? "/employee-dashboard" : "/application-status"), 2000);
  };

  if (!token || !account) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-white/50 text-sm">Invalid or expired link.</p>
          <a href="/applicant-login" className="text-sm mt-4 inline-block" style={{ color: GOLD }}>Go to login →</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: GOLD }} />
          <h2 className="text-2xl font-black text-white mb-2">Password set!</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Redirecting you now...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-20">
      <a href="/" className="flex items-center gap-3 mb-12">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
          <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
        </svg>
        <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
      </a>

      <div className="w-full max-w-md">
        <p className="text-[9px] tracking-[0.35em] uppercase mb-3 text-center" style={{ color: GOLD }}>WELCOME</p>
        <h1 className="text-3xl font-black text-white text-center mb-2">Set Your Password</h1>
        <p className="text-sm text-center mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
          Hey {account.name} — create your password to access your portal.
        </p>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {[["Password", password, setPassword], ["Confirm Password", confirm, setConfirm]].map(([label, val, setter], i) => (
            <div key={label}>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>{label}</label>
              <div className="relative">
                <input required type={showPw ? "text" : "password"} placeholder="••••••••"
                  value={val} onChange={(e) => setter(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }} onFocus={focus} onBlur={blur} />
                {i === 0 && (
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          <button type="submit"
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 rounded-lg transition-all hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
            <span>SET PASSWORD & ENTER</span><ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}