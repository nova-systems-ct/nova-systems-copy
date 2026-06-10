import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ExternalLink, ArrowRight } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import CRMModal from "@/components/crm/CRMModal";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getClients, upsertClient, logActivity } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const INDUSTRIES = ["Technology", "Restaurant", "Barbershop", "Religious / Ministry", "Education", "Retail", "Healthcare", "Real Estate", "Entertainment", "Other"];
const SERVICES_LIST = ["Custom Website", "Supabase CMS", "Admin Dashboard", "Email via Resend", "SEO", "Social Media", "Content Creation", "Drone Footage", "AI Chatbot", "CRM Setup"];

const emptyForm = {
  name: "", owner_name: "", industry: "", email: "", phone: "",
  website: "", domain: "", services: [], monthly_rate: "", contract_start: "", status: "active", notes: "",
};

export default function CRMClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { setClients(getClients()); }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.owner_name || "").toLowerCase().includes(q);
    const matchI = filterIndustry === "All" || c.industry === filterIndustry;
    return matchQ && matchI;
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleService = (s) => setForm((f) => ({
    ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s],
  }));

  const save = () => {
    if (!form.name) return;
    const client = { ...form, id: `client-${Date.now()}`, created_at: new Date().toISOString(), monthly_rate: Number(form.monthly_rate) || 0 };
    upsertClient(client);
    logActivity(`New client added: ${client.name}`);
    setClients(getClients());
    setShowModal(false);
    setForm(emptyForm);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
            <h1 className="text-2xl font-black text-white">Clients</h1>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
            <Plus className="w-3.5 h-3.5" /> Add Client
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />
            <input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }} />
          </div>
          <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}
            style={{ ...inputStyle, width: "auto", appearance: "none", paddingRight: 28 }}>
            <option style={{ background: "#111" }}>All</option>
            {INDUSTRIES.map(i => <option key={i} style={{ background: "#111" }}>{i}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id}
              className="rounded-xl p-6 cursor-pointer transition-all hover:border-opacity-60 group"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onClick={() => navigate(`/dashboard/clients/${c.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                  {c.name[0].toUpperCase()}
                </div>
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: c.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                    color: c.status === "active" ? "#4ade80" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${c.status === "active" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {c.status?.toUpperCase() || "ACTIVE"}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{c.name}</h3>
              <p className="text-[11px] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{c.industry}</p>
              {c.website && (
                <div className="flex items-center gap-1 mb-3">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                  <span className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{c.website}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: GOLD }}>
                  {c.monthly_rate > 0 ? `$${c.monthly_rate}/mo` : "Pro Bono"}
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="md:col-span-3 rounded-xl p-16 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white font-bold mb-2">No clients found</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Add your first client to get started.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CRMModal title="Add Client" onClose={() => setShowModal(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Business Name *"><input required placeholder="Mars Hill Apologetics" value={form.name} onChange={set("name")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Owner Name"><input placeholder="John Doe" value={form.owner_name} onChange={set("owner_name")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Email"><input type="email" placeholder="owner@email.com" value={form.email} onChange={set("email")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Phone"><input type="tel" placeholder="+1 (860) 000-0000" value={form.phone} onChange={set("phone")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Industry">
                <select value={form.industry} onChange={set("industry")} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="" style={{ background: "#111" }}>Select</option>
                  {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: "#111" }}>{i}</option>)}
                </select>
              </CRMField>
              <CRMField label="Status">
                <select value={form.status} onChange={set("status")} style={{ ...inputStyle, appearance: "none" }}>
                  {["active","inactive","prospect"].map(s => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
                </select>
              </CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Website URL"><input placeholder="example.com" value={form.website} onChange={set("website")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Domain"><input placeholder="example.com" value={form.domain} onChange={set("domain")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CRMField label="Monthly Rate ($)"><input type="number" placeholder="0" value={form.monthly_rate} onChange={set("monthly_rate")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
              <CRMField label="Contract Start"><input type="date" value={form.contract_start} onChange={set("contract_start")} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            </div>
            <CRMField label="Services We Provide">
              <div className="flex flex-wrap gap-2 mt-1">
                {SERVICES_LIST.map(s => (
                  <button key={s} type="button" onClick={() => toggleService(s)}
                    className="text-[10px] px-3 py-1.5 rounded-full font-semibold transition-all"
                    style={{
                      background: form.services.includes(s) ? `${GOLD}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${form.services.includes(s) ? GOLD : "rgba(255,255,255,0.1)"}`,
                      color: form.services.includes(s) ? GOLD : "rgba(255,255,255,0.4)",
                      cursor: "pointer",
                    }}>{s}</button>
                ))}
              </div>
            </CRMField>
            <CRMField label="Notes"><textarea rows={3} placeholder="Any notes about this client..." value={form.notes} onChange={set("notes")} style={{ ...inputStyle, resize: "none" }} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <button onClick={save}
              className="w-full py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
              SAVE CLIENT
            </button>
          </div>
        </CRMModal>
      )}
    </CRMSidebar>
  );
}