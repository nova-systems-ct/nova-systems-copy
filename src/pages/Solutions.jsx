import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Globe2, Bot, Palette, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const sections = [
  {
    icon: Globe2,
    tag: "01 — WEB AND APPLICATION DEVELOPMENT",
    title: "Web and Application Development",
    desc: "Looking for a premium web developer in Connecticut? We build responsive fast web applications, custom admin portals, booking systems, e-commerce, and client-facing platforms.",
    features: [
      "Custom responsive websites",
      "Client-facing web applications",
      "Custom admin portals",
      "Booking and scheduling systems",
      "E-commerce platforms",
      "Fast, mobile-first performance",
    ],
    keywords: "Connecticut web developer, custom website Connecticut, web application development CT, client portal development",
  },
  {
    icon: Bot,
    tag: "02 — AI AND BUSINESS AUTOMATION",
    title: "AI and Business Automation",
    desc: "Bring your business into the future. We design automated workflows, AI phone agents to handle inbound calls, lead tracking pipelines, and CRM systems that scale your revenue automatically.",
    features: [
      "AI phone agents for inbound calls",
      "Automated workflow design",
      "Lead tracking pipelines",
      "Custom CRM systems",
      "Follow-up and booking automation",
      "Cloud infrastructure setup",
    ],
    keywords: "AI phone agent Connecticut, business automation CT, AI for small business Connecticut, automated lead tracking",
  },
  {
    icon: Palette,
    tag: "03 — BRANDING, IDENTITY, AND PHYSICAL ASSETS",
    title: "Branding, Identity, and Physical Assets",
    desc: "From full digital rebrands to premium physical assets. Custom team apparel, uniforms, business cards, storefront signage, neon signs, vehicle wrap coordination, billboard coordination, and corporate identity systems.",
    features: [
      "Full brand identity systems",
      "Custom team apparel and uniforms",
      "Business cards and print materials",
      "Storefront and neon signage",
      "Vehicle wrap coordination",
      "Billboard coordination",
    ],
    keywords: "luxury branding agency Connecticut, corporate uniforms CT, business signs Connecticut, custom apparel Connecticut",
  },
];

export default function Solutions() {
  const navigate = useNavigate();
  useSEO({
    title: "Business Technology Solutions in Connecticut — Nova Systems",
    description: "Web development, AI automation, and branding solutions for Connecticut businesses. Nova Systems builds custom websites, AI phone agents, CRM systems, and full brand identity — Waterbury to Fairfield County.",
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-28 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 30% 50%, rgba(212,160,48,0.09) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(212,160,48,0.04) 0%, transparent 55%)"
          }} />
          <div className="max-w-4xl mx-auto relative">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>
              SOLUTIONS <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
            </p>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Tailored Technical Solutions<br />for Every Business.
            </h1>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>
              Whatever you need — we have built it before. Here is how we can help you.
            </p>
          </div>
        </section>

        {/* Services */}
        {sections.map((s, i) => (
          <section
            key={s.tag}
            className="py-20 px-6 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: i % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent" }}
          >
            <div className="max-w-5xl mx-auto">
              <div className={`grid md:grid-cols-2 gap-14 items-start ${i % 2 === 1 ? "md:grid-flow-dense" : ""}`}>

                {/* Text side */}
                <div className={i % 2 === 1 ? "md:col-start-2" : ""}>
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                    >
                      <s.icon className="w-5 h-5" style={{ color: GOLD }} />
                    </div>
                    <p className="text-[9px] tracking-[0.2em] uppercase font-bold" style={{ color: GOLD }}>{s.tag}</p>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white mb-4">{s.title}</h2>
                  <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</p>

                  <Link
                    to="/welcome"
                    className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                    style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                  >
                    START THIS PROJECT <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Features side */}
                <div className={`rounded-xl p-8 ${i % 2 === 1 ? "md:col-start-1" : ""}`}
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-[9px] tracking-[0.25em] uppercase font-bold mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
                    WHAT'S INCLUDED
                  </p>
                  <div className="space-y-4">
                    {s.features.map((f) => (
                      <div key={f} className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}40` }}
                        >
                          <Check className="w-3 h-3" style={{ color: GOLD }} />
                        </div>
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="py-20 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>READY TO START</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Ready to Build Something Real?
            </h2>
            <p className="text-sm mb-10 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a free strategy meeting and we will map out exactly what your business needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/welcome"
                className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
              >
                SCHEDULE A STRATEGY MEETING <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/company"
                className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase"
                style={{ border: `1px solid ${GOLD}50`, color: GOLD }}
              >
                ABOUT NOVA SYSTEMS
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
