import React from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import { useSEO } from "@/hooks/useSEO";
import novaLogo from "@/assets/nova logo.png";
import {
  ArrowRight, Workflow, RefreshCcw, ClipboardCheck, ShieldCheck, Activity, Mic,
  UtensilsCrossed, Scissors, Stethoscope, HardHat, Building2, ShoppingBag,
} from "lucide-react";

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#E0C476";
const GOLD_DARK = "#8a6b2a";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const TICKER_ITEMS = ["Nova Audit", "Nova Core", "Nova Harvest", "Nova Sentry"];

// Availability labels must match what is actually running (docs/NOVA_OPERATIONAL_MVP_READINESS.md). No outcome statistics.
const PILLARS = [
  { name: "Nova Audit", Icon: ClipboardCheck, status: "Available now", desc: "Nova looks at how your business handles new customers — phone, texts, web form, booking, payment and follow-up — and writes down what it finds, with the source and date of every observation. Estimates are labelled as estimates." },
  { name: "Nova Core", Icon: Workflow, status: "Pilot only", desc: "Workers that carry out the routine steps of a sale: answer the inquiry, ask your qualifying questions, quote only prices you approved, offer real open times, book, send the agreement and pass the job to your team." },
  { name: "Nova Harvest", Icon: RefreshCcw, status: "Pilot only", desc: "Follow-up on customers you already have: a text back after a missed call, check-ins with past customers and old quotes, and honest review and referral invitations — only to people who gave permission." },
  { name: "Nova Sentry", Icon: Activity, status: "Pilot only", desc: "Watches that the other three keep working, alerts a named person when something fails, and sends a weekly scoreboard built from your actual records." },
];

const INDUSTRIES = [
  { name: "Restaurants", Icon: UtensilsCrossed },
  { name: "Barbershops & Salons", Icon: Scissors },
  { name: "Medical & Dental", Icon: Stethoscope },
  { name: "Contractors", Icon: HardHat },
  { name: "Real Estate", Icon: Building2 },
  { name: "Retail & Boutiques", Icon: ShoppingBag },
];

