import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Solutions", path: "/solutions" },
    { label: "Resources", path: "#" },
    { label: "Company", path: "/company" },
    { label: "Pricing", path: "/pricing" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-primary font-bold text-sm tracking-[0.2em] uppercase">
          NOVA SYSTEMS
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              className={`text-sm transition-colors ${
                isActive(link.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          to="/pricing"
          className="hidden md:inline-flex items-center px-5 py-2 border border-primary text-primary text-xs font-semibold tracking-wider uppercase hover:bg-primary hover:text-primary-foreground transition-all"
        >
          BOOK A DEMO
        </Link>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-2 ${
                isActive(link.path) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/pricing"
            onClick={() => setMobileOpen(false)}
            className="block text-center px-5 py-2 border border-primary text-primary text-xs font-semibold tracking-wider uppercase mt-3"
          >
            BOOK A DEMO
          </Link>
        </div>
      )}
    </nav>
  );
}