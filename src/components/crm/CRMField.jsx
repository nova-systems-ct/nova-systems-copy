import React from "react";

const GOLD = "#D4A030";

export const inputStyle = {
  width: "100%", padding: "11px 14px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box",
};

export const labelStyle = {
  display: "block", fontSize: 9, fontWeight: 700,
  letterSpacing: "0.22em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", marginBottom: 6,
};

export function CRMField({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function onFocus(e) { e.target.style.borderColor = `${GOLD}70`; }
export function onBlur(e) { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }