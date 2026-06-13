import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, ArrowRight, Eye, EyeOff, Upload, X } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const POSITIONS = [
  { id: "videographer", label: "Videographer / Content Creator", open: true },
  { id: "sales",        label: "Sales Representative",           open: true },
  { id: "web-dev",      label: "Web Developer",                  open: false },
  { id: "brand-ambassador", label: "Brand Ambassador",           open: false },
];

const EDITING_SOFTWARE = ["CapCut", "Adobe Premiere Pro", "DaVinci Resolve", "Final Cut Pro", "iMovie", "Other"];

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

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {["Yes", "No"].map((opt) => (
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

function RefBlock({ number, value, onChange }) {
  const setF = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const focus = (e) => (e.target.style.borderColor = `${GOLD}70`);
  const blur = (e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)");
  return (
    <div style={{ padding: "20px 20px 16px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 14 }}>
        Reference {number}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Full Name">
          <input value={value.name} onChange={setF("name")} style={inp} placeholder="Jane Smith" onFocus={focus} onBlur={blur} />
        </Field>
        <Field label="Relationship">
          <input value={value.relationship} onChange={setF("relationship")} style={inp} placeholder="Manager, Teacher, Coach…" onFocus={focus} onBlur={blur} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={value.phone} onChange={setF("phone")} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
        </Field>
        <Field label="Email">
          <input type="email" value={value.email} onChange={setF("email")} style={inp} placeholder="jane@email.com" onFocus={focus} onBlur={blur} />
        </Field>
      </div>
    </div>
  );
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApplicationForm({ preselectedPosition }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", position: preselectedPosition || "",
    password: "", confirmPassword: "",
    cover_letter: "",
    experience: "", why_nova: "", availability: "", expected_pay: "",
    // videographer
    owns_camera: "", camera_specs: "", has_editing_exp: "", editing_software: "",
    portfolio_url: "", social_media: "", has_drone: "",
    // sales
    sales_experience: "", industries: "", has_car: "", cold_calling: "", biggest_sale: "",
  });
  const [refs, setRefs] = useState([
    { name: "", relationship: "", phone: "", email: "" },
    { name: "", relationship: "", phone: "", email: "" },
    { name: "", relationship: "", phone: "", email: "" },
  ]);
  const [resumeFile, setResumeFile] = useState(null);
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
  const isFilled = selectedPos && !selectedPos.open;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") setResumeFile(f);
    else if (f) { setError("Resume must be a PDF file."); setResumeFile(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);

    const password_hash = await hashPassword(form.password);
    const appId = crypto.randomUUID();
    const posLabel = selectedPos?.label || form.position;

    // Read resume as base64
    let resume_base64 = "";
    let resume_name = "";
    if (resumeFile) {
      resume_base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(resumeFile);
      });
      resume_name = resumeFile.name;
    }

    const newApp = {
      id: appId,
      name: form.name, email: form.email, phone: form.phone,
      position: posLabel, status: "new",
      password_hash, cover_letter: form.cover_letter,
      experience: form.experience, why_nova: form.why_nova,
      availability: form.availability, expected_pay: form.expected_pay,
      portfolio_url: form.portfolio_url,
      owns_camera: form.owns_camera, camera_specs: form.camera_specs,
      has_editing_exp: form.has_editing_exp, editing_software: form.editing_software,
      social_media: form.social_media, has_drone: form.has_drone,
      sales_experience: form.sales_experience, industries: form.industries,
      has_car: form.has_car, cold_calling: form.cold_calling, biggest_sale: form.biggest_sale,
      reference_1_name: refs[0].name, reference_1_relationship: refs[0].relationship,
      reference_1_phone: refs[0].phone, reference_1_email: refs[0].email,
      reference_2_name: refs[1].name, reference_2_relationship: refs[1].relationship,
      reference_2_phone: refs[1].phone, reference_2_email: refs[1].email,
      reference_3_name: refs[2].name, reference_3_relationship: refs[2].relationship,
      reference_3_phone: refs[2].phone, reference_3_email: refs[2].email,
      resume_name,
      status_messages: [],
      submittedAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    existing.unshift(newApp);
    localStorage.setItem("nova_applications", JSON.stringify(existing));

    // Send to API
    try {
      const res = await fetch("/api/submit-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newApp, resume_base64 }),
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
            Isaac will personally review your application. A confirmation email with your login credentials was sent to <strong style={{ color: "rgba(255,255,255,0.6)" }}>{form.email}</strong>.
          </p>
          <a href="/applicant-login"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-lg hover:opacity-85 transition-all"
            style={{ background: G, color: "#0a0800" }}>
            CHECK APPLICATION STATUS <ArrowRight className="w-3.5 h-3.5" />
          </a>
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
            Required fields are marked with *. Everything else is optional — leave blank or write N/A.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── POSITION ────────────────────────────────────────── */}
          <Field label="Position Applying For *">
            <select required value={form.position} onChange={set("position")} style={{ ...inp, appearance: "none", cursor: "pointer" }} onFocus={focus} onBlur={blur}>
              <option value="" style={{ background: "#111" }}>Select a position</option>
              <optgroup label="Open Positions" style={{ background: "#111" }}>
                {POSITIONS.filter((p) => p.open).map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#111" }}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Filled Positions" style={{ background: "#111" }}>
                {POSITIONS.filter((p) => !p.open).map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#111" }}>{p.label} — FILLED</option>
                ))}
              </optgroup>
            </select>
            {isFilled && (
              <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                This position is filled. Submit anyway to be considered for future openings.
              </div>
            )}
          </Field>

          <SectionDivider title="Contact Info" />

          {/* ── CONTACT ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full Name *">
              <input required value={form.name} onChange={set("name")} style={inp} placeholder="Jane Smith" onFocus={focus} onBlur={blur} />
            </Field>
            <Field label="Phone *">
              <input required type="tel" value={form.phone} onChange={set("phone")} style={inp} placeholder="+1 (860) 000-0000" onFocus={focus} onBlur={blur} />
            </Field>
          </div>

          <Field label="Email Address * (used to log in to check status)">
            <input required type="email" value={form.email} onChange={set("email")} style={inp} placeholder="jane@email.com" onFocus={focus} onBlur={blur} />
          </Field>

          {/* ── ACCOUNT PASSWORD ─────────────────────────────────── */}
          <SectionDivider title="Create Account Password" />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: -10, lineHeight: 1.6 }}>
            This password lets you log in at <span style={{ color: GOLD }}>nova-systems.app/applicant-login</span> to track your application status.
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

          {/* ── POSITION-SPECIFIC ─────────────────────────────────── */}
          {form.position && <SectionDivider title={isFilled ? "Application" : "Position Details"} />}

          {form.position === "videographer" && (
            <>
              <Field label="Do you own a camera or 1080p-capable phone? *">
                <YesNo value={form.owns_camera} onChange={setVal("owns_camera")} />
              </Field>
              <Field label="Camera specs / model">
                <input value={form.camera_specs || ""} onChange={set("camera_specs")} style={inp} placeholder="e.g. iPhone 15 Pro, Sony A7III…" onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Video editing experience? *">
                <YesNo value={form.has_editing_exp} onChange={setVal("has_editing_exp")} />
                {form.has_editing_exp === "yes" && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ ...lbl, marginBottom: 8 }}>Editing software</label>
                    <select value={form.editing_software || ""} onChange={set("editing_software")} style={{ ...inp, appearance: "none" }} onFocus={focus} onBlur={blur}>
                      <option value="" style={{ background: "#111" }}>Select software</option>
                      {EDITING_SOFTWARE.map((s) => <option key={s} value={s} style={{ background: "#111" }}>{s}</option>)}
                    </select>
                  </div>
                )}
              </Field>
              <Field label="Portfolio URL (website, Instagram, TikTok, YouTube)">
                <input type="text" value={form.portfolio_url || ""} onChange={set("portfolio_url")} style={inp} placeholder="https://…" onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Social media (platforms & follower counts)">
                <textarea rows={2} value={form.social_media || ""} onChange={set("social_media")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="TikTok 10k, Instagram 5k…" />
              </Field>
              <Field label="Drone experience?">
                <YesNo value={form.has_drone} onChange={setVal("has_drone")} />
              </Field>
            </>
          )}

          {form.position === "sales" && (
            <>
              <Field label="Sales experience">
                <textarea rows={3} value={form.sales_experience || ""} onChange={set("sales_experience")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="B2B, B2C, door-to-door, retail…" />
              </Field>
              <Field label="Industries you've worked in">
                <input value={form.industries || ""} onChange={set("industries")} style={inp} placeholder="Tech, Real Estate, Insurance…" onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Reliable car?">
                <YesNo value={form.has_car} onChange={setVal("has_car")} />
              </Field>
              <Field label="Comfortable cold calling?">
                <YesNo value={form.cold_calling} onChange={setVal("cold_calling")} />
              </Field>
              <Field label="Biggest sale you've ever closed">
                <textarea rows={2} value={form.biggest_sale || ""} onChange={set("biggest_sale")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="Size, context, how you closed it…" />
              </Field>
              <Field label="Commission expectations">
                <input value={form.expected_pay || ""} onChange={set("expected_pay")} style={inp} placeholder="10%, $500/deal, open to negotiation…" onFocus={focus} onBlur={blur} />
              </Field>
            </>
          )}

          {/* ── COVER LETTER ─────────────────────────────────────── */}
          {form.position && (
            <>
              <SectionDivider title="Cover Letter" />
              <Field label="Cover Letter">
                <textarea rows={8} value={form.cover_letter} onChange={set("cover_letter")} onFocus={focus} onBlur={blur}
                  style={{ ...inp, resize: "vertical", lineHeight: 1.75 }}
                  placeholder="Tell Isaac why you're the one. What have you done, what are you building, and why Nova Systems specifically…" />
              </Field>

              <SectionDivider title="Background" />
              <Field label="Previous Experience">
                <textarea rows={3} value={form.experience} onChange={set("experience")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="Relevant work, projects, or life experience…" />
              </Field>
              <Field label="Why Nova Systems?">
                <textarea rows={3} value={form.why_nova} onChange={set("why_nova")} onFocus={focus} onBlur={blur} style={{ ...inp, resize: "none" }} placeholder="Be specific. What do you know about what we do?" />
              </Field>
              <Field label="Availability">
                <input value={form.availability} onChange={set("availability")} style={inp} placeholder="Weekdays, weekends, flexible…" onFocus={focus} onBlur={blur} />
              </Field>
              {form.position !== "sales" && (
                <Field label="Expected Pay">
                  <input value={form.expected_pay} onChange={set("expected_pay")} style={inp} placeholder="$20/hr, $200/project, negotiable…" onFocus={focus} onBlur={blur} />
                </Field>
              )}

              {/* ── REFERENCES ─────────────────────────────────────── */}
              <SectionDivider title="References (optional)" />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: -10, lineHeight: 1.6 }}>
                Up to 3 professional or personal references. All fields optional. Do not list family members.
              </p>
              {refs.map((ref, i) => (
                <RefBlock key={i} number={i + 1} value={ref}
                  onChange={(v) => setRefs((r) => r.map((x, j) => j === i ? v : x))} />
              ))}

              {/* ── RESUME ───────────────────────────────────────────── */}
              <SectionDivider title="Resume" />
              <Field label="Resume Upload (PDF) — optional">
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: "28px 20px", border: `2px dashed ${resumeFile ? GOLD : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                    background: resumeFile ? `${GOLD}08` : "rgba(255,255,255,0.02)",
                  }}>
                  {resumeFile ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>{resumeFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setResumeFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.2)" }} />
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Click to upload PDF</p>
                      <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, marginTop: 4 }}>Max 4MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{ display: "none" }} />
              </Field>
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
