import React from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import {
  ChevronRight, Phone, Rocket, ClipboardCheck, Eye,
  MessageSquare, RefreshCcw, UtensilsCrossed, Scissors, Stethoscope,
  Building2, HardHat, ShoppingBag,
} from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const STATS = [
  { value: "< 60s", label: "Response Time" },
  { value: "24/7", label: "Availability" },
  { value: "EN / ES", label: "English and Spanish" },
  { value: "14 Days", label: "Live and Answering" },
];

const STEPS = [
  {
    icon: ClipboardCheck,
    tag: "STEP 1",
    title: "We Learn Your Business",
    desc: "You tell us everything about your business — services, prices, hours, how you like to talk to customers. We train your agent on all of it.",
  },
  {
    icon: Rocket,
    tag: "STEP 2",
    title: "Your Agent Goes Live",
    desc: "We give you a dedicated phone number. Your agent answers every call, qualifies every lead, and books appointments directly into your calendar.",
  },
  {
    icon: Eye,
    tag: "STEP 3",
    title: "You See Everything",
    desc: "Every call recorded and transcribed. Every booking logged. See exactly what your agent said and what happened. Improve it anytime.",
  },
];

const PRODUCTS = [
  {
    icon: Phone,
    name: "Nova Voice",
    price: "$500",
    desc: "AI phone agent that answers every inbound call. Qualifies leads. Books appointments. Speaks English and Spanish.",
  },
  {
    icon: MessageSquare,
    name: "Nova Text",
    price: "$300",
    desc: "AI SMS agent that follows up with every lead automatically. Handles objections. Books meetings. Never misses a follow-up.",
  },
  {
    icon: RefreshCcw,
    name: "Nova Revive",
    price: "$400",
    desc: "Automated reactivation of cold leads. Upload your dead lead list. Nova AI contacts them all automatically and recovers lost revenue.",
  },
];

const INDUSTRIES = [
  { icon: UtensilsCrossed, name: "Restaurants", desc: "Nova AI takes reservations, answers menu questions, and handles takeout orders — even during your busiest dinner rush." },
  { icon: Scissors, name: "Barbershops and Salons", desc: "Every chair full, every call still answered. Nova AI books appointments and manages your schedule around the clock." },
  { icon: Stethoscope, name: "Medical and Dental", desc: "Nova AI schedules appointments, answers insurance questions, and handles cancellations without tying up your front desk." },
  { icon: Building2, name: "Real Estate", desc: "Nova AI qualifies buyer and renter inquiries instantly and books showings before another agent gets there first." },
  { icon: HardHat, name: "Contractors", desc: "Nova AI answers every call from the job site, captures the details, and books estimates onto your calendar automatically." },
  { icon: ShoppingBag, name: "Retail", desc: "Nova AI answers hours and inventory questions and captures every missed-call customer instead of losing them to voicemail." },
];

function scrollToHowItWorks(e) {
  e.preventDefault();
  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
}

export default function AIHome() {
  useSEO({
    title: "Nova AI — AI Voice and Text Agents for Connecticut Businesses",
    description: "Nova AI installs a custom AI voice and SMS agent into your Connecticut business. It answers every call, books every appointment, speaks English and Spanish, and never takes a day off.",
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-28 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 30% 30%, rgba(212,160,48,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(212,160,48,0.06) 0%, transparent 55%)",
          }} />
          <div className="max-w-4xl mx-auto relative text-center">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}45`, marginBottom: 24 }}>
              NOVA AI
            </span>
            <h1 className="font-black text-white leading-[1.05] mb-6" style={{ fontSize: "clamp(2.2rem, 5vw, 4.4rem)", letterSpacing: "-0.02em" }}>
              Your Business Answers Every Call.<br />Books Every Appointment.{" "}
              <span style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 50%, ${GOLD} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                24 Hours a Day.
              </span>
            </h1>
            <p className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
              Nova AI installs a custom AI voice agent into your Connecticut business. It sounds like a real person. It speaks English and Spanish. It never takes a day off.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/welcome" className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
                GET NOVA AI <ChevronRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works" onClick={scrollToHowItWorks} className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ border: `1px solid ${GOLD}50`, color: GOLD }}>
                SEE HOW IT WORKS
              </a>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="py-10 px-6 border-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl md:text-3xl font-black" style={{ color: GOLD }}>{s.value}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>HOW IT WORKS</p>
              <h2 className="text-3xl md:text-4xl font-black text-white">From Signup to Answering — in 14 Days.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {STEPS.map(({ icon: Icon, tag, title, desc }) => (
                <div key={tag} className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}15`, border: `1px solid ${GOLD}40` }}>
                    <Icon style={{ width: 21, height: 21, color: GOLD }} />
                  </div>
                  <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 10 }}>{tag}</p>
                  <h3 className="text-white font-bold text-lg mb-3">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-24 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>THE PRODUCTS</p>
              <h2 className="text-3xl md:text-4xl font-black text-white">Three Agents. One Mission.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {PRODUCTS.map(({ icon: Icon, name, price, desc }) => (
                <div key={name} className="rounded-2xl p-8 flex flex-col" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}15`, border: `1px solid ${GOLD}40` }}>
                    <Icon style={{ width: 21, height: 21, color: GOLD }} />
                  </div>
                  <h3 className="text-white font-black text-xl mb-2">{name}</h3>
                  <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                  <p className="text-2xl font-black" style={{ color: GOLD }}>{price}<span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>/month</span></p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6" style={{ background: `linear-gradient(135deg, rgba(212,160,48,0.1) 0%, rgba(0,0,0,0.3) 100%)`, border: `1px solid ${GOLD}40` }}>
              <div>
                <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 8 }}>THE FULL ENGINE</p>
                <h3 className="text-2xl font-black text-white mb-2">Nova Voice + Nova Text + Nova Revive</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Every call answered. Every lead followed up. Every cold lead revived.</p>
              </div>
              <div className="text-center flex-shrink-0">
                <p className="text-3xl font-black text-white">$1,000<span className="text-sm font-normal" style={{ color: "rgba(255,255,255,0.4)" }}>/mo</span></p>
                <Link to="/welcome" className="inline-flex items-center gap-2 mt-4 px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background: G, color: "#0a0800" }}>
                  GET STARTED <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>BUILT FOR YOUR INDUSTRY</p>
              <h2 className="text-3xl md:text-4xl font-black text-white">Nova AI Speaks Your Business.</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {INDUSTRIES.map(({ icon: Icon, name, desc }) => (
                <div key={name} className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}>
                    <Icon style={{ width: 18, height: 18, color: GOLD }} />
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">{name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-5">Ready to Stop Missing Calls?</h2>
            <p className="text-sm md:text-base mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>Get Nova AI today.</p>
            <Link to="/welcome" className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85" style={{ background: G, color: "#0a0800" }}>
              GET NOVA AI <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
