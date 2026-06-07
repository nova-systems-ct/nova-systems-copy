import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Target, Bell, Zap, BarChart3, ShieldCheck } from "lucide-react";

const GOLD = "#D4AF37";

const features = [
  { icon: Target, label: "TRACK EVERY LEAD", desc: "Real-time visibility into every interaction." },
  { icon: Bell, label: "SMART ALERTS", desc: "AI-powered alerts to prevent lost opportunities." },
  { icon: Zap, label: "AUTOMATE WORKFLOWS", desc: "Eliminate manual work and follow-ups." },
  { icon: BarChart3, label: "DRIVE REVENUE", desc: "Turn insights into action and grow faster." },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authClient.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => authClient.auth.loginWithProvider("google", "/");
  const handleMicrosoft = () => authClient.auth.loginWithProvider("microsoft", "/");

  return (
    <div className="min-h-screen flex" style={{ background: "#050505" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2832&auto=format&fit=crop')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(5,5,5,0.92) 0%, rgba(8,17,32,0.85) 100%)" }} />

        {/* Gold diagonal slash */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px"
          style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}, transparent)` }}
        />
        <div
          className="absolute right-[-1px] top-0 bottom-0 w-16 opacity-10"
          style={{ background: `linear-gradient(to right, transparent, ${GOLD})` }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 relative">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 28L14 8L20 18L24 12L28 28" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 28H28" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold tracking-[0.2em] text-sm leading-none">NOVA</p>
              <p className="tracking-[0.25em] text-[9px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>SYSTEMS</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="mb-12">
            <p className="text-xs tracking-[0.3em] uppercase font-semibold mb-4" style={{ color: GOLD }}>
              OPERATIONAL INTELLIGENCE.
            </p>
            <h1 className="text-5xl xl:text-6xl font-black leading-[0.9] tracking-tight text-white mb-2">
              TOTAL VISIBILITY.
            </h1>
            <h1 className="text-5xl xl:text-6xl font-black leading-[0.9] tracking-tight" style={{ color: GOLD }}>
              TOTAL CONTROL.
            </h1>
            <p className="mt-6 text-sm leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Nova Systems gives you the intelligence to track every lead, optimize every workflow, and stop losing opportunities. This is more than software. This is your infrastructure.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-5">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}12` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[0.15em] text-white">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust line */}
        <div className="relative z-10 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: GOLD }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Secure. Reliable. Built for scale.</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-7 h-7">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 28L14 8L20 18L24 12L28 28" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 28H28" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-white font-bold tracking-[0.2em] text-sm">NOVA SYSTEMS</p>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-xs tracking-[0.3em] uppercase font-semibold mb-4" style={{ color: GOLD }}>
              WELCOME BACK
            </p>
            <div className="w-8 h-px mb-5" style={{ background: GOLD }} />
            <h2 className="text-3xl font-bold text-white mb-2">Log in to Nova Systems</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Access your dashboard and take control<br />of your operational intelligence.
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-14 pl-11 pr-4 text-sm text-white placeholder-white/25 rounded-lg outline-none transition-all focus:ring-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => { e.target.style.borderColor = GOLD + "80"; e.target.style.background = "rgba(212,175,55,0.04)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-14 pl-11 pr-12 text-sm text-white placeholder-white/25 rounded-lg outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => { e.target.style.borderColor = GOLD + "80"; e.target.style.background = "rgba(212,175,55,0.04)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    border: `1px solid ${rememberMe ? GOLD : "rgba(255,255,255,0.2)"}`,
                    background: rememberMe ? GOLD : "transparent",
                  }}
                >
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#050505" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-xs transition-opacity hover:opacity-80" style={{ color: GOLD }}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 mt-2 font-bold text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 rounded-lg transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ background: GOLD, color: "#050505" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  LOG IN
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>OR CONTINUE WITH</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogle}
              className="h-12 flex items-center justify-center gap-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              onClick={handleMicrosoft}
              className="h-12 flex items-center justify-center gap-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/>
                <path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/>
                <path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/>
                <path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/>
              </svg>
              Microsoft
            </button>
          </div>

          {/* Footer */}
          <p className="text-center mt-8 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Don't have an account?{" "}
            <Link to="/pricing" className="font-semibold transition-opacity hover:opacity-80" style={{ color: GOLD }}>
              Book a demo →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}