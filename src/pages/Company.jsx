import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { ChevronRight, MapPin, Target, Eye, Users } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const values = [
  {
    icon: Eye,
    title: "Total Visibility",
    desc: "We believe no business owner should be blindsided by revenue loss. Every opportunity deserves to be seen and captured.",
  },
  {
    icon: Target,
    title: "Execution Over Theory",
    desc: "We don't sell software and walk away. We implement, optimize, and stay accountable to your results.",
  },
  {
    icon: Users,
    title: "Local Business First",
    desc: "We're built for local service businesses â€” HVAC, legal, healthcare, home services, auto â€” not enterprise SaaS companies.",
  },
];

export default function Company() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-28 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 30% 55%, rgba(212,160,48,0.09) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(212,160,48,0.04) 0%, transparent 55%)"
          }} />
          <div className="max-w-4xl mx-auto relative">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>
              WHO WE ARE <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.9] tracking-tight mb-6">
              Operational<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>infrastructure</span><br />
              for real businesses.
            </h1>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>
              Nova Systems is a Connecticut-based company that builds revenue infrastructure for local businesses â€” not Fortune 500s. We find your revenue leaks, fix your systems, and make sure every lead that finds you becomes a customer.
            </p>
            <div className="flex items-center gap-2 mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: GOLD }} />
              <span className="text-xs tracking-wider">Connecticut, USA</span>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>FOUNDED BY</p>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-5">Isaac Nova</h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Isaac Nova founded Nova Systems after watching local businesses he cared about bleed revenue from problems they didn't even know they had. A missed call here. A follow-up dropped there. A website that loaded too slow and cost them a booking.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  He built Nova Systems to solve exactly that â€” an operational infrastructure company that gives local businesses the same lead capture, automation, and revenue intelligence tools that enterprise companies use, but built and priced for the real world.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Based in Connecticut. Obsessed with results. Every system we build is backed by a commitment to your revenue growth.
                </p>
              </div>

              <div
                className="rounded-2xl p-10 text-center"
                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}20` }}
              >
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                >
                  IN
                </div>
                <p className="text-lg font-black text-white mb-1">Isaac Nova</p>
                <p className="text-xs tracking-widest uppercase mb-6" style={{ color: GOLD }}>Founder & CEO</p>
                <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div className="space-y-3 text-left">
                  {[
                    "Connecticut-based",
                    "Revenue systems specialist",
                    "Local business advocate",
                    "Obsessed with operational efficiency",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>OUR MISSION</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
              Eliminate revenue leaks<br />for every local business.
            </h2>
            <p className="text-base leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Local businesses are the backbone of every community. They deserve the same competitive infrastructure as billion-dollar companies. We're here to level the playing field â€” one recovered lead at a time.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5 text-center" style={{ color: GOLD }}>OUR VALUES</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center">What drives us.</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-xl p-7"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                  >
                    <v.icon className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{v.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Where we work */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>WHO WE SERVE</p>
                <h2 className="text-3xl font-black text-white mb-5">Built for local service businesses.</h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                  We specialize in local businesses where every lead matters â€” because a missed call isn't just an inconvenience, it's hundreds or thousands of dollars walking to your competitor.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["HVAC & Home Services", "Legal & Law Firms", "Healthcare & Med Spas", "Auto Dealers & Shops", "Real Estate", "Contractors & Builders"].map((industry) => (
                    <div key={industry} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{industry}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Average Revenue Recovered", value: "35%", sub: "in the first 90 days" },
                  { label: "Calls Answered", value: "100%", sub: "with AI call handling" },
                  { label: "Hours Saved Weekly", value: "15+", sub: "per team through automation" },
                  { label: "Lead Conversion Lift", value: "2â€“4x", sub: "from web infrastructure upgrades" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between rounded-xl px-6 py-4"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</span>
                    <div className="text-right">
                      <p className="text-lg font-black" style={{ color: GOLD }}>{stat.value}</p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-black text-white mb-4">
              Ready to plug the leaks?
            </h2>
            <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a free 30-minute call with Isaac and see exactly where your business is losing revenue.
            </p>
            <a
              href="mailto:hello@nova-systems.app?subject=Nova%20Systems%20Demo%20Request"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
            >
              BOOK A FREE DEMO <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

