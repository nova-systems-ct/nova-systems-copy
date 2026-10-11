import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#C9A84C";

// No working client portal exists in this repo yet: the old flow here hashed a password
// client-side and checked it via /api/client?resource=auth, which never issued a session and had
// no destination to land on ("Nova Connect" was never finished) — that's not real auth, it's a
// dead end dressed up as a login form. The .agency hand-off this page used instead is also gone
// now that nova-systems.agency is being decommissioned (Stage 2, 2026-09-12). Rather than fake a
// working login against either of those, this is an honest "not live yet" state until a real
// client portal is built under .app (tracked as backlog — see Stage 2 report).
export default function ClientLogin() {
  useSEO({
    title: "Client Login — Nova Systems",
    description: "The Nova Systems client portal is being rebuilt.",
  });

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0A0A" }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-2/5 relative flex-col justify-between p-14 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(201, 168, 76,0.08) 0%, rgba(0,0,0,0.9) 70%)" }} />
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
          <h2 className="text-2xl font-black text-white mb-1">Client portal coming soon</h2>
          <p className="text-xs mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            The Nova client portal is being rebuilt. If you're an active client and need something
            in the meantime, reach out directly and we'll take care of it.
          </p>

          <a
            href="mailto:hello@nova-systems.app"
            className="w-full py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
            style={{ border: `1px solid ${GOLD}50`, color: GOLD, background: "transparent" }}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>EMAIL HELLO@NOVA-SYSTEMS.APP</span>
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
