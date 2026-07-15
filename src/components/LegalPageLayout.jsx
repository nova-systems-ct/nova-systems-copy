import React from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import novaLogo from "@/assets/nova logo.png";
import { useSEO } from "@/hooks/useSEO";
import { generateLegalPDF } from "@/utils/generatePdf";

const GOLD = "#D4A030";

export default function LegalPageLayout({ title, effectiveDate, sections, seoDescription }) {
  useSEO({ title: `${title} — Nova Systems`, description: seoDescription });

  const downloadPdf = () => {
    const doc = generateLegalPDF({ title, effectiveDate, sections });
    doc.save(`Nova-Systems-${title.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={novaLogo} alt="Nova Systems" className="h-7 w-7 object-contain" />
            <span className="text-xs font-black tracking-[0.2em] uppercase">Nova Systems</span>
          </Link>
          <button
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-[0.1em] uppercase rounded-md border border-black/15 hover:bg-black hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Download as PDF
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-black mb-2">{title}</h1>
        <p className="text-sm text-black/45 mb-12">Effective Date: {effectiveDate}</p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold mb-3">{s.heading}</h2>
              <p className="text-sm leading-relaxed text-black/70 whitespace-pre-line">{s.body}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-black/10 mt-4">
        <div className="max-w-3xl mx-auto px-6 py-10 text-xs text-black/45 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>Nova Systems &middot; Waterbury, Connecticut</span>
          <span>
            Questions? <a href="mailto:hello@nova-systems.app" style={{ color: GOLD }}>hello@nova-systems.app</a> &middot; (203) 706-0504
          </span>
        </div>
      </footer>
    </div>
  );
}
