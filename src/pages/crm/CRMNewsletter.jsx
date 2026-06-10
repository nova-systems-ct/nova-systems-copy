import React, { useState, useEffect } from "react";
import { Send, Users } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { CRMField, inputStyle, onFocus, onBlur } from "@/components/crm/CRMField";
import { getSubscribers, getSentNewsletters, addSentNewsletter } from "@/lib/crmData";
import { callFunction } from "@/lib/callFunction";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export default function CRMNewsletter() {
  const [subscribers, setSubscribers] = useState([]);
  const [sent, setSent] = useState([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSubscribers(getSubscribers());
    setSent(getSentNewsletters());
  }, []);

  const sendNewsletter = async () => {
    if (!subject || !body || subscribers.length === 0) return;
    setSending(true);
    let count = 0;
    for (const sub of subscribers) {
      try {
        await callFunction("sendEmail", {
          type: "newsletter",
          payload: { toEmail: sub.email, subject, body },
        });
        count++;
      } catch { /* continue */ }
    }
    const record = { id: Date.now().toString(), subject, body, sent_at: new Date().toISOString(), recipient_count: count };
    addSentNewsletter(record);
    setSent(getSentNewsletters());
    setSending(false);
    setSuccess(true);
    setSubject("");
    setBody("");
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        <div className="mb-8">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>CRM</p>
          <h1 className="text-2xl font-black text-white">Newsletter</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: compose + history */}
          <div className="md:col-span-2 space-y-6">
            {/* Compose */}
            <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: GOLD }}>COMPOSE</p>
              <div className="space-y-4">
                <CRMField label="Subject Line *">
                  <input placeholder="Nova Systems — June Update" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
                <CRMField label="Body *">
                  <textarea rows={10} placeholder="Write your newsletter content here..."
                    value={body} onChange={e => setBody(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical" }} onFocus={onFocus} onBlur={onBlur} />
                </CRMField>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Sends to <span style={{ color: GOLD, fontWeight: 700 }}>{subscribers.length}</span> subscriber{subscribers.length !== 1 ? "s" : ""}
                  </p>
                  <button onClick={sendNewsletter} disabled={sending || !subject || !body || subscribers.length === 0}
                    className="flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.18em] uppercase rounded-lg hover:opacity-85"
                    style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer", opacity: (!subject || !body || sending || subscribers.length === 0) ? 0.5 : 1 }}>
                    {sending ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "SENDING..." : success ? "SENT!" : "SEND TO ALL"}
                  </button>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: GOLD }}>SENT HISTORY ({sent.length})</p>
              {sent.length === 0 ? (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No newsletters sent yet.</p>
              ) : sent.map(n => (
                <div key={n.id} className="py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{n.subject}</p>
                      <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {new Date(n.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {n.recipient_count} recipients
                      </p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>SENT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: subscribers */}
          <div>
            <div className="rounded-2xl p-6 sticky top-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4" style={{ color: GOLD }} />
                <p className="text-[9px] tracking-[0.22em] uppercase font-bold" style={{ color: GOLD }}>SUBSCRIBERS ({subscribers.length})</p>
              </div>
              {subscribers.length === 0 ? (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No subscribers yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {subscribers.map((sub, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                        style={{ background: `${GOLD}18`, color: GOLD }}>
                        {sub.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{sub.email}</p>
                        {sub.created_at && <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{new Date(sub.created_at).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CRMSidebar>
  );
}