import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Clock, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

export const CATEGORIES = ["All", "AI & Technology", "Connecticut Business", "Websites & SEO", "Social Media", "Branding & Identity", "Case Studies", "Tips & Strategy"];

export function readTime(content) {
  const words = (content || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso, opts) {
  return iso ? new Date(iso).toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" }) : "";
}

export default function Insights() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "All";

  useSEO({
    title: "Nova Insights — AI and Business Growth Strategies for Connecticut",
    description: "Digital architecture, AI strategy, and growth intelligence for Connecticut businesses — from Nova Systems, Waterbury CT's AI and technology agency.",
  });

  useEffect(() => {
    fetch("/api/client?resource=blog&op=posts")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const setCategory = (cat) => {
    if (cat === "All") setSearchParams({});
    else setSearchParams({ category: cat });
  };

  const featured = posts[0];
  const rest = activeCategory === "All" ? posts.slice(1) : posts.filter((p) => p.category === activeCategory);
  const showFeatured = activeCategory === "All" && featured;

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Header */}
        <section className="py-20 px-6 border-b relative overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,160,48,0.09) 0%, transparent 60%)" }} />
          <div className="max-w-6xl mx-auto relative text-center">
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 16 }}>INTELLIGENCE FOR CONNECTICUT BUSINESS</p>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4" style={{ color: GOLD }}>Nova Insights</h1>
            <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Intelligence for Connecticut businesses ready to grow.
            </p>
          </div>
        </section>

        {/* Category tabs */}
        <section className="px-6 pt-10 pb-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-center pb-8">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{
                  padding: "9px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                  borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  background: activeCategory === cat ? GOLD : "rgba(255,255,255,0.05)",
                  color: activeCategory === cat ? "#0a0800" : "rgba(255,255,255,0.5)",
                  border: `1px solid ${activeCategory === cat ? GOLD : "rgba(255,255,255,0.1)"}`,
                }}>
                {cat}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="py-16 px-6">
            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
              {[0, 1, 2].map((i) => <div key={i} className="rounded-2xl animate-pulse" style={{ height: 340, background: "rgba(255,255,255,0.03)" }} />)}
            </div>
          </section>
        ) : posts.length === 0 ? (
          <section className="py-24 px-6 text-center">
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No insights published yet — check back soon.</p>
          </section>
        ) : (
          <>
            {showFeatured && (
              <section className="py-14 px-6">
                <div className="max-w-6xl mx-auto">
                  <FeaturedCard post={featured} />
                </div>
              </section>
            )}

            <section className="py-14 px-6">
              <div className="max-w-6xl mx-auto">
                {rest.length === 0 ? (
                  <div className="text-center py-16">
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No articles in this category yet — check back soon.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {rest.map((post) => <PostCard key={post.id} post={post} />)}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function FeaturedCard({ post }) {
  return (
    <Link to={`/insights/${post.slug}`} className="block rounded-2xl overflow-hidden relative transition-all duration-300 hover:opacity-95"
      style={{ background: "linear-gradient(135deg, rgba(212,160,48,0.08) 0%, #0a0a0a 65%)", border: `1px solid ${GOLD}35` }}>
      <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none" style={{ background: `radial-gradient(circle, ${GOLD}14 0%, transparent 70%)` }} />
      <div className="relative p-8 md:p-14">
        <div className="flex items-center gap-3 mb-6">
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 20, background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}45` }}>
            {post.category}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>FEATURED</span>
        </div>
        <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-5 max-w-3xl">{post.title}</h2>
        <p className="text-sm md:text-base leading-relaxed mb-8 max-w-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>{post.excerpt}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: G, color: "#0a0800" }}>IN</div>
            <div>
              <p className="text-xs font-bold text-white">{post.author || "Isaac Nova"}</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{formatDate(post.created_at, { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-bold tracking-[0.15em] uppercase rounded-lg ml-auto" style={{ background: G, color: "#0a0800" }}>
            READ MORE <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }) {
  return (
    <Link to={`/insights/${post.slug}`} className="group block rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: "#fdfcfa", border: "1px solid transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.boxShadow = `0 12px 40px ${GOLD}20`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ height: 6, background: post.thumbnail_color || GOLD }} />
      <div className="p-6">
        <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 12 }}>
          {post.category}
        </span>
        <h3 className="font-bold text-lg leading-snug mb-3" style={{ color: "#0a0a0a" }}>{post.title}</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#6b6b6b" }}>{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs pt-4" style={{ color: "#9a9a9a", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <span>{post.author || "Isaac Nova"} · {formatDate(post.created_at)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {readTime(post.content)} min</span>
        </div>
      </div>
    </Link>
  );
}
