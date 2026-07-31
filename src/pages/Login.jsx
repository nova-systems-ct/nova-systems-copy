import React, { useRef, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, Globe, Palette, Workflow } from "lucide-react";
import video1 from "@/assets/Video 1.mp4";
import video2 from "@/assets/video 2.mp4";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
const VIDEOS = [video1, video2];
const PLATFORM_URL = "https://nova-systems.agency";

const features = [
  { icon: Bot, label: "AI ECOSYSTEMS", sub: "Automated workflows and phone agents, live." },
  { icon: Globe, label: "WEB INFRASTRUCTURE", sub: "Sites, portals, and platforms built to convert." },
  { icon: Palette, label: "BRAND AND IDENTITY", sub: "Every asset, from digital to physical." },
  { icon: Workflow, label: "FULL OPERATIONS", sub: "CRM, contracts, and cloud infrastructure." },
];

// This page performs NO authentication of its own — nova-systems.app is the public marketing
// entrance only. It exists to keep one consistent brand moment before handing off to the real,
// canonical login at nova-systems.agency, which is the only place a session is ever created.
// Only a relative path is ever accepted for returnTo (an open-redirect guard); anything else
// falls back to the platform's default landing.
function safeReturnTo(value) {
  if (typeof value !== "string" || !value) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
  if (/[\x00-\x1f\s]/.test(decoded)) return null;
  const rest = decoded.slice(1);
  const breakIndex = rest.search(/[/?#]/);
  const firstSegment = breakIndex === -1 ? rest : rest.slice(0, breakIndex);
  if (firstSegment.includes(":")) return null;
  return decoded;
}

export default function Login() {
  useSEO({ title: "Client Login — Nova Systems", description: "Secure access to your Nova Systems workspace." });
  const [searchParams] = useSearchParams();
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

  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const platformLoginUrl = `${PLATFORM_URL}/login?source=app${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-between p-14 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          onEnded={() => setVidIdx((i) => (i + 1) % VIDEOS.length)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        />
        <div className="absolute inset-0" style={{ zIndex: 1, background: "rgba(4,3,0,0.80)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 2,
          background: "radial-gradient(ellipse at 30% 40%, rgba(212,160,48,0.10) 0%, transparent 60%)",
        }} />

        <div className="relative flex items-center gap-3" style={{ zIndex: 10 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="relative" style={{ zIndex: 10 }}>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>OPERATIONAL COMMAND</p>
          <h1 className="font-black text-white leading-[0.9] mb-7" style={{ fontSize: "clamp(2.8rem,5vw,4.5rem)", letterSpacing: "-0.02em" }}>
            ELITE<br />
            <span style={{ background: `linear-gradient(90deg,${GOLD} 0%,${GOLD_BRIGHT} 50%,${GOLD} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              INFRASTRUCTURE.
            </span>
          </h1>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 320 }}>
            Whatever your business needs, we build it. Manage it all from here.
          </p>
          <div className="space-y-5">
            {features.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                  <Icon className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-white">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2" style={{ zIndex: 10 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Secure. Reliable. Built for scale.</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        className="flex-1 flex flex-col justify-center px-8 md:px-14 py-14 relative"
        style={{ background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[9px] tracking-[0.35em] uppercase whitespace-nowrap" style={{ color: GOLD }}>WELCOME BACK</p>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right,${GOLD}60,transparent)` }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">Sign in to Nova Systems</h2>
          <p className="text-xs mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
            Your workspace, dashboards, and client tools live on Nova's secure platform.
          </p>

          <a
            href={platformLoginUrl}
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            <span>CONTINUE TO SECURE LOGIN</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          <p className="text-center mt-6 text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.25)" }}>
            Protected by encrypted authentication on nova-systems.agency.
          </p>

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Are you a client?{" "}
            <Link to="/client-login" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Client Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
