import React from "react";
import { Quote } from "lucide-react";

const GOLD = "#D4A030";

const TESTIMONIALS = [
  {
    quote: "Before working with Isaac and Nova Systems, our digital setup was pretty disjointed and a headache to manage. Isaac stepped in as our all-in-one partner and built out our entire framework under one roof. It's been live for a month now, everything runs incredibly fast, and having one single point of contact has completely changed how we handle our backend. If you're looking to scale your business infrastructure cleanly, I highly recommend partnering with Nova Systems.",
    name: "John",
    role: "Mars Hill",
  },
  {
    quote: "Nova Systems brings fresh ideas and a genuine desire to help small businesses grow. The planning process has been organized, professional, and focused on finding practical ways to improve our business.",
    name: "Early Partner",
    role: null,
  },
  {
    quote: "Isaac made the process simple and professional. He listened to what we wanted, created clean business cards that matched our brand, and communicated with us every step of the way. We're excited to continue working with Nova Systems as we grow.",
    name: "Flow Barbershop",
    role: null,
  },
  {
    quote: "Working with Isaac and Nova Systems has been an amazing experience so far. Even before we've officially started the full project, he's taken the time to understand my business, create a clear vision, and show me what's possible. His ideas for modernizing my store, improving my online presence, and helping me attract more customers have given me a lot of confidence. I'm excited to move forward and see everything come to life.",
    name: "Owner",
    role: "Fuente de Nutrición Protein Bar",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 px-6 bg-black border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHAT OUR CUSTOMERS SAY</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
            Real Partners. Real Testimonials.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <div
              key={name + (role || "")}
              className="rounded-2xl p-8 transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Quote style={{ width: 22, height: 22, color: GOLD, marginBottom: 16 }} />
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.65)" }}>
                {quote}
              </p>
              <p className="text-sm font-bold" style={{ color: "#fff" }}>
                {name}
                {role && <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}> — {role}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
