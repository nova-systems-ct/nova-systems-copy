import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

// 14k orange-gold — rich, warm, not bright yellow
const G1 = "#8B5E00";
const G2 = "#B07D1A";
const G3 = "#C8901F";
const G4 = "#A06818";
const GOLD_GRADIENT = `linear-gradient(135deg, ${G1} 0%, ${G2} 25%, ${G3} 55%, ${G2} 80%, ${G1} 100%)`;
const GOLD_MID = "#B07D1A";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black">

      {/* Background image — covers right ~70% */}
      <div className="absolute inset-0">
        <div className="absolute right-0 top-0 bottom-0 w-[72%]">
          <img
            src={HERO_BG}
            alt="Data matrix"
            className="w-full h-full object-cover object-left"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55" />
        </div>

        {/* Solid left panel */}
        <div className="absolute left-0 top-0 bottom-0 w-[32%] bg-black" />

        {/* Diagonal gold divider — shifted more right, more angle */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: "38%",
            width: "2px",
            background: `linear-gradient(to bottom, transparent 0%, ${G1} 8%, ${G2} 25%, ${G3} 50%, ${G2} 75%, ${G1} 92%, transparent 100%)`,
            transform: "skewX(-8deg)",
            filter: `drop-shadow(0 0 6px ${GOLD_MID}60)`,
          }}
        />
      </div>

      {/* CONTENT */}
      <div className="relative w-full max-w-7xl mx-auto px-8 md:px-14 py-28 flex items-center min-h-screen">

        {/* LEFT — text block */}
        <div className="w-full md:w-[44%]">
          <p
            className="text-[10px] tracking-[0.3em] uppercase mb-6 flex items-center gap-3"
            style={{ color: GOLD_MID }}
          >
            NOVA SYSTEMS
            <span
              className="inline-block h-px w-10"
              style={{ background: GOLD_GRADIENT }}
            />
          </p>

          <h1
            className="font-black leading-[0.88] tracking-tight text-white"
            style={{ fontSize: "clamp(3.5rem, 7vw, 7rem)" }}
          >
            Stop losing<br />revenue
          </h1>

          <p className="text-white/50 mt-7 text-base leading-relaxed max-w-xs">
            Most businesses lose opportunities<br />without ever seeing where.
          </p>

          <Link
            to="/solutions"
            className="inline-flex items-center gap-3 mt-10 px-8 py-4 text-xs font-bold tracking-[0.18em] uppercase transition-opacity hover:opacity-80"
            style={{
              background: GOLD_GRADIENT,
              color: "#0a0800",
            }}
          >
            SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ALERT CARDS — spread across center of the image in a wide V */}
        {/* Card 1 — top center-right */}
        <div
          className="hidden md:block absolute"
          style={{ top: "18%", left: "52%" }}
        >
          <AlertCard
            icon={<Phone className="w-4 h-4" />}
            label="MISSED CALL"
            sub="Potential Lead Lost"
            gold={GOLD_MID}
          />
        </div>

        {/* Card 2 — middle, pulled further right (widest point of V) */}
        <div
          className="hidden md:block absolute"
          style={{ top: "46%", left: "62%" }}
        >
          <AlertCard
            icon={<Clock className="w-4 h-4" />}
            label="NO RESPONSE"
            sub="Opportunity Lost"
            gold={GOLD_MID}
          />
        </div>

        {/* Card 3 — bottom center-right (closing the V) */}
        <div
          className="hidden md:block absolute"
          style={{ bottom: "14%", left: "50%" }}
        >
          <AlertCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="SLOW FOLLOW-UP"
            sub="Revenue Leak"
            gold={GOLD_MID}
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
        background: "rgba(6,4,0,0.80)",
        border: `1px solid ${highlight ? gold + "70" : "rgba(255,255,255,0.08)"}`,
        minWidth: "210px",
        boxShadow: highlight ? `0 0 18px ${gold}25` : "none",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `${gold}18`,
          border: `1px solid ${gold}45`,
          color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-wider text-white"
        >
          {label}
        </p>
        <p className="text-[10px] text-white/45 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}