import React from "react";
import {
  Globe, Share2, PhoneCall, Database, TrendingUp, Layers, Camera, Wind,
  Car, Landmark, Shirt, CreditCard, Star, Mail, CalendarClock, Wallet,
  Search, FileSignature,
} from "lucide-react";

const GOLD = "#D4A030";

const SERVICES = [
  { icon: Globe,         label: "Websites & SEO" },
  { icon: Share2,        label: "Social Media Management" },
  { icon: PhoneCall,     label: "AI Phone Systems" },
  { icon: Database,      label: "CRM & Lead Tracking" },
  { icon: TrendingUp,    label: "Revenue Intelligence" },
  { icon: Layers,        label: "Brand Organization" },
  { icon: Camera,        label: "Content Creation (Photo & Video)" },
  { icon: Wind,          label: "Drone Footage" },
  { icon: Car,           label: "Vehicle Wrap Coordination" },
  { icon: Landmark,      label: "Billboard & Signage Coordination" },
  { icon: Shirt,         label: "Custom Apparel & Uniforms" },
  { icon: CreditCard,    label: "Business Cards & Print Materials" },
  { icon: Star,          label: "Reputation Management & Reviews" },
  { icon: Mail,          label: "Email & SMS Marketing" },
  { icon: CalendarClock, label: "Booking & Scheduling Systems" },
  { icon: Wallet,        label: "Online Payment Integration" },
  { icon: Search,        label: "Google Business Management" },
  { icon: FileSignature, label: "Digital Contracts & Invoicing" },
];

export default function ServicesGridSection() {
  return (
    <section className="py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>EVERYTHING YOUR BUSINESS NEEDS</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
            Whatever your business needs — we build it, manage it, and grow it.
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Powered by artificial intelligence.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {SERVICES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl transition-all duration-200"
              style={{ padding: "18px 20px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}40`; e.currentTarget.style.background = `${GOLD}06`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}12`, border: `1px solid ${GOLD}30` }}>
                <Icon style={{ width: 15, height: 15, color: GOLD }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
