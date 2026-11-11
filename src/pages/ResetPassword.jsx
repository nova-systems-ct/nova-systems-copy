import { useEffect, useState } from "react";
import { Link,useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { safeReturnTo } from "@/lib/returnTo";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#C9A84C";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

const inputStyle = {
  width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff",
  fontSize: 14, outline: "none", boxSizing: "border-box",
};

// Reached only via AuthCallback after a real PASSWORD_RECOVERY session is established — this page
// never accepts a password without that session already existing (supabase.auth.updateUser
// operates on the current session, so there's nothing to check here beyond "a session exists,"
// which AuthCallback already guaranteed before routing here). If a visitor lands here directly
// without a session, updateUser will simply fail and the error state below is shown.
export default function ResetPassword() {
  useSEO({ title: "Reset Password — Nova Systems" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified,setVerified]=useState(false);
  const [checking,setChecking]=useState(true);
  const destination = safeReturnTo(searchParams.get("returnTo"));
  useEffect(()=>{let active=true;if(!supabase){setChecking(false);return;}supabase.auth.getUser().then(({data,error})=>{if(active){setVerified(!error&&Boolean(data?.user));setChecking(false)}}).catch(()=>{if(active)setChecking(false)});return()=>{active=false}},[]);

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
    if (!supabase||!verified) {
      setError("Open the newest password-reset email link before setting a password.");
      return;
    }

    setLoading(true);
    try{
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if(updateErr)throw updateErr;
      try{sessionStorage.removeItem('nova_password_recovery')}catch{/* Optional routing hint. */}
      navigate(destination, { replace: true });
    }catch{setError("Could not update your password. Please request a new reset link.")}
    finally{setLoading(false)}
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A0A" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <p className="mt-4 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</p>
          <h1 className="text-sm text-white mt-1">Set a new password</h1>
        </div>

        <div className="rounded-xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}
          {checking?<p role="status">Checking your recovery session…</p>:!verified?<div><p className="text-sm text-white">Open the newest password-reset email link first.</p><Link className="text-sm" style={{color:GOLD}} to="/login">Return to sign in</Link></div>:<form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>New password</label>
              <input aria-label="New password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Confirm password</label>
              <input aria-label="Confirm password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
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
