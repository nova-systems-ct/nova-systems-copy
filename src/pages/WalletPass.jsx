import {Link} from 'react-router-dom';
import {ArrowLeft,Wallet} from 'lucide-react';
import {useSEO} from '@/hooks/useSEO';
import NovaBrand from '@/components/NovaBrand';
import '@/styles/NovaLuxe.css';

export default function WalletPass() {
  useSEO({title:'Nova Wallet setup pass',description:'Install the signed Nova Systems setup pass on your iPhone.'});
  return (
    <main className="luxe-page" style={{maxWidth:640,margin:'auto',minHeight:'100vh'}}>
      <Link className="luxe-link" to="/"><ArrowLeft size={16}/>Nova Systems</Link>
      <section className="luxe-panel" style={{marginTop:26,padding:36}}>
        <NovaBrand compact/>
        <img src="/nova-studio/nova-mark.jpg" alt="Nova Systems gold emblem" style={{width:'100%',borderRadius:12,margin:'24px 0'}}/>
        <h1 style={{fontSize:32,marginBottom:10}}>Nova Wallet setup pass</h1>
        <p style={{color:'#c8c0b3',lineHeight:1.7}}>Open this page in Safari on your iPhone. Download the signed setup pass, then tap Add when Wallet shows the card.</p>
        <a className="luxe-button" style={{marginTop:22}} href="/wallet/nova-setup-test.pkpass"><Wallet size={17}/>Download setup pass</a>
        <p style={{color:'#a39b8a',fontSize:13,marginTop:18}}>Installation test · No cash or reward value.</p>
      </section>
    </main>
  );
}
