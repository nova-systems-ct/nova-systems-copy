import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Check, Minus, ChevronRight } from "lucide-react";

const PRICING_BG = "https://media.base44.com/images/public/user_6955f8132de0845ff4cba0e3/4194fce08_174A8915-BB96-4710-8D0C-E6B1337C78C2.png";

const plans = [
  {
    name: "STARTER",
    desc: "Perfect for small teams getting started.",
    monthly: 49,
    annual: 39,
    features: ["1 User", "Up to 5,000 tracked leads", "Real-time monitoring", "Instant alerts", "Email support"],
    popular: false,
  },
  {
    name: "GROWTH",
    desc: "For growing businesses focused on recovery.",
    monthly: 129,
    annual: 103,
    features: ["5 Users", "Up to 25,000 tracked leads", "Real-time monitoring", "Instant alerts", "Performance insights", "Priority support"],
    popular: true,
  },
  {
    name: "ENTERPRISE",
    desc: "For large teams with advanced needs.",
    monthly: 299,
    annual: 239,
    features: ["Unlimited Users", "Unlimited tracked leads", "Real-time monitoring", "Instant alerts", "Performance insights", "Recover lost revenue", "Dedicated account manager", "24/7 priority support"],
    popular: false,
  },
];

const comparisonRows = [
  { feature: "Real-time monitoring", starter: true, growth: true, enterprise: true },
  { feature: "Instant alerts", starter: true, growth: true, enterprise: true },
  { feature: "Performance insights", starter: false, growth: true, enterprise: true },
  { feature: "Recover lost revenue", starter: false, growth: false, enterprise: true },
  { feature: "Tracked leads", starter: "Up to 5,000", growth: "Up to 25,000", enterprise: "Unlimited" },
  { feature: "Users", starter: "1", growth: "5", enterprise: "Unlimited" },
  { feature: "Priority support", starter: false, growth: true, enterprise: true },
  { feature: "Dedicated account manager", starter: false, growth: false, enterprise: true },
  { feature: "24/7 support", starter: false, growth: false, enterprise: true },
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative min-h-[50vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img src={PRICING_BG} alt="Background" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
          </div>
          <div className="relative max-w-7xl mx-auto px-6 py-32">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">
              PRICING <span className="inline-block w-8 h-px bg-primary ml-2 align-middle" />
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-foreground">
              <em className="not-italic">Simple pricing.</em><br />
              <em className="not-italic">Powerful impact.</em>
            </h1>
            <p className="text-muted-foreground mt-6 text-sm max-w-md leading-relaxed">
              Choose the plan that fits your business needs and start recovering lost revenue today.
            </p>
          </div>
        </section>

        {/* Toggle */}
        <section className="px-6 -mt-8 relative z-10">
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-muted"}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                  isAnnual ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
            {isAnnual && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-semibold">
                Save 20%
              </span>
            )}
          </div>
        </section>

        {/* Plans */}
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative border rounded-xl p-8 flex flex-col ${
                  plan.popular
                    ? "border-primary bg-card scale-105 shadow-xl shadow-primary/5"
                    : "border-border bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase px-4 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <p className="text-xs tracking-[0.2em] uppercase text-primary font-semibold">{plan.name}</p>
                <p className="text-xs text-muted-foreground mt-2">{plan.desc}</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-foreground">
                    ${isAnnual ? plan.annual : plan.monthly}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAnnual ? "Billed annually" : "Billed monthly"}
                </p>
                <div className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                <button className="mt-8 w-full py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all">
                  START FREE TRIAL
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">No credit card required</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-foreground mb-8">Compare plans</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-muted-foreground font-normal"></th>
                    <th className="text-center py-3 text-primary font-semibold tracking-wider uppercase text-xs">STARTER</th>
                    <th className="text-center py-3 text-primary font-semibold tracking-wider uppercase text-xs">GROWTH</th>
                    <th className="text-center py-3 text-primary font-semibold tracking-wider uppercase text-xs">ENTERPRISE</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="border-b border-border/50">
                      <td className="py-3 text-xs text-muted-foreground">{row.feature}</td>
                      {["starter", "growth", "enterprise"].map((plan) => (
                        <td key={plan} className="text-center py-3">
                          {typeof row[plan] === "boolean" ? (
                            row[plan] ? (
                              <Check className="w-4 h-4 text-primary mx-auto" />
                            ) : (
                              <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">{row[plan]}</span>
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

        {/* Custom Solution CTA */}
        <section className="py-16 px-6 bg-card border-y border-border/50">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Need a custom solution?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Let's build a plan that fits your business.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-6 py-3 border border-primary text-primary text-xs font-semibold tracking-wider uppercase hover:bg-primary hover:text-primary-foreground transition-all">
                TALK TO SALES
              </button>
              <Link to="/pricing" className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-foreground hover:text-primary transition-colors">
                BOOK A DEMO <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}