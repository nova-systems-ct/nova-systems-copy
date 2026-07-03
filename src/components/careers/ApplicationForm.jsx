import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, ArrowRight, Eye, EyeOff, Upload, X } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export const POSITIONS = [
  { id: "content-creator",      label: "Social Media Content Creator",   hasPassword: true,  hasPortfolio: true },
  { id: "videographer-drone",   label: "Videographer & Drone Operator",  hasPassword: true,  hasPortfolio: true },
  { id: "sales-rep",            label: "Sales Representative (Commission Only)", hasPassword: false, hasPortfolio: false },
  { id: "ai-agent-specialist",  label: "AI Agent Specialist (Remote)",   hasPassword: true,  hasPortfolio: true },
];

const SALES_EXPERIENCE = ["None", "1-2 years", "3-5 years", "5+ years"];
const START_TIMES = ["Immediately", "1 week", "2 weeks", "1 month"];

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

function SectionDivider({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{title}</p>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    </div>
  );
}

function YesNo({ value, onChange, options = ["Yes", "No"] }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt.toLowerCase())}
          style={{
            padding: "10px 22px", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
            background: value === opt.toLowerCase() ? `${GOLD}20` : "rgba(255,255,255,0.03)",
            border: `1px solid ${value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.1)"}`,
            color: value === opt.toLowerCase() ? GOLD : "rgba(255,255,255,0.4)",
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const initialForm = {
  name: "", email: "", phone: "", position: "",
  password: "", confirmPassword: "",
  city_ct: "", city_state: "", bio: "",
  // content creator
  equipment_owned: "", has_transportation: "", instagram_tiktok: "",
  // videographer/drone
  camera_equipment: "", drone_equipment: "", faa_part_107: "",
  // sales
  has_transportation_license: "", speaks_spanish: "", sales_experience: "",
  sales_experience_desc: "", why_position: "", start_timing: "", linkedin_url: "",
  // AI agent
  ai_tools_experience: "", ai_system_description: "",
  // shared
  portfolio_links: "",
};

export default function ApplicationForm({ preselectedPosition }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({ ...initialForm, position: preselectedPosition || "" });
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (preselectedPosition) setForm((f) => ({ ...f, position: preselectedPosition }));
  }, [preselectedPosition]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");

  const selectedPos = POSITIONS.find((p) => p.id === form.position);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { setError("Portfolio file must be under 4MB — for larger files, use the portfolio links field instead."); return; }
    setPortfolioFile(f);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedPos) { setError("Please select a position."); return; }

    if (selectedPos.hasPassword) {
      if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    }

    setLoading(true);

    const password_hash = selectedPos.hasPassword ? await hashPassword(form.password) : "";
    const appId = crypto.randomUUID();

    let portfolio_file_base64 = "";
    let portfolio_file_name = "";
    if (portfolioFile) {
      portfolio_file_base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(portfolioFile);
      });
      portfolio_file_name = portfolioFile.name;
    }

    const payload = {
      id: appId,
      name: form.name, email: form.email, phone: form.phone,
      position: selectedPos.label, status: "new",
      password_hash,
      city: form.city_ct || form.city_state,
      bio: form.bio,
      equipment_owned: form.equipment_owned,
      has_transportation: form.has_transportation,
      instagram_tiktok: form.instagram_tiktok,
      camera_equipment: form.camera_equipment,
      drone_equipment: form.drone_equipment,
      faa_part_107: form.faa_part_107,
      has_transportation_license: form.has_transportation_license,
      speaks_spanish: form.speaks_spanish,
      sales_experience: form.sales_experience,
      sales_experience_desc: form.sales_experience_desc,
      why_position: form.why_position,
      start_timing: form.start_timing,
      linkedin_url: form.linkedin_url,
      ai_tools_experience: form.ai_tools_experience,
      ai_system_description: form.ai_system_description,
      portfolio_links: form.portfolio_links,
      portfolio_file_name,
      submittedAt: new Date().toISOString(),
    };

    // Local echo so /application-status works immediately in this browser
    const existing = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    existing.unshift(payload);
    localStorage.setItem("nova_applications", JSON.stringify(existing));

    try {
      const res = await fetch("/api/intake?action=submit-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, portfolio_file_base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[ApplicationForm] API error:", err);
      }
    } catch (e) {
      console.error("[ApplicationForm] Network error:", e.message);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <section id="apply" className="py-24 px-6 bg-black">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}>
            <CheckCircle className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 16 }}>
            APPLICATION RECEIVED
          </p>
          <h2 className="text-3xl font-black text-white mb-4">You're in the pipeline.</h2>
          <p className="text-sm leading-relaxed mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Isaac will personally review your application. A confirmation email was sent to <strong style={{ color: "rgba(255,255,255,0.6)" }}>{form.email}</strong>.
          </p>
          {selectedPos?.hasPassword && (
            <a href="/application-status"
              className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-lg hover:opacity-85 transition-all"
              style={{ background: G, color: "#0a0800" }}>
              CHECK APPLICATION STATUS <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id="apply" className="py-16 md:py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>APPLY NOW</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">Ready to Build With Us?</h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Required fields are marked with *.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── POSITION ────────────────────────────────────────── */}
          <Field label="Position Applying For *">
            <select required value={form.position} onChange={set("position")} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select a position</option>
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#111" }}>{p.label}</option>
              ))}
            </select>
          </Field>

          {selectedPos && (
            <>
              <SectionDivider title="Contact Info" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Full Name *">
                  <input required value={form.name} onChange={set("name")} style={inp} placeholder="Jane Smith" onFocus={focus} onBlur={blur} />
                </Field>
                <Field label="Phone *">
                  <input required type="tel" value={form.phone} onChange={set("phone")} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
                </Field>
              </div>

              <Field label={`Email Address *${selectedPos.hasPassword ? " (used to log in to check status)" : ""}`}>
                <input required type="email" value={form.email} onChange={set("email")} style={inp} placeholder="jane@email.com" onFocus={focus} onBlur={blur} />
              </Field>

              {selectedPos.id === "ai-agent-specialist" ? (
                <Field label="City / State *">
                  <input required value={form.city_state} onChange={set("city_state")} style={inp} placeholder="Waterbury, CT" onFocus={focus} onBlur={blur} />
                </Field>
              ) : (
                <Field label="City / Town in CT *">
                  <input required value={form.city_ct} onChange={set("city_ct")} style={inp} placeholder="Waterbury" onFocus={focus} onBlur={blur} />
                </Field>
              )}

              {/* ── PASSWORD (skip for sales rep) ─────────────────── */}
              {selectedPos.hasPassword && (
                <>
                  <SectionDivider title="Create Account Password" />
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: -10, lineHeight: 1.6 }}>
                    This password lets you log in at <span style={{ color: GOLD }}>nova-systems.app/application-status</span> to track your application status.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Password * (min 8 characters)">
                      <div style={{ position: "relative" }}>
                        <input required type={showPw ? "text" : "password"} minLength={8} value={form.password}
                          onChange={set("password")} style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" onFocus={focus} onBlur={blur} />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                    <Field label="Confirm Password *">
                      <input required type={showPw ? "text" : "password"} value={form.confirmPassword}
                        onChange={set("confirmPassword")} style={inp} placeholder="••••••••" onFocus={focus} onBlur={blur} />
                    </Field>
                  </div>
                </>
              )}

              {/* ── POSITION-SPECIFIC ─────────────────────────────── */}
              <SectionDivider title="Position Details" />

              {selectedPos.id === "content-creator" && (
                <>
                  <Field label="Equipment owned (camera, lighting, microphone) *">
                    <textarea required rows={3} value={form.equipment_owned} onChange={set("equipment_owned")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="Sony A7III, ring light, Rode mic…" />
                  </Field>
                  <Field label="Do you have reliable transportation? *">
                    <YesNo value={form.has_transportation} onChange={setVal("has_transportation")} />
                  </Field>
                  <Field label="Instagram or TikTok handle">
                    <input value={form.instagram_tiktok} onChange={set("instagram_tiktok")} style={inp} placeholder="@yourhandle" onFocus={focus} onBlur={blur} />
                  </Field>
                </>
              )}

              {selectedPos.id === "videographer-drone" && (
                <>
                  <Field label="Camera equipment owned *">
                    <textarea required rows={2} value={form.camera_equipment} onChange={set("camera_equipment")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="Sony FX3, gimbal, lenses…" />
                  </Field>
                  <Field label="Drone equipment owned *">
                    <textarea required rows={2} value={form.drone_equipment} onChange={set("drone_equipment")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="DJI Mavic 3 Cine…" />
                  </Field>
                  <Field label="FAA Part 107 certified?">
                    <YesNo value={form.faa_part_107} onChange={setVal("faa_part_107")} />
                  </Field>
                  <Field label="Do you have reliable transportation? *">
                    <YesNo value={form.has_transportation} onChange={setVal("has_transportation")} />
                  </Field>
                </>
              )}

              {selectedPos.id === "sales-rep" && (
                <>
                  <Field label="Do you have reliable transportation and a valid CT driver's license? *">
                    <YesNo value={form.has_transportation_license} onChange={setVal("has_transportation_license")} />
                  </Field>
                  <Field label="Do you speak Spanish?">
                    <YesNo value={form.speaks_spanish} onChange={setVal("speaks_spanish")} options={["Yes", "No", "Somewhat"]} />
                  </Field>
                  <Field label="Sales experience *">
                    <select required value={form.sales_experience} onChange={set("sales_experience")} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
                      <option value="" style={{ background: "#111" }}>Select</option>
                      {SALES_EXPERIENCE.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Describe your sales experience">
                    <textarea rows={3} value={form.sales_experience_desc} onChange={set("sales_experience_desc")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="B2B, B2C, door-to-door, retail…" />
                  </Field>
                  <Field label="Why do you want this position? *">
                    <textarea required rows={3} value={form.why_position} onChange={set("why_position")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} />
                  </Field>
                  <Field label="How soon can you start? *">
                    <select required value={form.start_timing} onChange={set("start_timing")} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
                      <option value="" style={{ background: "#111" }}>Select</option>
                      {START_TIMES.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="LinkedIn profile URL (optional)">
                    <input value={form.linkedin_url} onChange={set("linkedin_url")} style={inp} placeholder="https://linkedin.com/in/…" onFocus={focus} onBlur={blur} />
                  </Field>
                </>
              )}

              {selectedPos.id === "ai-agent-specialist" && (
                <>
                  <Field label="AI tools you have experience with *">
                    <textarea required rows={3} value={form.ai_tools_experience} onChange={set("ai_tools_experience")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="ChatGPT, Claude, Make, Zapier, Voiceflow…" />
                  </Field>
                  <Field label="Describe an automation or AI system you built *">
                    <textarea required rows={4} value={form.ai_system_description} onChange={set("ai_system_description")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} />
                  </Field>
                </>
              )}

              {/* ── PORTFOLIO ─────────────────────────────────────── */}
              {selectedPos.hasPortfolio && (
                <>
                  <SectionDivider title="Portfolio" />
                  <Field label={selectedPos.id === "ai-agent-specialist" ? "Portfolio or GitHub link" : "Portfolio (video files or links)"}>
                    <textarea rows={2} value={form.portfolio_links} onChange={set("portfolio_links")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="https://…  (one per line — Instagram, TikTok, YouTube, Vimeo, GitHub, website…)" />
                  </Field>
                  <Field label="Or upload a file — optional (max 4MB, larger files use links above)">
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        padding: "24px 20px", border: `2px dashed ${portfolioFile ? GOLD : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                        background: portfolioFile ? `${GOLD}08` : "rgba(255,255,255,0.02)",
                      }}>
                      {portfolioFile ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                          <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{portfolioFile.name}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setPortfolioFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
                          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Click to upload</p>
                        </>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="video/*,image/*,.pdf" onChange={handleFileChange} style={{ display: "none" }} />
                  </Field>
                </>
              )}

              {/* ── BIO ──────────────────────────────────────────── */}
              {selectedPos.id !== "sales-rep" && (
                <>
                  <SectionDivider title="About You" />
                  <Field label="Brief bio *">
                    <textarea required rows={4} value={form.bio} onChange={set("bio")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "vertical", lineHeight: 1.75 }} placeholder="Tell Isaac about yourself, your work, and why Nova Systems…" />
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── ERROR ────────────────────────────────────────────── */}
          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* ── SUBMIT ───────────────────────────────────────────── */}
          <button type="submit" disabled={loading || !form.position}
            style={{
              width: "100%", padding: "16px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.2em", textTransform: "uppercase", borderRadius: 10, border: "none",
              cursor: !form.position || loading ? "not-allowed" : "pointer",
              background: !form.position || loading ? "rgba(255,255,255,0.06)" : G,
              color: !form.position || loading ? "rgba(255,255,255,0.25)" : "#0a0800",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>
            {loading
              ? <div className="w-4 h-4 border-2 border-[#0a0800]/30 border-t-[#0a0800] rounded-full animate-spin" />
              : <><span>SUBMIT APPLICATION</span><ArrowRight className="w-4 h-4" /></>}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
            Isaac personally reviews every application. No spam, no bots.
          </p>
        </form>
      </div>
    </section>
  );
}
