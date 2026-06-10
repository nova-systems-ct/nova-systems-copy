import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ArrowRight, Calendar } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import CRMModal from "@/components/crm/CRMModal";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getLeads, upsertLead, logActivity, STAGE_LABELS, STAGE_COLORS } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const INDUSTRIES = ["Barbershop", "Restaurant", "Education", "Technology", "Retail", "Healthcare", "Real Estate", "Entertainment", "Religious / Ministry", "Other"];

const emptyForm = {
  name: "", contact_name: "", industry: "", email: "", phone: "",
  stage: "new_contact", potential_value: "", what_they_want: "", what_they_need: "",
  next_steps: "", meeting_date: "", notes: "",
};

export default function CRMLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("All");
  const [filterIndustry, setFilterIndustry] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { setLeads(getLeads()); }, []);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name.toLowerCase().includes(q) || (l.contact_name || "").toLowerCase().includes(q);
    const matchS = filterStage === "All" || l.stage === filterStage;
    const matchI = filterIndustry === "All" || l.industry === filterIndustry;
    return matchQ && matchS && matchI;
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => {
    if (!form.name) return;
    const lead = { ...form, id: `lead-${Date.now()}`, created_at: new Date().toISOString() };
    upsertLead(lead);
    logActivity(`New lead added: ${lead.name}`);
    setLeads(getLeads());
    setShowModal(false);
    setForm(emptyForm);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
            <h1 className="text-2xl font-black text-white">Leads</h1>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />
            <input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }} />
          </div>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
            style={{ ...inputStyle, width: "auto", appearance: "none" }}>
            <option value="All" style={{ background: "#111" }}>All Stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k} style={{ background: "#111" }}>{v}</option>)}
          </select>
          <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}
            style={{ ...inputStyle, width: "auto", appearance: "none" }}>
            <option value="All" style={{ background: "#111" }}>All Industries</option>
            {INDUSTRIES.map(i => <option key={i} style={{ background: "#111" }}>{i}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((lead) => {
            const stageStyle = STAGE_COLORS[lead.stage] || STAGE_COLORS.new_contact;
            return (
              <div key={lead.id}
                className="rounded-xl p-5 cursor-pointer transition-all group"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                    {lead.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-white text-sm">{lead.name}</p>
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: stageStyle.bg, border: `1px solid ${stageStyle.border}`, color: stageStyle.color }}>
                        {STAGE_LABELS[lead.stage] || lead.stage}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {lead.contact_name && <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{lead.contact_name}</span>}
                      {lead.industry && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>{lead.industry}</span>}
                      {lead.meeting_date && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: GOLD }}>
                          <Calendar className="w-3 h-3" />
                          {new Date(lead.meeting_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {lead.potential_value && <p className="text-xs font-bold" style={{ color: GOLD }}>{lead.potential_value}</p>}
                    <ArrowRight className="w-4 h-4 ml-auto mt-1 transition-transform group-hover:translate-x-1" style={{ color: "rgba(255,255,255,0.2)" }} />
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl p-16 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white font-bold mb-2">No leads found</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Add your first lead to start building your pipeline.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CRMModal title="Add Lead" onClose={() => setShowModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Business Name *"><input required placeholder="Flow Barbershop" value={form.name} onChange={set("name")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Contact Name"><input placeholder="John Doe" value={form.contact_name} onChange={set("contact_name")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Industry">
                <select value={form.industry} onChange={set("industry")} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="" style={{ background: "#111" }}>Select</option>
                  {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: "#111" }}>{i}</option>)}
                </select>
              </CRMField>
              <CRMField label="Stage">
                <select value={form.stage} onChange={set("stage")} style={{ ...inputStyle, appearance: "none" }}>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k} style={{ background: "#111" }}>{v}</option>)}
                </select>
              </CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Email"><input type="email" value={form.email} onChange={set("email")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Phone"><input type="tel" value={form.phone} onChange={set("phone")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <CRMField label="Potential Value"><input placeholder="$1,500 startup + $1,000/mo" value={form.potential_value} onChange={set("potential_value")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="What They Want"><textarea rows={2} value={form.what_they_want} onChange={set("what_they_want")} style={{ ...inputStyle, resize: "none" }} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="Next Steps"><input value={form.next_steps} onChange={set("next_steps")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="Meeting Date / Time"><input type="datetime-local" value={form.meeting_date} onChange={set("meeting_date")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="Notes"><textarea rows={2} value={form.notes} onChange={set("notes")} style={{ ...inputStyle, resize: "none" }} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <button onClick={save}
              className="w-full py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
              SAVE LEAD
            </button>
          </div>
        </CRMModal>
      )}
    </CRMSidebar>
  );
}