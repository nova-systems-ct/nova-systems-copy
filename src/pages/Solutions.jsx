import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { ChevronRight, Search, Radar, BarChart3, Bell, Zap, Brain, Shield, Plug } from "lucide-react";

const SOLUTIONS_BG = "https://media.base44.com/images/public/user_6955f8132de0845ff4cba0e3/51da0f3b9_319F7C48-3E15-46E8-98BC-5ABC5609A8C0.png";
const GLOBE_IMG = "https://media.base44.com/images/public/user_6955f8132de0845ff4cba0e3/7321296d4_0C8AEAC4-C897-4A64-B1D4-2D20D468699B.png";

const processSteps = [
  { num: "01", title: "Capture", desc: "We capture and analyze calls, chats, and emails across your business.", icon: Search },
  { num: "02", title: "Detect", desc: "AI detects missed opportunities, risks, and patterns.", icon: Radar },
  { num: "03", title: "Analyze", desc: "We surface actionable insights and point out what matters most.", icon: BarChart3 },
  { num: "04", title: "Alert", desc: "Your team gets instant alerts so nothing slips through the cracks.", icon: Bell },
  { num: "05", title: "Improve", desc: "Teams take action, fix gaps, and close more consistently.", icon: Zap },
];

const aiFeatures = [
  { title: "AI Conversation Intelligence", desc: "Understand customer conversations, fix your biggest errors and things you miss.", icon: Brain },
  { title: "Real-Time Insights", desc: "See what's happening now and take action before opportunities are lost.", icon: BarChart3 },
  { title: "Enterprise Security", desc: "Bank-grade encryption, role-based access, and compliance-ready.", icon: Shield },
  { title: "Seamless Integrations", desc: "Works with your CRM, phone systems, and business tools.", icon: Plug },
];

const teams = [
  { title: "Sales Teams", desc: "Find missed opportunities, improve win rates, and close more deals." },
  { title: "Customer Success", desc: "Proactively solve issues, reduce churn, and grow existing accounts." },
  { title: "Support Teams", desc: "Resolve issues faster and turn every interaction into loyalty." },
  { title: "Revenue Leaders", desc: "Get visibility into performance, forecast with confidence, and drive predictable growth." },
  { title: "Compliance & Legal", desc: "Ensure policies are followed and reduce risk with complete conversation visibility." },
  { title: "Any Industry", desc: "From financial services to healthcare, SaaS to home services — NOVA works wherever conversations happen." },
];

export default function Solutions() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative min-h-[60vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img src={SOLUTIONS_BG} alt="Background" className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          </div>
          <div className="relative max-w-7xl mx-auto px-6 py-32">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">
              WHAT WE DO <span className="inline-block w-8 h-px bg-primary ml-2 align-middle" />
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-foreground max-w-xl">
              We find the leaks draining your revenue.
            </h1>
            <p className="text-muted-foreground mt-6 text-sm max-w-md leading-relaxed">
              NOVA Systems uses AI-powered conversation intelligence to surface revenue leaks, close gaps, and help your team win more.
            </p>
          </div>
        </section>

        {/* Our Process */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">OUR PROCESS</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              From conversation to conversion.
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
              We turn every customer interaction into clear insights and real revenue impact.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-14">
              {processSteps.map((step) => (
                <div key={step.num} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full border border-primary/30 flex items-center justify-center mb-4">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-xs text-primary font-semibold">{step.num}</p>
                  <h3 className="text-sm font-bold text-foreground mt-1">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Features */}
        <section className="py-20 px-6 bg-card border-y border-border/50">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">POWERED BY AI. BUILT FOR REVENUE.</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Intelligence that drives results.
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
              NOVA Pulse analyzes 100% of conversations so you can focus your team on what moves the needle.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mt-12 text-left">
              {aiFeatures.map((f) => (
                <div key={f.title} className="bg-background border border-border rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{f.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-12 px-6 bg-card border-b border-border/50">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-foreground">
                Turn every conversation into revenue.
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                See how NOVA Systems can help you plug leaks and grow your business.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/pricing" className="px-6 py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all">
                BOOK A DEMO
              </Link>
              <Link to="/solutions" className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-foreground hover:text-primary transition-colors">
                SEE HOW IT WORKS <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Globe Section */}
        <section className="relative py-20 px-6 overflow-hidden">
          <div className="absolute inset-0">
            <img src={GLOBE_IMG} alt="Global network" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-background/70" />
          </div>
          <div className="relative max-w-5xl mx-auto text-center">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">WHO WE HELP</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Every team. Every industry.
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
              If your team talks to customers, NOVA Pulse can help you win more.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
              {teams.map((t) => (
                <div key={t.title} className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-5 text-left">
                  <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 px-6 bg-background border-t border-border/50">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Built for your industry. Focused on your revenue.
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              No matter your business, NOVA helps you stop losing revenue and start growing it.
            </p>
            <div className="flex items-center justify-center gap-4 mt-8">
              <Link to="/pricing" className="px-6 py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all">
                BOOK A DEMO
              </Link>
              <Link to="/solutions" className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-foreground hover:text-primary transition-colors">
                SEE HOW IT WORKS <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}