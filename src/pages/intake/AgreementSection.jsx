import React from "react";
import { Checkbox, Field, TextInput, SignaturePad, G } from "./ui";

const REQUIRED_AGREEMENTS = [
  ["agree_terms", <>I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Terms of Service</a></>],
  ["agree_privacy", <>I have read and agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a></>],
  ["agree_audit_authorization", "I authorize Nova Systems to perform a digital business audit using publicly available information and information I have provided"],
  ["agree_no_services_until_signed", "I understand no services begin until a final service agreement is signed and payment is confirmed"],
  ["agree_no_charge_today", "I understand no payment will be charged today"],
  ["agree_cancellation_policy", "I understand the cancellation policy described above"],
];

const OPTIONAL_AGREEMENTS = [
  ["sms_consent", "I agree to receive SMS text messages from Nova Systems"],
  ["email_consent", "I agree to receive emails from Nova Systems"],
  ["call_consent", "I agree to receive phone calls from Nova Systems and its authorized AI agents"],
];

export default function AgreementSection({ form, onChange, onSubmit, submitting, error }) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Required</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {REQUIRED_AGREEMENTS.map(([key, label]) => (
            <Checkbox key={key} checked={form[key]} onChange={(v) => onChange({ [key]: v })} required>{label}</Checkbox>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Communication Preferences</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {OPTIONAL_AGREEMENTS.map(([key, label]) => (
            <Checkbox key={key} checked={form[key]} onChange={(v) => onChange({ [key]: v })}>{label}</Checkbox>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>AI Authorization</p>
        <Checkbox checked={form.ai_authorization} onChange={(v) => onChange({ ai_authorization: v })} required>
          I authorize Nova Systems and its AI systems to analyze the information I provide for the purpose of generating reports, proposals, and business insights
        </Checkbox>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>Digital Signature</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Type Your Full Legal Name" required>
            <TextInput value={form.digital_signature} onChange={(e) => onChange({ digital_signature: e.target.value })} placeholder="Full legal name" />
          </Field>
          <Field label="Draw Your Signature">
            <SignaturePad onChange={(dataUrl) => onChange({ signature_image: dataUrl })} />
          </Field>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>Date: {today}</p>
        </div>
      </div>

      {error && <p style={{ color: "#e05252", fontSize: 12.5 }}>{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        style={{
          width: "100%", padding: "19px", fontSize: 13, fontWeight: 800,
          letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 10, border: "none",
          cursor: submitting ? "not-allowed" : "pointer",
          background: submitting ? "#5a4d1e" : G, color: "#0a0800", fontFamily: "inherit",
        }}
      >
        {submitting ? "Submitting..." : "Submit Assessment"}
      </button>
    </>
  );
}
