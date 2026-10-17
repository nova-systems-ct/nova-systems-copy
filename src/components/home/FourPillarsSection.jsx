import React from "react";
import { Link } from "react-router-dom";
import { Search, Bot, Target, ArrowRight } from "lucide-react";

const GOLD = "#C9A84C";
const DIM = "rgba(255,255,255,0.65)";

// The Triangle of Nova (owner specification 2026-10-17): Audit, Agents, Demand. Revive and Sentry sit underneath the
// Agents. Every claim must match what is verified today (see docs/NOVA_OPERATIONAL_MVP_CHECKPOINT.md). Section id stays
// "services" for existing links. File name kept for existing imports.
const OFFERS = [
  {
    icon: Search, name: "Nova Audit", status: "Available now", title: "Find where customers, money and time are lost",
    body: "Nova inspects your real customer journey — calls, texts, forms, booking, agreements, payments, follow-up and the tools you already pay for — online and on-site. Every finding shows its evidence, source and time, what we observed is kept separate from what we estimate, and the result is a specific installation plan.",
    note: "Delivered within 48–72 hours once scope, access and inputs are confirmed.",
  },
  {
    icon: Bot, name: "Nova Agents", status: "Labelled pilot", title: "Workers that carry out the approved work",
    body: "Agents answer each inquiry, qualify it, quote only your approved prices, offer real open times, book, send your agreement for signature, take deposits into your own Stripe account, and hand the job to your team. Nova Revive follows up on stalled quotes and unfinished bookings; Nova Sentry watches that everything keeps working and reports every Sunday.",
    note: "Agents act only within the prices, agreement, calendar and contact permissions you approve. An AI voice receptionist is in testing and is not offered yet.",
  },
  {
    icon: Target, name: "Nova Demand", status: "Campaigns prepared with you", title: "Go out and create new sales opportunities",
    body: "Choose a service you have capacity to deliver, find suitable buyers, build a clear offer, reach them through permitted channels, handle the replies and move interested people into the Agents to quote, book and get paid. Every prospect is tracked from contact to collected payment.",
    note: "No outreach runs until you approve the campaign, audience, channels and limits. Nova commits its work to a defined outcome; it cannot guarantee that independent customers will buy.",
  },
];

export default function FourPillarsSection() {
  return (
    <section id="services" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>The Triangle of Nova</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">Find the failures. Do the work. Create new business.</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Most businesses already paid for software, agencies and AI that promised more and left them with bills and manual work. Nova proves the problem, installs workers that complete the process, and builds new opportunities you can count — not posts, impressions or advice.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {OFFERS.map(({ icon: Icon, name, status, title, body, note }) => (
            <article key={name} className="rounded-xl p-7 flex flex-col" style={{ background: "#0F0F0F", border: `1px solid ${name === "Nova Audit" ? `${GOLD}55` : "rgba(255,255,255,0.07)"}` }}>
              <span className="flex items-center justify-center mb-4" style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${GOLD}55` }}><Icon className="w-5 h-5" style={{ color: GOLD }} /></span>
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>{name}</p>
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: "rgba(250,250,250,0.55)" }}>{status}</p>
              <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: DIM }}>{body}</p>
              <p className="text-xs mt-auto" style={{ color: "rgba(255,255,255,0.42)" }}>{note}</p>
            </article>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          <Link to="/book" className="inline-flex items-center gap-2 px-7 py-3.5 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background: GOLD, color: "#0A0A0A" }}>Request your audit <ArrowRight className="w-3.5 h-3.5" /></Link>
          <Link to="/demo" className="inline-flex items-center gap-2 px-7 py-3.5 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ border: `1px solid ${GOLD}`, color: "#FAFAFA" }}>Experience the five-minute audit</Link>
        </div>
      </div>
    </section>
  );
}
