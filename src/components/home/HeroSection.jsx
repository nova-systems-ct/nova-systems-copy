import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ArrowUpRight,ChevronDown,ChevronLeft,ChevronRight,Menu,X} from 'lucide-react';
import NovaBrand from '../NovaBrand';
import './HeroReference.css';

const slides=[
  {
    eyebrow:'Nova Systems',
    title:'The work behind your business.',
    emphasis:'Handled.',
    lines:['Customers answered.','Appointments organized.','Follow-up done, and you can see it.'],
    cta:'Tell us what needs handling',
  },
  {
    eyebrow:'Customer care and scheduling',
    title:'Every customer answered.',
    emphasis:'Every visit on the calendar.',
    lines:['Give customers a clear next step.','Keep booking and follow-up together.','See the work as it happens.'],
    cta:'Request customer care',
  },
  {
    eyebrow:'Marketing',
    title:'Reach the right people.',
    emphasis:'Follow the result.',
    lines:['Start with a defined audience.','Prepare the message and the next action.','Track what each opportunity becomes.'],
    cta:'Plan your next step',
  },
];

export function NovaHomeNavigation() {
  const [open,setOpen]=useState(false);
  return (
    <nav className="nova-reference-nav" aria-label="Main navigation">
      <Link to="/" className="nova-reference-brand" aria-label="Nova Systems home">
        <NovaBrand compact/>
      </Link>
      <button className="nova-reference-menu" type="button" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>
        {open?<X size={24}/>:<Menu size={24}/>}
      </button>
      <div className={'nova-reference-nav-links'+(open?' is-open':'')}>
        <Link to="/services" onClick={()=>setOpen(false)}>Services</Link>
        <a href="/#workflow" onClick={()=>setOpen(false)}>How it works</a>
        <details>
          <summary>Industries <ChevronDown size={13}/></summary>
          <div className="nova-industry-menu">
            <a href="/#industries" onClick={()=>setOpen(false)}>Home services</a>
            <a href="/#industries" onClick={()=>setOpen(false)}>Auto repair</a>
            <a href="/#industries" onClick={()=>setOpen(false)}>Professional services</a>
          </div>
        </details>
        <Link to="/insights" onClick={()=>setOpen(false)}>Journal</Link>
        <Link to="/login" className="nova-reference-mobile-signin">Sign in <ArrowUpRight size={13}/></Link>
      </div>
      <div className="nova-reference-nav-actions">
        <Link to="/login">Sign in <ArrowUpRight size={13}/></Link>
        <a className="nova-reference-outline" href="/service-request">Request a service <span><ArrowRight size={18}/></span></a>
      </div>
    </nav>
  );
}

export default function HeroSection() {
  const [index,setIndex]=useState(0);
  const slide=slides[index];
  const move=offset=>setIndex(current=>(current+offset+slides.length)%slides.length);
  return (
    <>
      <section className="nova-reference-hero" aria-label="Experience Nova">
        <div className="nova-reference-scene" aria-hidden="true">
          <img src="/nova-studio/gold-network.jpg" alt="" fetchPriority="high"/>
        </div>
        <div className="nova-reference-hero-copy" aria-live="polite">
          <p className="nova-reference-eyebrow">{slide.eyebrow}</p>
          <h1>{slide.title}<br/><em>{slide.emphasis}</em></h1>
          <p className="nova-reference-hero-description">{slide.lines.map(line=><span key={line}>{line}</span>)}</p>
          <div className="nova-reference-hero-actions">
            <a className="nova-reference-outline" href="/service-request">{slide.cta}<span><ArrowRight size={19}/></span></a>
            <a className="nova-reference-hero-secondary" href="#services">See the services <ArrowRight size={16}/></a>
          </div>
          <p className="nova-reference-time">Online and in person · 48–72 hours after scope and inputs are confirmed.</p>
        </div>
        <div className="nova-reference-carousel" aria-label="Nova services carousel">
          <button type="button" aria-label="Previous service" onClick={()=>move(-1)}><ChevronLeft size={21}/></button>
          <span aria-label={`Service ${index+1} of ${slides.length}`}>0{index+1} / 03</span>
          <span className="nova-reference-progress" aria-hidden="true"><span style={{width:`${(index+1)/slides.length*100}%`}}/></span>
          <button type="button" aria-label="Next service" onClick={()=>move(1)}><ChevronRight size={21}/></button>
        </div>
      </section>
      <section className="nova-reference-pillars" aria-label="Nova services">
        {[
          ['Intelligence','The Nova Audit','Evidence before recommendations.','#services'],
          ['Execution','Agents & Revive','Intake, booking and follow-up that get done.','#workflow'],
          ['Opportunity','Nova Demand','A measurable path to new opportunities.','#pilot'],
        ].map(([label,title,description,link])=>(
          <a href={link} key={title}>
            <p className="nova-reference-eyebrow">{label}</p>
            <h2>{title}<ArrowRight size={25}/></h2>
            <p>{description}</p>
          </a>
        ))}
      </section>
    </>
  );
}
