import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { Check, ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const plans = [
  {
    name: "STARTER",
    price: "$1,000",
    period: "/month",
    tagline: "Custom website, SEO, and local presence.",
    features: [
      "Custom website",
      "SEO",
      "Google Business setup",
      "Hosting and maintenance",
      "Monthly analytics report",
    ],
    cta: "GET STARTED",
    popular: false,
  },
  {
    name: "GROWTH",
    price: "$1,500",
    period: "/month",
    tagline: "Premium infrastructure and AI automation.",
    features: [
      "Everything in Starter",
      "Social media management (when team is hired)",
      "AI phone agent",
      "Brand organization",
      "CRM setup",
      "Email and SMS marketing",
    ],
    cta: "GET STARTED",
    popular: true,
  },
  {
    name: "ENTERPRISE",
    price: "Custom",
    period: "",
    tagline: "Full operational infrastructure, built for you.",
    features: [
      "Full AI ecosystem",
      "Custom web applications",
      "Complete operational automation",
      "Dedicated account management",
      "Priority support",
      "Everything Nova Systems offers",
    ],
    cta: "BOOK A CONSULTATION",
    popular: false,
  },
];

const FAQS = [
  { q: "Do you work with all business types?", a: "Yes, restaurants, barbershops, retail, medical, legal, and more." },
  { q: "Do you serve all of Connecticut?", a: "Yes, we serve businesses statewide with priority in Fairfield County and Hartford County." },
  { q: "Is there a contract?", a: "Month to month — cancel with 30 days notice." },
  { q: "What if I need something not listed?", a: "We build custom solutions — book a meeting and we will scope it out." },
  { q: "Do you offer services in Spanish?", a: "Yes — fully bilingual English and Spanish." },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  useSEO({
    title: "Pricing — Nova Systems Connecticut",
    description: "Transparent, custom-built pricing for Connecticut businesses. Starter, Growth, and Enterprise plans from Nova Systems — Waterbury, CT's AI and technology agency.",
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 50% 70%, rgba(212,160,48,0.10) 0%, transparent 60%)"
          }} />
          <div className="max-w-4xl mx-auto relative">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
          <div className="max-w-4xl mx-auto relative text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
              PRICING <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
            </p>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05] mb-5">
              Transparent Pricing.<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Built Around Your Scale.</span>
            </h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Every plan is custom built for your business. These are starting points — not ceilings.
            </p>
          </div>
        </section>

        {/* Plans */}
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-xl p-8 flex flex-col transition-all duration-300"
                style={{
                  background: plan.popular ? "rgba(212,160,48,0.07)" : "rgba(255,255,255,0.025)",
                  border: plan.popular ? `1px solid ${GOLD}55` : "1px solid rgba(255,255,255,0.08)",
                  transform: plan.popular ? "scale(1.03)" : "scale(1)",
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-[0.2em] uppercase px-4 py-1 rounded-full whitespace-nowrap"
                    style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <p className="text-[10px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: GOLD }}>{plan.name}</p>
                <p className="text-[11px] mb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{plan.tagline}</p>

                <div className="mb-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.38)" }}>{plan.period}</span>
                </div>
                <p className="text-[10px] mb-6" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {plan.period ? "Starting at" : "Tailored to your operation"}
                </p>

                <p className="text-[9px] tracking-[0.25em] uppercase font-bold mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>Includes</p>
                <div className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/welcome"
                  className="w-full py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
                  style={plan.popular
                    ? { background: GOLD_GRADIENT, color: "#0a0800" }
                    : { border: `1px solid ${GOLD}50`, color: GOLD, background: "transparent" }
                  }
                >
                  {plan.cta} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4 text-center" style={{ color: GOLD }}>QUESTIONS</p>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-10 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <div key={f.q} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <span className="text-sm font-semibold text-white">{f.q}</span>
                    <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: GOLD, transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5">
                      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{f.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Custom CTA */}
        <section className="py-16 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-8"
              style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${GOLD}20` }}
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Need a custom solution?</h2>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Let's build a plan that fits your business exactly.
                </p>
              </div>
              <Link
                to="/welcome"
                className="px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85 flex-shrink-0"
                style={{ background: GOLD_GRADIENT, color: "#0a0800", display: "inline-block" }}
              >
                BOOK A CONSULTATION
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
