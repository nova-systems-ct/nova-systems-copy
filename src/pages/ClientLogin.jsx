import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const GOLD_GRADIENT = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;
const PLATFORM_CLIENT_LOGIN_URL = "https://nova-systems.agency/client/login";

// This used to hash a password client-side and check it via /api/client?resource=auth, with a
// "coming soon" screen even on success (Nova Connect was never actually finished here). The real
// client portal is nova-wave-one's Nova Client (scrypt-hashed passwords, signed session tokens,
// e2e-tested), so this becomes a handoff to the real, working thing instead of a second
// unfinished one.
export default function ClientLogin() {
  useSEO({
    title: "Client Login — Nova Systems",
    description: "Log in to your Nova Systems client portal.",
  });

  return (
    <div className="min-h-screen flex" style={{ background: "#080600" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-14 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(212,160,48,0.08) 0%, rgba(0,0,0,0.9) 70%)" }} />
        <div className="relative flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>
        <div className="relative">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>CLIENT PORTAL</p>
          <h1 className="font-black text-white leading-[0.95] mb-6" style={{ fontSize: "clamp(2rem,3.6vw,3.2rem)", letterSpacing: "-0.02em" }}>
            Your dedicated<br />client portal.
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 300 }}>
            Track services, message the team, and manage your files — all in one place.
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Built for real clients getting real results.</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-14 py-14" style={{ background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>CLIENT LOGIN</p>
          <h2 className="text-2xl font-black text-white mb-1">Sign in to your portal</h2>
          <p className="text-xs mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
            Your client portal lives on Nova's secure platform.
          </p>

          <a
            href={PLATFORM_CLIENT_LOGIN_URL}
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            <span>CONTINUE TO SECURE LOGIN</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          <p className="text-center mt-8 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Not a client yet?{" "}
            <Link to="/welcome" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
              Schedule a strategy meeting
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
