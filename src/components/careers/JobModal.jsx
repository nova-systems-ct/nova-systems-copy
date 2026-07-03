import React, { useEffect } from "react";
import { X, CheckCircle2, DollarSign } from "lucide-react";
import JobApplicationForm from "./JobApplicationForm";

const GOLD = "#D4A030";

export default function JobModal({ job, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!job) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "5vh 16px", overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl"
        style={{
          background: "#0a0a0a", border: `1px solid ${GOLD}35`,
          borderRadius: 20, boxShadow: `0 20px 80px rgba(0,0,0,0.6), 0 0 60px ${GOLD}0d`,
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, right: 0, width: 320, height: 320, background: `radial-gradient(circle, ${GOLD}14 0%, transparent 70%)`, pointerEvents: "none" }} />

        <button onClick={onClose} aria-label="Close"
          style={{
            position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
          <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
        </button>

        <div className="p-8 md:p-12" style={{ position: "relative" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}45`, marginBottom: 20 }}>
            {job.badge}
          </span>

          {job.pitch ? <SalesPitch job={job} /> : <StandardJob job={job} />}

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "40px 0 28px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Apply for This Position</p>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <JobApplicationForm job={job} />
        </div>
      </div>
    </div>
  );
}

function StandardJob({ job }) {
  return (
    <>
      <h2 className="text-2xl md:text-4xl font-black text-white leading-[1.1] mb-6" style={{ maxWidth: 640 }}>
        {job.title}
      </h2>
      <p className="text-sm md:text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)", maxWidth: 680 }}>
        {job.description}
      </p>

      <div style={{ padding: "16px 20px", borderRadius: 10, background: `${GOLD}0d`, border: `1px solid ${GOLD}30`, marginBottom: 28, display: "flex", gap: 12 }}>
        <DollarSign className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
        <div>
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Compensation</p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.7 }}>{job.compensation}</p>
        </div>
      </div>

      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>Requirements</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {job.requirements.map((r, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{r}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function SalesPitch({ job }) {
  const p = job.pitch;
  return (
    <>
      <h2 className="text-3xl md:text-5xl font-black text-white leading-[1.05] mb-5" style={{ maxWidth: 640 }}>
        {p.headline}
      </h2>
      <p className="text-sm md:text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.55)", maxWidth: 680 }}>
        {p.subheadline}
      </p>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 720 }}>
        {job.description}
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <PitchColumn title="Commission Structure" items={p.commissionStructure} />
        <PitchColumn title="What You Need" items={job.requirements} />
        <PitchColumn title="What We Provide" items={p.provides} />
      </div>

      <div style={{ padding: "14px 20px", borderRadius: 10, background: `${GOLD}12`, border: `1px solid ${GOLD}35`, marginBottom: 12 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>★ Bonus: {p.bonus}</p>
      </div>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 4 }}>{p.topEarner}</p>
    </>
  );
}

function PitchColumn({ title, items }) {
  return (
    <div>
      <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>{title}</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
