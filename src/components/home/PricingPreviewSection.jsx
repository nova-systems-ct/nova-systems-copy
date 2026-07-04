import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const PLANS = [
  { name: "STARTER", price: "$1,000", period: "/mo", tagline: "Starting at", desc: "Custom website, branding, local SEO", popular: false },
  { name: "GROWTH", price: "$1,500", period: "/mo", tagline: "Starting at", desc: "Premium digital infrastructure, AI automation, advanced systems", popular: true },
  { name: "ENTERPRISE", price: "Custom", period: "", tagline: "", desc: "Bespoke AI ecosystems, full operational software, end-to-end execution", popular: false },
];

export default function PricingPreviewSection() {
  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[180px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${GOLD}12 0%, transparent 70%)` }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-14">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>PRICING</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">Transparent Pricing. Built Around Your Scale.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
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
              <p className="text-[10px] tracking-[0.25em] uppercase font-bold mb-5" style={{ color: GOLD }}>{plan.name}</p>

              <div className="mb-2">
                {plan.tagline && <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{plan.tagline}</p>}
                <span className="text-4xl font-black text-white">{plan.price}</span>
                <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.38)" }}>{plan.period}</span>
              </div>

              <p className="text-sm leading-relaxed mb-8 mt-3 flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{plan.desc}</p>

              <Link
                to="/welcome"
                className="w-full py-3.5 text-[10px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85 flex items-center justify-center gap-2"
                style={plan.popular
                  ? { background: GOLD_GRADIENT, color: "#0a0800" }
                  : { border: `1px solid ${GOLD}50`, color: GOLD, background: "transparent" }
                }
              >
                GET STARTED <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-10" style={{ color: "rgba(255,255,255,0.3)" }}>
          Every plan is custom built for your business. No two clients are the same.
        </p>
      </div>
    </section>
  );
}
