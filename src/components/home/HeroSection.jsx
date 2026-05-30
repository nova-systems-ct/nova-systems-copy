import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/6a1b4bf7edab14ff13a1d1b4/e901e94e6_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-black">
      {/* Right side image — full bleed */}
      <div className="absolute inset-0">
        {/* Image fills the right 60% */}
        <div className="absolute right-0 top-0 bottom-0 w-[65%]">
          <img
            src={HERO_BG}
            alt="Data matrix"
            className="w-full h-full object-cover"
          />
          {/* fade from left into the image */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />
          {/* subtle dark vignette top/bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
        </div>

        {/* Left black area */}
        <div className="absolute left-0 top-0 bottom-0 w-[40%] bg-black" />

        {/* Diagonal gold divider line */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: "35%",
            width: "2px",
            background: "linear-gradient(to bottom, transparent 0%, #c9a84c 20%, #f0c040 50%, #c9a84c 80%, transparent 100%)",
            transform: "skewX(-3deg)",
            opacity: 0.8,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative w-full max-w-7xl mx-auto px-8 md:px-12 py-32 flex items-center">
        {/* Left text block */}
        <div className="w-full md:w-[45%]">
          <p className="text-[11px] tracking-[0.25em] uppercase mb-5 flex items-center gap-3"
             style={{ color: "#c9a84c" }}>
            NOVA SYSTEMS
            <span className="inline-block w-10 h-px" style={{ background: "linear-gradient(to right, #c9a84c, #f0c040)" }} />
          </p>

          <h1 className="text-5xl md:text-[5.5rem] font-bold leading-[0.92] text-white tracking-tight">
            Stop losing<br />revenue
          </h1>

          <p className="text-gray-400 mt-6 text-base leading-relaxed max-w-xs">
            Most businesses lose opportunities<br />without ever seeing where.
          </p>

          <Link
            to="/solutions"
            className="inline-flex items-center gap-3 mt-10 px-7 py-4 text-xs font-bold tracking-[0.15em] uppercase transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #c9a84c 0%, #f0c040 50%, #c9a84c 100%)",
              color: "#0a0a0a",
            }}
          >
            SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Alert cards overlaid on right image */}
        <div className="hidden md:flex flex-col gap-4 absolute right-[4%] top-1/2 -translate-y-1/2 w-64">
          {/* MISSED CALL */}
          <div className="backdrop-blur-md rounded border border-white/10 px-4 py-3 flex items-center gap-3"
               style={{ background: "rgba(10,10,10,0.75)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <Phone className="w-3.5 h-3.5" style={{ color: "#f0c040" }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white">MISSED CALL</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Potential Lead Lost</p>
            </div>
          </div>

          {/* NO RESPONSE */}
          <div className="backdrop-blur-md rounded border border-white/10 px-4 py-3 flex items-center gap-3 ml-6"
               style={{ background: "rgba(10,10,10,0.75)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <Clock className="w-3.5 h-3.5" style={{ color: "#f0c040" }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white">NO RESPONSE</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Opportunity Lost</p>
            </div>
          </div>

          {/* SLOW FOLLOW-UP */}
          <div className="backdrop-blur-md rounded border border-white/10 px-4 py-3 flex items-center gap-3 ml-12"
               style={{ background: "rgba(10,10,10,0.75)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#f0c040" }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f0c040" }}>SLOW FOLLOW-UP</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Revenue Leak</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}