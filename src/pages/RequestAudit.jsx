import React, { useState } from "react";
import { CheckCircle, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
// Same list nova-wave-one's own audit tooling uses, so a request submitted here lines up with
// what Isaac already sees on the review side.
const INDUSTRIES = [
  "Restaurant", "Barbershop and Salon", "Medical and Dental", "Law and Finance",
  "Real Estate", "Contractor and Trade", "Retail Store", "Auto Shop",
  "Gym and Fitness", "Food Truck", "Convenience Store", "Nutrition Bar",
  "Jewelry Store", "Print and Graphics Shop", "Technology", "Professional Services", "Other",
];
const GOALS = [
  "More phone calls and bookings", "Better online reviews and reputation",
  "A faster, more modern website", "Automated follow-up so no lead is missed",
  "Stronger social media presence", "Clearer reporting on what's working", "Not sure yet",
];
const REFERRAL_SOURCES = ["Google search", "Instagram", "Facebook", "LinkedIn", "Referral from a friend/client", "Saw a Nova client", "Other"];

// Posts cross-origin to nova-wave-one's API (nova-systems.agency) — this repo owns no
// authenticated data of its own for this flow; the request lands directly in Nova Systems HQ's
// audit approval queue via the same Supabase project.
const PLATFORM_API_URL = "https://nova-systems.agency/api/nova-audit?action=request_audit";

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
};
const lbl = {
  display: "block", fontSize: 9, fontWeight: 700,
  letterSpacing: "0.22em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)", marginBottom: 8,
};

function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

const emptyForm = {
  first_name: "", last_name: "", business_name: "", business_email: "", phone: "",
  website: "", industry: "", city: "", state: "", main_challenge: "", primary_goal: "",
  referral_source: "", consent: false,
};

export default function RequestAudit() {
  useSEO({
    title: "Request a Nova Audit — Nova Systems",
    description: "See where your business is losing time, customers, and opportunity. Request a free Nova Audit.",
  });

  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.consent) { setError("Please confirm consent to be contacted before submitting."); return; }
    setLoading(true);

    try {
      const res = await fetch(PLATFORM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#080600" }}>
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}>
            <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 16 }}>
            REQUEST RECEIVED
          </p>
          <h1 className="text-2xl font-black text-white mb-4">You're in the queue.</h1>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Isaac personally reviews every audit request. If it's a good fit, we'll follow up with next steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-16" style={{ background: "#080600" }}>
      <div className="max-w-xl mx-auto">
        <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>
          FREE NOVA AUDIT
        </p>
        <h1 className="text-3xl font-black text-white mb-3">Request a Nova Audit</h1>
        <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Tell us a bit about your business. Isaac reviews every request personally — if it's a fit, we'll follow up to schedule your full Business Assessment.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="First Name *">
              <input required value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} style={inp} onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Last Name *">
              <input required value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} style={inp} onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <Field label="Business Name *">
            <input required value={form.business_name} onChange={(e) => set({ business_name: e.target.value })} style={inp} onFocus={focus} onBlur={blur} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Business Email *">
              <input required type="email" value={form.business_email} onChange={(e) => set({ business_email: e.target.value })} style={inp} onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Phone Number *">
              <input required type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <Field label="Website (optional — leave blank if you don't have one)">
            <input type="url" value={form.website} onChange={(e) => set({ website: e.target.value })} style={inp} placeholder="https://…" onFocus={focus} onBlur={blur} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label="Industry *">
              <select required value={form.industry} onChange={(e) => set({ industry: e.target.value })} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
                <option value="" style={{ background: "#111" }}>Select</option>
                {INDUSTRIES.map((i) => <option key={i} value={i} style={{ background: "#111" }}>{i}</option>)}
              </select>
            </Field>
            <Field label="City *">
              <input required value={form.city} onChange={(e) => set({ city: e.target.value })} style={inp} onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="State *">
              <input required value={form.state} onChange={(e) => set({ state: e.target.value })} style={inp} placeholder="CT" onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <Field label="What is your biggest business challenge right now? *">
            <textarea required rows={3} value={form.main_challenge} onChange={(e) => set({ main_challenge: e.target.value })} style={{ ...inp, resize: "none" }} onFocus={focus} onBlur={blur} />
          </Field>

          <Field label="What are you hoping to improve? *">
            <select required value={form.primary_goal} onChange={(e) => set({ primary_goal: e.target.value })} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select</option>
              {GOALS.map((g) => <option key={g} value={g} style={{ background: "#111" }}>{g}</option>)}
            </select>
          </Field>

          <Field label="How did you hear about Nova? *">
            <select required value={form.referral_source} onChange={(e) => set({ referral_source: e.target.value })} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select</option>
              {REFERRAL_SOURCES.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
            </select>
          </Field>

          {/* Honeypot — hidden from real visitors via CSS, not the `hidden` attribute (some bots
              skip visibly-hidden inputs but still fill ones only excluded via layout). Real users
              never see or fill this. */}
          <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor="company_website_confirm">Leave this field blank</label>
            <input id="company_website_confirm" name="company_website_confirm" type="text" tabIndex={-1} autoComplete="off"
              value={form.company_website_confirm || ""} onChange={(e) => set({ company_website_confirm: e.target.value })} />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" required checked={form.consent} onChange={(e) => set({ consent: e.target.checked })} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              I consent to Nova Systems contacting me about this request by phone, text, or email. *
            </span>
          </label>

          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: "100%", padding: "16px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.2em", textTransform: "uppercase", borderRadius: 10, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(255,255,255,0.06)" : G,
              color: loading ? "rgba(255,255,255,0.25)" : "#0a0800",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>
            {loading
              ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              : <><span>REQUEST MY AUDIT</span><ArrowRight className="w-4 h-4" /></>}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            Isaac personally reviews every request. No spam, no bots.
          </p>
        </form>
      </div>
    </div>
  );
}
