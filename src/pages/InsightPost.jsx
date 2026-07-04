import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageNotFound from "../lib/PageNotFound";
import { useSEO } from "@/hooks/useSEO";
import { Link2, Linkedin, Twitter, ArrowRight, Clock, Loader2 } from "lucide-react";

const GOLD = "#D4A030";
const G = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

function readTime(content) {
  const words = (content || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

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
            .then((all) => setRelated((Array.isArray(all) ? all : []).filter((p) => p.category === data.category && p.slug !== slug).slice(0, 3)));
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
        <article className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 20, background: `${post.thumbnail_color || GOLD}18`, color: post.thumbnail_color || GOLD, border: `1px solid ${post.thumbnail_color || GOLD}40` }}>
                {post.category}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">{post.title}</h1>

            <div className="flex items-center gap-4 text-sm mb-10 pb-8 border-b" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
              <span>By <strong style={{ color: "rgba(255,255,255,0.7)" }}>{post.author || "Isaac Nova"}</strong></span>
              <span>·</span>
              <span>{post.created_at ? new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {readTime(post.content)} min read</span>
            </div>

            <div className="prose prose-invert max-w-none" style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, lineHeight: 1.85 }}>
              <ReactMarkdown
                components={{
                  h1: (p) => <h2 className="text-2xl font-black text-white mt-10 mb-4" {...p} />,
                  h2: (p) => <h2 className="text-2xl font-black text-white mt-10 mb-4" {...p} />,
                  h3: (p) => <h3 className="text-xl font-bold text-white mt-8 mb-3" {...p} />,
                  p:  (p) => <p className="mb-5" {...p} />,
                  ul: (p) => <ul className="list-disc pl-6 mb-5 space-y-2" {...p} />,
                  ol: (p) => <ol className="list-decimal pl-6 mb-5 space-y-2" {...p} />,
                  strong: (p) => <strong style={{ color: "#fff" }} {...p} />,
                  a: (p) => <a style={{ color: GOLD }} target="_blank" rel="noreferrer" {...p} />,
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

            {/* Related posts */}
            {related.length > 0 && (
              <div className="mt-16">
                <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 20 }}>Related Insights</p>
                <div className="grid md:grid-cols-3 gap-5">
                  {related.map((r) => (
                    <Link key={r.id} to={`/insights/${r.slug}`} className="block rounded-xl p-5 transition-colors" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-white text-sm font-bold leading-snug">{r.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-16 rounded-2xl p-10 text-center" style={{ background: "linear-gradient(135deg, rgba(212,160,48,0.1) 0%, rgba(0,0,0,0.3) 100%)", border: `1px solid ${GOLD}35` }}>
              <h3 className="text-2xl font-black text-white mb-3">Ready to Build Something Real?</h3>
              <p className="text-sm mb-7" style={{ color: "rgba(255,255,255,0.45)" }}>nova-systems.app</p>
              <Link to="/welcome" className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-7 py-3.5 rounded-lg hover:opacity-85 transition-all" style={{ background: G, color: "#0a0800" }}>
                BOOK YOUR FREE MEETING <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </article>
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
