import React, { useState, useEffect } from "react";
import { FileText, Loader, Send, Save } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getClients, getLeads, getDocuments, upsertDocument, logActivity } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const DOC_TYPES = ["Proposal", "Contract", "Invoice", "MOU", "Custom"];

export default function CRMDocuments() {
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({ entityType: "client", entityId: "", docType: "Proposal", description: "" });
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setClients(getClients());
    setLeads(getLeads());
    setDocuments(getDocuments());
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const entities = form.entityType === "client" ? clients : leads;
  const selectedEntity = entities.find(e => e.id === form.entityId);

  const generate = async () => {
    if (!form.entityId || !form.description) return;
    setLoading(true);
    setGenerated("");

    const entityName = selectedEntity?.name || "";
    const prompt = `Generate a professional ${form.docType} document for Nova Systems (a Connecticut-based operational infrastructure company) for the client/lead: ${entityName}. 

Details: ${form.description}

Format it as a clean, professional business document with proper sections, headings, and language. Include Nova Systems' contact info (Connecticut, USA | hello@nova-systems.app) and today's date (${new Date().toLocaleDateString()}).`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": window.__ANTHROPIC_KEY__ || "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 2000,
          system: "You are a professional business document writer for Nova Systems, a Connecticut-based operational infrastructure company. Generate professional, concise business documents.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.content?.[0]?.text) {
        setGenerated(data.content[0].text);
      } else {
        // Fallback: generate a template locally
        setGenerated(generateFallback(form.docType, entityName, form.description));
      }
    } catch {
      setGenerated(generateFallback(form.docType, entityName, form.description));
    }
    setLoading(false);
  };

  const generateFallback = (type, entity, desc) => `# ${type.toUpperCase()}

**Nova Systems**
Connecticut, USA | hello@nova-systems.app
Date: ${new Date().toLocaleDateString()}

---

**Prepared for:** ${entity}

**Subject:** ${type} — ${desc}

---

## Overview

This ${type.toLowerCase()} outlines the services and terms proposed by Nova Systems for ${entity}.

${desc}

---

## Terms

- All services are delivered as described above
- Payment terms: Net 30
- This ${type.toLowerCase()} is valid for 30 days from the date above

---

**Nova Systems**
Isaac Nova | Founder
Connecticut, USA`;

  const saveDoc = () => {
    if (!generated) return;
    const doc = {
      id: `doc-${Date.now()}`,
      client_id: form.entityType === "client" ? form.entityId : null,
      lead_id: form.entityType === "lead" ? form.entityId : null,
      type: form.docType,
      entity_name: selectedEntity?.name || "",
      content: generated,
      sent: false,
      created_at: new Date().toISOString(),
    };
    upsertDocument(doc);
    logActivity(`${form.docType} generated for ${selectedEntity?.name}`);
    setDocuments(getDocuments());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <div className="mb-8">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
          <h1 className="text-2xl font-black text-white">Documents</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>AI-powered document generator for proposals, contracts, and more.</p>
        </div>

        {/* Generator */}
        <div className="rounded-2xl p-7 mb-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: GOLD }}>GENERATE DOCUMENT</p>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <CRMField label="For (Client or Lead)">
              <div className="flex gap-2 mb-2">
                {["client", "lead"].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, entityType: t, entityId: "" }))}
                    className="px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all capitalize"
                    style={{
                      background: form.entityType === t ? `${GOLD}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${form.entityType === t ? GOLD + "40" : "rgba(255,255,255,0.1)"}`,
                      color: form.entityType === t ? GOLD : "rgba(255,255,255,0.35)",
                      cursor: "pointer",
                    }}>{t}</button>
                ))}
              </div>
              <select value={form.entityId} onChange={set("entityId")} style={{ ...inputStyle, appearance: "none" }}>
                <option value="" style={{ background: "#111" }}>Select {form.entityType}...</option>
                {entities.map(e => <option key={e.id} value={e.id} style={{ background: "#111" }}>{e.name}</option>)}
              </select>
            </CRMField>
            <CRMField label="Document Type">
              <select value={form.docType} onChange={set("docType")} style={{ ...inputStyle, appearance: "none" }}>
                {DOC_TYPES.map(t => <option key={t} value={t} style={{ background: "#111" }}>{t}</option>)}
              </select>
            </CRMField>
          </div>
          <CRMField label="Describe what you need *">
            <textarea rows={3} placeholder="e.g. Monthly retainer proposal for website management, $1,000/mo, 3-month contract, includes hosting and content updates..."
              value={form.description} onChange={set("description")}
              style={{ ...inputStyle, resize: "none" }} onFocus={onFocus} onBlur={onBlur} />
          </CRMField>
          <button onClick={generate} disabled={loading || !form.entityId || !form.description}
            className="mt-4 flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer", opacity: (!form.entityId || !form.description || loading) ? 0.5 : 1 }}>
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? "GENERATING..." : "GENERATE WITH AI"}
          </button>
        </div>

        {/* Preview */}
        {generated && (
          <div className="rounded-2xl p-7 mb-8" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}30` }}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold" style={{ color: GOLD }}>PREVIEW</p>
              <div className="flex gap-2">
                <button onClick={saveDoc}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-85"
                  style={{ border: `1px solid ${GOLD}40`, color: GOLD, background: saveSuccess ? `${GOLD}18` : `${GOLD}08`, cursor: "pointer" }}>
                  <Save className="w-3.5 h-3.5" />
                  {saveSuccess ? "SAVED!" : "SAVE"}
                </button>
              </div>
            </div>
            <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "inherit" }}>
              {generated}
            </pre>
          </div>
        )}

        {/* Saved documents */}
        <div>
          <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>SAVED DOCUMENTS ({documents.length})</p>
          {documents.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No documents saved yet. Generate one above.</p>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="rounded-xl p-5 flex items-center justify-between"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{doc.type}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full"
                        style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}25` }}>
                        {doc.entity_name}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: doc.sent ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)", color: doc.sent ? "#4ade80" : "rgba(255,255,255,0.3)", border: `1px solid ${doc.sent ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                      {doc.sent ? "SENT" : "DRAFT"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CRMSidebar>
  );
}