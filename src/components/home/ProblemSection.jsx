import React, { useEffect, useRef, useState } from "react";
import { Phone, Clock, Eye } from "lucide-react";

const GOLD = "#D4A030";

const problems = [
  {
    icon: Phone,
    title: "Leads vanish before you know they called.",
    desc: "Every unanswered call is a customer choosing your competitor. Right now.",
  },
  {
    icon: Clock,
    title: "Slow follow-up costs you deals every day.",
    desc: "The window to win is minutes - not hours. Most teams respond in hours.",
  },
  {
    icon: Eye,
    title: "You can't fix what you can't see.",
    desc: "Revenue leaks from places your team has never looked. We find them.",
  },
];

function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function ProblemSection() {
  const [headRef, headInView] = useInView(0.5);

  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${GOLD}18 0%, transparent 70%)` }}
      />

      <div className="max-w-4xl mx-auto text-center relative">
        <div ref={headRef} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 20 }}>
          <p className="text-[9px] tracking-[0.35em] uppercase" style={{ color: GOLD }}>THE PROBLEM</p>
          <div style={{
            height: 1, background: GOLD,
            transition: "width 0.9s ease",
            width: headInView ? 80 : 0,
          }} />
        </div>

        <h2 className="text-4xl md:text-6xl font-black text-white leading-[0.95] tracking-tight">
          Revenue is walking<br />
          <span style={{
            background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>out your door.</span>
        </h2>
        <p className="text-white/40 mt-5 text-base max-w-md mx-auto">
          Every missed call. Every slow response. Every dropped lead.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mt-14">
          {problems.map((p, i) => <ProblemCard key={p.title} p={p} delay={i * 120} />)}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .problem-card-in { animation: fadeSlideUp 0.55s ease both; }
      `}</style>
    </section>
  );
}

function ProblemCard({ p, delay }) {
  const [ref, inView] = useInView(0.2);
  const Icon = p.icon;
  return (
    <div
      ref={ref}
      className={inView ? "problem-card-in" : ""}
      style={{
        opacity: inView ? 1 : 0,
        animationDelay: `${delay}ms`,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: 28,
        textAlign: "left",
        transition: "transform 0.2s",
        position: "relative",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, width: 32, height: 32,
        background: `linear-gradient(135deg, ${GOLD}35 0%, transparent 60%)`,
        borderTopLeftRadius: 12, pointerEvents: "none",
      }} />
      <div style={{
        width: 40, height: 40, borderRadius: 8, marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${GOLD}15`, border: `1px solid ${GOLD}35`,
      }}>
        <Icon style={{ width: 20, height: 20, color: GOLD }} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.35, marginBottom: 8 }}>{p.title}</h3>
      <p style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,0.38)" }}>{p.desc}</p>
    </div>
  );
}
