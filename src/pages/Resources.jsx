import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { BookOpen, FileText, TrendingUp, ChevronRight, ArrowRight, Clock } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #F0C040 55%, ${GOLD} 80%, #8a6200 100%)`;

const categories = ["All", "Revenue Leaks", "Case Studies", "Guides", "Automation"];

const posts = [
  {
    category: "Case Studies",
    tag: "CASE STUDY",
    title: "How a Connecticut HVAC Company Recovered $84K in One Quarter",
    excerpt: "Pinnacle Heating & Cooling was answering roughly 60% of inbound calls. The other 40% were gone. Nova Systems deployed AI call handling and Nova Pulse monitoring — and the results changed everything.",
    readTime: "6 min read",
    result: "+$84,000 revenue recovered",
    featured: true,
  },
  {
    category: "Revenue Leaks",
    tag: "REVENUE LEAKS",
    title: "The $50,000 Mistake: What Happens When You Miss 5 Calls Per Day",
    excerpt: "If your business misses just 5 calls per day with an average ticket of $200, you're walking away from over $50,000 per year. And that's before counting the compounding effect of those customers going to your competitor.",
    readTime: "4 min read",
    result: null,
    featured: false,
  },
  {
    category: "Guides",
    tag: "GUIDE",
    title: "The Local Business Revenue Leak Audit: A 10-Point Checklist",
    excerpt: "Before you can fix a revenue leak, you need to know where it is. This 10-point checklist walks through every point of failure in the typical local business sales process — from first contact to closed deal.",
    readTime: "8 min read",
    result: null,
    featured: false,
  },
  {
    category: "Revenue Leaks",
    tag: "REVENUE LEAKS",
    title: "Why Local Service Businesses Lose 30% of Revenue to Slow Follow-Up",
    excerpt: "Leads contacted within 5 minutes are 21x more likely to convert than those contacted after 30 minutes. Most local businesses respond in hours — or not at all. Here's what's actually happening and how to fix it.",
    readTime: "5 min read",
    result: null,
    featured: false,
  },
  {
    category: "Case Studies",
    tag: "CASE STUDY",
    title: "Luxe Realty: From 22% to 67% Lead Conversion in 60 Days",
    excerpt: "Luxe Realty had a lead problem — not a traffic problem. Leads were coming in but follow-up was inconsistent and manual. Nova Systems rebuilt their CRM pipeline and automated every touchpoint.",
    readTime: "7 min read",
    result: "22% to 67% conversion rate",
    featured: false,
  },
  {
    category: "Automation",
    tag: "AUTOMATION",
    title: "5 Follow-Up Automations Every Local Business Needs Right Now",
    excerpt: "Manual follow-up is killing your close rate. Here are the five automation workflows that Nova Systems implements for every client — and how to build them for your specific business.",
    readTime: "6 min read",
    result: null,
    featured: false,
  },
  {
    category: "Revenue Leaks",
    tag: "REVENUE LEAKS",
    title: "5 Signs Your Business Is Losing Revenue Without Knowing It",
    excerpt: "Revenue leaks are invisible by design. By the time you notice your close rate is down, the leads are already gone. These five warning signs appear before the revenue disappears — here's how to spot them.",
    readTime: "4 min read",
    result: null,
    featured: false,
  },
  {
    category: "Guides",
    tag: "GUIDE",
    title: "How to Choose the Right CRM for a Local Service Business",
    excerpt: "Most CRMs are built for enterprise sales teams — not for HVAC companies, med spas, or law firms. This guide breaks down what matters for local service businesses and how to avoid expensive implementation mistakes.",
    readTime: "9 min read",
    result: null,
    featured: false,
  },
];

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState("All");

  const featured = posts.find((p) => p.featured);
  const filtered = activeCategory === "All"
    ? posts.filter((p) => !p.featured)
    : posts.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0" style={{
            background: "radial-gradient(ellipse at 50% 70%, rgba(212,160,48,0.08) 0%, transparent 60%)"
          }} />
          <div className="max-w-4xl mx-auto relative text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>
              RESOURCES <span className="inline-block w-8 h-px align-middle ml-2" style={{ background: GOLD }} />
            </p>
            <h1 className="text-5xl md:text-6xl font-black text-white leading-[0.95] mb-5">
              Stop guessing.<br />
              <span style={{
                background: `linear-gradient(90deg, ${GOLD} 0%, #F0C040 50%, ${GOLD} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Start knowing.</span>
            </h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Guides, case studies, and revenue intelligence for local businesses that refuse to leave money on the table.
            </p>
          </div>
        </section>

        {/* Category Filter */}
        <section className="px-6 pb-10 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-5 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-full transition-all"
                style={activeCategory === cat
                  ? { background: GOLD_GRADIENT, color: "#0a0800" }
                  : { border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }
                }
              >
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
              <div
                className="rounded-2xl p-10 md:p-14 relative overflow-hidden transition-all hover:scale-[1.005] cursor-pointer"
                style={{ background: "rgba(212,160,48,0.05)", border: `1px solid ${GOLD}25` }}
              >
                <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none" style={{
                  background: `radial-gradient(ellipse at top right, ${GOLD}10 0%, transparent 70%)`
                }} />
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
                    <button
                      className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
                      style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
                    >
                      READ CASE STUDY <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="rounded-xl p-8 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[9px] tracking-[0.25em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>KEY RESULT</p>
                    <p className="text-3xl font-black mb-2" style={{ color: GOLD }}>{featured.result}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Pinnacle Heating &amp; Cooling · Q1 2025</p>
                  </div>
                </div>
              </div>
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
                <div
                  key={post.title}
                  className="rounded-xl p-7 flex flex-col cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
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
                  <button
                    className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase mt-auto"
                    style={{ color: GOLD }}
                  >
                    READ MORE <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.012)" }}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>READY TO FIX YOUR LEAKS?</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">See how much revenue you're losing.</h2>
            <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Book a free 30-minute call and we'll run a live revenue leak audit on your business.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
            >
              BOOK A FREE AUDIT <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
