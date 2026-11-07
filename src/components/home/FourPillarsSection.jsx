import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const GOLD = '#C9A84C';
const OFFERS = [
  { n: '01', name: 'Nova Audit', verb: 'Find the gap.', status: 'Evidence review available', body: 'Trace the places customers find you, contact you and try to buy. Receive sourced findings, a clear order of priorities and a report you can act on.', note: 'Public information first. Private records are optional. Calls, emails and other active tests need your permission and an activated channel.' },
  { n: '02', name: 'Nova Core', verb: 'Put work in motion.', status: 'Configured pilot', body: 'Connect the tools you already use. Install supported workflows to answer, qualify, book, send agreements and hand the right work to your team.', note: 'Each connection is tested for your business. Prices, calendar availability, payments and human handoffs follow your approved playbook.' },
  { n: '03', name: 'Nova Harvest', verb: 'Create opportunity.', status: 'Campaigns prepared with you', body: 'Build a focused offer, reach a suitable audience through approved channels and bring interested buyers into a working customer journey.', note: 'Audience, channel access and limits are agreed before launch. Results come from recorded replies, bookings and payments.' },
  { n: '04', name: 'Nova Revive', verb: 'Bring them back.', status: 'Permission-based pilot', body: 'Follow up on unfinished bookings and stalled quotes. Reconnect with eligible past customers, while honoring replies and opt-outs.', note: 'An approved list and live channel come first. Nova Sentry monitors the installed work and raises issues for review.' },
];

export default function FourPillarsSection() {
  return (
    <section id="services" className="px-6 py-20 md:py-28 scroll-mt-20" style={{ background: '#FAFAFA', color: '#0A0A0A' }}>
      <div className="max-w-6xl mx-auto">
        <div className="md:flex justify-between items-end gap-12 mb-12 md:mb-16">
          <div className="max-w-2xl">
            <p className="text-[10px] tracking-[0.26em] uppercase mb-5" style={{ color: '#806522' }}>One business. Four connected capabilities.</p>
            <h2 className="text-4xl md:text-5xl leading-[1.08] tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>A closer look.<br />A better way forward.</h2>
          </div>
          <p className="text-sm leading-relaxed max-w-xs mt-6 md:mt-0" style={{ color: '#565656' }}>Start with what is actually happening. Fix the important gaps. Prove the work before expanding it.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-x-12">
          {OFFERS.map(o => <article key={o.name} className="py-8 md:py-10 border-t" style={{ borderColor: '#DAD7CF' }}>
            <div className="flex items-center justify-between gap-5 mb-7">
              <p className="text-xs uppercase tracking-[0.16em] font-semibold">{o.name}</p>
              <span className="text-2xl" style={{ color: GOLD, fontFamily: 'Georgia, serif' }}>{o.n}</span>
            </div>
            <h3 className="text-3xl leading-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>{o.verb}</h3>
            <p className="text-sm leading-7 max-w-lg" style={{ color: '#404040' }}>{o.body}</p>
            <details className="mt-5 text-xs leading-6" style={{ color: '#656565' }}>
              <summary className="cursor-pointer font-medium" style={{ color: '#5F4A19' }}>{o.status} · How it works</summary>
              <p className="pt-2">{o.note}</p>
            </details>
          </article>)}
        </div>
        <div className="flex flex-wrap gap-6 items-center mt-8 pt-8 border-t" style={{ borderColor: '#DAD7CF' }}>
          <Link to="/book" className="inline-flex items-center gap-4 px-7 py-4 text-xs font-semibold tracking-[0.12em] uppercase" style={{ background: '#0A0A0A', color: '#FAFAFA' }}>Start with your audit <ArrowUpRight size={17} style={{ color: GOLD }} /></Link>
          <span className="text-xs" style={{ color: '#666' }}>Waterbury, Connecticut · Built around your business.</span>
        </div>
      </div>
    </section>
  );
}
