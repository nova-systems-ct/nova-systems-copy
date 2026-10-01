import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";

const GOLD = "#C9A84C";
const G = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

export default function OnboardSuccess() {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${GOLD}15`, border: `2px solid ${GOLD}60`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
          <CheckCircle2 style={{ width: 34, height: 34, color: GOLD }} />
        </div>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>PAYMENT SUBMITTED</p>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 14 }}>Welcome to Nova Systems.</h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Your payment was submitted. You will receive a receipt by email once the payment provider confirms it — your plan starts after that confirmation.
        </p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 22, marginBottom: 28, textAlign: "left" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>What happens next</p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Nova will contact you to schedule the kickoff", "Keep the payment receipt email for your records"].map((s) => (
              <li key={s} style={{ display: "flex", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                <span style={{ color: GOLD }}>•</span> {s}
              </li>
            ))}
          </ul>
        </div>

        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          BACK TO NOVA SYSTEMS <ArrowRight style={{ width: 14, height: 14 }} />
        </Link>
      </div>
    </div>
  );
}
