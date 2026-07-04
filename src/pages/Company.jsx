import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, MapPin, Phone, Mail, Award, Zap, ShieldCheck, Instagram, Linkedin, ArrowLeft } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const values = [
  {
    icon: Award,
    title: "Excellence",
    desc: "We do not ship until it is perfect. Every system carries the Nova Systems name.",
  },
  {
    icon: Zap,
    title: "Speed",
    desc: "Your business cannot wait — we move fast, without cutting corners.",
  },
  {
    icon: ShieldCheck,
    title: "Integrity",
    desc: "We do what we say we will do. No excuses, no disappearing acts.",
  },
];

export default function Company() {
  const navigate = useNavigate();
  useSEO({
    title: "About Nova Systems — Connecticut AI and Technology Agency",
    description: "Nova Systems is a Connecticut-based technology and AI agency founded by Isaac Nova in Waterbury, CT — building elite digital infrastructure for businesses of every size.",
  });

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
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>
              WHO WE ARE <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
            </p>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Driven by Innovation.<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Engineered for Perfection.</span>
            </h1>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>
              Nova Systems is a Connecticut-based technology and AI agency building elite digital infrastructure for businesses of every size.
            </p>
            <div className="flex items-center gap-2 mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: GOLD }} />
              <span className="text-xs tracking-wider">Waterbury, Connecticut</span>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>OUR MISSION</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight">
              Fortune 500 technology.<br />Built for every business.
            </h2>
            <p className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              We believe every business deserves access to the same technology that Fortune 500 companies use. We build it, manage it, and grow it — so you can focus on running your business.
            </p>
          </div>
        </section>

        {/* Founder */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div
                className="rounded-2xl p-10 text-center order-2 md:order-1"
                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}20` }}
              >
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                >
                  IN
                </div>
                <p className="text-lg font-black text-white mb-1">Isaac Nova</p>
                <p className="text-xs tracking-widest uppercase mb-6" style={{ color: GOLD }}>Founder and Chief Executive Officer</p>
                <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div className="space-y-3 text-left">
                  {[
                    "Waterbury, Connecticut",
                    "Founded Nova Systems at 19",
                    "Building CT's first AI-focused agency",
                    "Serving Waterbury to Fairfield County",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-1 md:order-2">
                <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>FOUNDED BY</p>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-5">Isaac Nova</h2>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Isaac Nova founded Nova Systems in Waterbury, Connecticut with one goal — to give local businesses the same powerful technology infrastructure that large corporations use every day. At 19 years old he is building one of Connecticut's first AI-focused business technology agencies, serving clients from Waterbury to Fairfield County.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
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

        {/* Contact */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5 text-center" style={{ color: GOLD }}>GET IN TOUCH</p>
            <h2 className="text-3xl font-black text-white mb-12 text-center">Contact Nova Systems.</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { Icon: Phone, label: "Phone", value: "(203) 706-0504" },
                { Icon: Mail, label: "Email", value: "hello@nova-systems.app" },
                { Icon: MapPin, label: "Location", value: "Waterbury, Connecticut" },
                { Icon: Instagram, label: "Instagram", value: "@novasystems" },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}>
                    <Icon className="w-4 h-4" style={{ color: GOLD }} />
                  </div>
                  <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 mt-8">
              <a href="#" className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ border: `1px solid ${GOLD}35`, background: `${GOLD}10` }}>
                <Instagram className="w-4 h-4" style={{ color: GOLD }} />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ border: `1px solid ${GOLD}35`, background: `${GOLD}10` }}>
                <Linkedin className="w-4 h-4" style={{ color: GOLD }} />
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-black text-white mb-4">
              Ready to Build Something Real?
            </h2>
            <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a free strategy meeting with Isaac and map out exactly what your business needs.
            </p>
            <Link
              to="/welcome"
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
            >
              BOOK YOUR FREE MEETING <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
