import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import CRMModal from "@/components/crm/CRMModal";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getClient, upsertClient, getInvoices, upsertInvoice, getDocuments, logActivity } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const TABS = ["Overview", "Services", "Invoices", "Documents", "Notes"];

export default function CRMClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [invoices, setInvoices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invForm, setInvForm] = useState({ description: "", amount: "", due_date: "" });

  useEffect(() => {
    const c = getClient(id);
    setClient(c || null);
    setNotes(c?.notes || "");
    setInvoices(getInvoices().filter(i => i.client_id === id));
    setDocuments(getDocuments().filter(d => d.client_id === id));
  }, [id]);

  if (!client) return (
    <CRMSidebar>
      <div className="p-10 text-center">
        <p className="text-white font-bold mb-2">Client not found</p>
        <button onClick={() => navigate("/dashboard/clients")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer" }}>← Back to Clients</button>
      </div>
    </CRMSidebar>
  );

  const saveNotes = () => {
    const updated = { ...client, notes };
    upsertClient(updated);
    setClient(updated);
    logActivity(`Notes updated for ${client.name}`);
  };

  const addInvoice = () => {
    if (!invForm.amount) return;
    const inv = { id: `inv-${Date.now()}`, client_id: id, ...invForm, amount: Number(invForm.amount), paid: false, created_at: new Date().toISOString() };
    upsertInvoice(inv);
    setInvoices(prev => [inv, ...prev]);
    logActivity(`Invoice created for ${client.name}: $${invForm.amount}`);
    setShowInvoiceModal(false);
    setInvForm({ description: "", amount: "", due_date: "" });
  };

  const togglePaid = (invId) => {
    const all = getInvoices();
    const updated = all.map(i => i.id === invId ? { ...i, paid: !i.paid } : i);
    localStorage.setItem("nova_crm_invoices", JSON.stringify(updated));
    setInvoices(updated.filter(i => i.client_id === id));
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        {/* Back + Header */}
        <button onClick={() => navigate("/dashboard/clients")}
          className="flex items-center gap-2 text-xs mb-6 hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Clients
        </button>

        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-white">{client.name}</h1>
              <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                {client.status?.toUpperCase() || "ACTIVE"}
              </span>
              {client.industry && (
                <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                  {client.industry}
                </span>
              )}
            </div>
            {client.owner_name && <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Owner: {client.owner_name}</p>}
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>MONTHLY RATE</p>
            <p className="text-xl font-black" style={{ color: GOLD }}>
              {client.monthly_rate > 0 ? `$${client.monthly_rate}/mo` : "Pro Bono"}
            </p>
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

        {/* OVERVIEW */}
        {tab === "Overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Section title="CONTACT INFO">
              <Row label="Email" value={client.email} />
              <Row label="Phone" value={client.phone} />
              <Row label="Owner" value={client.owner_name} />
              {client.website && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] tracking-[0.18em] uppercase w-20 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>Website</span>
                  <a href={`https://${client.website}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline" style={{ color: GOLD }}>
                    {client.website} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              <Row label="Domain" value={client.domain} />
              <Row label="Contract Start" value={client.contract_start ? new Date(client.contract_start).toLocaleDateString() : ""} />
            </Section>
            <Section title="SERVICES">
              {(client.services || []).length === 0 ? (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No services listed.</p>
              ) : (client.services || []).map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{s}</span>
                </div>
              ))}
            </Section>
          </div>
        )}

        {/* SERVICES */}
        {tab === "Services" && (
          <Section title="ACTIVE SERVICES">
            {(client.services || []).length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No services listed for this client.</p>
            ) : (client.services || []).map(s => (
              <div key={s} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="text-sm text-white font-medium">{s}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>ACTIVE</span>
              </div>
            ))}
          </Section>
        )}

        {/* INVOICES */}
        {tab === "Invoices" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold" style={{ color: GOLD }}>INVOICES</p>
              <button onClick={() => setShowInvoiceModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                <Plus className="w-3 h-3" /> Generate Invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No invoices yet.</p>
            ) : invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-sm text-white font-medium">{inv.description || "Invoice"}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: GOLD }}>${inv.amount}</span>
                  <button onClick={() => togglePaid(inv.id)}
                    className="text-[9px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: inv.paid ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                      color: inv.paid ? "#4ade80" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${inv.paid ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                      cursor: "pointer",
                    }}>
                    {inv.paid ? "PAID" : "UNPAID"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DOCUMENTS */}
        {tab === "Documents" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold" style={{ color: GOLD }}>DOCUMENTS</p>
              <button onClick={() => navigate("/dashboard/documents")}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-lg hover:opacity-85"
                style={{ border: `1px solid ${GOLD}40`, color: GOLD, background: `${GOLD}08`, cursor: "pointer" }}>
                <Plus className="w-3 h-3" /> Generate Document
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No documents yet. Use the Document Generator to create one.</p>
            ) : documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-sm text-white font-medium">{doc.type}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: doc.sent ? "rgba(34,197,94,0.12)" : `${GOLD}12`, color: doc.sent ? "#4ade80" : GOLD, border: `1px solid ${doc.sent ? "rgba(34,197,94,0.3)" : GOLD + "30"}` }}>
                  {doc.sent ? "SENT" : "DRAFT"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* NOTES */}
        {tab === "Notes" && (
          <div>
            <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>NOTES</p>
            <textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this client..."
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

      {showInvoiceModal && (
        <CRMModal title="Generate Invoice" onClose={() => setShowInvoiceModal(false)}>
          <div className="space-y-4">
            <CRMField label="Description"><input placeholder="Monthly retainer, website build..." value={invForm.description} onChange={e => setInvForm(f => ({...f, description: e.target.value}))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="Amount ($)"><input type="number" placeholder="0" value={invForm.amount} onChange={e => setInvForm(f => ({...f, amount: e.target.value}))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <CRMField label="Due Date"><input type="date" value={invForm.due_date} onChange={e => setInvForm(f => ({...f, due_date: e.target.value}))} style={inputStyle} onFocus={onFocus} onBlur={onBlur} /></CRMField>
            <button onClick={addInvoice}
              className="w-full py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
              CREATE INVOICE
            </button>
          </div>
        </CRMModal>
      )}
    </CRMSidebar>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-6 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>{title}</p>
      {children}
    </div>
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