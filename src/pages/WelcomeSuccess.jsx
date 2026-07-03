import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export default function WelcomeSuccess() {
  const [params] = useSearchParams();
  const clientId = params.get("client_id");
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    fetch("/api/intake?action=clients")
      .then((r) => r.json())
      .then((list) => setClient(Array.isArray(list) ? list.find((c) => c.id === clientId) : null))
      .catch(() => {});
  }, [clientId]);

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${GOLD}15`, border: `2px solid ${GOLD}60`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
          <CheckCircle2 style={{ width: 34, height: 34, color: GOLD }} />
        </div>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>PAYMENT CONFIRMED</p>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 14 }}>Welcome to Nova Systems.</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          {client?.tier_name ? <>Your <strong style={{ color: GOLD }}>{client.tier_name}</strong> plan is now active.</> : "Your plan is now active."}
          {" "}A confirmation email with your client portal login has been sent to your inbox.
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 22, marginBottom: 28, textAlign: "left" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>What happens next</p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Isaac will personally reach out within 24 hours", "Your signed contract is saved in Nova Vault", "Log in to Nova Connect to track progress"].map((s) => (
              <li key={s} style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                <span style={{ color: GOLD }}>•</span> {s}
              </li>
            ))}
          </ul>
        </div>

        <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          GO TO CLIENT PORTAL <ArrowRight style={{ width: 14, height: 14 }} />
        </Link>
      </div>
    </div>
  );
}
