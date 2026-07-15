import React, { useRef, useEffect, useState } from "react";
import { Check } from "lucide-react";

export const GOLD = "#C8A96E";
export const GOLD_DARK = "#8a6a3a";
export const GOLD_BRIGHT = "#D9BE86";
export const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

export const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
  color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
export const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8,
};

export function Asterisk() {
  return <span style={{ color: GOLD }}> *</span>;
}

export function Field({ label, required, error, hint, children }) {
  return (
    <div>
      {label && <label style={lbl}>{label}{required && <Asterisk />}</label>}
      {children}
      {hint && <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 5 }}>{hint}</p>}
      {error && <p style={{ color: "#e05252", fontSize: 11, marginTop: 5 }}>{error}</p>}
    </div>
  );
}

export function TextInput({ value, onChange, ...props }) {
  return <input value={value} onChange={onChange} style={inp} {...props} />;
}

export function TextArea({ value, onChange, minChars, rows = 5, ...props }) {
  return (
    <div>
      <textarea value={value} onChange={onChange} rows={rows} style={{ ...inp, resize: "vertical" }} {...props} />
      {typeof minChars === "number" && (
        <p style={{ fontSize: 11, marginTop: 5, color: value.length >= minChars ? "rgba(255,255,255,0.35)" : GOLD }}>
          {value.length} / {minChars} characters minimum
        </p>
      )}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder = "Select an option" }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
    </select>
  );
}

export function Pill({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 8,
        border: `1px solid ${selected ? GOLD : "rgba(255,255,255,0.15)"}`,
        background: selected ? "rgba(200,169,110,0.12)" : "rgba(255,255,255,0.03)",
        color: selected ? GOLD : "rgba(255,255,255,0.7)",
        cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export function PillGroup({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => <Pill key={o} selected={value === o} onClick={() => onChange(o)}>{o}</Pill>)}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, required }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center",
          background: checked ? GOLD : "transparent", border: `1px solid ${checked ? GOLD : "rgba(255,255,255,0.3)"}`,
        }}
      >
        {checked && <Check style={{ width: 12, height: 12, color: "#0a0800" }} />}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
        {children}{required && <Asterisk />}
      </span>
    </label>
  );
}

export function SectionCard({ children, style }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  );
}

// Mouse + touch signature capture. Exposes the drawn image via onChange(dataUrl|"").
export function SignaturePad({ onChange }) {
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
    ctx.strokeStyle = "#fff";
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
        style={{ width: "100%", height: 150, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, touchAction: "none", cursor: "crosshair" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <button type="button" onClick={clear} style={{ marginTop: 8, background: "none", border: "none", color: GOLD, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Clear Signature
      </button>
    </div>
  );
}

export function CheckmarkAnimation() {
  return (
    <div style={{ width: 90, height: 90, margin: "0 auto", position: "relative" }}>
      <svg viewBox="0 0 90 90" style={{ width: "100%", height: "100%" }}>
        <circle cx="45" cy="45" r="42" fill="none" stroke={GOLD} strokeWidth="3"
          style={{ strokeDasharray: 264, strokeDashoffset: 264, animation: "intakeCircle 0.6s ease-out forwards" }} />
        <path d="M27 46 L40 59 L64 32" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 60, strokeDashoffset: 60, animation: "intakeCheck 0.4s ease-out 0.5s forwards" }} />
      </svg>
      <style>{`
        @keyframes intakeCircle { to { stroke-dashoffset: 0; } }
        @keyframes intakeCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

// Small "Saved just now" indicator that fades in on trigger and back out after a beat.
export function useSavedFlash() {
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  const flash = () => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 1800);
  };
  return [visible, flash];
}
