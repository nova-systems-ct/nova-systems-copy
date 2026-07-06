import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import { useSEO } from "@/hooks/useSEO";
import novaLogo from "@/assets/nova logo.png";
import {
  ArrowRight, Mic, MessageSquare, Mail as MailIcon,
  Share2, RefreshCcw, ClipboardCheck, ShieldCheck, Crown, Sparkles,
  UtensilsCrossed, Scissors, Stethoscope, HardHat, Building2, ShoppingBag,
} from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const TICKER_ITEMS = ["Nova Voice", "Nova Blue", "Nova Email", "Nova Social", "Nova Revive", "Nova Audit"];

const ENGINES = [
  { name: "Nova Voice", color: "#a78bfa", Icon: Mic, desc: "AI phone agent answering every call 24/7 in English and Spanish. Never miss a lead again.", stat: "24/7 coverage, EN + ES" },
  { name: "Nova Blue", color: "#60a5fa", Icon: MessageSquare, desc: "AI SMS agent following up with every lead automatically.", stat: "98% of texts read within 3 minutes" },
  { name: "Nova Email", color: "#2dd4bf", Icon: MailIcon, desc: "AI managing your entire inbox. Every inquiry answered professionally.", stat: "Replies in under 2 minutes" },
  { name: "Nova Social", color: "#e879f9", Icon: Share2, desc: "AI handling every Instagram, TikTok, Facebook, and LinkedIn DM and comment.", stat: "Turns attention into appointments", gradient: "linear-gradient(135deg,#f472b6,#a78bfa)" },
  { name: "Nova Revive", color: "#fb923c", Icon: RefreshCcw, desc: "AI reactivating every dead lead in your database.", stat: "Recovers revenue you already paid for" },
  { name: "Nova Audit", color: GOLD, Icon: ClipboardCheck, desc: "Full business intelligence scan showing exactly where you lose money and what competitors do better.", stat: "Delivered as a premium PDF report" },
];

const INDUSTRIES = [
  { name: "Restaurants", Icon: UtensilsCrossed },
  { name: "Barbershops & Salons", Icon: Scissors },
  { name: "Medical & Dental", Icon: Stethoscope },
  { name: "Contractors", Icon: HardHat },
  { name: "Real Estate", Icon: Building2 },
  { name: "Retail & Boutiques", Icon: ShoppingBag },
];

function useSpotsRemaining() {
  const [spots, setSpots] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/waves-intake?action=spots").then((r) => r.json()).then((d) => {
        if (!cancelled) setSpots(Number.isFinite(d?.spots_remaining) ? d.spots_remaining : 7);
      }).catch(() => { if (!cancelled) setSpots(7); });
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  return spots;
}

