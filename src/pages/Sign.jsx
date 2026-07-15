import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { useSEO } from "@/hooks/useSEO";
import { getContractContent } from "@/data/contractTemplates";
import { generateSignedContractPDF } from "@/utils/generatePdf";

const GOLD = "#C8A96E";
const GOLD_DARK = "#8a6a3a";
const GOLD_BRIGHT = "#D9BE86";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "#fafafa", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8,
  color: "#111", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "rgba(0,0,0,0.45)", marginBottom: 8,
};

// Canvas signature capture styled for the light /sign page (dark ink on a pale field).
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const point = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawn.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(hasDrawn.current ? canvasRef.current.toDataURL("image/png") : "");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 150, background: "#fafafa", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, touchAction: "none", cursor: "crosshair" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button type="button" onClick={clear} style={{ marginTop: 8, background: "none", border: "none", color: GOLD_DARK, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Clear Signature
      </button>
    </div>
  );
}

function Checkbox({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
          background: checked ? GOLD : "transparent", border: `1px solid ${checked ? GOLD : "rgba(0,0,0,0.3)"}`,
        }}
      >
        {checked && <Check style={{ width: 12, height: 12, color: "#fff" }} />}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(0,0,0,0.7)" }}>{children}</span>
    </label>
  );
}

function CenteredMessage({ title, body }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <img src={novaLogo} alt="Nova Systems" style={{ width: 48, height: 48, objectFit: "contain", margin: "0 auto 24px" }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 10 }}>{title}</h1>
        <p style={{ fontSize: 14, color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>{body}</p>
      </div>
    </div>
  );
}

export default function Sign() {
  const { contract_id } = useParams();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [typedName, setTypedName] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  useSEO({ title: "Sign Your Agreement — Nova Systems", description: "Review and sign your Nova Systems agreement." });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/contracts?action=get&id=${encodeURIComponent(contract_id)}`);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "This contract could not be found.");
        if (!cancelled) setContract(data);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "This contract could not be found.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [contract_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 style={{ width: 28, height: 28, color: GOLD_DARK }} className="animate-spin" />
      </div>
    );
  }

  if (loadError || !contract || !contract.id) {
    return <CenteredMessage title="Contract Not Found" body="This signing link is invalid. Please contact Nova Systems for a new link." />;
  }

  if (contract.expired) {
    return <CenteredMessage title="This Link Has Expired" body="This signing link has expired. Please contact hello@nova-systems.app or text (203) 706-0504 for a new link." />;
  }

  if (contract.status === "signed") {
    return (
      <CenteredMessage
        title="Already Signed"
        body={`This agreement was already signed by ${contract.signed_name || contract.client_name} on ${contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : "an earlier date"}.`}
      />
    );
  }

  const content = getContractContent(contract.contract_type, contract.custom_notes);

  const handleSubmit = async () => {
    if (!typedName.trim()) { setSubmitError("Please type your full legal name."); return; }
    if (!signatureImage) { setSubmitError("Please draw your signature."); return; }
    if (!agreed) { setSubmitError("You must agree to the terms in this document before signing."); return; }

    setSubmitting(true);
    setSubmitError("");

    let pdf_base64 = "";
    try {
      const doc = generateSignedContractPDF({
        title: content.title,
        intro: content.intro,
        sections: content.sections,
        clientName: contract.client_name,
        signedName: typedName,
        signatureDataUrl: signatureImage,
        signedDate: today,
      });
      pdf_base64 = doc.output("datauristring");
    } catch (err) {
      console.warn("[Sign] PDF generation failed (non-fatal):", err.message);
    }

    try {
      const r = await fetch("/api/contracts?action=sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contract.id, signed_name: typedName, signature_data: signatureImage, pdf_base64, agreed: true }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Something went wrong. Please try again.");

      navigate(`/sign/${contract.id}/success`, { state: { pdf_base64, signed_name: typedName, pdf_url: data.contract?.pdf_url || "" } });
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <header style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
          <img src={novaLogo} alt="Nova Systems" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#111" }}>Nova Systems</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD_DARK, marginBottom: 8 }}>
          Agreement for {contract.client_name}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111", marginBottom: 4 }}>{content.title}</h1>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", marginBottom: 36 }}>Please read the full agreement below before signing.</p>

        {content.intro && (
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(0,0,0,0.75)", marginBottom: 32 }}>{content.intro}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 48 }}>
          {content.sections.map((s) => (
            <section key={s.heading}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 8 }}>{s.heading}</h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.8, color: "rgba(0,0,0,0.68)", whiteSpace: "pre-line" }}>{s.body}</p>
            </section>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Sign This Agreement</h2>

          <div>
            <label style={lbl}>Type Your Full Legal Name</label>
            <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Full legal name" style={inp} />
          </div>

          <div>
            <label style={lbl}>Draw Your Signature</label>
            <SignaturePad onChange={setSignatureImage} />
          </div>

          <div>
            <label style={lbl}>Date</label>
            <p style={{ fontSize: 14, color: "#111" }}>{today}</p>
          </div>

          <Checkbox checked={agreed} onChange={setAgreed}>
            I have read and agree to all terms in this document.
          </Checkbox>

          {submitError && <p style={{ color: "#dc2626", fontSize: 13 }}>{submitError}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%", padding: "18px", fontSize: 13, fontWeight: 800,
              letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              background: submitting ? "#d9c9a3" : G,
              color: "#0a0800", fontFamily: "inherit",
            }}
          >
            {submitting ? "Submitting..." : "Sign and Submit"}
          </button>
        </div>
      </main>
    </div>
  );
}
