import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Clock, ChevronRight } from "lucide-react";
import { articles } from "@/lib/articles";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export default function Article() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="min-h-screen flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-white/40 mb-4">Article not found.</p>
            <button onClick={() => navigate("/resources")}
              className="text-sm" style={{ color: GOLD }}>Back to Resources</button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const others = articles.filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="py-16 px-6 border-b relative overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,160,48,0.07) 0%, transparent 60%)" }} />
          <div className="max-w-3xl mx-auto relative">
            <button onClick={() => navigate("/resources")}
              className="flex items-center gap-2 mb-8 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back to Resources
            </button>

            <div className="flex items-center gap-3 mb-5">
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full"
                style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}35` }}>
                {article.tag}
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                <Clock className="w-3 h-3" /> {article.readTime}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-6">{article.title}</h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)", maxWidth: 600 }}>{article.excerpt}</p>

            {article.result && (
              <div className="inline-flex items-center gap-3 mt-6 px-5 py-3 rounded-xl"
                style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
                <span className="text-sm font-bold" style={{ color: GOLD }}>{article.result}</span>
              </div>
            )}
          </div>
        </section>

        {/* Article body */}
        <section className="py-14 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="prose-like space-y-10">
              {article.content.map(({ heading, body }) => (
                <div key={heading}>
                  <h2 className="text-lg font-black text-white mb-3"
                    style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 14 }}>
                    {heading}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)", paddingLeft: 17 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-14 rounded-2xl p-8 md:p-10 text-center"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
              <p className="text-[9px] tracking-[0.35em] uppercase mb-3" style={{ color: GOLD }}>READY TO FIX YOUR LEAKS?</p>
              <h3 className="text-2xl font-black text-white mb-3">See your numbers in a free audit.</h3>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                Isaac will personally review your business and show you exactly where revenue is escaping.
              </p>
              <Link to="/book-demo"
                className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.18em] uppercase transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                BOOK A FREE DEMO <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* More articles */}
        {others.length > 0 && (
          <section className="py-12 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="max-w-3xl mx-auto">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-8" style={{ color: GOLD }}>MORE ARTICLES</p>
              <div className="grid md:grid-cols-3 gap-4">
                {others.map((a) => (
                  <Link key={a.slug} to={`/resources/${a.slug}`}
                    className="rounded-xl p-5 block transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none" }}>
                    <span className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full mb-3 inline-block"
                      style={{ background: `${GOLD}15`, color: GOLD }}>
                      {a.tag}
                    </span>
                    <p className="text-sm font-black text-white leading-snug mt-2">{a.title}</p>
                    <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <Clock className="w-3 h-3" /> {a.readTime}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
      <Footer />
    </div>
  );
}
