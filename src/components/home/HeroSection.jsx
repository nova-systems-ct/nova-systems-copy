import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

// Warm orange-gold — like 14k gold in the reference images
const GOLD = "#C8920A";
const GOLD_LIGHT = "#D4A520";
const GOLD_DARK = "#8B6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 40%, ${GOLD_LIGHT} 60%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

export default function HeroSection() {
  return (
    <section className="relative h-screen flex items-center overflow-hidden bg-black">

      {/* Background image — covers ~75% from the right */}
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{ left: "22%" }}
      >
        <img
          src={HERO_BG}
          alt="Data matrix"
          className="w-full h-full object-cover object-left-top"
          style={{ opacity: 0.95 }}
        />
        {/* Gentle fade on far right edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30" />
        {/* Top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
      </div>

      {/* Left dark panel */}
      <div className="absolute top-0 bottom-0 left-0" style={{ width: "25%" }}>
        <div className="absolute inset-0 bg-black" />
      </div>

      {/* Diagonal gold divider line — at ~24%, angled */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: "24%",
          width: "2px",
          background: `linear-gradient(to bottom, transparent 0%, ${GOLD_DARK} 5%, ${GOLD} 30%, ${GOLD_LIGHT} 55%, ${GOLD} 75%, ${GOLD_DARK} 95%, transparent 100%)`,
          transform: "skewX(-6deg)",
          filter: `drop-shadow(0 0 8px ${GOLD}80) drop-shadow(0 0 2px ${GOLD_LIGHT})`,
          zIndex: 10,
        }}
      />
      {/* Subtle glow behind the line */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: "23.5%",
          width: "8px",
          background: `linear-gradient(to bottom, transparent, ${GOLD}20 20%, ${GOLD}35 50%, ${GOLD}20 80%, transparent)`,
          transform: "skewX(-6deg)",
          filter: "blur(3px)",
          zIndex: 9,
        }}
      />

      {/* CONTENT LAYER */}
      <div className="relative w-full h-full flex items-center" style={{ zIndex: 20 }}>

        {/* LEFT TEXT — sits in the black panel */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-center px-8 md:px-10" style={{ width: "24%" }}>
          <p
            className="text-[9px] tracking-[0.28em] uppercase mb-5 flex items-center gap-2"
            style={{ color: GOLD }}
          >
            NOVA SYSTEMS
            <span className="inline-block h-px w-8" style={{ background: GOLD_GRADIENT }} />
          </p>

          <h1
            className="font-black leading-[0.88] tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 3.2vw, 3.8rem)" }}
          >
            Stop losing<br />revenue
          </h1>

          <p className="text-white/55 mt-5 leading-relaxed" style={{ fontSize: "clamp(0.7rem, 0.9vw, 0.9rem)" }}>
            Most businesses lose opportunities without ever seeing where.
          </p>

          <Link
            to="/solutions"
            className="inline-flex items-center gap-2 mt-7 px-5 py-3 text-[10px] font-bold tracking-[0.15em] uppercase transition-opacity hover:opacity-80"
            style={{
              background: GOLD_GRADIENT,
              color: "#0a0800",
              width: "fit-content",
            }}
          >
            SEE NOVA PULSE IN ACTION <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* ALERT CARDS — on the image, spread in a stacked V */}
        {/* Card 1 — upper area */}
        <div className="hidden md:block absolute" style={{ top: "22%", left: "42%" }}>
          <AlertCard
            icon={<Phone className="w-3.5 h-3.5" />}
            label="MISSED CALL"
            sub="Potential Lead Lost"
            gold={GOLD}
          />
        </div>

        {/* Card 2 — middle, slightly right */}
        <div className="hidden md:block absolute" style={{ top: "47%", left: "40%" }}>
          <AlertCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="NO RESPONSE"
            sub="Opportunity Lost"
            gold={GOLD}
          />
        </div>

        {/* Card 3 — lower area */}
        <div className="hidden md:block absolute" style={{ top: "66%", left: "43%" }}>
          <AlertCard
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="SLOW FOLLOW-UP"
            sub="Revenue Leak"
            gold={GOLD}
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
      className="flex items-center gap-3 px-4 py-3 rounded-sm backdrop-blur-md"
      style={{
        background: "rgba(5,4,2,0.75)",
        border: `1px solid ${highlight ? gold + "60" : "rgba(255,255,255,0.1)"}`,
        minWidth: "195px",
        boxShadow: highlight ? `0 0 20px ${gold}20` : "none",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `${gold}20`,
          border: `1px solid ${gold}50`,
          color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white">
          {label}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{sub}</p>
      </div>
    </div>
  );
}