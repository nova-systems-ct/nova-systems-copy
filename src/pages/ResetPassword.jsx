import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { authDestination } from "@/lib/authDestination";
import { useSEO } from "@/hooks/useSEO";
import NovaLogo from "@/components/NovaLogo";

const GOLD = "#C9A84C";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

const inputStyle = {
  width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff",
  fontSize: 16, minHeight: 48, boxSizing: "border-box", accentColor: GOLD,
};

// Reached via AuthCallback after a real recovery or invitation session is established — this page
// never accepts a password without that session already existing (supabase.auth.updateUser
// operates on the current session). A direct visit without a session explains the
// required invitation instead of offering a form that cannot save.
export default function ResetPassword() {
  useSEO({ title: "Reset Password — Nova Systems" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState('checking');
  const destination = authDestination({ returnTo: searchParams.get("returnTo") });

  useEffect(() => {
    let active = true;
    if (!supabase) { setSessionState('missing'); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSessionState(data?.session ? 'ready' : 'missing');
    }).catch(() => { if (active) setSessionState('missing'); });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Not configured. Contact hello@nova-systems.app.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError("Could not update your password. Please request a new reset link.");
        return;
      }
      navigate(destination, { replace: true });
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A0A" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <NovaLogo size={96} />
          <p className="text-sm text-white mt-1">Set a new password</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}
          {sessionState === 'checking' ? <p role="status" className="text-sm text-white/70">Checking your setup link…</p>
            : sessionState === 'missing' ? <div className="text-sm leading-relaxed text-white/70">
              <p>Open the invitation or password-reset link sent to your email before choosing a password.</p>
              <a href="/login" className="inline-flex min-h-11 items-center mt-4 underline underline-offset-4" style={{ color: GOLD }}>Return to sign in</a>
            </div> : <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }} htmlFor="reset-password">New password</label>
              <input id="reset-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }} htmlFor="reset-confirm">Confirm password</label>
              <input id="reset-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 text-[11px] font-bold tracking-[0.2em] uppercase transition-all"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", opacity: loading ? 0.6 : 1, border: "none", cursor: loading ? "default" : "pointer" }}
            >
              {loading ? "Saving…" : "Save New Password"}
            </button>
          </form>}
        </div>
      </div>
    </div>
  );
}
