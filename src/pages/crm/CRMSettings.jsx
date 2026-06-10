import React, { useState } from "react";
import { Save, Eye, EyeOff } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export default function CRMSettings() {
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10 max-w-2xl">
        <div className="mb-8">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
          <h1 className="text-2xl font-black text-white">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <Section title="YOUR PROFILE">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CRMField label="Full Name">
                  <input defaultValue="Isaac Nova" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
                <CRMField label="Email">
                  <input defaultValue="Isaac_0427@icloud.com" type="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
              </div>
              <CRMField label="Phone">
                <input defaultValue="+1 (860) 000-0000" type="tel" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </CRMField>
            </div>
          </Section>

          {/* Business */}
          <Section title="BUSINESS INFO">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CRMField label="Business Name">
                  <input defaultValue="Nova Systems" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
                <CRMField label="Website">
                  <input defaultValue="nova-systems.app" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
              </div>
              <CRMField label="Location">
                <input defaultValue="Connecticut, USA" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </CRMField>
            </div>
          </Section>

          {/* Change Password */}
          <Section title="CHANGE PASSWORD">
            <div className="space-y-4">
              <CRMField label="Current Password">
                <input type="password" placeholder="••••••••" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </CRMField>
              <div className="grid grid-cols-2 gap-4">
                <CRMField label="New Password">
                  <input type="password" placeholder="••••••••" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
                <CRMField label="Confirm Password">
                  <input type="password" placeholder="••••••••" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
              </div>
            </div>
          </Section>

          {/* API Keys */}
          <Section title="API KEYS">
            <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>API keys are stored as environment variables on the server. Never share these.</p>
            <div className="space-y-4">
              {[
                { label: "Resend API Key", value: "re_••••••••••••••••" },
                { label: "Anthropic API Key", value: "sk-ant-••••••••••••" },
              ].map(({ label, value }) => (
                <CRMField key={label} label={label}>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      defaultValue={value}
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={onFocus} onBlur={onBlur}
                      readOnly
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </CRMField>
              ))}
            </div>
          </Section>

          <button onClick={save}
            className="flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
            <Save className="w-4 h-4" />
            {saved ? "SAVED!" : "SAVE SETTINGS"}
          </button>
        </div>
      </div>
    </CRMSidebar>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: GOLD }}>{title}</p>
      {children}
    </div>
  );
}