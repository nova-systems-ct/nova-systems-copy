import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const inputStyle = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, color: "#fff", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};

// SHA-256 — must match exactly how ApplicationForm.jsx hashes on submit
async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// localStorage fallback — used when Supabase is not yet configured
function checkLocalStorage(email, password_hash) {
  console.log("[applicant-login] Falling back to localStorage check");

  const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
  console.log("[applicant-login] localStorage applications count:", apps.length);

  const emailMatch = apps.find((a) => a.email?.toLowerCase() === email.toLowerCase());
  console.log("[applicant-login] Email found in localStorage:", !!emailMatch);

  if (!emailMatch) return { result: "no_account" };

  const fullMatch = apps.find(
    (a) => a.email?.toLowerCase() === email.toLowerCase() && a.password_hash === password_hash
  );
  console.log("[applicant-login] Hash match in localStorage:", !!fullMatch);

  if (!fullMatch) return { result: "wrong_password" };

  return {
    result: "ok",
    application: {
      id:       fullMatch.id,
      email:    fullMatch.email,
      name:     fullMatch.name,
      position: fullMatch.position,
      status:   fullMatch.status,
    },
  };
}

export default function ApplicantLogin() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("nova_applicant_session") || "null");
    if (session) {
      if (session.isEmployee) navigate("/employee-dashboard");
      else navigate("/application-status");
    }
  }, []);

  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur  = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const pw_hash = await hashPassword(password);

    console.log("[applicant-login] Attempting login for:", normalizedEmail);
    console.log("[applicant-login] Password hash computed:", pw_hash.slice(0, 12) + "...");

    let outcome;

    try {
      const res = await fetch("/api/intake?action=check-applicant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password_hash: pw_hash }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      console.log("[applicant-login] API response:", data.mode || data.result);

      if (data.mode === "localStorage") {
        // Supabase not configured — fall back to localStorage
        outcome = checkLocalStorage(normalizedEmail, pw_hash);
      } else {
        outcome = data;
      }
    } catch (err) {
      console.error("[applicant-login] API call failed:", err.message);
      // Network error — fall back to localStorage so local dev still works
      outcome = checkLocalStorage(normalizedEmail, pw_hash);
    }

    console.log("[applicant-login] Final outcome:", outcome?.result);

    setLoading(false);

    if (outcome.result === "no_account") {
      setError("No account found. Please apply first at /careers");
      return;
    }

    if (outcome.result === "wrong_password") {
      setError("Incorrect password. Try again or re-apply at /careers if you forgot it.");
      return;
    }

    if (outcome.result === "ok") {
      localStorage.setItem(
        "nova_applicant_session",
        JSON.stringify({
          id:            outcome.application.id,
          email:         outcome.application.email,
          applicationId: outcome.application.id,
          isEmployee:    outcome.application.isEmployee || false,
        })
      );
      navigate("/application-status");
      return;
    }

    // Fallback for unexpected API response
    setError("Something went wrong. Please try again.");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-20">
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
          Sign in with the email and password you created during your application.
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

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 rounded-lg transition-opacity hover:opacity-85"
            style={{ background: G, color: "#0a0800", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              : <><span>SIGN IN</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          Don&apos;t have an account?{" "}
          <a href="/careers" style={{ color: GOLD }}>Apply for a position first</a>
        </p>
      </div>
    </div>
  );
}
