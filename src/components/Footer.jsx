import React from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Linkedin, Instagram } from "lucide-react";

const GOLD = "#D4A030";

export default function Footer() {
  return (
    <footer className="bg-black border-t px-6 pt-16 pb-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="max-w-7xl mx-auto">

        {/* Top row */}
        <div className="grid md:grid-cols-4 gap-10 mb-14">

          {/* Brand */}
          <div className="md:col-span-1">
            <p className="text-sm font-black tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
              NOVA SYSTEMS
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              Waterbury, Connecticut. Elite digital infrastructure — whatever your business needs, we build it.
            </p>
            {/* Social icons */}
            <div className="flex gap-3 mt-5">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/nova_systems27/" },
                { Icon: Linkedin, href: "https://www.linkedin.com/company/nova-systems07/" },
              ].map(({ Icon, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{ border: `1px solid ${GOLD}35`, background: `${GOLD}10` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                </a>
              ))}
            </div>
          </div>

          {/* Nav Links */}
          <div>
            <p className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-4" style={{ color: GOLD }}>PLATFORM</p>
            <div className="space-y-2.5">
              {[["Solutions", "/solutions"], ["Insights", "/insights"], ["Portfolio", "/portfolio"], ["Careers", "/careers"], ["Company", "/company"], ["Pricing", "/pricing"]].map(([label, path]) => (
                <Link key={label} to={path} className="block text-xs transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-4" style={{ color: GOLD }}>GET STARTED</p>
            <div className="space-y-2.5">
              <Link to="/welcome" className="block text-xs transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>Book a Meeting</Link>
              <Link to="/client-login" className="block text-xs transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>Client Login</Link>
              <Link to="/login" className="block text-xs transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>Admin Login</Link>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <p className="text-[9px] tracking-[0.25em] uppercase font-semibold mb-4" style={{ color: GOLD }}>CONTACT</p>
            <div className="space-y-3">
              {[
                { Icon: Mail, text: "hello@nova-systems.app" },
                { Icon: Phone, text: "(203) 706-0504" },
                { Icon: MapPin, text: "Waterbury, Connecticut" },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            © 2026 Nova Systems. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
            <p className="text-[10px] tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
              WATERBURY, CONNECTICUT
            </p>
            <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
          </div>
        </div>
      </div>
    </footer>
  );
}
