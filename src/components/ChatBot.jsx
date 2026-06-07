import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const STEPS = [
  { key: "intro",     bot: "Hi! I'm Nova Assistant. I help businesses stop losing revenue. What's your name?" },
  { key: "name",      bot: (name) => `Nice to meet you, ${name}! What type of business do you run?` },
  { key: "business",  bot: () => "Got it. What's your biggest challenge right now — missed calls, slow follow-up, lead tracking, or something else?" },
  { key: "challenge", bot: () => "That's exactly what we help with. I'd love to connect you with Isaac for a 30-minute strategy call. What day this week works best for you?" },
  { key: "day",       bot: () => "Perfect. What's the best email to send your calendar invite to?" },
  { key: "email",     bot: (email) => `Done! I've sent your info to Isaac. He'll reach out to ${email} within 24 hours to confirm your call. Talk soon!` },
];

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
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendNotification = (d) => {
    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "hello@nova-systems.app",
        subject: `Nova Chat Lead: ${d.name || "Unknown"}`,
        body: `Chat Lead:\nName: ${d.name || "-"}\nBusiness: ${d.business || "-"}\nChallenge: ${d.challenge || "-"}\nAvailable: ${d.day || "-"}\nEmail: ${d.email || "-"}`,
      }),
    }).catch(() => {});
  };

  const handleSend = () => {
    const val = input.trim();
    if (!val) return;
    const newData = { ...data };
    const currentKey = STEPS[step]?.key;
    if (currentKey && currentKey !== "intro") newData[currentKey] = val;
    setData(newData);

    setMessages((m) => [...m, { type: "user", text: val }]);
    setInput("");

    const nextStep = step + 1;
    if (nextStep < STEPS.length) {
      setStep(nextStep);
      const botFn = STEPS[nextStep].bot;
      const botText = typeof botFn === "function" ? botFn(val, newData) : botFn;
      setTimeout(() => {
        setMessages((m) => [...m, { type: "bot", text: botText }]);
        if (nextStep === STEPS.length - 1) {
          newData.email = val;
          sendNotification(newData);
          setDone(true);
        }
      }, 550);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <>
      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 20, width: 340, maxHeight: 500,
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
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.5)", padding: 0, display: "flex" }}>
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
                ref={inputRef}
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Type your reply..."
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#fff", outline: "none" }}
              />
              <button onClick={handleSend}
                style={{ width: 36, height: 36, borderRadius: 8, background: GOLD_GRADIENT, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={14} style={{ color: "#0a0800" }} />
              </button>
            </div>
          ) : (
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <a href="/book-demo"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "10px 16px", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", background: GOLD_GRADIENT, color: "#0a0800", borderRadius: 8, textDecoration: "none" }}>
                BOOK DEMO FORM <ArrowRight size={13} />
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
          boxShadow: `0 8px 32px rgba(212,160,48,0.4)`,
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
