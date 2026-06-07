import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { Check, Minus, ArrowRight, ArrowLeft } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const plans = [
  {
    name: "STARTER",
    price: { monthly: 497, annual: 398 },
    tagline: "Perfect for local businesses ready to stop losing leads.",
    desc: "Get Nova Pulse monitoring, missed call alerts, and basic automation to start capturing more of what's already coming to you.",
    features: [
      "Nova Pulse revenue monitoring",
      "Up to 500 tracked leads/month",
      "Missed call & follow-up alerts",
      "Basic lead capture automation",
      "Monthly performance report",
      "Email support",
    ],
    cta: "GET STARTED",
    popular: false,
  },
  {
    name: "GROWTH",
    price: { monthly: 997, annual: 798 },
    tagline: "For growing operations that need full-stack infrastructure.",
    desc: "Everything in Starter plus AI call handling, custom CRM integration, and weekly strategy calls to accelerate your revenue recovery.",
    features: [
      "Everything in Starter",
      "Unlimited lead tracking",
      "AI call handling & SMS follow-up",
      "Custom CRM build & integration",
      "Weekly strategy calls",
      "Priority support",
      "Nova Pulse dashboard access",
      "Conversion funnel tracking",
    ],
    cta: "BOOK A DEMO",
    popular: true,
  },
  {
    name: "ENTERPRISE",
    price: null,
    tagline: "Full operational infrastructure built for your business.",
    desc: "Custom website, full automation suite, dedicated account manager, and complete revenue operations infrastructure.",
    features: [
      "Everything in Growth",
      "Custom website build",
      "Dedicated account manager",
      "Custom automation workflows",
      "Multi-location support",
      "White-label reporting",
      "24/7 priority support",
      "Quarterly business reviews",
    ],
    cta: "GET A QUOTE",
    popular: false,
  },
];

const comparisonRows = [
  { feature: "Nova Pulse monitoring", starter: true, growth: true, enterprise: true },
  { feature: "Missed call alerts", starter: true, growth: true, enterprise: true },
  { feature: "AI call handling", starter: false, growth: true, enterprise: true },
  { feature: "Custom CRM integration", starter: false, growth: true, enterprise: true },
  { feature: "Custom website build", starter: false, growth: false, enterprise: true },
  { feature: "Weekly strategy calls", starter: false, growth: true, enterprise: true },
  { feature: "Dedicated account manager", starter: false, growth: false, enterprise: true },
  { feature: "Multi-location support", starter: false, growth: false, enterprise: true },
  { feature: "Tracked leads/month", starter: "500", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Support", starter: "Email", growth: "Priority", enterprise: "24/7" },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  const navigate = useNavigate();

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
            <h1 className="text-5xl md:text-6xl font-black text-white leading-[0.95] mb-5">
              Simple pricing.<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Powerful impact.</span>
            </h1>
            <p className="text-sm max-w-md mx-auto mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
              Choose the plan that fits your business needs and start recovering lost revenue today.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs" style={{ color: !annual ? "white" : "rgba(255,255,255,0.4)" }}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                className="relative w-11 h-6 rounded-full transition-colors"
                style={{ background: annual ? GOLD : "rgba(255,255,255,0.15)" }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-black transition-transform"
                  style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
              <span className="text-xs" style={{ color: annual ? "white" : "rgba(255,255,255,0.4)" }}>Annual</span>
              {annual && (
                <span
                  className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
                  style={{ background: `${GOLD}25`, color: GOLD, border: `1px solid ${GOLD}40` }}
                >
                  SAVE 20%
                </span>
              )}
            </div>
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
                  {plan.price ? (
                    <>
                      <span className="text-5xl font-black text-white">
                        ${annual ? plan.price.annual : plan.price.monthly}
                      </span>
                      <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.38)" }}>/mo</span>
                    </>
                  ) : (
                    <span className="text-4xl font-black text-white">Custom</span>
                  )}
                </div>
                <p className="text-[10px] mb-6" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {plan.price ? (annual ? "Billed annually" : "Billed monthly") : "Contact us for pricing"}
                </p>

                <p className="text-xs leading-relaxed mb-6 pb-6 border-b" style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
                  {plan.desc}
                </p>

                <div className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={plan.cta === "GET STARTED" ? "/register" : "/book-demo"}
                  className="w-full py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
                  style={plan.popular
                    ? { background: GOLD_GRADIENT, color: "#0a0800" }
                    : { border: `1px solid ${GOLD}50`, color: GOLD, background: "transparent" }
                  }
                >
                  {plan.cta} <ArrowRight className="w-3 h-3" />
                </Link>
                <p className="text-[10px] text-center mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {plan.price ? "No contracts. Cancel anytime." : "Custom terms available."}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-black text-white mb-10 text-center">Compare plans</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <th className="text-left py-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}></th>
                    {["STARTER", "GROWTH", "ENTERPRISE"].map((p) => (
                      <th key={p} className="text-center py-3 text-[10px] font-bold tracking-[0.2em]" style={{ color: GOLD }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <td className="py-3.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{row.feature}</td>
                      {["starter", "growth", "enterprise"].map((plan) => (
                        <td key={plan} className="text-center py-3.5">
                          {typeof row[plan] === "boolean" ? (
                            row[plan]
                              ? <Check className="w-4 h-4 mx-auto" style={{ color: GOLD }} />
                              : <Minus className="w-4 h-4 mx-auto" style={{ color: "rgba(255,255,255,0.15)" }} />
                          ) : (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{row[plan]}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <div className="flex items-center gap-4 flex-shrink-0">
                <Link
                  to="/book-demo"
                  className="px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800", display: "inline-block" }}
                >
                  TALK TO ISAAC
                </Link>
                <Link
                  to="/book-demo"
                  className="px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase"
                  style={{ border: `1px solid ${GOLD}50`, color: GOLD, display: "inline-block" }}
                >
                  BOOK A DEMO
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