export default function Waves() {
  useSEO({
    title: "Wave One Pilot — Nova Systems for Connecticut Businesses",
    description: "Apply for Nova Systems' Wave One pilot: a complimentary Nova Audit first, then, if you choose, a clearly labelled pilot of Nova Core, Harvest and Sentry. Connecticut businesses.",
  });

  const scrollToEngines = () => {
    document.getElementById("wave-engines")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-navy text-white">
      <style>{`
        @keyframes wavePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.4); } }
        @keyframes waveTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      {/* Custom minimal top bar (not the global Navbar — hero has its own per spec) */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <img src={novaLogo} alt="Nova Systems" className="h-7 w-7 object-contain" />
          <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
        </Link>
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}45` }}>
          Wave One Pilot
        </span>
      </div>

      {/* SECTION 1 — HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden pt-24 pb-16">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(201, 168, 76,0.14) 0%, transparent 62%)" }} />

        <div className="relative flex items-center gap-2.5 mb-8">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full" style={{ background: GOLD, animation: "wavePulse 1.8s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: GOLD }} />
          </span>
          <span className="text-xs md:text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>Pilot applications open</span>
        </div>

        <h1 className="relative font-black leading-[0.98] max-w-5xl mb-6" style={{ fontSize: "clamp(2.4rem, 6vw, 5rem)", letterSpacing: "-0.03em" }}>
          Find out where customers slip away.<br className="hidden md:block" /> Then fix the parts worth fixing.
        </h1>

        <p className="relative text-lg md:text-2xl font-bold mb-6" style={{ color: GOLD }}>
          Wave One: the first Connecticut businesses to run Nova.
        </p>

        <p className="relative text-sm md:text-base max-w-2xl leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
          Every Wave One business starts with a complimentary Nova Audit. If the findings are worth acting on, you decide the scope and Nova installs it as a clearly labelled pilot. Pricing is set in writing for your scope before anything starts.
        </p>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link to="/waves/form" className="inline-flex items-center justify-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
            Apply for Early Access <ArrowRight className="w-4 h-4" />
          </Link>
          <button onClick={scrollToEngines} className="inline-flex items-center justify-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}>
            See The Four Pillars
          </button>
        </div>

        {/* Ticker */}
        <div className="relative w-full overflow-hidden py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex whitespace-nowrap" style={{ animation: "waveTicker 22s linear infinite", width: "fit-content" }}>
            {[...Array(4)].flatMap(() => TICKER_ITEMS).map((item, i) => (
              <span key={i} className="mx-6 text-sm md:text-base font-bold tracking-wide flex items-center gap-6" style={{ color: "rgba(255,255,255,0.3)" }}>
                {item} <span style={{ color: GOLD }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — THE PROBLEM */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#050400" }}>
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16 max-w-3xl mx-auto leading-tight">Most Owners Cannot Answer These Three Questions.</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-14 text-left">
              {[
                { emoji: "📞", text: "How many calls go unanswered after hours, and what happens to those callers?" },
                { emoji: "⏱️", text: "How long does a new inquiry from your website or a text wait for a reply?" },
                { emoji: "🗂️", text: "How many past customers and old quotes have never been followed up?" },
              ].map((c, i) => (
                <div key={i} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="text-3xl mb-5">{c.emoji}</div>
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{c.text}</p>
                </div>
              ))}
            </div>
            <p className="text-2xl md:text-3xl font-black" style={{ color: GOLD }}>The Nova Audit finds out, with evidence.</p>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 3 — THE FOUR PILLARS */}
      <section id="wave-engines" className="py-24 px-6" style={{ background: "#0a0800" }}>
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <h2 className="text-3xl md:text-5xl font-black text-center mb-16">The Four Pillars.</h2>
          </FadeUp>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {PILLARS.map((e, i) => (
              <FadeUp key={e.name} delay={i * 60}>
                <div className="h-full rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}50` }}>
                    <e.Icon className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <h3 className="text-base font-black mb-1" style={{ color: GOLD }}>{e.name}</h3>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: e.status === "Available now" ? "#FAFAFA" : "rgba(250,250,250,0.55)" }}>{e.status}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{e.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <p className="flex items-start gap-2 max-w-3xl mx-auto text-xs leading-relaxed mb-12" style={{ color: "rgba(255,255,255,0.45)" }}>
            <Mic className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
            An AI voice receptionist is being tested and is not offered yet. Wave One pilots handle texts and web inquiries; calls go to your team as they do today.
          </p>
          <div className="text-center">
            <Link to="/waves/form" className="inline-flex items-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              Apply For The Pilot <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#050400" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16">How Wave One Works.</h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { n: "01", title: "You apply", desc: "Tell us about your business and how customers reach you today." },
                { n: "02", title: "Nova audits", desc: "With your written permission, Nova reviews your channels and writes up what it found — observations, owner-reported facts and labelled estimates kept separate." },
                { n: "03", title: "You decide", desc: "If something is worth fixing, you approve a written scope and price. Nova installs it as a labelled pilot, and you see the weekly scoreboard from your own records." },
              ].map((s) => (
                <div key={s.n}>
                  <p className="text-4xl font-black mb-4" style={{ color: `${GOLD}50` }}>{s.n}</p>
                  <h3 className="text-lg font-black mb-3">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 5 — WHAT A PILOT IS */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#1A1100" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16" style={{ color: GOLD }}>What A Pilot Means</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-14 text-left">
              {[
                { Icon: ShieldCheck, title: "Your approval first", desc: "Prices, agreement wording and who may be contacted are set by you. Nova never quotes a price you have not approved." },
                { Icon: Activity, title: "Real records", desc: "The weekly scoreboard is built from your bookings, agreements and deposits. Estimates are labelled, and test activity is never counted." },
                { Icon: ClipboardCheck, title: "Honest limits", desc: "A pilot is labelled as a pilot. If something is not ready, Nova says so instead of selling it." },
              ].map((b) => (
                <div key={b.title} className="rounded-2xl p-8" style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${GOLD}35` }}>
                  <b.Icon className="w-7 h-7 mb-5" style={{ color: GOLD }} />
                  <h3 className="text-base font-black mb-2 text-white">{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{b.desc}</p>
                </div>
              ))}
            </div>
            <Link to="/waves/form" className="inline-flex items-center gap-2 px-10 py-5 text-sm font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              Apply For Wave One <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 6 — WHO THIS IS FOR */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#0a0800" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16">Built For Local Businesses That Win Customers By Phone, Text And Booking.</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-12">
              {INDUSTRIES.map((ind) => (
                <div key={ind.name} className="rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <ind.Icon className="w-6 h-6" style={{ color: GOLD }} />
                  <p className="text-sm font-bold text-center">{ind.name}</p>
                </div>
              ))}
            </div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Not sure if you qualify? Apply anyway. We review every application personally.
            </p>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 7 — FINAL CTA */}
      <section className="py-24 px-6 text-center" style={{ background: "#000", borderTop: `1px solid ${GOLD}`, borderBottom: `1px solid ${GOLD}` }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">Start With The Audit.</h2>
          <p className="text-sm md:text-base mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
            Every application is reviewed personally by the Nova team. There is no obligation to buy anything after the audit.
          </p>
          <Link to="/waves/form" className="inline-flex items-center gap-2 px-10 py-5 text-sm font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85 mb-5" style={{ background: G, color: "#0a0800" }}>
            Apply Now <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            The Nova Audit is complimentary for Wave One applicants.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
