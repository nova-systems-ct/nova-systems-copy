import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

const GOLD = "#D4A030";

export default function HeroSection() {
  return (
    <section className="relative h-screen overflow-hidden bg-black">

      {/* RIGHT image panel — inset from left using clip-path trapezoid */}
      <div
        className="absolute top-0 right-0 bottom-0"
        style={{
          left: "0",
          zIndex: 5,
          clipPath: "polygon(52% 0%, 100% 0%, 100% 100%, 44% 100%)",
        }}
      >
        <img
          src={HERO_BG}
          alt="Data matrix"
          className="w-full h-full object-cover object-left-top"
        />
        {/* left fade */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 25%, transparent 50%)" }}
        />
        {/* bottom vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.55) 100%)" }}
        />
      </div>

      {/* Gold line along the top of the image (horizontal, right portion) */}
      <div
        className="absolute top-0"
        style={{
          left: "52%",
          right: 0,
          height: "2px",
          background: `linear-gradient(to right, ${GOLD}, #F0C040 40%, ${GOLD} 70%, transparent 100%)`,
          filter: `drop-shadow(0 0 4px ${GOLD}aa)`,
          zIndex: 25,
        }}
      />

      {/* Diagonal gold divider line — SVG for true trapezoid edge */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 20, pointerEvents: "none" }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="goldLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.3" />
            <stop offset="15%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="50%" stopColor="#F0C040" stopOpacity="1" />
            <stop offset="85%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Line from top-52% to bottom-44% */}
        <line
          x1="52%" y1="0%"
          x2="44%" y2="100%"
          stroke="url(#goldLine)"
          strokeWidth="1.5"
          filter="url(#glow)"
        />
      </svg>

      {/* LEFT text panel */}
      <div
        className="absolute top-0 left-0 bottom-0 flex flex-col justify-center px-12 md:px-16"
        style={{ width: "50%", zIndex: 30 }}
      >
        <p
          className="text-[10px] tracking-[0.3em] uppercase mb-5 flex items-center gap-3"
          style={{ color: GOLD }}
        >
          NOVA SYSTEMS
          <span
            className="inline-block h-px w-10"
            style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }}
          />
        </p>

        <h1
          className="font-black leading-[0.9] tracking-tight text-white"
          style={{ fontSize: "clamp(2.8rem, 5vw, 5rem)" }}
        >
          Stop losing<br />revenue
        </h1>

        <p className="text-white/55 mt-6 text-sm leading-relaxed max-w-xs">
          Most businesses lose opportunities without ever seeing where.
        </p>

        <Link
          to="/solutions"
          className="inline-flex items-center gap-3 mt-9 px-7 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-opacity hover:opacity-85"
          style={{
            background: `linear-gradient(135deg, #8a6200 0%, ${GOLD} 40%, #F0C040 60%, ${GOLD} 80%, #8a6200 100%)`,
            color: "#0a0800",
            width: "fit-content",
          }}
        >
          SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ALERT CARDS on the image */}
      <div className="absolute inset-0" style={{ zIndex: 35, pointerEvents: "none" }}>
        {/* Card 1 — upper */}
        <div className="hidden md:block absolute" style={{ top: "18%", left: "54%" }}>
          <AlertCard icon={<Phone className="w-3.5 h-3.5" />} label="MISSED CALL" sub="Potential Lead Lost" gold={GOLD} />
        </div>

        {/* Card 2 — middle */}
        <div className="hidden md:block absolute" style={{ top: "44%", left: "52%" }}>
          <AlertCard icon={<Clock className="w-3.5 h-3.5" />} label="NO RESPONSE" sub="Opportunity Lost" gold={GOLD} />
        </div>

        {/* Card 3 — lower */}
        <div className="hidden md:block absolute" style={{ top: "63%", left: "54%" }}>
          <AlertCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="SLOW FOLLOW-UP" sub="Revenue Leak" gold={GOLD} highlight />
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
        background: "rgba(4,3,1,0.80)",
        border: `1px solid ${highlight ? gold + "70" : "rgba(255,255,255,0.12)"}`,
        minWidth: "205px",
        boxShadow: highlight ? `0 0 20px ${gold}30` : "none",
        pointerEvents: "auto",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `${gold}25`,
          border: `1px solid ${gold}60`,
          color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-white">{label}</p>
        <p className="text-[9px] mt-0.5 text-white/45">{sub}</p>
      </div>
    </div>
  );
}