export default function Waves() {
  const spots = useSpotsRemaining();

  useSEO({
    title: "Wave One — The AI Revenue Engine for Connecticut Businesses | Nova Systems",
    description: "Wave One is now open. Six AI engines, one partner, one check. Limited enrollment for Connecticut businesses ready to stop losing revenue to missed calls, slow follow-up, and dead leads.",
  });

  const scrollToEngines = () => {
    document.getElementById("wave-engines")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
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
          Wave One — Now Open
        </span>
      </div>

      {/* SECTION 1 — HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden pt-24 pb-16">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(212,160,48,0.14) 0%, transparent 62%)" }} />

        <div className="relative flex items-center gap-2.5 mb-8">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full" style={{ background: GOLD, animation: "wavePulse 1.8s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: GOLD }} />
          </span>
          <span className="text-xs md:text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.7)" }}>Limited Enrollment Open</span>
        </div>

        <h1 className="relative font-black leading-[0.98] max-w-5xl mb-6" style={{ fontSize: "clamp(2.4rem, 6vw, 5rem)", letterSpacing: "-0.03em" }}>
          The AI Revenue Engine for<br className="hidden md:block" /> Connecticut Businesses.
        </h1>

        <p className="relative text-lg md:text-2xl font-bold mb-6" style={{ color: GOLD }}>
          Wave One. Six engines. One partner. One check.
        </p>

        <p className="relative text-sm md:text-base max-w-2xl leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
          We are selecting a limited group of Connecticut businesses to deploy our full AI Revenue Engine before the public launch. Early partners lock in a lower rate, skip setup fees, and go live in 14 days.
        </p>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link to="/waves/form" className="inline-flex items-center justify-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
            Apply for Early Access <ArrowRight className="w-4 h-4" />
          </Link>
          <button onClick={scrollToEngines} className="inline-flex items-center justify-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}>
            See What Is Included
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
            <h2 className="text-3xl md:text-5xl font-black mb-16 max-w-3xl mx-auto leading-tight">Your Business Is Losing Money Right Now.</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-14 text-left">
              {[
                { emoji: "📞", text: "35% of calls go unanswered after hours. Those callers call your competitor next." },
                { emoji: "⏱️", text: "Average business takes 12 hours to reply to a lead. You have 5 minutes before they move on." },
                { emoji: "💀", text: "Thousands in dead leads sitting in your database. Nobody is following up. That money is gone." },
              ].map((c, i) => (
                <div key={i} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="text-3xl mb-5">{c.emoji}</div>
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{c.text}</p>
                </div>
              ))}
            </div>
            <p className="text-2xl md:text-3xl font-black" style={{ color: GOLD }}>Nova Systems fixes all three. Automatically.</p>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 3 — THE 6 ENGINES */}
      <section id="wave-engines" className="py-24 px-6" style={{ background: "#0a0800" }}>
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <h2 className="text-3xl md:text-5xl font-black text-center mb-16">Wave One Includes All 6 Engines.</h2>
          </FadeUp>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
            {ENGINES.map((e, i) => (
              <FadeUp key={e.name} delay={i * 60}>
                <div className="h-full rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: e.gradient || `${e.color}20`, border: `1px solid ${e.color}50` }}>
                    <e.Icon className="w-5 h-5" style={{ color: e.gradient ? "#fff" : e.color }} />
                  </div>
                  <h3 className="text-base font-black mb-2" style={{ color: GOLD }}>{e.name}</h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>{e.desc}</p>
                  <p className="text-xs font-bold" style={{ color: e.color }}>{e.stat}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <div className="text-center">
            <Link to="/waves/form" className="inline-flex items-center gap-2 px-9 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              Get All 6 Engines <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#050400" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16">Live in 14 Days. Here Is How.</h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { n: "01", title: "You apply", desc: "Takes 5 minutes. Tell us about your business and your biggest challenge." },
                { n: "02", title: "We build your system", desc: "Our team trains your AI on everything about your business. Voice, SMS, email, social — all configured for you." },
                { n: "03", title: "You grow", desc: "Your AI Revenue Engine goes live. Every call answered. Every lead followed up. Every channel covered." },
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

      {/* SECTION 5 — WAVE ONE OFFER */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#1A1100" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16" style={{ color: GOLD }}>Wave One Early Partner Rate</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-14 text-left">
              {[
                { Icon: ShieldCheck, title: "Zero Setup Fees", desc: "Early partners pay no implementation fee.", value: "Value: $2,500" },
                { Icon: Crown, title: "Locked Monthly Rate", desc: "Your rate is locked for 12 months. No price increases." },
                { Icon: Sparkles, title: "Priority Support", desc: "Direct line to Isaac and the Nova Systems team." },
              ].map((b) => (
                <div key={b.title} className="rounded-2xl p-8" style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${GOLD}35` }}>
                  <b.Icon className="w-7 h-7 mb-5" style={{ color: GOLD }} />
                  <h3 className="text-base font-black mb-2 text-white">{b.title}</h3>
                  <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>{b.desc}</p>
                  {b.value && <p className="text-xs font-bold" style={{ color: GOLD }}>{b.value}</p>}
                </div>
              ))}
            </div>

            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-10" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${GOLD}40` }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full" style={{ background: "#f87171", animation: "wavePulse 1.8s ease-in-out infinite" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#f87171" }} />
              </span>
              <span className="text-sm font-bold text-white">
                {spots === null ? "Loading spots..." : `${spots} spot${spots === 1 ? "" : "s"} remaining`}
              </span>
            </div>
            <div>
              <Link to="/waves/form" className="inline-flex items-center gap-2 px-10 py-5 text-sm font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
                Lock In My Spot <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* SECTION 6 — WHO THIS IS FOR */}
      <FadeUp>
        <section className="py-24 px-6" style={{ background: "#0a0800" }}>
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-16">Wave One Is For Connecticut Businesses That Are Ready.</h2>
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
          <h2 className="text-3xl md:text-5xl font-black mb-5 leading-tight">The Public Launch Is Coming. Early Partners Go First.</h2>
          <p className="text-sm md:text-base mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
            Once Wave One capacity is filled this page closes. Applications reviewed within 24 hours.
          </p>
          <Link to="/waves/form" className="inline-flex items-center gap-2 px-10 py-5 text-sm font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85 mb-5" style={{ background: G, color: "#0a0800" }}>
            Apply Now <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            No commitment required. Free Nova Audit included with every application.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
