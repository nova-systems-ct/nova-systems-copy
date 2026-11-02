import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroPoster from "@/assets/hero-poster-v3.jpg";
import { useSEO } from "@/hooks/useSEO";
import { supabase } from "@/lib/supabaseClient";
import { safeReturnTo } from "@/lib/returnTo";
import NovaLogo from "@/components/NovaLogo";

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#E0C476";
const GOLD_DARK = "#8a6b2a";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const inputStyle = {
  width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, color: "#FAFAFA",
  fontSize: 16, outline: "none", boxSizing: "border-box",
};

export default function Login() {
  useSEO({ title: "Login — Nova Systems", description: "Secure access to your Nova Systems workspace." });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const destination = safeReturnTo(searchParams.get("returnTo"));


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

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!authErr && data?.session) {
        navigate(destination, { replace: true });
        return;
      }
      setError(authErr?.code === 'email_not_confirmed'
        ? 'Open your account invitation or confirmation email to finish setup before signing in.'
        : 'Invalid email or password. Please try again.');
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
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
    setResetLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      setInfo(resetErr ? "" : "If that email has an account, a reset link is on its way.");
      if (resetErr) setError("Could not send a reset email right now. Please try again shortly.");
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen" style={{ background: "#0A0A0A" }} />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A", color: "#FAFAFA" }}>

      {/* LEFT PANEL — brand (2026-10-25 design: the approved mark over the gold data-stream image) */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 overflow-hidden" aria-hidden="true">
        <img src={heroPoster} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0, filter: "saturate(1.05)" }} />
        <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(100deg, rgba(10,10,10,0.94) 0%, rgba(10,10,10,0.78) 45%, rgba(10,10,10,0.45) 100%)" }} />
        <img src="/logo.png" alt="" width="150" height="150" className="relative" style={{ zIndex: 10, width: 150, height: 150, mixBlendMode: "lighten", marginLeft: -18 }} />
        <div className="relative" style={{ zIndex: 10 }}>
          <p className="mb-6" style={{ color: "rgba(250,250,250,0.55)", fontSize: 11, letterSpacing: "0.36em", textTransform: "uppercase", lineHeight: 2 }}>Technology<br />People<br />Progress</p>
          <h1 style={{ fontSize: "clamp(3rem,5vw,4.6rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, margin: 0 }}>
            Built to<br />move business<span style={{ color: GOLD }}>.</span>
          </h1>
          <div style={{ width: 64, height: 1, background: GOLD, margin: "28px 0 18px" }} />
          <p style={{ color: "rgba(250,250,250,0.6)", fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase" }}>Audit · Systemize · Scale</p>
        </div>
        <p className="relative" style={{ zIndex: 10, color: "rgba(250,250,250,0.4)", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase" }}>Waterbury, Connecticut</p>
      </div>

      {/* RIGHT PANEL — sign in */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-14 py-14 relative" style={{ background: "#0D0D0D", borderLeft: "1px solid rgba(201,168,76,0.16)" }}>
        <div className="max-w-sm w-full mx-auto">
          <NovaLogo style={{ margin: "0 auto 18px", display: "block" }} />
          <h2 className="text-center" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px" }}>Welcome back.</h2>
          <p className="text-center mb-8" style={{ color: "rgba(250,250,250,0.6)", fontSize: 14 }}>Sign in to your Nova Systems workspace.</p>

          {error && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(240,113,103,0.10)", border: "1px solid rgba(240,113,103,0.35)", color: "#F4A29B" }}>
              {error}
            </div>
          )}
          {info && (
            <div role="status" className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}40`, color: GOLD }}>
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2" style={{ color: "rgba(250,250,250,0.7)", fontSize: 13, fontWeight: 500 }} htmlFor="login-email">Email</label>
              <input id="login-email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} className="nova-login-input" />
            </div>
            <div>
              <label className="block mb-2" style={{ color: "rgba(250,250,250,0.7)", fontSize: 13, fontWeight: 500 }} htmlFor="login-password">Password</label>
              <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} className="nova-login-input" />
            </div>
            <div className="flex justify-end">
              <button type="button" disabled={resetLoading || loading} onClick={handleForgotPassword} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 13, padding: 4, minHeight: 44 }}>
                {resetLoading ? 'Requesting link…' : 'Forgot password?'}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: GOLD_GRADIENT, color: "#0A0A0A", opacity: loading ? 0.6 : 1, border: "none", cursor: loading ? "default" : "pointer", borderRadius: 12, padding: "15px 18px", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em" }}
            >
              <span>{loading ? "SIGNING IN…" : "SIGN IN"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div style={{ height: 1, background: "rgba(250,250,250,0.08)", margin: "28px 0 18px" }} />
          <p className="text-center" style={{ color: "rgba(250,250,250,0.5)", fontSize: 13 }}>
            Are you a client?{" "}
            <Link to="/client-login" className="font-semibold hover:opacity-80" style={{ color: GOLD }}>Client sign-in</Link>
            {" · "}
            <a href="mailto:hello@nova-systems.app" className="hover:opacity-80" style={{ color: GOLD }}>Contact Nova</a>
          </p>
        </div>
      </div>
      <style>{`.nova-login-input:focus{outline:none;border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(201,168,76,0.18)}`}</style>
    </div>
  );
}
