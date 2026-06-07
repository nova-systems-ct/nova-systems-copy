import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Activity, Bell, Wrench, Globe } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#F0C040";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const features = [
  { icon: Activity, label: "Track Every Lead", sub: "See every call, contact, and opportunity in real time." },
  { icon: Bell, label: "Smart Alerts", sub: "Get notified the moment revenue is at risk." },
  { icon: Wrench, label: "Automate Workflows", sub: "Follow-ups, booking, CRM — all on autopilot." },
  { icon: Globe, label: "Drive Revenue", sub: "Convert more of the leads you're already getting." },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/dashboard");
    }, 1200);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-14 overflow-hidden">

        {/* Gold network background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at 30% 40%, rgba(212,160,48,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(212,160,48,0.06) 0%, transparent 50%)",
          }} />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#D4A030" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Node dots */}
          {[
            [20, 15], [45, 30], [70, 10], [85, 45], [30, 60],
            [60, 70], [15, 80], [75, 85], [50, 50], [90, 20],
          ].map(([x, y], i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${x}%`, top: `${y}%`,
                width: i % 3 === 0 ? 6 : 4,
                height: i % 3 === 0 ? 6 : 4,
                background: GOLD,
                opacity: 0.25 + (i % 4) * 0.1,
                transform: "translate(-50%,-50%)",
              }}
            />
          ))}
          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }}>
            <line x1="20%" y1="15%" x2="45%" y2="30%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="45%" y1="30%" x2="70%" y2="10%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="45%" y1="30%" x2="50%" y2="50%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="70%" y1="10%" x2="85%" y2="45%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="50%" y1="50%" x2="60%" y2="70%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="30%" y1="60%" x2="50%" y2="50%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="15%" y1="80%" x2="30%" y2="60%" stroke={GOLD} strokeWidth="0.8" />
            <line x1="60%" y1="70%" x2="75%" y2="85%" stroke={GOLD} strokeWidth="0.8" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill={GOLD} />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="20" fill="#0a0800">N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        {/* Main copy */}
        <div className="relative">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>OPERATIONAL INTELLIGENCE</p>
          <h1
            className="font-black text-white leading-[0.88] mb-8"
            style={{ fontSize: "clamp(2.8rem, 5vw, 4.5rem)", letterSpacing: "-0.02em" }}
          >
            TOTAL VISIBILITY.<br />
            <span style={{
              background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 50%, ${GOLD} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>TOTAL CONTROL.</span>
          </h1>
          <p className="text-sm leading-relaxed max-w-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Nova Systems gives you the intelligence to track every lead, optimize every workflow, and stop losing opportunities. This is more than software. This is your infrastructure.
          </p>

          <div className="space-y-5">
            {features.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tag */}
        <div className="relative flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
            Secure. Reliable. Built for scale.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-center px-8 md:px-14 py-14 relative"
        style={{ background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="7" fill={GOLD} />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="20" fill="#0a0800">N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-3" style={{ color: GOLD }}>WELCOME BACK</p>
          <h2 className="text-2xl font-black text-white mb-2">Log in to Nova Systems</h2>
          <p className="text-xs mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            Access your dashboard and take control of your operational intelligence.
          </p>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={(e) => e.target.style.borderColor = `${GOLD}70`}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  onFocus={(e) => e.target.style.borderColor = `${GOLD}70`}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setRemember(!remember)}
                  className="w-4 h-4 rounded flex items-center justify-center transition-all"
                  style={{
                    border: `1px solid ${remember ? GOLD : "rgba(255,255,255,0.2)"}`,
                    background: remember ? `${GOLD}25` : "transparent",
                  }}
                >
                  {remember && <div className="w-2 h-2 rounded-sm" style={{ background: GOLD }} />}
                </div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Remember me</span>
              </label>
              <button type="button" className="text-xs transition-colors hover:opacity-80" style={{ color: GOLD }}>
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2 mt-2"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              ) : (
                <>LOG IN <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Google", icon: "G" },
              { label: "Microsoft", icon: "M" },
            ].map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                className="flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all hover:border-white/20"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: 8 }}
              >
                <span className="font-black text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Don't have an account?{" "}
            <Link to="/pricing" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Book a demo →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
