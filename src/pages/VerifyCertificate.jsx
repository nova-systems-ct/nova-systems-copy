import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, XCircle, Search } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#C9A84C";

// Public verification page for Nova Sales Academy certificates — the certificate PDF itself
// (generateCertificatePDF) points here with a verification code. No authentication required;
// this only ever reveals the same non-sensitive fields already printed on the certificate
// (holder name, program title, issue date) — never anything else about the rep's account.
export default function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [result, setResult] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useSEO({ title: "Verify a Certificate — Nova Systems", description: "Verify the authenticity of a Nova Sales Academy certificate." });

  const verify = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setChecked(false);
    try {
      const r = await fetch(`/api/academy?action=verify-certificate&code=${encodeURIComponent(code.trim())}`);
      const data = await r.json();
      setResult(data);
    } catch {
      setResult({ valid: false });
    }
    setChecked(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20" style={{ background: "#0A0A0A" }}>
      <div className="w-full max-w-md">
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>
          NOVA SYSTEMS
        </p>
        <h1 className="text-2xl font-black text-white text-center mb-2">Verify a Certificate</h1>
        <p className="text-center text-sm mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
          Enter the verification code printed on a Nova Sales Academy certificate.
        </p>

        <form onSubmit={verify} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            style={{ flex: 1, padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, outline: "none" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "12px 18px", background: GOLD, border: "none", borderRadius: 8, color: "#0a0800", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Search className="w-4 h-4" /> {loading ? "…" : "Verify"}
          </button>
        </form>

        {checked && result && (
          result.valid ? (
            <div style={{ padding: 24, borderRadius: 14, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "#4ade80" }} />
                <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>Valid Nova Systems Certificate</p>
              </div>
              {[
                ["Holder", result.holder_name],
                ["Program", result.program_title],
                ["Certificate No.", result.certificate_number],
                ["Issued", result.issued_at ? new Date(result.issued_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"],
                ["Issuer", result.issuer],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{label}</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
                This is a Nova-issued internal credential, not an independent third-party accreditation.
              </p>
            </div>
          ) : (
            <div style={{ padding: 24, borderRadius: 14, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <XCircle className="w-5 h-5" style={{ color: "#f87171" }} />
              <p style={{ color: "#f87171", fontSize: 13 }}>No certificate found for that code.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
