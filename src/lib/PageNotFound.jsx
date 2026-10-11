import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NAVY, GOLD, GOLD_GRADIENT } from '@/lib/theme';

// Rebuilt 2026-09-20 — this was still base44 scaffolding boilerplate (light slate theme, an
// import of a dead no-op auth stub at src/api/client.js whose "Admin Note" branch could never
// actually fire since that stub's auth.me() always resolved to null, and copy telling a real
// visitor to "ask the AI to implement it in the chat"). Removed the dead import along with it —
// nothing else referenced src/api/client.js.
export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.slice(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: NAVY }}>
      <div className="max-w-md w-full text-center">
        <p className="font-black" style={{ fontSize: '6rem', lineHeight: 1, color: 'rgba(255,255,255,0.12)' }}>404</p>
        <h1 className="text-2xl font-bold text-white mt-2 mb-3">Page Not Found</h1>
        <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {pageName ? <>The page <span style={{ color: 'rgba(255,255,255,0.6)' }}>"/{pageName}"</span> doesn't exist.</> : "That page doesn't exist."}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-85"
          style={{ background: GOLD_GRADIENT, color: '#0a0800' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Nova Systems
        </Link>
      </div>
    </div>
  );
}
