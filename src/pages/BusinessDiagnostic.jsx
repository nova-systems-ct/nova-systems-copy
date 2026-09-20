import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Search, MessageSquare, Star, Smartphone, Phone,
  MapPin, Users, FileCheck, Clock, ShieldCheck, ClipboardList,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { NAVY, GOLD, GOLD_TEXT_GRADIENT, GOLD_GRADIENT, SURFACE, SURFACE_BORDER, TEXT_MUTED } from "@/lib/theme";

const INVESTIGATES = [
  { icon: Search, title: "Your website", desc: "Functionality, mobile usability, load speed, and whether visitors can actually do what they came to do." },
  { icon: ClipboardList, title: "Forms and contact paths", desc: "Whether your forms actually submit, go anywhere, and get a response — tested directly, not assumed." },
  { icon: Phone, title: "Phone response", desc: "How a real call to your business is actually handled, where that's in scope." },
  { icon: MapPin, title: "Search & listings", desc: "Google Business Profile, local search visibility, and business listing accuracy." },
  { icon: Star, title: "Reviews & reputation", desc: "Public review presence and patterns — what customers are already telling the world." },
  { icon: Smartphone, title: "Social presence", desc: "Whether your public channels exist, are active, and are consistent with your brand." },
  { icon: Users, title: "Customer journey", desc: "The real path a prospect follows from finding you to becoming a customer — and where it breaks." },
  { icon: MessageSquare, title: "Positioning & messaging", desc: "Whether your public-facing content clearly explains what you do and why someone should choose you." },
];

const DELIVERABLES = [
  "A written, evidence-backed findings report — every conclusion traces back to something we actually observed, not a guess.",
  "Findings ranked by priority, not just listed — so you know what to fix first.",
  "A confidence and severity rating on each finding — we tell you what we're sure about and what we're not.",
  "A recommendation for each finding — what we'd suggest doing about it, whether that's implementation, internal process, or a decision only you can make.",
];

const PROVIDE = [
  "Access to review (a working link to your website, listings, and any public profiles in scope)",
  "A completed detailed intake (the /intake form) — this is what actually starts the clock",
  "Prompt response to any clarifying questions during the diagnostic",
  "Honest answers about your current operations where asked — the diagnostic is only as good as the information behind it",
];

export default function BusinessDiagnostic() {
  const navigate = useNavigate();
  useSEO({
    title: "Digital Business Diagnostic — Nova Systems",
    description: "An evidence-based review of your business's digital presence — website, forms, search visibility, reviews, and customer journey — with ranked, evidence-backed findings and recommendations.",
  });

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 20%, ${GOLD}12 0%, transparent 60%)` }} />
          <div className="max-w-4xl mx-auto relative">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: TEXT_MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5 text-center" style={{ color: GOLD }}>
              DIGITAL BUSINESS DIAGNOSTIC
            </p>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.05] mb-6 text-center">
              We investigate first.<br />
              <span style={{ background: GOLD_TEXT_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Then we tell you what's actually wrong.
              </span>
            </h1>
            <p className="text-base leading-relaxed max-w-2xl mx-auto text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
              A remote, evidence-based review of your business's digital presence. We don't start by selling you a website or a phone system — we start by finding out where your business is actually losing customers, revenue, opportunities, trust, or time.
            </p>
            <div className="flex items-center justify-center gap-4 mt-10 flex-wrap">
              <Link to="/welcome" className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                START YOUR DIAGNOSTIC <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors hover:text-white"
                style={{ color: TEXT_MUTED, border: `1px solid ${SURFACE_BORDER}` }}>
                See Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Honest scope statement */}
        <section className="py-16 px-6 border-t" style={{ borderColor: SURFACE_BORDER }}>
          <div className="max-w-3xl mx-auto rounded-2xl p-8 flex items-start gap-5" style={{ background: SURFACE, border: `1px solid ${GOLD}30` }}>
            <ShieldCheck className="w-8 h-8 flex-shrink-0" style={{ color: GOLD }} />
            <div>
              <p className="text-white font-bold mb-2">This is the Digital Business Diagnostic — a remote review.</p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                There is a separate, broader <strong className="text-white">360 Business Diagnostic</strong> for businesses that want physical, on-site review — signage, in-person customer experience, staff interaction — in addition to everything covered here. The 360 Diagnostic has its own scope and timeline; it is not covered by the turnaround described on this page. Ask about it when you request your diagnostic if you think it applies to you.
              </p>
            </div>
          </div>
        </section>

        {/* What we investigate */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4 text-center" style={{ color: GOLD }}>WHAT WE INVESTIGATE</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-center">Where the evidence actually comes from.</h2>
            <p className="text-sm text-center max-w-2xl mx-auto mb-14" style={{ color: "rgba(255,255,255,0.4)" }}>
              Not every area applies to every business — scope depends on what you actually have (a business with no social presence doesn't get a fabricated social review). Here's what's typically in scope for a remote diagnostic:
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {INVESTIGATES.map((item) => (
                <div key={item.title} className="rounded-xl p-6" style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}35` }}>
                    <item.icon className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <h3 className="font-bold text-white mb-2 text-sm">{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What you receive */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER, background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4 text-center" style={{ color: GOLD }}>WHAT YOU RECEIVE</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-10 text-center">A report you can actually act on.</h2>
            <div className="space-y-4">
              {DELIVERABLES.map((d) => (
                <div key={d} className="flex items-start gap-4 rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}>
                  <FileCheck className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER }}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6" style={{ color: GOLD }} />
              <p className="text-[9px] tracking-[0.35em] uppercase" style={{ color: GOLD }}>TIMELINE</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">24–72 hours — once we can actually start.</h2>
            <p className="text-sm leading-relaxed max-w-2xl mx-auto mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              The 24–72 hour target applies to an appropriately-scoped Digital Business Diagnostic <strong className="text-white">after</strong> we have your completed detailed intake and the access described below. That's when the clock actually starts — not when you first reach out. If your scope is unusually large, or information is missing, we'll tell you before assuming the timeline still applies. This is not a universal guarantee for every business regardless of complexity.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              {[
                { step: "1", label: "Short request", desc: "Submit /welcome. We review and follow up." },
                { step: "2", label: "Detailed intake", desc: "Complete /intake. This is what starts the clock." },
                { step: "3", label: "Findings delivered", desc: "24–72 hrs later, for in-scope requests." },
              ].map((s) => (
                <div key={s.step} className="rounded-xl p-5" style={{ background: SURFACE, border: `1px solid ${SURFACE_BORDER}` }}>
                  <p className="text-2xl font-black mb-2" style={{ color: GOLD }}>{s.step}</p>
                  <p className="text-white font-bold text-sm mb-1">{s.label}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What you provide */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER, background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4 text-center" style={{ color: GOLD }}>WHAT YOU NEED TO PROVIDE</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-10 text-center">The diagnostic is only as good as this.</h2>
            <div className="space-y-3">
              {PROVIDE.map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: GOLD }} />
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Optional implementation */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER }}>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>AFTER YOUR FINDINGS</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">Implementation is optional — and yours to decide.</h2>
            <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
              Once you have your findings, you can fix issues yourself, bring in another provider, or ask Nova to implement the fix. Nothing is built or charged before you've seen evidence and agreed to a specific scope. The diagnostic doesn't assume the answer is a new website, a CRM, or an AI phone system — it tells you what's actually wrong first.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 border-t" style={{ borderColor: SURFACE_BORDER }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Find out what your business is losing.</h2>
            <Link to="/welcome" className="inline-flex items-center gap-2 px-8 py-4 mt-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              START YOUR BUSINESS DIAGNOSTIC <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
