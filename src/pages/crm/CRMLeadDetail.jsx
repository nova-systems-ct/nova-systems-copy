import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getLead, upsertLead, logActivity, STAGE_LABELS, STAGE_COLORS } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const TABS = ["Overview", "Notes"];

export default function CRMLeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState("");

  useEffect(() => {
    const l = getLead(id);
    setLead(l || null);
    setNotes(l?.notes || "");
    setStage(l?.stage || "new_contact");
  }, [id]);

  if (!lead) return (
    <CRMSidebar>
      <div className="p-10 text-center">
        <p className="text-white font-bold mb-2">Lead not found</p>
        <button onClick={() => navigate("/dashboard/leads")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
      </div>
    </CRMSidebar>
  );

  const stageStyle = STAGE_COLORS[stage] || STAGE_COLORS.new_contact;

  const updateStage = (newStage) => {
    const updated = { ...lead, stage: newStage };
    upsertLead(updated);
    setLead(updated);
    setStage(newStage);
    logActivity(`${lead.name} stage → ${STAGE_LABELS[newStage]}`);
  };

  const saveNotes = () => {
    const updated = { ...lead, notes };
    upsertLead(updated);
    setLead(updated);
    logActivity(`Notes updated for lead: ${lead.name}`);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <button onClick={() => navigate("/dashboard/leads")}
          className="flex items-center gap-2 text-xs mb-6 hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </button>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-black text-white">{lead.name}</h1>
              <span className="text-[9px] font-bold tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: stageStyle.bg, border: `1px solid ${stageStyle.border}`, color: stageStyle.color }}>
                {STAGE_LABELS[stage] || stage}
              </span>
              {lead.industry && (
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                  {lead.industry}
                </span>
              )}
            </div>
            {lead.contact_name && <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Contact: {lead.contact_name}</p>}
          </div>
          {lead.potential_value && (
            <div className="text-right">
              <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>POTENTIAL VALUE</p>
              <p className="text-lg font-black" style={{ color: GOLD }}>{lead.potential_value}</p>
            </div>
          )}
        </div>

        {/* Stage selector */}
        <div className="mb-8 rounded-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>PIPELINE STAGE</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STAGE_LABELS).map(([key, label]) => {
              const s = STAGE_COLORS[key];
              return (
                <button key={key} onClick={() => updateStage(key)}
                  className="text-[9px] font-bold tracking-[0.15em] px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: stage === key ? s.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${stage === key ? s.border : "rgba(255,255,255,0.1)"}`,
                    color: stage === key ? s.color : "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all"
              style={{
                color: tab === t ? GOLD : "rgba(255,255,255,0.35)",
                borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                background: "none", border: "none", borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                cursor: "pointer", marginBottom: -1,
              }}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl p-6 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>CONTACT INFO</p>
              <Row label="Contact" value={lead.contact_name} />
              <Row label="Email" value={lead.email} />
              <Row label="Phone" value={lead.phone} />
              <Row label="Industry" value={lead.industry} />
              {lead.meeting_date && <Row label="Meeting" value={new Date(lead.meeting_date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} />}
            </div>
            <div className="space-y-4">
              {lead.what_they_want && (
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>WHAT THEY WANT</p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{lead.what_they_want}</p>
                </div>
              )}
              {lead.what_they_need && (
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>WHAT THEY NEED</p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{lead.what_they_need}</p>
                </div>
              )}
              {lead.next_steps && (
                <div className="rounded-xl p-5" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
                  <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-2" style={{ color: GOLD }}>NEXT STEPS</p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{lead.next_steps}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "Notes" && (
          <div>
            <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>NOTES</p>
            <textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add timestamped notes about this lead..."
              style={{ ...inputStyle, resize: "none", width: "100%" }}
              onFocus={onFocus} onBlur={onBlur} />
            <button onClick={saveNotes}
              className="mt-4 px-6 py-2.5 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
              SAVE NOTES
            </button>
          </div>
        )}
      </div>
    </CRMSidebar>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-[9px] tracking-[0.18em] uppercase w-20 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{value}</span>
    </div>
  );
}