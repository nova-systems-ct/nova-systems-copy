import {Link} from 'react-router-dom';
import Footer from '@/components/Footer';
import {NovaHomeNavigation} from '@/components/home/HeroSection';
import { useSEO } from '@/hooks/useSEO';
import { SERVICE_CATALOG, AVAILABILITY, requestLink } from '@/lib/serviceCatalog';
import './HomeLaunch.css';
import './Services.css';

// The full service catalog. Every service states what is included, what the customer supplies,
// what comes back, and what happens when Nova cannot handle something. No prices are shown:
// each service is quoted after the work is agreed.
export default function Services() {
  useSEO({ title: 'Services — Nova Systems', description: 'What Nova handles for your business: customer care, scheduling, sales support, marketing, daily operations, administration, finance support and business improvement.' });
  return <div className="nova-home nova-services-page"><NovaHomeNavigation/><main>
    <header className="nova-services-hero"><p className="nova-kicker">SERVICES</p><h1>The work behind your business.<br /><em>Handled.</em></h1><p>From answering customers and organizing appointments to following up, producing marketing and keeping your team on track, Nova helps take care of the work behind your business.</p>
      <nav className="nova-services-index" aria-label="Services on this page">{SERVICE_CATALOG.map(s => <a key={s.key} href={`#${s.key}`}>{s.name}</a>)}</nav></header>
    <div className="nova-services-list">{SERVICE_CATALOG.map((s, i) => <section className="nova-service-detail" id={s.key} key={s.key} aria-labelledby={`${s.key}-title`}>
      <div className="nova-service-detail-head"><p className="nova-kicker">{String(i + 1).padStart(2, '0')}</p><h2 id={`${s.key}-title`}>{s.name}</h2><p className="nova-service-summary">{s.summary}</p>
        <p className={`nova-availability is-${s.availability}`}>{AVAILABILITY[s.availability]}</p>{s.availabilityNote && <p className="nova-availability-note">{s.availabilityNote}</p>}
        <a className="nova-home-button" href={requestLink(s)}>Request {s.name.toLowerCase()} <span>→</span></a><p className="nova-quote-note">Priced by quote once we agree on the work. Sending a request does not commit you to anything.</p></div>
      <dl className="nova-service-facts">
        <div><dt>Who it helps</dt><dd>{s.helps}</dd></div>
        <div><dt>What is included</dt><dd><ul>{s.included.map(item => <li key={item}>{item}</li>)}</ul></dd></div>
        <div><dt>What you supply</dt><dd>{s.youSupply}</dd></div>
        <div><dt>What you get back</dt><dd>{s.deliverable}</dd></div>
        <div><dt>When something is outside the plan</dt><dd>{s.escalation}</dd></div>
      </dl></section>)}</div>
    <section className="nova-services-how"><p className="nova-kicker">HOW NOVA WORKS</p><h2>Tell us what needs handling. We agree on the work. Nova gets it moving. You can see what happened.</h2><p>Nova uses software and AI assistants to carry out much of this work, with people responsible for the decisions. When a customer is dealing with an automated assistant, it says so if asked. Nova does not replace your accountant, your lawyer or any licensed professional.</p><Link className="nova-home-button" to="/contact">Talk to us first <span>→</span></Link></section>
  </main><Footer /></div>;
}
