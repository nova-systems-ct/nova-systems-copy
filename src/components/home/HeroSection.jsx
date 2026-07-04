import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import video3 from "@/assets/video 3.mp4";
import video4 from "@/assets/video 4.mp4";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const VIDEOS = [video3, video4];

export default function HeroSection() {
  const [vidIdx, setVidIdx] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.src = VIDEOS[vidIdx];
    v.load();
    v.play().catch(() => {});
  }, [vidIdx]);

  return (
    <section className="relative h-screen overflow-hidden bg-black">

      {/* RIGHT panel - looping video background */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 5, clipPath: "polygon(62% 0%, 100% 0%, 100% 100%, 40% 100%)" }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          onEnded={() => setVidIdx((i) => (i + 1) % VIDEOS.length)}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.60)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 30%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 65%, rgba(0,0,0,0.6) 100%)" }} />
      </div>

      {/* Gold top-edge line */}
      <div
        className="absolute top-0"
        style={{
          left: "62%", right: 0, height: "2px",
          background: `linear-gradient(to right, ${GOLD}, ${GOLD_BRIGHT} 35%, ${GOLD} 70%, transparent 100%)`,
          filter: `drop-shadow(0 0 5px ${GOLD}bb)`,
          zIndex: 25,
        }}
      />

      {/* Diagonal gold SVG divider */}
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
          style={{ color: GOLD, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}
        >
          NOVA SYSTEMS
          <span className="inline-block h-px w-12" style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }} />
        </p>

        <h1
          className="font-black text-white leading-[0.95]"
          style={{ fontSize: "clamp(2.6rem, 5.2vw, 5.2rem)", letterSpacing: "-0.02em", maxWidth: 640 }}
        >
          Elite Digital Infrastructure.{" "}
          <span style={{
            background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 50%, ${GOLD} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Engineered for Scale.</span>
        </h1>

        <p className="text-white/55 mt-6 leading-relaxed" style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)", maxWidth: 460 }}>
          Whatever your business needs, wants, or envisions — we build it. From premium websites to custom AI systems, Nova Systems engineers the tools your company demands.
        </p>

        <Link
          to="/welcome"
          className="inline-flex items-center gap-3 mt-10 font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
          style={{
            background: `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 40%, ${GOLD_BRIGHT} 60%, ${GOLD} 80%, ${GOLD_DARK} 100%)`,
            color: "#0a0800",
            width: "fit-content",
            fontSize: 12,
            padding: "18px 32px",
          }}
        >
          SCHEDULE A STRATEGY MEETING <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

    </section>
  );
}
