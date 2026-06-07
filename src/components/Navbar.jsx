import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const GOLD = "#D4A030";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Solutions", path: "/solutions" },
    { label: "Resources", path: "/resources" },
    { label: "Company", path: "/company" },
    { label: "Pricing", path: "/pricing" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/8">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3"
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
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
              className="text-sm transition-colors"
              style={{ color: isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)" }}
              onMouseEnter={(e) => e.target.style.color = "white"}
              onMouseLeave={(e) => e.target.style.color = isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)"}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="text-xs font-semibold tracking-wider uppercase transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => e.target.style.color = "white"}
            onMouseLeave={(e) => e.target.style.color = "rgba(255,255,255,0.45)"}
          >
            LOG IN
          </Link>
          <a
            href="mailto:hello@nova-systems.app?subject=Nova%20Systems%20Demo%20Request"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-5 py-2 text-xs font-semibold tracking-wider uppercase transition-all hover:opacity-85"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
            onMouseEnter={(e) => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = "#0a0800"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = GOLD; }}
          >
            BOOK A DEMO
          </a>
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
              className="block text-sm py-2"
              style={{ color: isActive(link.path) ? GOLD : "rgba(255,255,255,0.55)" }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm text-center"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            LOG IN
          </Link>
          <a
            href="mailto:hello@nova-systems.app?subject=Nova%20Systems%20Demo%20Request"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileOpen(false)}
            className="block text-center px-5 py-3 text-xs font-semibold tracking-wider uppercase mt-1"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
          >
            BOOK A DEMO
          </a>
        </div>
      )}
    </nav>
  );
}