import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, Globe, Palette, Workflow } from "lucide-react";
import loginVideo from "@/assets/video 2.mp4";
import { useSEO } from "@/hooks/useSEO";
import { supabase } from "@/lib/supabaseClient";
import { safeReturnTo } from "@/lib/returnTo";

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#E0C476";
const GOLD_DARK = "#8a6b2a";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
// 2026-09-21 (final video decision, repair task): single video, no rotation — "video 2.mp4" only,
// used exactly as supplied (no re-encoding).

const features = [
  { icon: Bot, label: "AI ECOSYSTEMS", sub: "Automated workflows and phone agents, live." },
  { icon: Globe, label: "WEB INFRASTRUCTURE", sub: "Sites, portals, and platforms built to convert." },
  { icon: Palette, label: "BRAND AND IDENTITY", sub: "Every asset, from digital to physical." },
  { icon: Workflow, label: "FULL OPERATIONS", sub: "CRM, contracts, and cloud infrastructure." },
];

const inputStyle = {
  width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

export default function Login() {
  useSEO({ title: "Login — Nova Systems", description: "Secure access to your Nova Systems workspace." });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const destination = safeReturnTo(searchParams.get("returnTo"));

  // Bug found 2026-09-20 (real repair task): this effect's dependency array didn't include
  // checkingSession, but the <video> element (and therefore videoRef.current) doesn't exist in
  // the DOM until AFTER checkingSession flips to false (see the early-return below). On first
  // mount the effect ran once with a null ref and did nothing; since vidIdx/reducedMotion never
  // changed afterward, it never got a second chance to run once the ref was actually available —
  // the video sat with no src set, permanently. Adding checkingSession here makes the effect
  // re-run the moment the real video element exists.
  useEffect(() => {
    if (reducedMotion || checkingSession) return;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.src = loginVideo;
    v.load();
    v.play().catch(() => {});
  }, [reducedMotion, checkingSession]);

  // If a real session already exists, skip the form entirely and go straight to the destination.
  useEffect(() => {
    let active = true;
    async function check() {
      if (!supabase) {
        setCheckingSession(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data?.session) {
        navigate(destination, { replace: true });
      } else {
        setCheckingSession(false);
      }
    }
    check();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!supabase) {
      setError("Login is not configured. Contact hello@nova-systems.app.");
      setLoading(false);
      return;
    }

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (!authErr && data?.session) {
      navigate(destination, { replace: true });
      return;
    }
    setError("Invalid email or password. Please try again.");
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!supabase) return;
    const target = email.trim();
    if (!target) {
      setError('Enter your email above first, then press "Forgot password?"');
      return;
    }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setInfo(resetErr ? "" : "If that email has an account, a reset link is on its way.");
    if (resetErr) setError("Could not send a reset email right now. Please try again shortly.");
  };

  if (checkingSession) {
    return <div className="min-h-screen" style={{ background: "#0A0A0A" }} />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-14 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <div className="absolute inset-0" style={{ zIndex: 1, background: "rgba(4,3,0,0.80)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 2,
          background: "radial-gradient(ellipse at 30% 40%, rgba(201, 168, 76,0.10) 0%, transparent 60%)",
        }} />

        <div className="relative flex items-center gap-3" style={{ zIndex: 10 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="relative" style={{ zIndex: 10 }}>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>OPERATIONAL COMMAND</p>
          <h1 className="font-black text-white leading-[0.9] mb-7" style={{ fontSize: "clamp(2.8rem,5vw,4.5rem)", letterSpacing: "-0.02em" }}>
            ELITE<br />
            <span style={{ background: `linear-gradient(90deg,${GOLD} 0%,${GOLD_BRIGHT} 50%,${GOLD} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              INFRASTRUCTURE.
            </span>
          </h1>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 320 }}>
            Whatever your business needs, we build it. Manage it all from here.
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
          <h2 className="text-2xl font-black text-white mb-1">Sign in to Nova Systems</h2>
          <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            Your workspace, dashboards, and client tools live on Nova's secure platform.
          </p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}
          {info && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}40`, color: GOLD }}>
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Email</label>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Password</label>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", opacity: loading ? 0.6 : 1, border: "none", cursor: loading ? "default" : "pointer" }}
            >
              <span>{loading ? "SIGNING IN…" : "SIGN IN"}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
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

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Are you a client?{" "}
            <Link to="/client-login" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Client Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
