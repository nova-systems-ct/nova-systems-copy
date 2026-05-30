import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

const GOLD = "#C8960C";
const GOLD_GRADIENT = `linear-gradient(180deg, transparent 0%, #7a5c00 5%, ${GOLD} 30%, #E8B020 55%, ${GOLD} 75%, #7a5c00 95%, transparent 100%)`;

export default function HeroSection() {
  return (
    <section className="relative h-screen flex overflow-hidden bg-black">

      {/* LEFT panel — black, ~48% */}
      <div className="relative flex flex-col justify-center px-12 md:px-16" style={{ width: "48%", zIndex: 20 }}>
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
          style={{ fontSize: "clamp(3rem, 5.5vw, 5.5rem)" }}
        >
          Stop losing<br />revenue
        </h1>

        <p className="text-white/55 mt-6 text-base leading-relaxed max-w-sm">
          Most businesses lose opportunities without ever seeing where.
        </p>

        <Link
          to="/solutions"
          className="inline-flex items-center gap-3 mt-9 px-7 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-opacity hover:opacity-85"
          style={{
            background: `linear-gradient(135deg, #7a5c00 0%, ${GOLD} 40%, #E8B020 60%, ${GOLD} 80%, #7a5c00 100%)`,
            color: "#0a0800",
            width: "fit-content",
          }}
        >
          SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Diagonal gold divider line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "47%",
          width: "2px",
          background: GOLD_GRADIENT,
          transform: "skewX(-5deg)",
          filter: `drop-shadow(0 0 6px ${GOLD}90)`,
          zIndex: 30,
        }}
      />

      {/* RIGHT panel — data image, ~52% */}
      <div className="relative flex-1" style={{ zIndex: 10 }}>
        <img
          src={HERO_BG}
          alt="Data matrix"
          className="w-full h-full object-cover object-left-top"
        />
        {/* slight left-edge fade to blend with divider */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.35) 0%, transparent 20%)" }}
        />
        {/* top/bottom vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)" }}
        />

        {/* ALERT CARDS */}
        <div className="absolute inset-0" style={{ zIndex: 20 }}>
          {/* Card 1 — upper */}
          <div className="hidden md:block absolute" style={{ top: "20%", left: "18%" }}>
            <AlertCard icon={<Phone className="w-3.5 h-3.5" />} label="MISSED CALL" sub="Potential Lead Lost" gold={GOLD} />
          </div>

          {/* Card 2 — middle */}
          <div className="hidden md:block absolute" style={{ top: "46%", left: "14%" }}>
            <AlertCard icon={<Clock className="w-3.5 h-3.5" />} label="NO RESPONSE" sub="Opportunity Lost" gold={GOLD} />
          </div>

          {/* Card 3 — lower */}
          <div className="hidden md:block absolute" style={{ top: "66%", left: "17%" }}>
            <AlertCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="SLOW FOLLOW-UP" sub="Revenue Leak" gold={GOLD} highlight />
          </div>
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
        background: "rgba(4,3,1,0.78)",
        border: `1px solid ${highlight ? gold + "65" : "rgba(255,255,255,0.1)"}`,
        minWidth: "210px",
        boxShadow: highlight ? `0 0 18px ${gold}25` : "none",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: `${gold}22`,
          border: `1px solid ${gold}55`,
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