import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { ArrowRight, Download } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#C8A96E";
const GOLD_DARK = "#8a6a3a";
const GOLD_BRIGHT = "#D9BE86";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

function CheckmarkAnimation() {
  return (
    <div style={{ width: 90, height: 90, margin: "0 auto", position: "relative" }}>
      <svg viewBox="0 0 90 90" style={{ width: "100%", height: "100%" }}>
        <circle cx="45" cy="45" r="42" fill="none" stroke={GOLD_DARK} strokeWidth="3"
          style={{ strokeDasharray: 264, strokeDashoffset: 264, animation: "signCircle 0.6s ease-out forwards" }} />
        <path d="M27 46 L40 59 L64 32" fill="none" stroke={GOLD_DARK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "signCheck 0.4s ease-out 0.5s forwards" }} />
      </svg>
      <style>{`
        @keyframes signCircle { to { stroke-dashoffset: 0; } }
        @keyframes signCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

export default function SignSuccess() {
  const { contract_id } = useParams();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState(location.state?.pdf_url || "");

  useSEO({ title: "Contract Signed — Nova Systems", description: "Your Nova Systems agreement has been signed." });

  useEffect(() => {
    if (pdfUrl) return;
    (async () => {
      try {
        const r = await fetch(`/api/contracts?action=get&id=${encodeURIComponent(contract_id)}`);
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.pdf_url) setPdfUrl(data.pdf_url);
      } catch {
        // non-fatal — the download button just won't show a link yet
      }
    })();
  }, [contract_id, pdfUrl]);

  const downloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (location.state?.pdf_base64) {
      const a = document.createElement("a");
      a.href = location.state.pdf_base64;
      a.download = `Nova-Systems-Signed-Agreement.pdf`;
      a.click();
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <img src={novaLogo} alt="Nova Systems" style={{ width: 44, height: 44, objectFit: "contain", margin: "0 auto 20px" }} />
        <CheckmarkAnimation />
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111", marginTop: 22, marginBottom: 10 }}>Contract Signed.</h1>
        <p style={{ color: "rgba(0,0,0,0.55)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Thank you{location.state?.signed_name ? `, ${location.state.signed_name.split(" ")[0]}` : ""}. Your agreement has been signed
          and a copy has been emailed to you. We will be in touch within 24 hours to get started.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={downloadPdf}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", border: "1px solid rgba(0,0,0,0.15)", color: "#111", borderRadius: 9, fontSize: 12, fontWeight: 700, background: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Download style={{ width: 14, height: 14 }} /> Download PDF
          </button>
          <a
            href="https://nova-systems.app"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 28px", background: G, color: "#0a0800", borderRadius: 9, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
          >
            Go to nova-systems.app <ArrowRight style={{ width: 14, height: 14 }} />
          </a>
        </div>
      </div>
    </div>
  );
}
