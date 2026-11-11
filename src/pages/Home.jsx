import Footer from '@/components/Footer';
import HeroSection,{NovaHomeNavigation} from '@/components/home/HeroSection';
import { useSEO } from '@/hooks/useSEO';
import './HomeLaunch.css';

const services = [
  { no: '01', title: 'Capture the request.', body: 'Give customers one clear place to explain what they need. Their details and next step stay organized from the start.', tag: 'CUSTOMER INTAKE' },
  { no: '02', title: 'Make room for the next step.', body: 'Offer the times you actually have available. A selected appointment is confirmed only when the calendar reserves it.', tag: 'BOOKING & SCHEDULING' },
  { no: '03', title: 'Keep the work moving.', body: 'Put the request, appointment and follow-up task together so your team knows what needs attention next.', tag: 'CRM & FOLLOW-UP' },
];
const questions = [
  ['Where do we start?', 'Start with one task that takes too much time: responding to inquiries, arranging appointments or keeping track of follow-up. We agree on the scope before installing a wider system.'],
  ['Can Nova work with our existing tools?', 'We review the tools and channels your business already uses, then confirm the integrations and provider approvals needed for your installation.'],
  ['What happens when I use the booking assistant?', 'Your request is saved for Nova, together with a follow-up task. If you choose a published phone appointment and the reservation succeeds, you receive a booked-time confirmation and a calendar download.'],
  ['Do I have to agree to text messages?', 'No. Service texts are a separate, optional choice. Providing a phone number or sending a request does not grant marketing permission.'],
];
export default function Home() {
  useSEO({ title: 'Nova Systems — Customer Work, Connected', description: 'Business systems for customer requests, appointment booking and follow-up. Start with one useful workflow. Based in Waterbury, Connecticut.' });
  return <div className="nova-home"><NovaHomeNavigation/><main><HeroSection />
    <section id="services" className="nova-home-section"><div className="nova-section-heading"><p className="nova-kicker">LESS FRICTION. MORE FOLLOW-THROUGH.</p><h2>Make the everyday<br /><em>work better.</em></h2><p>Nova helps connect the customer-facing work that too often gets scattered across calls, inboxes and calendars.</p></div><div className="nova-services-grid">{services.map(s => <article className="nova-service-card" key={s.no}><div className="nova-card-number">{s.no}<span>→</span></div><p className="nova-kicker">{s.tag}</p><h3>{s.title}</h3><p>{s.body}</p></article>)}</div></section>
    <section id="workflow" className="nova-workflow-section"><div className="nova-home-section"><div className="nova-section-heading"><p className="nova-kicker">TRY THE NEXT STEP</p><h2>One request.<br /><em>A clear way forward.</em></h2><p>Use Nova’s customer assistant to send your request and arrange a conversation about your business.</p><a className="nova-home-button" href="/service-request">Open the booking assistant <span>→</span></a></div><ol className="nova-workflow-list"><li><span>01</span><div><h3>Tell us what needs attention</h3><p>Choose the system you want to improve and share the details that matter.</p></div></li><li><span>02</span><div><h3>Choose your next step</h3><p>Book a published phone appointment or ask Nova to arrange a time with you.</p></div></li><li><span>03</span><div><h3>See what was completed</h3><p>Get a saved request reference, your appointment result and a clear record of the next action.</p></div></li></ol></div></section>
    <section id="pilot" className="nova-home-section nova-pilot"><div><p className="nova-kicker">FOR BUSINESSES READY TO SIMPLIFY</p><h2>Start with one<br /><em>real task.</em></h2><p>A useful system starts with a specific job. Tell us where customers or your team get stuck, and we’ll work through the right scope with you.</p></div><div className="nova-pilot-card"><span className="nova-pilot-dot" /> <p className="nova-kicker">NOVA SYSTEMS · CONNECTICUT</p><h3>Your workflow.<br />Built around your business.</h3><p>Customer intake, appointments and follow-up—starting with the next step you need.</p><a className="nova-home-button" href="/service-request">Tell Nova what you need <span>→</span></a><a className="nova-pilot-contact" href="mailto:isaac@nova-systems.app">isaac@nova-systems.app</a></div></section>
    <section id="industries" className="nova-home-section">
      <div className="nova-section-heading"><p className="nova-kicker">INDUSTRIES</p><h2>Systems for<br/><em>the work you do.</em></h2></div>
      <div className="nova-services-grid">
        {[
          ['Home services','Route service requests and give the crew one place to check follow-up.'],
          ['Auto repair','Collect vehicle details and connect repair inquiries to the appointment queue.'],
          ['Professional services','Organize inquiries, consultations and the next action for each client.'],
        ].map(([title,body])=><article className="nova-service-card" key={title}><h3>{title}</h3><p>{body}</p></article>)}
      </div>
    </section>
    <section id="faq" className="nova-home-section nova-faq"><div><p className="nova-kicker">BEFORE WE GET STARTED</p><h2>A few<br /><em>good questions.</em></h2></div><div>{questions.map(([q,a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
  </main><Footer /></div>;
}
