import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Activity, Wrench, Globe, Phone, Check, ArrowRight, ArrowLeft } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const services = [
  {
    icon: Activity,
    tag: "01  -  NOVA PULSE",
    title: "Revenue Monitoring & Lead Intelligence",
    headline: "See every leak before revenue walks out the door.",
    desc: "Nova Pulse tracks every call, lead, and follow-up in real time - and alerts you the moment an opportunity is at risk.",
    features: [
      "Real-time call & lead tracking",
      "Automated missed-opportunity alerts",
      "Follow-up delay detection",
      "Conversion funnel visibility",
      "Weekly revenue leak reports",
      "Dashboard with live KPIs",
    ],
    result: "Clients recover an average of 35% more revenue within 90 days.",
  },
  {
    icon: Wrench,
    tag: "02  -  CUSTOM SYSTEMS",
    title: "Business Automation & CRM Infrastructure",
    headline: "Stop running your business on spreadsheets and sticky notes.",
    desc: "Custom CRM pipelines, automated follow-up, and booking integrations - all built around how your specific business works.",
    features: [
      "Custom CRM build & configuration",
      "Automated follow-up sequences",
      "Booking & scheduling integrations",
      "Lead routing & assignment rules",
      "Internal workflow automation",
      "Team onboarding & training",
    ],
    result: "Our clients save 15+ hours per week on manual tasks after implementation.",
  },
  {
    icon: Globe,
    tag: "03  -  WEB INFRASTRUCTURE",
    title: "High-Converting Local Business Websites",
    headline: "Your website should be generating revenue, not just sitting there.",
    desc: "Fast, mobile-first sites with embedded call tracking, lead capture, and local SEO foundations - so your site generates revenue, not just traffic.",
    features: [
      "Mobile-first responsive design",
      "Embedded call tracking",
      "Lead capture & contact forms",
      "Google Business integration",
      "Local SEO foundations",
      "Speed-optimized (Core Web Vitals)",
    ],
    result: "Our websites generate 2 - 4x more leads from the same traffic.",
  },
  {
    icon: Phone,
    tag: "04  -  AI CALL HANDLING",
    title: "24/7 AI Inbound Call Response",
    headline: "Answer every call. Book every appointment. Even at 2am.",
    desc: "Our AI answers every call, qualifies the lead, and books an appointment - then hands off to your team with full context, 24/7.",
    features: [
      "24/7 AI inbound call answering",
      "Lead qualification scripting",
      "Automatic appointment booking",
      "SMS follow-up after every call",
      "Full call transcripts",
      "CRM handoff with context",
    ],
    result: "100% of calls answered. After-hours leads converted at the same rate as business hours.",
  },
];

export default function Solutions() {
  const navigate = useNavigate();
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
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.9] tracking-tight mb-6">
              Built to make<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>local businesses<br />unstoppable.</span>
            </h1>
            <p className="text-base leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>
              Four core services. One mission: stop revenue from leaking out of your business and start capturing every opportunity you're currently missing.
            </p>
          </div>
        </section>

        {/* Services */}
        {services.map((s, i) => (
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
                    <p className="text-[9px] tracking-[0.25em] uppercase font-bold" style={{ color: GOLD }}>{s.tag}</p>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white mb-3">{s.title}</h2>
                  <p className="text-base font-semibold mb-4" style={{ color: GOLD }}>"{s.headline}"</p>
                  <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</p>

                  <div
                    className="inline-flex items-start gap-3 p-4 rounded-xl mb-8"
                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}22` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: GOLD }} />
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: GOLD }}>{s.result}</p>
                  </div>

                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                    style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                  >
                    GET STARTED <ArrowRight className="w-3.5 h-3.5" />
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
              Stop leaving money on the table.
            </h2>
            <p className="text-sm mb-10 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a 30-minute call and we'll show you exactly where your revenue is leaking and how to fix it.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/book-demo"
                className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
              >
                BOOK A FREE DEMO <ChevronRight className="w-4 h-4" />
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

