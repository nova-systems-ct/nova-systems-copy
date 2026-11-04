import { captureLeadAnswer, contactLeadPayload } from '../lib/chatLead.js';
import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowRight } from "lucide-react";

const GOLD = "#C9A84C";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6b2a 0%, ${GOLD} 35%, #E0C476 55%, ${GOLD} 80%, #8a6b2a 100%)`;

const STEPS = [
  { key: "name", bot: "Welcome to Nova. We investigate business bottlenecks and help put the right systems to work. What's your name?" },
  { key: "business", bot: name => `Nice to meet you, ${name}. What business do you run?` },
  { key: "challenge", bot: () => "Where would you most like to improve: customers, response, bookings, operations or follow-up?" },
  { key: "day", bot: () => "What day would you prefer for a conversation with Nova?" },
  { key: "email", bot: () => "What's your email? We'll save your request; a preferred day is not a confirmed booking." },
];
const SENT_MESSAGE = email => `Your request is saved with ${email}. Your preferred day still needs confirmation. You can also choose a time through Book an audit.`;
const FAILED_MESSAGE = "I couldn't send that through just now — our messaging system is temporarily unavailable. Please use the form at /welcome instead, or call (203) 706-0504 directly. Sorry about that!";

function BotBubble({ text }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#0a0800", flexShrink: 0 }}>N</div>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "4px 12px 12px 12px", padding: "9px 13px", fontSize: 12, color: "#fff", lineHeight: 1.55, maxWidth: "82%" }}>{text}</div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{ background: GOLD, borderRadius: "12px 4px 12px 12px", padding: "9px 13px", fontSize: 12, color: "#0a0800", lineHeight: 1.55, maxWidth: "82%", fontWeight: 500 }}>{text}</div>
    </div>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ type: "bot", text: STEPS[0].bot }]);
  const [data, setData] = useState({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Returns whether the message actually reached Isaac in some real, verifiable form. As of
  // 2026-09-20, api/notify.js's `contact` action persists to a real contact_submissions table
  // first (the required action) and only treats email as best-effort on top of it — so "false"
  // here now means the save itself failed (rare), not just that a best-effort email didn't send.
  const sendNotification = async (d) => {
    try {
      const res = await fetch("/api/notify?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactLeadPayload(d)),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleSend = async () => {
    if (sendLock.current || done) return;
    const val = input.trim();
    const answer = captureLeadAnswer(data, step, val);
    if (answer.error) { setMessages(m => [...m, {type:"bot",text:answer.error}]); return; }
    setData(answer.data); setInput(""); setMessages(m => [...m,{type:"user",text:val}]);
    if (!answer.complete) {
      setStep(answer.nextStep);
      const botFn=STEPS[answer.nextStep].bot;
      setMessages(m => [...m,{type:"bot",text:typeof botFn==='function'?botFn(val):botFn}]);
      return;
    }
    sendLock.current=true;setSending(true);
    try { const saved=await sendNotification(answer.data);setMessages(m => [...m,{type:"bot",text:saved?SENT_MESSAGE(answer.data.email):FAILED_MESSAGE}]);setDone(saved); }
    finally {sendLock.current=false;setSending(false);}
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <>
      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 20, width: "min(340px, calc(100vw - 32px))", maxHeight: "min(500px, calc(100dvh - 120px))",
          background: "#0e0b03", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column", zIndex: 9998,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10, background: GOLD_GRADIENT }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0 }}>N</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#0a0800", margin: 0 }}>Nova Assistant</p>
              <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", margin: 0 }}>Typically replies instantly</p>
            </div>
            <button aria-label="Close Nova assistant" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.5)", padding: 0, display: "flex" }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {messages.map((m, i) =>
              m.type === "bot"
                ? <BotBubble key={i} text={m.text} />
                : <UserBubble key={i} text={m.text} />
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!done ? (
            <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                aria-label="Your reply" disabled={sending}
                ref={inputRef}
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Type your reply..."
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#fff", outline: "none" }}
              />
              <button aria-label="Send reply" disabled={sending} onClick={handleSend}
                style={{ width: 36, height: 36, borderRadius: 8, background: GOLD_GRADIENT, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={14} style={{ color: "#0a0800" }} />
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <a href="/welcome"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px 16px", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", background: GOLD_GRADIENT, color: "#0a0800", borderRadius: 8, textDecoration: "none" }}>
                SCHEDULE A MEETING <ArrowRight size={13} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 20, right: 20, width: 56, height: 56, borderRadius: "50%",
          background: GOLD_GRADIENT, border: "none", cursor: "pointer", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 32px rgba(201, 168, 76,0.4)`,
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        aria-label="Open chat"
      >
        {open ? <X size={22} style={{ color: "#0a0800" }} /> : <MessageCircle size={22} style={{ color: "#0a0800" }} />}
      </button>
    </>
  );
}
