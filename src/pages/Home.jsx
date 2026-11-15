import {ArrowUpRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import Footer from '@/components/Footer';
import HeroSection,{NovaHomeNavigation} from '@/components/home/HeroSection';
import { useSEO } from '@/hooks/useSEO';
import { SERVICE_CATALOG, AVAILABILITY } from '@/lib/serviceCatalog';
import './HomeLaunch.css';
import './Services.css';

const questions = [
  ['Where do we start?', 'Start with one piece of work that takes too much of your time: answering customers, arranging appointments or keeping up with follow-up. We agree on exactly what Nova will handle before anything begins.'],
  ['Do I need to understand the technology?', 'No. You tell us what needs handling and how you want it done. Nova uses software and AI assistants to do the work, and you see what was completed in plain language.'],
  ['Will my customers know when they are talking to an assistant?', 'Yes. When a customer is dealing with an automated assistant, it says so if asked, and anything it cannot answer goes to a person on your team.'],
  ['Can Nova work with what we already use?', 'We look at the tools and channels your business already has, then confirm what can be connected and what approvals each one needs.'],
  ['What happens when I send a request?', 'Your request is saved with a reference number. If you choose a published phone appointment and the reservation succeeds, you get a confirmation and a calendar file. Sending a request does not agree to a price or a contract.'],
  ['Do I have to agree to text messages?', 'No. Service texts are a separate, optional choice. Providing a phone number or sending a request does not grant marketing permission.'],
];
export default function Home() {
  useSEO({ title: 'Nova Systems — The work behind your business. Handled.', description: 'Nova takes care of the work that keeps your business running: answering customers, organizing appointments, following up, marketing and daily administration. Based in Waterbury, Connecticut.' });
  return <div className="nova-home"><NovaHomeNavigation/><main><HeroSection />
    <section id="services" className="nova-editorial"><div className="nova-home-section"><div className="nova-section-heading"><p className="nova-kicker">WHAT NOVA TAKES CARE OF</p><h2>The work behind<br /><em>your business.</em></h2><p>Nova takes care of the work that keeps your business running. Choose the part that costs you the most time. We agree on what is included, and you can see what was done.</p></div>
      <div className="nova-catalog-grid">{SERVICE_CATALOG.map((s, i) => <Link className="nova-catalog-card" key={s.key} to={`/services#${s.key}`}><div className="nova-card-number">{String(i + 1).padStart(2, '0')}<ArrowUpRight size={19} aria-hidden="true"/></div><h3>{s.name}</h3><p>{s.summary}</p><span className={`nova-availability is-${s.availability}`}>{AVAILABILITY[s.availability]}</span></Link>)}</div>
      <Link className="nova-home-button" to="/services">See what each service includes <span>→</span></Link></div></section>
    <section id="workflow" className="nova-workflow-section"><div className="nova-home-section"><div className="nova-section-heading"><p className="nova-kicker">HOW IT WORKS</p><h2>We’ve got it.<br /><em>You can see it.</em></h2><p>No jargon and no long setup project. Start with one request.</p><a className="nova-home-button" href="/service-request">Tell us what needs handling <span>→</span></a></div><ol className="nova-workflow-list"><li><span>01</span><div><h3>Tell us what needs handling</h3><p>Describe the work in your own words and choose a time to talk, or ask us to arrange one.</p></div></li><li><span>02</span><div><h3>We agree on the work</h3><p>What is included, what you supply and who is responsible. Nothing starts and nothing is charged before you agree.</p></div></li><li><span>03</span><div><h3>Nova gets it moving</h3><p>The work is assigned and carried out. Anything uncertain comes to a person instead of being guessed.</p></div></li><li><span>04</span><div><h3>You can see what happened</h3><p>Each finished piece of work leaves a record you can open: the request, the appointment, the follow-up.</p></div></li></ol></div></section>
    <section id="pilot" className="nova-home-section nova-pilot"><div><p className="nova-kicker">FOR OWNERS WITH TOO MUCH ON THEIR PLATE</p><h2>Start with one<br /><em>real task.</em></h2><p>Tell us where customers or your team get stuck. We will work out the right place to begin with you.</p></div><div className="nova-pilot-card"><span className="nova-pilot-dot" /> <p className="nova-kicker">NOVA SYSTEMS · CONNECTICUT</p><h3>Your business.<br />Taken care of.</h3><p>Customers answered, appointments organized and follow-up done, starting with what you need most.</p><a className="nova-home-button" href="/service-request">Tell Nova what you need <span>→</span></a><a className="nova-pilot-contact" href="mailto:isaac@nova-systems.app">isaac@nova-systems.app</a></div></section>
    <section id="industries" className="nova-home-section">
      <div className="nova-section-heading"><p className="nova-kicker">WHO WE WORK WITH</p><h2>Built around<br/><em>the work you do.</em></h2></div>
      <div className="nova-services-grid">
        {[
          ['Home services','A customer calls while you are on a job. Their request is taken, and the visit is on your calendar when you look up.'],
          ['Auto repair','Vehicle details are collected up front, so the shop knows what is coming in and when.'],
          ['Professional services','Inquiries, consultations and the next step for each client stay in one place.'],
        ].map(([title,body])=><article className="nova-service-card" key={title}><h3>{title}</h3><p>{body}</p></article>)}
      </div>
    </section>
    <section id="faq" className="nova-home-section nova-faq"><div><p className="nova-kicker">BEFORE WE GET STARTED</p><h2>A few<br /><em>good questions.</em></h2></div><div>{questions.map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
  </main><Footer /></div>;
}
