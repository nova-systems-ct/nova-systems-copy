import React, { useState } from "react";
import { Check, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const plans = [
  {
    name: "STARTER",
    price: { monthly: 497, annual: 398 },
    desc: "Perfect for local businesses ready to stop losing leads.",
    features: [
      "Nova Pulse revenue monitoring",
      "Up to 500 tracked leads/mo",
      "Missed call alerts",
      "Basic lead capture automation",
      "Monthly performance report",
      "Email support",
    ],
    popular: false,
    cta: "GET STARTED",
  },
  {
    name: "GROWTH",
    price: { monthly: 997, annual: 798 },
    desc: "For growing operations that need full-stack infrastructure.",
    features: [
      "Everything in Starter",
      "Unlimited lead tracking",
      "AI call handling & SMS follow-up",
      "Custom CRM integration",
      "Weekly strategy calls",
      "Priority support",
      "Dashboard access",
    ],
    popular: true,
    cta: "BOOK A DEMO",
  },
  {
    name: "ENTERPRISE",
    price: null,
    desc: "Full operational infrastructure built for your business.",
    features: [
      "Everything in Growth",
      "Custom website build",
      "Dedicated account manager",
      "Custom automation workflows",
      "Multi-location support",
      "White-label reporting",
      "24/7 priority support",
    ],
    popular: false,
    cta: "GET A QUOTE",
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[180px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${GOLD}12 0%, transparent 70%)` }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>PRICING</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">Simple. Transparent. Scalable.</h2>
          <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Choose the plan that fits your business and start recovering lost revenue today.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
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

        <div className="grid md:grid-cols-3 gap-5">
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
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-[0.2em] uppercase px-4 py-1 rounded-full"
                  style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                >
                  MOST POPULAR
                </div>
              )}
              <p className="text-[10px] tracking-[0.25em] uppercase font-bold mb-1" style={{ color: GOLD }}>{plan.name}</p>
              <p className="text-[11px] mb-5" style={{ color: "rgba(255,255,255,0.38)" }}>{plan.desc}</p>

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
              <p className="text-[10px] mb-7" style={{ color: "rgba(255,255,255,0.28)" }}>
                {plan.price ? (annual ? "Billed annually" : "Billed monthly") : "Tailored to your operation"}
              </p>

              <div className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
                style={plan.popular
                  ? { background: GOLD_GRADIENT, color: "#0a0800" }
                  : { border: `1px solid ${GOLD}50`, color: GOLD, background: "transparent" }
                }
              >
                {plan.cta} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

