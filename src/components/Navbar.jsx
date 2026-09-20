import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogIn, ArrowRight } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { NAVY, GOLD, GOLD_BRIGHT, GOLD_GRADIENT } from "@/lib/theme";

// Mapped to real, existing routes only — no dedicated "Case Studies" page exists separately from
// Portfolio, so that label points at the closest real destination rather than a new page or a "#"
// placeholder. "Services" and "Why Nova" are in-page anchors on the homepage itself (see
// ServiceGrid, id="services", and WhyNovaSection, id="why-nova") since that content lives there,
// not on a separate route. Wave One isn't repeated in the primary nav (spec's exact 7-item list
// is Home/Services/Solutions/Why Nova/Case Studies/Pricing/About) — it stays fully reachable via
// the ServiceGrid card, the dedicated WaveOneFeature section, and the footer.
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Services", path: "/#services" },
    { label: "Solutions", path: "/solutions" },
    { label: "Why Nova", path: "/#why-nova" },
    { label: "Case Studies", path: "/portfolio" },
    { label: "Pricing", path: "/pricing" },
    { label: "About", path: "/company" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-white/8" style={{ background: "rgba(4,17,43,0.92)" }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={novaLogo} alt="Nova Systems" className="h-9 w-9 object-contain flex-shrink-0" />
          <span className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>
            NOVA SYSTEMS
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className="text-sm font-semibold transition-colors flex items-center gap-1.5"
              style={{ color: link.highlight ? GOLD : (isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)"), fontWeight: link.highlight ? 700 : 400 }}
              onMouseEnter={(e) => e.currentTarget.style.color = link.highlight ? GOLD_BRIGHT : "white"}
              onMouseLeave={(e) => e.currentTarget.style.color = link.highlight ? GOLD : (isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)")}
            >
              {link.highlight && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: GOLD, opacity: 0.6 }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: GOLD }} />
                </span>
              )}
              {link.label}
              {link.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}50` }}
                >
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold tracking-wider uppercase transition-all hover:opacity-85"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = "#0a0800"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = GOLD; }}
          >
            <LogIn className="w-3.5 h-3.5" /> LOG IN
          </Link>
          <Link
            to="/request-audit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold tracking-wider uppercase transition-opacity hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            BOOK AN AUDIT <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          className="md:hidden text-white/70"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/8 px-6 py-4 space-y-3" style={{ background: NAVY }}>
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-1.5 text-sm py-2 font-semibold"
              style={{ color: link.highlight ? GOLD : (isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)") }}
            >
              {link.highlight && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: GOLD, opacity: 0.6 }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: GOLD }} />
                </span>
              )}
              {link.label}
              {link.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}50` }}
                >
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
          <Link
            to="/request-audit"
            onClick={() => setMobileOpen(false)}
            className="block text-center px-5 py-3 text-xs font-bold tracking-wider uppercase mt-1"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            BOOK AN AUDIT
          </Link>
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="block text-center px-5 py-3 text-xs font-semibold tracking-wider uppercase mt-2"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
          >
            LOG IN
          </Link>
        </div>
      )}
    </nav>
  );
}
