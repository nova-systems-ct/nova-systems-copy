import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import NovaLogo from "@/components/NovaLogo";
import { useSEO } from "@/hooks/useSEO";
import { generateLegalPDF } from "@/utils/generatePdf";

const GOLD = "#C9A84C";

export default function LegalPageLayout({ title, effectiveDate, sections, seoDescription }) {
  useSEO({ title: `${title} — Nova Systems`, description: seoDescription });

  const downloadPdf = () => {
    const doc = generateLegalPDF({ title, effectiveDate, sections });
    doc.save(`Nova-Systems-${title.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
  };

  return (
    <div className="nova-legal min-h-screen bg-white text-black">
      <style>{`@media print { .nova-legal button { display:none !important; } .nova-legal section { break-inside:avoid; } .nova-legal main { padding-top:24px; padding-bottom:24px; } }`}</style>
      <header className="border-b border-black/10" style={{ borderTop: `2px solid ${GOLD}` }}>
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <NovaLogo size={28} surface="light" />
            <span className="text-xs font-black tracking-[0.2em] uppercase">Nova Systems</span>
          </Link>
          <button
            onClick={downloadPdf}
            type="button"
            className="inline-flex min-h-11 items-center gap-2 px-4 py-2 text-xs font-medium rounded-md border border-black/15 hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download as PDF
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight mb-3">{title}</h1>
        <p className="text-sm text-black/45 mb-12">Effective Date: {effectiveDate}</p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold mb-3">{s.heading}</h2>
              <p className="text-sm leading-relaxed text-black/70 whitespace-pre-line">{s.body}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-black/10 mt-4">
        <div className="max-w-3xl mx-auto px-6 py-10 text-xs text-black/45 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>Nova Systems &middot; Waterbury, Connecticut</span>
          <span>
            Questions? <a href="mailto:isaac@nova-systems.app" className="underline underline-offset-4" style={{ color: '#756019' }}>isaac@nova-systems.app</a> &middot; (203) 706-0504
          </span>
        </div>
      </footer>
    </div>
  );
}
