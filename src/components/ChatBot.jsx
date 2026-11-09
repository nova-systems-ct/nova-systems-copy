import { useState } from 'react';
import { MessageCircle, X, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// One public entry point uses the real CRM/booking worker, rather than a disconnected lead script.
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  if (pathname.startsWith('/dashboard') || pathname === '/login') return null;
  return <aside aria-label="Nova customer assistant" style={{position:'fixed',right:20,bottom:20,zIndex:45}}>
    {open && <section id="nova-assistant-panel" style={{width:'min(340px, calc(100vw - 40px))',padding:25,marginBottom:14,border:'1px solid #c9a84c66',borderRadius:16,background:'#10100f',boxShadow:'0 15px 60px #0009',color:'#f4f0e5'}}>
      <p style={{color:'#d5b96c',fontSize:10,letterSpacing:'.18em',marginBottom:12}}>NOVA SYSTEMS</p>
      <h2 style={{fontSize:24,lineHeight:1.15,margin:'0 0 12px'}}>What needs attention?</h2>
      <p style={{color:'#b5ae9f',fontSize:13,lineHeight:1.7}}>Tell Nova about your business, choose a published phone appointment and get a saved request reference.</p>
      <a href="/service-request" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,background:'#d5b96c',color:'#10100f',padding:'13px 15px',borderRadius:7,fontSize:12,fontWeight:800,marginTop:20,textDecoration:'none'}}>Open booking assistant <ArrowRight size={16}/></a>
      <p style={{fontSize:11,color:'#938b7b',lineHeight:1.7,marginTop:14}}>No published time that suits you? Send your request and Nova will arrange a time.</p>
    </section>}
    <button type="button" aria-label={open?'Close assistant':'Open Nova assistant'} aria-expanded={open} aria-controls="nova-assistant-panel" onClick={()=>setOpen(!open)} style={{marginLeft:'auto',display:'flex',alignItems:'center',justifyContent:'center',width:56,height:56,borderRadius:'50%',border:0,background:'linear-gradient(135deg,#8a6b2a,#e0c476)',color:'#100e08',boxShadow:'0 5px 24px #c9a84c30',cursor:'pointer'}}>{open?<X size={22}/>:<MessageCircle size={22}/>}</button>
  </aside>;
}
