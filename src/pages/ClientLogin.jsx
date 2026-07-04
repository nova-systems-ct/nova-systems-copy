import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ClientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useSEO({
    title: "Client Login — Nova Connect — Nova Systems",
    description: "Log in to Nova Connect, your Nova Systems client portal.",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const password_hash = await hashPassword(password);
      const res = await fetch("/api/client?resource=auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password_hash }),
      });
      const data = await res.json();

      if (data.result === "ok") {
        setSuccess(true);
      } else if (data.result === "wrong_password") {
        setError("Incorrect password.");
      } else if (data.result === "no_account") {
        setError("No Nova Connect account found for that email.");
      } else {
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch (err) {
      setError("Network error — please try again.");
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#080600" }}>
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: GOLD }} />
          </div>
          <p className="text-[9px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>WELCOME BACK</p>
          <h1 className="text-2xl font-black text-white mb-4">You're logged in.</h1>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Nova Connect is being finalized for your account. Isaac will notify you the moment full portal access is live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-14 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(212,160,48,0.08) 0%, rgba(0,0,0,0.9) 70%)" }} />
        <div className="relative flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>
        <div className="relative">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>NOVA CONNECT</p>
          <h1 className="font-black text-white leading-[0.95] mb-6" style={{ fontSize: "clamp(2rem,3.6vw,3.2rem)", letterSpacing: "-0.02em" }}>
            Your dedicated<br />client portal.
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 300 }}>
            Track services, approve content, and pay invoices — all in one place.
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Built for real clients getting real results.</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-14 py-14" style={{ background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>CLIENT LOGIN</p>
          <h2 className="text-2xl font-black text-white mb-1">Log in to Nova Connect</h2>
          <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            Use the email and password Isaac set up for your account.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Email Address</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={(e) => (e.target.style.borderColor = `${GOLD}70`)}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  onFocus={(e) => (e.target.style.borderColor = `${GOLD}70`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2 mt-2"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
                : <><span>LOG IN</span><ArrowRight className="w-3.5 h-3.5" /></>
              }
            </button>
          </form>

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Not a client yet?{" "}
            <Link to="/welcome" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Schedule a strategy meeting
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
