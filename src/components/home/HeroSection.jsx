import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#F0C040";
const GOLD_DARK = "#8a6200";

export default function HeroSection() {
  return (
    <section className="relative h-screen overflow-hidden bg-black">

      {/* RIGHT image — clipped with steep diagonal: 62% top → 40% bottom */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 5,
          clipPath: "polygon(62% 0%, 100% 0%, 100% 100%, 40% 100%)",
        }}
      >
        <img
          src={HERO_BG}
          alt="Data matrix"
          className="w-full h-full object-cover object-left-top"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 30%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 65%, rgba(0,0,0,0.6) 100%)" }} />
      </div>

      {/* Gold top-edge line on the image */}
      <div
        className="absolute top-0"
        style={{
          left: "62%",
          right: 0,
          height: "2px",
          background: `linear-gradient(to right, ${GOLD}, ${GOLD_BRIGHT} 35%, ${GOLD} 70%, transparent 100%)`,
          filter: `drop-shadow(0 0 5px ${GOLD}bb)`,
          zIndex: 25,
        }}
      />

      {/* Diagonal gold SVG divider line */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 20, pointerEvents: "none" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="goldLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.2" />
            <stop offset="10%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="50%" stopColor={GOLD_BRIGHT} stopOpacity="1" />
            <stop offset="90%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <line x1="62%" y1="0%" x2="40%" y2="100%" stroke="url(#goldLine)" strokeWidth="1.8" filter="url(#glow)" />
      </svg>

      {/* LEFT text panel */}
      <div
        className="absolute top-0 left-0 bottom-0 flex flex-col justify-center"
        style={{ width: "58%", zIndex: 30, paddingLeft: "clamp(2rem, 6vw, 5rem)" }}
      >
        <p
          className="flex items-center gap-3 mb-6"
          style={{ color: GOLD, fontSize: "11px", letterSpacing: "0.28em", textTransform: "uppercase" }}
        >
          NOVA SYSTEMS
          <span className="inline-block h-px w-12" style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }} />
        </p>

        <h1
          className="font-black text-white leading-[0.88]"
          style={{ fontSize: "clamp(4rem, 7.5vw, 8rem)", letterSpacing: "-0.02em" }}
        >
          Stop losing<br />revenue
        </h1>

        <p className="text-white/55 mt-6 leading-relaxed" style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)", maxWidth: "340px" }}>
          Most businesses lose opportunities without ever seeing where.
        </p>

        <Link
          to="/solutions"
          className="inline-flex items-center gap-3 mt-10 font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
          style={{
            background: `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 40%, ${GOLD_BRIGHT} 60%, ${GOLD} 80%, ${GOLD_DARK} 100%)`,
            color: "#0a0800",
            width: "fit-content",
            fontSize: "12px",
            padding: "18px 32px",
          }}
        >
          SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ALERT CARDS — larger, stacked on the image */}
      <div className="absolute inset-0" style={{ zIndex: 35, pointerEvents: "none" }}>
        <div className="hidden md:block absolute" style={{ top: "17%", left: "58%" }}>
          <AlertCard icon={<Phone className="w-4 h-4" />} label="MISSED CALL" sub="Potential Lead Lost" gold={GOLD} />
        </div>
        <div className="hidden md:block absolute" style={{ top: "43%", left: "55%" }}>
          <AlertCard icon={<Clock className="w-4 h-4" />} label="NO RESPONSE" sub="Opportunity Lost" gold={GOLD} />
        </div>
        <div className="hidden md:block absolute" style={{ top: "64%", left: "57%" }}>
          <AlertCard icon={<AlertTriangle className="w-4 h-4" />} label="SLOW FOLLOW-UP" sub="Revenue Leak" gold={GOLD} highlight />
        </div>
      </div>
    </section>
  );
}

function AlertCard({ icon, label, sub, gold, highlight }) {
  return (
    <div
      className="flex items-center gap-4 backdrop-blur-md"
      style={{
        background: "rgba(5,4,1,0.82)",
        border: `1px solid ${highlight ? gold + "75" : "rgba(255,255,255,0.13)"}`,
        minWidth: "260px",
        padding: "14px 20px",
        borderRadius: "3px",
        boxShadow: highlight ? `0 0 24px ${gold}35` : "none",
        pointerEvents: "auto",
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: `${gold}28`,
          border: `1px solid ${gold}65`,
          color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "white" }}>{label}</p>
        <p style={{ fontSize: "10px", marginTop: "3px", color: "rgba(255,255,255,0.45)" }}>{sub}</p>
      </div>
    </div>
  );
}