import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Activity, Bell, Wrench, TrendingUp } from "lucide-react";
import video1 from "@/assets/Video 1.mp4";
import video2 from "@/assets/video 2.mp4";
import { supabase } from "@/lib/supabaseClient";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
const VIDEOS = [video1, video2];

// Admin credentials — change here to update login
const CRED_EMAIL = "Isaac_0427@icloud.com";
const CRED_PASS = "NovaSystem2024";

const features = [
  { icon: Activity, label: "TRACK EVERY LEAD", sub: "Every call, contact, and opportunity in real time." },
  { icon: Bell, label: "SMART ALERTS", sub: "Know the moment revenue is at risk." },
  { icon: Wrench, label: "AUTOMATE WORKFLOWS", sub: "Follow-ups, booking, CRM — on autopilot." },
  { icon: TrendingUp, label: "DRIVE REVENUE", sub: "Convert more of the leads you already have." },
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

    const enteredEmail = email.trim().toLowerCase();
    const enteredPass = password.trim();
    const expectedEmail = CRED_EMAIL.trim().toLowerCase();
    const expectedPass = CRED_PASS.trim();

    console.log("[Login] Credential check:", {
      enteredEmail,
      expectedEmail,
      emailMatch: enteredEmail === expectedEmail,
      passMatch: enteredPass === expectedPass,
    });

    if (enteredEmail !== expectedEmail || enteredPass !== expectedPass) {
      setError("Invalid email or password.");
      return;
    }

    setLoading(true);
    localStorage.setItem('nova_crm_auth', 'true');
    setTimeout(() => navigate("/dashboard"), 600);
  };

  const handleGoogleLogin = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) {
          setError("Google login failed: " + error.message);
        }
        // Supabase handles the redirect — no further action needed here
        return;
      } catch {}
    }
    // Fallback when Supabase not configured
    localStorage.setItem('nova_crm_auth', 'true');
    navigate("/dashboard");
  };

  const handleMicrosoftLogin = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            scopes: 'email',
          },
        });
        if (error) {
          setError("Microsoft login failed: " + error.message);
        }
        return;
      } catch {}
    }
    // Fallback when Supabase not configured
    localStorage.setItem('nova_crm_auth', 'true');
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-14 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          onEnded={() => setVidIdx((i) => (i + 1) % VIDEOS.length)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <div className="absolute inset-0" style={{ zIndex: 1, background: "rgba(4,3,0,0.80)" }} />
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

        {/* Copy */}
        <div className="relative" style={{ zIndex: 10 }}>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>OPERATIONAL INTELLIGENCE</p>
          <h1 className="font-black text-white leading-[0.9] mb-7" style={{ fontSize: "clamp(2.8rem,5vw,4.5rem)", letterSpacing: "-0.02em" }}>
            TOTAL VISIBILITY.<br />
            <span style={{ background: `linear-gradient(90deg,${GOLD} 0%,${GOLD_BRIGHT} 50%,${GOLD} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              TOTAL CONTROL.
            </span>
          </h1>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 320 }}>
            Stop losing leads. Start capturing every opportunity.
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
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2" style={{ zIndex: 10 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Secure. Reliable. Built for scale.</p>
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
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right,${GOLD}60,transparent)` }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">Log in to Nova Systems</h2>
          <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            Access your dashboard and operational intelligence.
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
                type="email"
                required
                placeholder={CRED_EMAIL}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={(e) => (e.target.style.borderColor = `${GOLD}70`)}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  placeholder={CRED_PASS}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 text-sm text-white placeholder-white/20 rounded-lg outline-none transition-all bg-transparent"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  onFocus={(e) => (e.target.style.borderColor = `${GOLD}70`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
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
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button type="button" onClick={handleMicrosoftLogin}
              className="flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", borderRadius: 8 }}>
              <svg width="16" height="16" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Microsoft
            </button>
          </div>

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Don&apos;t have an account?{" "}
            <Link to="/book-demo" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Book a demo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
