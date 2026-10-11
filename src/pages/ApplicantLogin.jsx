import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const GOLD = "#C9A84C";
const G = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, color: "#fff", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};

// Repair task (2026-09-23): this page used to hash a password client-side (SHA-256) and compare
// it server-side against applications.password_hash via api/intake.js's now-retired
// check-applicant action — a real security relic (no session was ever issued) with a
// localStorage fallback on top of that. Real Supabase Auth now, same signInWithPassword pattern
// as Login.jsx/ClientLogin.jsx. An applicant can only sign in here AFTER an administrator has
// reviewed and invited them (see api/intake.js's invite-applicant action) — before that, there
// is no account to sign into, by design: invitation is a deliberate, admin-gated step, not
// something the applicant self-serves at submission time.
export default function ApplicantLogin() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    async function check() {
      if (!supabase) { setCheckingSession(false); return; }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data?.session) navigate("/application-status", { replace: true });
      else setCheckingSession(false);
    }
    check();
    return () => { active = false; };
  }, []);

  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!supabase) {
      setError("Sign-in is not configured. Contact hello@nova-systems.app.");
      setLoading(false);
      return;
    }

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    setLoading(false);
    if (!authErr && data?.session) {
      navigate("/application-status", { replace: true });
      return;
    }
    setError("Incorrect email or password, or no invitation has been sent to this address yet.");
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!supabase) return;
    const target = email.trim();
    if (!target) { setError("Enter your email above first, then press \"Forgot password?\""); return; }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent("/application-status")}`,
    });
    if (resetErr) setError("Could not send a reset email right now. Please try again shortly.");
    else setInfo("If that email has an invited account, a reset link is on its way.");
  };

  if (checkingSession) {
    return <div className="min-h-screen" style={{ background: "#0A0A0A" }} />;
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 py-20">
      {/* Logo */}
      <a href="/" className="flex items-center gap-3 mb-12">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
          <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
        </svg>
        <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
      </a>

      <div className="w-full max-w-md">
        <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
          APPLICANT PORTAL
        </p>
        <h1 className="text-3xl font-black text-white text-center mb-2">Check Your Status</h1>
        <p className="text-sm text-center mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
          Sign in with the Nova Systems account from your invitation email.
        </p>

        <form
          onSubmit={handleLogin}
          className="rounded-2xl p-8 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
              Email Address
            </label>
            <input
              required type="email" placeholder="you@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={inputStyle} onFocus={focus} onBlur={blur}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
              Password
            </label>
            <div className="relative">
              <input
                required type={showPw ? "text" : "password"} placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }} onFocus={focus} onBlur={blur}
              />
              <button
                type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", lineHeight: 1.5 }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs px-3 py-2.5 rounded-lg"
              style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}40`, lineHeight: 1.5 }}>
              {info}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 rounded-lg transition-opacity hover:opacity-85"
            style={{ background: G, color: "#0a0800", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              : <><span>SIGN IN</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-[11px] py-1"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}
          >
            Forgot password?
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          Haven&apos;t applied yet?{" "}
          <a href="/careers" style={{ color: GOLD }}>Apply for a position</a>
        </p>
        <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.15)" }}>
          Already applied but no invitation yet? An administrator will email you once your application has been reviewed.
        </p>
      </div>
    </div>
  );
}
