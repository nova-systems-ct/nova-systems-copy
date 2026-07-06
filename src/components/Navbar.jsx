import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Solutions", path: "/solutions" },
    { label: "Nova AI", path: "/ai", badge: "AI" },
    { label: "Wave One", path: "/waves", badge: "NEW", highlight: true },
    { label: "Insights", path: "/insights" },
    { label: "Portfolio", path: "/portfolio" },
    { label: "Careers", path: "/careers" },
    { label: "Company", path: "/company" },
    { label: "Pricing", path: "/pricing" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/8">
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

        <div className="hidden md:flex items-center">
          <Link
            to="/welcome"
            className="inline-flex items-center px-5 py-2 text-xs font-semibold tracking-wider uppercase transition-all hover:opacity-85"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = "#0a0800"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = GOLD; }}
          >
            BOOK A MEETING
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
        <div className="md:hidden bg-black border-t border-white/8 px-6 py-4 space-y-3">
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
            to="/welcome"
            onClick={() => setMobileOpen(false)}
            className="block text-center px-5 py-3 text-xs font-semibold tracking-wider uppercase mt-1"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
          >
            BOOK A MEETING
          </Link>
        </div>
      )}
    </nav>
  );
}
