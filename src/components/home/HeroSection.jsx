import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

const GOLD = "linear-gradient(135deg, #b8860b 0%, #d4a017 20%, #f5c842 45%, #ffd700 60%, #d4a017 80%, #b8860b 100%)";
const GOLD_SOLID = "#d4a017";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black">

      {/* Full background image on the right */}
      <div className="absolute inset-0">
        <div className="absolute right-0 top-0 bottom-0 w-[68%]">
          <img
            src={HERO_BG}
            alt="Data matrix"
            className="w-full h-full object-cover object-left"
          />
          {/* Fade from left */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
          {/* top/bottom vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />
        </div>
        {/* Solid black left panel */}
        <div className="absolute left-0 top-0 bottom-0 w-[36%] bg-black" />

        {/* Diagonal gold divider — thick multi-tone */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: "32%",
            width: "3px",
            background: "linear-gradient(to bottom, transparent 0%, #7a5c00 5%, #b8860b 15%, #d4a017 30%, #f5c842 50%, #d4a017 70%, #b8860b 85%, #7a5c00 95%, transparent 100%)",
            transform: "skewX(-4deg)",
            filter: "drop-shadow(0 0 8px #d4a017) drop-shadow(0 0 20px #b8860b80)",
          }}
        />
        {/* Glow halo on the divider */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: "31.5%",
            width: "12px",
            background: "linear-gradient(to bottom, transparent 0%, #b8860b15 15%, #d4a01730 50%, #b8860b15 85%, transparent 100%)",
            transform: "skewX(-4deg)",
            filter: "blur(4px)",
          }}
        />
      </div>

      {/* LEFT CONTENT */}
      <div className="relative w-full max-w-7xl mx-auto px-8 md:px-14 py-32 flex items-center min-h-screen">
        <div className="w-full md:w-[42%]">
          {/* Label */}
          <p className="text-[11px] tracking-[0.28em] uppercase mb-6 flex items-center gap-3 text-white/60">
            NOVA SYSTEMS
            <span
              className="inline-block h-px w-10"
              style={{ background: GOLD }}
            />
          </p>

          {/* Headline — 3 lines, takes screen */}
          <h1 className="font-bold leading-[0.9] tracking-tight text-white" style={{ fontSize: "clamp(3rem, 6vw, 6rem)" }}>
            Stop losing<br />
            revenue.<br />
            <span className="text-[0.65em] text-white/70 font-semibold">opportunities.</span>
          </h1>

          <p className="text-white/50 mt-7 text-base leading-relaxed max-w-xs">
            Most businesses lose opportunities<br />without ever seeing where.
          </p>

          {/* Gold gradient button */}
          <Link
            to="/solutions"
            className="inline-flex items-center gap-3 mt-10 px-8 py-4 text-xs font-bold tracking-[0.18em] uppercase transition-all hover:opacity-90 active:scale-95"
            style={{
              background: GOLD,
              color: "#0a0800",
              boxShadow: "0 0 20px #d4a01740, 0 4px 24px #b8860b30",
            }}
          >
            SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ALERT CARDS — sideways V shape across the image */}
        {/* Card 1 — top right (tip of V) */}
        <div
          className="hidden md:block absolute"
          style={{ top: "14%", right: "22%" }}
        >
          <AlertCard
            icon={<Phone className="w-4 h-4" />}
            label="MISSED CALL"
            sub="Potential Lead Lost"
            gold={GOLD_SOLID}
          />
        </div>

        {/* Card 2 — middle, pulled left toward center (middle of V) */}
        <div
          className="hidden md:block absolute"
          style={{ top: "44%", right: "36%" }}
        >
          <AlertCard
            icon={<Clock className="w-4 h-4" />}
            label="NO RESPONSE"
            sub="Opportunity Lost"
            gold={GOLD_SOLID}
          />
        </div>

        {/* Card 3 — bottom right (other tip of V) */}
        <div
          className="hidden md:block absolute"
          style={{ bottom: "12%", right: "18%" }}
        >
          <AlertCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="SLOW FOLLOW-UP"
            sub="Revenue Leak"
            gold={GOLD_SOLID}
            highlight
          />
        </div>
      </div>
    </section>
  );
}

function AlertCard({ icon, label, sub, gold, highlight }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded backdrop-blur-md"
      style={{
        background: "rgba(8,6,0,0.78)",
        border: `1px solid ${highlight ? gold + "80" : "rgba(255,255,255,0.1)"}`,
        minWidth: "200px",
        boxShadow: highlight ? `0 0 16px ${gold}30` : "none",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `${gold}18`,
          border: `1px solid ${gold}50`,
          color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: highlight ? gold : "#ffffff" }}
        >
          {label}
        </p>
        <p className="text-[10px] text-white/50 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}