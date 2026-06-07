import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Activity, Bell, Wrench, TrendingUp } from "lucide-react";
import video1 from "@/assets/Video 1.mp4";
import video2 from "@/assets/video 2.mp4";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
const VIDEOS = [video1, video2];

const CRED_EMAIL = "hello@nova-systems.app";
const CRED_PASS = "NovaSystem2024";

const features = [
  { icon: Activity, label: "TRACK EVERY LEAD", sub: "See every call, contact, and opportunity in real time." },
  { icon: Bell, label: "SMART ALERTS", sub: "Get notified the moment revenue is at risk." },
  { icon: Wrench, label: "AUTOMATE WORKFLOWS", sub: "Follow-ups, booking, CRM - all on autopilot." },
  { icon: TrendingUp, label: "DRIVE REVENUE", sub: "Convert more of the leads you're already getting." },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vidIdx, setVidIdx] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.src = VIDEOS[vidIdx];
    v.load();
    v.play().catch(() => {});
  }, [vidIdx]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (email !== CRED_EMAIL || password !== CRED_PASS) {
      setError("Invalid email or password.");
      return;
    }
    setLoading(true);
    setTimeout(() => navigate("/dashboard"), 900);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* LEFT PANEL - looping video background */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-14 overflow-hidden">

        {/* Video BG */}
        <video
          ref={videoRef}
          muted
          playsInline
          onEnded={() => setVidIdx((i) => (i + 1) % 2)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ zIndex: 1, background: "rgba(4,3,0,0.78)" }} />
        {/* Gold glow overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 2,
          background: "radial-gradient(ellipse at 30% 40%, rgba(212,160,48,0.10) 0%, transparent 60%)",
        }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3" style={{ zIndex: 10 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        {/* Main copy */}
        <div className="relative" style={{ zIndex: 10 }}>
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
          <p className="text-sm leading-relaxed max-w-sm mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
            Nova Systems gives you the intelligence to track every lead, optimize every workflow, and stop losing opportunities.
          </p>
          <div className="space-y-5">
            {features.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                  <Icon className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-white">{label}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.32)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tag */}
        <div className="relative flex items-center gap-2" style={{ zIndex: 10 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
            Secure. Reliable. Built for scale.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        className="flex-1 flex flex-col justify-center px-8 md:px-14 py-14 relative"
        style={{ background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[9px] tracking-[0.35em] uppercase whitespace-nowrap" style={{ color: GOLD }}>WELCOME BACK</p>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${GOLD}60, transparent)` }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Log in to Nova Systems</h2>
          <p className="text-xs mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            Access your dashboard and take control of your operational intelligence.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Email Address
              </label>
              <input
                type="email" required
                placeholder={CRED_EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={(e) => e.target.style.borderColor = `${GOLD}70`}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} required
                  placeholder={CRED_PASS}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  onFocus={(e) => e.target.style.borderColor = `${GOLD}70`}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.25)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setRemember(!remember)}
                  className="w-4 h-4 rounded flex items-center justify-center transition-all"
                  style={{ border: `1px solid ${remember ? GOLD : "rgba(255,255,255,0.2)"}`, background: remember ? `${GOLD}25` : "transparent" }}>
                  {remember && <div className="w-2 h-2 rounded-sm" style={{ background: GOLD }} />}
                </div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Remember me</span>
              </label>
              <button type="button" className="text-xs transition-colors hover:opacity-80" style={{ color: GOLD }}>
                Forgot password?
              </button>
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

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Google", icon: "G" }, { label: "Microsoft", icon: "M" }].map(({ label, icon }) => (
              <button key={label} type="button"
                className="flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all hover:border-white/20"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: 8 }}>
                <span className="font-black text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Don't have an account?{" "}
            <a href="mailto:hello@nova-systems.app?subject=Nova%20Systems%20Demo%20Request" target="_blank" rel="noreferrer"
              className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Book a demo
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
