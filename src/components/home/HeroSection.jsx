import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroPoster from "@/assets/hero-poster.jpg";
import { NAVY, GOLD, GOLD_BRIGHT, GOLD_DARK, GOLD_GRADIENT, GOLD_TEXT_GRADIENT } from "@/lib/theme";

const VIDEOS = [heroVideo1, heroVideo2];

// Phase 1 (2026-09-20): restored from the committed video-led hero (src/components/home/
// HeroSection.jsx as of the 2026-08-03 commit), selectively recovered rather than a full repo
// revert. Two real fixes applied on top of the original, not just a restore:
//
// 1. VIDEO QUALITY — the original pointed at `video 3.mp4`/`video 4.mp4`, confirmed via ffprobe
//    to be genuine 960x540 source at ~0.6-1.1 Mbps — a real low-resolution source, not a CSS or
//    compression-only issue (upscaling 960px to a >1200px-wide hero panel is what produced the
//    blur). `Video 1.mp4`/`video 2.mp4` (already in this repo, used on the Login page) are real
//    1280x720 at 3.3-3.6 Mbps — visually confirmed crisp by extracting and viewing frames from
//    both pairs. Re-encoded copies of those (audio track stripped — always played muted, so it
//    was dead weight; CRF 26, faststart) ship here as hero-video-1/2.mp4, ~1.7MB each instead of
//    the 4-4.5MB originals, with no visible quality loss (verified by re-extracting and viewing
//    a frame from the re-encoded file).
// 2. MOBILE — the original had zero responsive handling at all: fixed absolute 58%/62% splits,
//    no breakpoints, would render as an unreadable diagonal sliver on a phone. Rebuilt with a
//    full-bleed single-layer video background below `md`, and the original diagonal split-panel
//    treatment preserved at `md` and above.
//
// Also added: a real poster image (extracted frame, shown while the video loads and as the
// entire background when reduced motion is preferred), and prefers-reduced-motion handling that
// skips autoplay entirely rather than just visually hiding a still-playing video.
export default function HeroSection() {
  const [vidIdx, setVidIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.src = VIDEOS[vidIdx];
    v.load();
    v.play().catch(() => {});
  }, [vidIdx, reducedMotion]);

  const videoLayer = reducedMotion ? (
    <img
      src={heroPoster}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
    />
  ) : (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      preload="auto"
      poster={heroPoster}
      onEnded={() => setVidIdx((i) => (i + 1) % VIDEOS.length)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );

  return (
    <section className="relative min-h-screen md:h-screen overflow-hidden" style={{ background: NAVY }}>

      {/* Mobile / small tablet (< md): full-bleed video background, no diagonal split — the
          original design had no mobile treatment at all; this is new. */}
      <div className="absolute inset-0 md:hidden" style={{ zIndex: 5 }}>
        {videoLayer}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.68)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, rgba(0,0,0,0.55) 100%)" }} />
      </div>

      {/* Desktop (md+): original diagonal split-panel video treatment, restored */}
      <div
        className="hidden md:block absolute inset-0"
        style={{ zIndex: 5, clipPath: "polygon(62% 0%, 100% 0%, 100% 100%, 40% 100%)" }}
      >
        {videoLayer}
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
