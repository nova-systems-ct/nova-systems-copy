import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import heroVideo from "@/assets/video 3.mp4";
import heroPoster from "@/assets/hero-poster-v3.jpg";
import { BLACK, GOLD, GOLD_BRIGHT, GOLD_GRADIENT, GOLD_TEXT_GRADIENT } from "@/lib/theme";

// 2026-09-21 (final video decision, repair task): single video, no rotation — "video 3.mp4" only,
// used exactly as supplied (not re-encoded; source is already a reasonable 1.36MB at 960x540, so
// there was no size problem to solve here, and the instruction was explicit not to claim a
// resolution improvement through re-encoding or CSS). Poster is a real extracted frame from this
// same file (hero-poster-v3.jpg), not the old globe-video poster — the loading/reduced-motion
// fallback has to match what actually plays. Two mounted <video> elements (mobile full-bleed +
// desktop diagonal-split layers) still exist for the responsive treatment; each needs its own ref
// (see the dual-ref bug fixed 2026-09-20 — one shared ref could only ever attach to one of the two
// actual DOM nodes) even though both now always play the same single file.
export default function HeroSection() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const mobileVideoRef = useRef(null);
  const desktopVideoRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    for (const ref of [mobileVideoRef, desktopVideoRef]) {
      const v = ref.current;
      if (!v) continue;
      v.pause();
      v.src = heroVideo;
      v.load();
      v.play().catch(() => {});
    }
  }, [reducedMotion]);

  return (
    <section className="relative min-h-screen md:h-screen overflow-hidden" style={{ background: BLACK }}>

      {/* Mobile / small tablet (< md): full-bleed video background, no diagonal split — the
          original design had no mobile treatment at all; this is new. */}
      <div className="absolute inset-0 md:hidden" style={{ zIndex: 5 }}>
        {reducedMotion ? (
          <img src={heroPoster} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <video
            ref={mobileVideoRef}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            poster={heroPoster}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.68)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, rgba(0,0,0,0.55) 100%)" }} />
      </div>

      {/* Desktop (md+): original diagonal split-panel video treatment, restored */}
      <div
        className="hidden md:block absolute inset-0"
        style={{ zIndex: 5, clipPath: "polygon(62% 0%, 100% 0%, 100% 100%, 40% 100%)" }}
      >
        {reducedMotion ? (
          <img src={heroPoster} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <video
            ref={desktopVideoRef}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            poster={heroPoster}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.60)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 30%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 65%, rgba(0,0,0,0.6) 100%)" }} />
      </div>

      {/* Gold top-edge line — desktop only, follows the diagonal split */}
      <div
        className="hidden md:block absolute top-0"
        style={{
          left: "62%", right: 0, height: "2px",
          background: `linear-gradient(to right, ${GOLD}, ${GOLD_BRIGHT} 35%, ${GOLD} 70%, transparent 100%)`,
          filter: `drop-shadow(0 0 5px ${GOLD}bb)`,
          zIndex: 25,
        }}
      />

      {/* Diagonal gold SVG divider — desktop only */}
      <svg
        className="hidden md:block absolute inset-0 w-full h-full"
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

      {/* Text panel — full width + padded on mobile, 58% fixed panel on desktop */}
      <div
        className="relative md:absolute top-0 left-0 md:bottom-0 flex flex-col justify-center px-6 py-24 md:py-0 md:px-0 w-full md:w-[58%]"
        style={{ zIndex: 30, minHeight: "100vh", paddingLeft: undefined }}
      >
        <div className="md:pl-[clamp(2rem,6vw,5rem)]">
          <p
            className="flex items-center gap-3 mb-6"
            style={{ color: GOLD, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}
          >
            NOVA SYSTEMS
            <span className="inline-block h-px w-12" style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }} />
          </p>

          <h1
            className="font-black text-white leading-[0.95]"
            style={{ fontSize: "clamp(2.3rem, 5.2vw, 5.2rem)", letterSpacing: "-0.02em", maxWidth: 640 }}
          >
            Your Business Is Losing{" "}
            <span style={{
              background: GOLD_TEXT_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Opportunities You Can't See.</span>
          </h1>

          <p className="text-white/55 mt-6 leading-relaxed" style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)", maxWidth: 460 }}>
            Nova investigates your business to find where customers, revenue, opportunities, trust, or time may be slipping away — then helps you fix what actually matters.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-10">
            <Link
              to="/welcome"
              className="inline-flex items-center gap-3 font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
              style={{
                background: GOLD_GRADIENT,
                color: "#0a0800",
                width: "fit-content",
                fontSize: 12,
                padding: "18px 32px",
              }}
            >
              START YOUR BUSINESS DIAGNOSTIC <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              to="/#process"
              className="inline-flex items-center gap-2 font-bold uppercase tracking-widest transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, padding: "18px 8px" }}
            >
              See How Nova Works <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

    </section>
  );
}
