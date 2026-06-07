import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Phone, Clock, AlertTriangle } from "lucide-react";
import video1 from "@/assets/Video 1.mp4";
import video2 from "@/assets/video 2.mp4";
import video3 from "@/assets/video 3.mp4";
import video4 from "@/assets/video 4.mp4";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#F0C040";
const GOLD_DARK = "#8a6200";
const VIDEOS = [video1, video2, video3, video4];

const MSG1 = "Hey! Sorry we missed your call. Lock in your booking slot here: [Link]";
const MSG2 = "Awesome, just booked for 3:00 PM!";

// ── iPhone notification popup ────────────────────────────────────────────────
function PhoneNotification({ visible }) {
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!visible) { setT1(""); setT2(""); setPhase(0); return; }

    if (phase === 0) {
      if (t1.length < MSG1.length) {
        const id = setTimeout(() => setT1(MSG1.slice(0, t1.length + 1)), 22);
        return () => clearTimeout(id);
      } else {
        const id = setTimeout(() => setPhase(1), 500);
        return () => clearTimeout(id);
      }
    }
    if (phase === 1) {
      const id = setTimeout(() => setPhase(2), 200);
      return () => clearTimeout(id);
    }
    if (phase === 2) {
      if (t2.length < MSG2.length) {
        const id = setTimeout(() => setT2(MSG2.slice(0, t2.length + 1)), 35);
        return () => clearTimeout(id);
      }
    }
  }, [visible, phase, t1, t2]);

  return (
    <div
      style={{
        position: "fixed",
        top: visible ? "1.5rem" : "-300px",
        right: "1.5rem",
        zIndex: 200,
        width: "300px",
        transition: "top 0.45s cubic-bezier(0.16,1,0.3,1)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          borderRadius: "20px",
          background: "rgba(20,20,20,0.96)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "14px 16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.75)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: GOLD, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, fontWeight: 800,
              color: "#0a0800", flexShrink: 0,
            }}
          >
            N
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>Nova Systems</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>now · AI Attendant</p>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>9:41 AM</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {t1 && (
            <div
              style={{
                background: GOLD, borderRadius: "14px 14px 4px 14px",
                padding: "8px 12px", maxWidth: "90%", alignSelf: "flex-start",
              }}
            >
              <p style={{ fontSize: 12, color: "#0a0800", margin: 0, fontWeight: 500 }}>
                <span style={{ opacity: 0.65 }}>Nova: </span>{t1}
                {phase === 0 && <span style={{ borderRight: "2px solid #0a0800", marginLeft: 1 }}>&nbsp;</span>}
              </p>
            </div>
          )}
          {t2 && (
            <div
              style={{
                background: "rgba(255,255,255,0.1)", borderRadius: "14px 14px 14px 4px",
                padding: "8px 12px", maxWidth: "90%", alignSelf: "flex-end",
              }}
            >
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", margin: 0, fontWeight: 500 }}>
                <span style={{ opacity: 0.5 }}>Customer: </span>{t2}
                {phase === 2 && t2.length < MSG2.length && <span>|</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ icon, label, sub, gold, highlight, onMouseEnter, onMouseLeave }) {
  return (
    <div
      className="flex items-center gap-4 backdrop-blur-md"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: "rgba(5,4,1,0.82)",
        border: `1px solid ${highlight ? gold + "75" : "rgba(255,255,255,0.13)"}`,
        minWidth: "260px",
        padding: "14px 20px",
        borderRadius: "3px",
        boxShadow: highlight ? `0 0 24px ${gold}35` : "none",
        pointerEvents: "auto",
        cursor: "default",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: `${gold}28`, border: `1px solid ${gold}65`, color: gold,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "white" }}>
          {label}
        </p>
        <p style={{ fontSize: 10, marginTop: 3, color: "rgba(255,255,255,0.45)" }}>{sub}</p>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function HeroSection() {
  const [notifVisible, setNotifVisible] = useState(false);
  const [vidIdx, setVidIdx] = useState(0);

  return (
    <>
      <PhoneNotification visible={notifVisible} />

      <section className="relative h-screen overflow-hidden bg-black">

        {/* RIGHT panel — looping video background, cycles video1 → video2 → video3 → video1 */}
        <div
          className="absolute inset-0"
          style={{ zIndex: 5, clipPath: "polygon(62% 0%, 100% 0%, 100% 100%, 40% 100%)" }}
        >
          <video
            key={vidIdx}
            src={VIDEOS[vidIdx]}
            autoPlay
            muted
            playsInline
            onEnded={() => setVidIdx((i) => (i + 1) % 4)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.52)" }} />
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
            className="font-black text-white leading-[0.88]"
            style={{ fontSize: "clamp(4rem, 7.5vw, 8rem)", letterSpacing: "-0.02em" }}
          >
            Stop losing<br />revenue
          </h1>

          <p className="text-white/55 mt-6 leading-relaxed" style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)", maxWidth: "420px" }}>
            Every missed call is a customer walking to your competitor. Nova Systems deploys premium web infrastructure, AI-driven lead capture, and presence kiosks to scale your operations.
          </p>

          <Link
            to="/solutions"
            className="inline-flex items-center gap-3 mt-10 font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
            style={{
              background: `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 40%, ${GOLD_BRIGHT} 60%, ${GOLD} 80%, ${GOLD_DARK} 100%)`,
              color: "#0a0800",
              width: "fit-content",
              fontSize: 12,
              padding: "18px 32px",
            }}
          >
            Deploy Nova Pulse <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ALERT CARDS — hover triggers iPhone notification */}
        <div className="absolute inset-0" style={{ zIndex: 35, pointerEvents: "none" }}>
          <div className="hidden md:block absolute" style={{ top: "28%", left: "63%" }}>
            <AlertCard
              icon={<Phone className="w-4 h-4" />}
              label="MISSED CALL"
              sub="Potential Lead Lost"
              gold={GOLD}
              onMouseEnter={() => setNotifVisible(true)}
              onMouseLeave={() => setNotifVisible(false)}
            />
          </div>
          <div className="hidden md:block absolute" style={{ top: "45%", left: "54%" }}>
            <AlertCard
              icon={<Clock className="w-4 h-4" />}
              label="NO RESPONSE"
              sub="Opportunity Lost"
              gold={GOLD}
              onMouseEnter={() => setNotifVisible(true)}
              onMouseLeave={() => setNotifVisible(false)}
            />
          </div>
          <div className="hidden md:block absolute" style={{ top: "62%", left: "62%" }}>
            <AlertCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="SLOW FOLLOW-UP"
              sub="Revenue Leak"
              gold={GOLD}
              highlight
              onMouseEnter={() => setNotifVisible(true)}
              onMouseLeave={() => setNotifVisible(false)}
            />
          </div>
        </div>

      </section>
    </>
  );
}
