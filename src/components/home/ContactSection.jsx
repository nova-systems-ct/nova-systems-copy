import React, { useState } from "react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const MAILTO = "mailto:Isaac_0427@icloud.com?subject=Nova%20Systems%20Demo%20Request";

export default function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/notify?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, to: "Isaac_0427@icloud.com" }),
      });
    } catch {
      // fallback: open mailto if fetch fails
      const body = encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\nPhone: ${form.phone}\n\n${form.message}`
      );
      window.open(`mailto:Isaac_0427@icloud.com?subject=Nova%20Systems%20Demo%20Request&body=${body}`, "_blank");
    }
    setSending(false);
    setSubmitted(true);
  };

  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at bottom, ${GOLD}10 0%, transparent 70%)` }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="grid md:grid-cols-2 gap-14 items-start">
          {/* Left */}
          <div>
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>GET STARTED</p>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-[0.95]">
              Ready to stop<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>losing revenue?</span>
            </h2>
            <p className="mt-5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              30 minutes. We find your leaks and show you exactly how to fix them.
            </p>
            <div className="mt-8 space-y-3">
              {["No obligation", "Personalized demo", "See ROI in real conversations"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: `1px solid ${GOLD}60`, background: `${GOLD}15` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <a
                href={MAILTO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
              >
                TALK TO ISAAC
              </a>
            </div>
          </div>

          {/* Right - Form */}
          <div
            className="rounded-2xl p-8"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {submitted ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}50` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: GOLD }} />
                </div>
                <h3 className="text-lg font-bold text-white">We'll be in touch.</h3>
                <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Expect a response within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Full Name"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-lg outline-none bg-transparent"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    onFocus={(e) => e.target.style.borderColor = `${GOLD}60`}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                  <input required type="email" placeholder="Work Email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-lg outline-none bg-transparent"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    onFocus={(e) => e.target.style.borderColor = `${GOLD}60`}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Company Name"
                    value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-lg outline-none bg-transparent"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    onFocus={(e) => e.target.style.borderColor = `${GOLD}60`}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                  <input placeholder="Phone Number"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-lg outline-none bg-transparent"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    onFocus={(e) => e.target.style.borderColor = `${GOLD}60`}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
                <textarea rows={4} placeholder="Tell us about your team..."
                  value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-lg outline-none bg-transparent resize-none"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => e.target.style.borderColor = `${GOLD}60`}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <button type="submit" disabled={sending}
                  className="w-full py-4 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                >
                  {sending ? "SENDING..." : "BOOK MY DEMO"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
