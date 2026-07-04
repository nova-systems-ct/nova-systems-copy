import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageNotFound from "../lib/PageNotFound";
import { useSEO } from "@/hooks/useSEO";
import { Link2, Linkedin, Twitter, ArrowRight, Clock, Loader2 } from "lucide-react";
import { CATEGORIES, readTime } from "./Insights";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;
const REAL_CATEGORIES = CATEGORIES.filter((c) => c !== "All");

export default function InsightPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(undefined);
  const [related, setRelated] = useState([]);
  const [copied, setCopied] = useState(false);

  useSEO({
    title: post ? `${post.title} — Nova Insights` : "Nova Insights",
    description: post?.seo_description || post?.excerpt || "Digital architecture, AI strategy, and growth intelligence for Connecticut businesses.",
  });

  useEffect(() => {
    setPost(undefined);
    fetch(`/api/client?resource=blog&op=posts&slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        setPost(data || null);
        if (data?.category) {
          fetch("/api/client?resource=blog&op=posts")
            .then((r) => r.json())
            .then((all) => setRelated(
              (Array.isArray(all) ? all : [])
                .filter((p) => p.category === data.category && p.slug !== slug)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 3)
            ));
        }
      })
      .catch(() => setPost(null));
  }, [slug]);

  if (post === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (post === null) return <PageNotFound />;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">

        {/* Dark header */}
        <section className="py-16 px-6 border-b relative overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(212,160,48,0.08) 0%, transparent 60%)" }} />
          <div className="max-w-4xl mx-auto relative">
            <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 20, background: `${post.thumbnail_color || GOLD}20`, color: GOLD, border: `1px solid ${GOLD}40`, marginBottom: 20 }}>
              {post.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span>By <strong style={{ color: "rgba(255,255,255,0.75)" }}>{post.author || "Isaac Nova"}</strong>, Founder Nova Systems</span>
              <span>·</span>
              <span>{post.created_at ? new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {readTime(post.content)} min read</span>
            </div>
          </div>
        </section>

        {/* Two-column body */}
        <section className="py-14 px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[65%_35%] gap-12">

            {/* Main content — 65% */}
            <article>
              <div className="prose prose-invert max-w-none" style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, lineHeight: 1.9 }}>
                <ReactMarkdown
                  components={{
                    h1: (p) => <h2 style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 16 }} className="text-2xl font-black text-white mt-12 mb-5" {...p} />,
                    h2: (p) => <h2 style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 16 }} className="text-2xl font-black text-white mt-12 mb-5" {...p} />,
                    h3: (p) => <h3 style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 16 }} className="text-xl font-bold text-white mt-10 mb-4" {...p} />,
                    p:  (p) => <p className="mb-5" {...p} />,
                    ul: (p) => <ul className="list-disc pl-6 mb-5 space-y-2" {...p} />,
                    ol: (p) => <ol className="list-decimal pl-6 mb-5 space-y-2" {...p} />,
                    strong: (p) => <strong style={{ color: "#fff" }} {...p} />,
                    a: (p) => <a style={{ color: GOLD }} target="_blank" rel="noreferrer" {...p} />,
                    blockquote: (p) => (
                      <blockquote
                        style={{ background: `${GOLD}0d`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8, padding: "20px 24px", margin: "32px 0", fontStyle: "italic", color: "#fff", fontSize: 18, lineHeight: 1.6 }}
                        {...p}
                      />
                    ),
                  }}
                >
                  {post.content || ""}
                </ReactMarkdown>
              </div>

              {/* Share buttons */}
              <div className="flex items-center gap-3 mt-12 pt-8 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Share:</span>
                <ShareBtn onClick={copyLink}><Link2 className="w-4 h-4" />{copied ? "Copied!" : ""}</ShareBtn>
                <ShareBtn as="a" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer"><Linkedin className="w-4 h-4" /></ShareBtn>
                <ShareBtn as="a" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noreferrer"><Twitter className="w-4 h-4" /></ShareBtn>
              </div>

              {/* CTA box */}
              <div className="mt-12 rounded-2xl p-8 md:p-10 text-center" style={{ background: "linear-gradient(135deg, rgba(212,160,48,0.12) 0%, rgba(0,0,0,0.3) 100%)", border: `1px solid ${GOLD}40` }}>
                <h3 className="text-xl md:text-2xl font-black text-white mb-3">Ready to apply this to your business?</h3>
                <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.45)" }}>Book a free strategy meeting and we'll map out exactly what your business needs.</p>
                <Link to="/welcome" className="inline-flex items-center gap-2 text-sm font-bold tracking-wider uppercase px-8 py-4 rounded-lg hover:opacity-85 transition-all" style={{ background: G, color: "#0a0800" }}>
                  BOOK A FREE STRATEGY MEETING <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>

            {/* Sidebar — 35% */}
            <aside className="space-y-6">
              {/* Author card */}
              <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black mb-4" style={{ background: G, color: "#0a0800" }}>IN</div>
                <p className="text-white font-bold text-sm mb-0.5">Isaac Nova</p>
                <p className="text-xs mb-4" style={{ color: GOLD }}>Founder, Nova Systems</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Isaac Nova is the founder of Nova Systems, a Connecticut-based AI and technology company serving businesses across CT.
                </p>
              </div>

              {/* Related articles */}
              {related.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>Related Insights</p>
                  <div className="space-y-4">
                    {related.map((r) => (
                      <Link key={r.id} to={`/insights/${r.slug}`} className="block group">
                        <p className="text-sm font-semibold text-white leading-snug group-hover:text-[#D4A030] transition-colors">{r.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>Categories</p>
                <div className="space-y-2">
                  {REAL_CATEGORIES.map((cat) => (
                    <Link key={cat} to={`/insights?category=${encodeURIComponent(cat)}`}
                      className="block text-sm transition-colors hover:text-white"
                      style={{ color: cat === post.category ? GOLD : "rgba(255,255,255,0.5)", fontWeight: cat === post.category ? 700 : 400 }}>
                      {cat}
                    </Link>
                  ))}
                </div>
              </div>

              {/* CTA card */}
              <div className="rounded-2xl p-6 text-center" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}>
                <p className="text-white font-bold text-sm mb-2">Ready to build something real?</p>
                <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>Free 30-minute strategy meeting. No obligation.</p>
                <Link to="/welcome" className="inline-flex items-center justify-center gap-2 w-full text-xs font-bold tracking-wider uppercase px-5 py-3 rounded-lg hover:opacity-85 transition-all" style={{ background: G, color: "#0a0800" }}>
                  BOOK A FREE MEETING <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </aside>

          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ShareBtn({ as: Comp = "button", children, ...props }) {
  return (
    <Comp
      {...props}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", textDecoration: "none", fontFamily: "inherit" }}
    >
      {children}
    </Comp>
  );
}
