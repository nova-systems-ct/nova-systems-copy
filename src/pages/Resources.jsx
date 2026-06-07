import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { Clock, ArrowRight, TrendingUp, ArrowLeft } from "lucide-react";
import { articles } from "@/lib/articles";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const categories = ["All", "Revenue Leaks", "Case Studies", "Guides", "Automation"];

export default function Resources() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");

  const featured = articles.find((p) => p.featured);
  const filtered = activeCategory === "All"
    ? articles.filter((p) => !p.featured)
    : articles.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 50% 70%, rgba(212,160,48,0.08) 0%, transparent 60%)"
          }} />
          <div className="max-w-4xl mx-auto relative">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-10 text-xs transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="text-center">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
                RESOURCES <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
              </p>
              <h1 className="text-5xl md:text-6xl font-black text-white leading-[0.95] mb-5">
                Stop guessing.<br />
                <span style={{
                  background: `linear-gradient(90deg, ${GOLD} 0%, #C8921A 50%, ${GOLD} 100%)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>Start knowing.</span>
              </h1>
              <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
                Guides, case studies, and revenue intelligence for local businesses that refuse to leave money on the table.
              </p>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="px-6 pb-10 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="px-5 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-full transition-all"
                style={activeCategory === cat
                  ? { background: GOLD_GRADIENT, color: "#0a0800" }
                  : { border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }
                }>
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Featured Post */}
        {activeCategory === "All" && featured && (
          <section className="py-14 px-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="max-w-6xl mx-auto">
              <p className="text-[9px] tracking-[0.35em] uppercase mb-6" style={{ color: GOLD }}>FEATURED</p>
              <Link to={`/resources/${featured.slug}`} className="block no-underline"
                style={{ textDecoration: "none" }}>
                <div className="rounded-2xl p-10 md:p-14 relative overflow-hidden transition-all hover:scale-[1.005] cursor-pointer"
                  style={{ background: "rgba(212,160,48,0.05)", border: `1px solid ${GOLD}25` }}>
                  <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at top right, ${GOLD}10 0%, transparent 70%)` }} />
                  <div className="relative grid md:grid-cols-2 gap-10 items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-5">
                        <span className="text-[9px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full"
                          style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}35` }}>
                          {featured.tag}
                        </span>
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                          <Clock className="w-3 h-3" /> {featured.readTime}
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-white mb-4 leading-snug">{featured.title}</h2>
                      <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>{featured.excerpt}</p>
                      <span className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                        style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
                        READ CASE STUDY <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="rounded-xl p-8 text-center"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-[9px] tracking-[0.25em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>KEY RESULT</p>
                      <p className="text-3xl font-black mb-2" style={{ color: GOLD }}>{featured.result}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Pinnacle Heating & Cooling · Q1 2025</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Posts Grid */}
        <section className="py-14 px-6">
          <div className="max-w-6xl mx-auto">
            {activeCategory !== "All" && (
              <p className="text-[9px] tracking-[0.35em] uppercase mb-8" style={{ color: GOLD }}>
                {activeCategory.toUpperCase()} — {filtered.length} ARTICLE{filtered.length !== 1 ? "S" : ""}
              </p>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((post) => (
                <Link key={post.slug} to={`/resources/${post.slug}`}
                  className="rounded-xl p-7 flex flex-col cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none" }}>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[9px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full"
                      style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}25` }}>
                      {post.tag}
                    </span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                      <Clock className="w-3 h-3" /> {post.readTime}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white leading-snug mb-3 flex-1">{post.title}</h3>
                  <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {post.excerpt.slice(0, 120)}...
                  </p>
                  {post.result && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
                      style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
                      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                      <span className="text-[10px] font-semibold" style={{ color: GOLD }}>{post.result}</span>
                    </div>
                  )}
                  <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase mt-auto"
                    style={{ color: GOLD }}>
                    READ MORE <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>READY TO FIX YOUR LEAKS?</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">See how much revenue you're losing.</h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a free 30-minute call and we'll run a live revenue leak audit on your business.
            </p>
            <Link to="/book-demo"
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              BOOK A FREE AUDIT <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
