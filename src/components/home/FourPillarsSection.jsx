import React from "react";
import { Link } from "react-router-dom";
import { Search, Bot, TrendingUp, ArrowRight } from "lucide-react";

const GOLD = "#C9A84C";
const DIM = "rgba(255,255,255,0.65)";

// What Nova is, in three parts. Every claim here must match what the product does today (see
// docs/NOVA_OPERATIONAL_MVP_READINESS.md). The section id stays "services" for existing links.
const AGENTS = [
  { name: "Nova Core", what: "Answers each web-form inquiry, asks your qualifying questions, quotes only your approved prices, offers real open times from your calendar, books, sends your agreement for signature and takes a deposit through Stripe. Unusual, upset or urgent requests go to a person." },
  { name: "Nova Harvest", what: "Follows up with customers you already have: one text back after a missed call where the caller gave permission, check-ins with past customers and old quotes after you approve the list, and honest review and referral invitations after completed work." },
  { name: "Nova Sentry", what: "Watches that the agents keep working, alerts a named person when something fails, and sends a Sunday report built from your recorded inquiries, bookings, agreements and deposits." },
];
const ACQUISITION = [
  ["Every inquiry gets an answer", "Website inquiries are qualified and offered a real time right away, so fewer people go elsewhere while they wait."],
  ["Missed calls are not lost", "Callers who gave permission get one text back offering a time."],
  ["Old opportunities are revisited", "Past customers and unaccepted quotes get a follow-up you approved — never an unapproved list."],
  ["Finished jobs bring the next ones", "After completed work, customers are asked for an honest review and invited to refer someone, under your referral terms."],
  ["You see the numbers", "The weekly report shows inquiries, bookings, signed agreements, deposits and completed work from your records. Anything that can't be measured is labelled, not guessed."],
];

export default function FourPillarsSection() {
  return (
    <section id="services" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>What Nova does</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">Find where customers slip away. Then have agents do the work.</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Nova Systems audits how a local business handles new customers, installs agents that carry out the intake-to-booking steps with your approval, recovers opportunities you already have, and reports what happened. Not an advertising agency, and not a chatbot that only talks.</p>
        </div>

        <article className="rounded-xl p-7 mb-5" style={{ background: "#0F0F0F", border: `1px solid ${GOLD}44` }}>
          <div className="flex items-center gap-3 mb-3"><span className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${GOLD}55` }}><Search className="w-5 h-5" style={{ color: GOLD }} /></span>
            <div><p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>Nova Audit · available now</p><h3 className="text-lg font-bold text-white">Inspect your real customer journey and records</h3></div></div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: DIM }}>Nova checks your website, contact and booking paths, follow-up and payment setup — online, and on-site if you choose — and, with your written permission, tests how calls and forms are answered. Every finding shows its evidence, source and time, and what we observed is kept separate from what we estimate.</p>
          <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>Delivered within 48–72 hours once scope, access and inputs are confirmed.</p>
          <div className="flex flex-wrap gap-3"><Link to="/book" className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background: GOLD, color: "#0A0A0A" }}>Request your audit <ArrowRight className="w-3.5 h-3.5" /></Link><Link to="/demo" className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ border: `1px solid ${GOLD}`, color: "#FAFAFA" }}>Watch the 5-minute demo</Link></div>
        </article>

        <article className="rounded-xl p-7 mb-5" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-4"><span className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${GOLD}55` }}><Bot className="w-5 h-5" style={{ color: GOLD }} /></span>
            <div><p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>Nova Agents · labelled pilot</p><h3 className="text-lg font-bold text-white">Agents that perform approved actions across your channels</h3></div></div>
          <div className="grid md:grid-cols-3 gap-4">{AGENTS.map((a) => <div key={a.name}><p className="text-sm font-bold text-white mb-1">{a.name}</p><p className="text-sm leading-relaxed" style={{ color: DIM }}>{a.what}</p></div>)}</div>
          <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.45)" }}>Agents only act within the prices, agreement, calendar and contact permissions you approve. An AI voice receptionist is in testing and is not offered yet.</p>
        </article>

        <article className="rounded-xl p-7" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-4"><span className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${GOLD}55` }}><TrendingUp className="w-5 h-5" style={{ color: GOLD }} /></span>
            <div><p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>Customer acquisition</p><h3 className="text-lg font-bold text-white">How Nova helps you win more of the customers who already reach out</h3></div></div>
          <ol className="grid md:grid-cols-2 gap-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>{ACQUISITION.map(([t, d], i) => <li key={t} className="flex gap-3"><span className="text-sm font-black" style={{ color: GOLD }}>{i + 1}</span><span><span className="text-sm font-bold text-white">{t}. </span><span className="text-sm" style={{ color: DIM }}>{d}</span></span></li>)}</ol>
          <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.45)" }}>Nova does not buy ads or generate cold leads for you. It converts and recovers the inquiries and customers you already have.</p>
        </article>
      </div>
    </section>
  );
}
