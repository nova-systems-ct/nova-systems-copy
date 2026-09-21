import React, { useState } from "react";
import { Mail, Phone, MapPin, Send, CheckCircle2, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { NAVY, GOLD, GOLD_GRADIENT, SURFACE, SURFACE_BORDER, TEXT_MUTED } from "@/lib/theme";

const CATEGORIES = [
  { value: "general", label: "General Inquiry" },
  { value: "sales", label: "New Business / Sales" },
  { value: "support", label: "Existing Client Support" },
  { value: "careers", label: "Careers" },
  { value: "press", label: "Press" },
  { value: "other", label: "Other" },
];

const inputStyle = {
  width: "100%", padding: "12px 14px", background: SURFACE, border: `1px solid ${SURFACE_BORDER}`,
  borderRadius: 8, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const labelStyle = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: TEXT_MUTED, marginBottom: 8 };

export default function Contact() {
  useSEO({
    title: "Contact — Nova Systems",
    description: "Reach Nova Systems by email or phone, or send a message directly. Based in Waterbury, Connecticut.",
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", category: "general", message: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok, warning } | { error }
  const [honeypot, setHoneypot] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (honeypot) return; // bot — silently no-op, matches /welcome's honeypot handling
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/notify?action=contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ error: data.error || "Something went wrong. Please try again or email hello@nova-systems.app directly." });
      } else {
        setResult({ ok: true, warning: data.warning });
        setForm({ name: "", email: "", phone: "", company: "", category: "general", message: "" });
      }
    } catch {
      setResult({ error: "Network error — please try again or email hello@nova-systems.app directly." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <Navbar />
      <main className="pt-16">
        <section className="px-6 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            <p style={{ color: GOLD, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 12 }}>Contact</p>
            <h1 className="font-black text-white" style={{ fontSize: "clamp(2.2rem,4.5vw,3.4rem)", letterSpacing: "-0.02em", maxWidth: 640, lineHeight: 1.05 }}>
              Let's talk about your business.
            </h1>
            <p className="mt-5" style={{ color: TEXT_MUTED, fontSize: 15, maxWidth: 520, lineHeight: 1.6 }}>
              For a full business diagnostic, use{" "}
              <a href="/welcome" style={{ color: GOLD, textDecoration: "underline" }}>Start Your Business Diagnostic</a>.
              For everything else — questions, support, careers, press — reach us directly below.
            </p>

            <div className="grid md:grid-cols-3 gap-10 mt-16">
              {/* Contact methods */}
              <div className="md:col-span-1 space-y-6">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: GOLD }} />
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Email</p>
                    <a href="mailto:hello@nova-systems.app" style={{ color: "#fff", fontSize: 14 }}>hello@nova-systems.app</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: GOLD }} />
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Phone</p>
                    <a href="tel:+12037060504" style={{ color: "#fff", fontSize: 14 }}>(203) 706-0504</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: GOLD }} />
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Location</p>
                    <p style={{ color: "#fff", fontSize: 14 }}>Waterbury, Connecticut</p>
                  </div>
                </div>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, lineHeight: 1.6, paddingTop: 8 }}>
                  Isaac personally reviews every message. Response time isn't guaranteed on any fixed schedule outside of an active client engagement.
                </p>
              </div>

              {/* Form */}
              <div className="md:col-span-2">
                {result?.ok ? (
                  <div className="rounded-xl p-8 text-center" style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}>
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-4" style={{ color: GOLD }} />
                    <p className="text-white font-bold text-lg mb-2">Message received.</p>
                    <p style={{ color: TEXT_MUTED, fontSize: 13, lineHeight: 1.6 }}>
                      Your message has been saved and Isaac will review it.
                      {result.warning ? " Email delivery is temporarily unavailable, so a confirmation email may not arrive — your message is on file regardless." : " A confirmation email is on its way."}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Honeypot — hidden from real visitors, catches simple bots */}
                    <input
                      type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                      name="company_website_confirm" autoComplete="off" tabIndex={-1}
                      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                      aria-hidden="true"
                    />
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label style={labelStyle}>Name *</label>
                        <input required value={form.name} onChange={set("name")} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email *</label>
                        <input required type="email" value={form.email} onChange={set("email")} style={inputStyle} />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label style={labelStyle}>Phone</label>
                        <input value={form.phone} onChange={set("phone")} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Company</label>
                        <input value={form.company} onChange={set("company")} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>What's this about? *</label>
                      <select required value={form.category} onChange={set("category")} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value} style={{ background: "#111" }}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Message *</label>
                      <textarea required rows={5} value={form.message} onChange={set("message")} style={{ ...inputStyle, resize: "vertical" }} />
                    </div>

                    {result?.error && (
                      <p style={{ color: "#f87171", fontSize: 13 }}>{result.error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
                      style={{ background: GOLD_GRADIENT, color: "#0a0800", fontSize: 12, padding: "14px 28px", opacity: loading ? 0.6 : 1, border: "none", cursor: loading ? "default" : "pointer" }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {loading ? "Sending…" : "Send Message"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
