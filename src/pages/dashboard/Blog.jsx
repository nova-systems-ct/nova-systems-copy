import { useState, useEffect } from 'react'
import { Plus, X, Loader2, FileText, Eye, EyeOff, Trash2, Edit3, AlertCircle } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const CATEGORIES = ['AI and Technology', 'Connecticut Business', 'Case Studies', 'News', 'Tips and Strategy']
const SWATCHES = ['#C49A3C', '#D4A030', '#60a5fa', '#a78bfa', '#4ade80', '#f97316', '#f87171']

const inp = {
  width: '100%', padding: '11px 14px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = {
  display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7,
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

const emptyForm = { id: '', title: '', slug: '', category: CATEGORIES[0], excerpt: '', content: '', thumbnail_color: '#C49A3C', seo_title: '', seo_description: '', published: false, slugTouched: false }

export default function Blog() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/blog-posts?admin=true')
      const data = await r.json()
      setPosts(Array.isArray(data) ? data : [])
      setError(!Array.isArray(data))
    } catch { setError(true) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(emptyForm); setEditing(true) }
  const openEdit = (post) => { setForm({ ...emptyForm, ...post, slugTouched: true }); setEditing(true) }

  const save = async (publish) => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/blog-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...form, published: publish }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Save failed')
      setEditing(false)
      load()
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  const togglePublish = async (post) => {
    await fetch('/api/blog-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', ...post, published: !post.published }),
    })
    load()
  }

  const remove = async (post) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    await fetch('/api/blog-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: post.id }),
    })
    load()
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Content</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Blog</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
        </div>
        {!editing && (
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: 14, height: 14 }} /> New Post
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '18px 22px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 28, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0 }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Supabase not configured — run <code style={{ color: GOLD }}>supabase/schema-update.sql</code> and set env vars.</p>
        </div>
      )}

      {editing ? (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>{form.id ? 'Edit Post' : 'New Post'}</p>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Title *</label>
              <input value={form.title} style={inp}
                onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) }))}
                placeholder="How AI Phone Agents Are Changing Local Business" />
            </div>
            <div>
              <label style={lbl}>Slug</label>
              <input value={form.slug} style={inp} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value), slugTouched: true }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Thumbnail Color</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {SWATCHES.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, thumbnail_color: c }))}
                      style={{ width: 26, height: 26, borderRadius: 6, background: c, border: form.thumbnail_color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label style={lbl}>Excerpt</label>
              <textarea rows={2} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} style={{ ...inp, resize: 'none' }} placeholder="A short one or two sentence summary" />
            </div>
            <div>
              <label style={lbl}>Content (Markdown — headers, **bold**, lists, paragraphs)</label>
              <textarea rows={14} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ ...inp, resize: 'vertical', fontFamily: 'ui-monospace, monospace', lineHeight: 1.7 }} placeholder={'## Heading\n\nParagraph text with **bold** and a list:\n\n- Point one\n- Point two'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>SEO Title</label>
                <input value={form.seo_title} onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))} style={inp} placeholder="Defaults to title" />
              </div>
              <div>
                <label style={lbl}>Meta Description</label>
                <input value={form.seo_description} onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))} style={inp} placeholder="Defaults to excerpt" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => save(false)} disabled={saving || !form.title.trim()}
                style={{ flex: 1, padding: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', margin: '0 auto' }} /> : 'Save Draft'}
              </button>
              <button onClick={() => save(true)} disabled={saving || !form.title.trim()}
                style={{ flex: 1, padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                Publish
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <FileText style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>No posts yet. Click "New Post" to write your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map(post => (
            <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: post.thumbnail_color || GOLD, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{post.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 3 }}>{post.category} · {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</p>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase', background: post.published ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', color: post.published ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {post.published ? 'Published' : 'Draft'}
              </span>
              <button onClick={() => togglePublish(post)} title={post.published ? 'Unpublish' : 'Publish'} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                {post.published ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
              </button>
              <button onClick={() => openEdit(post)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <Edit3 style={{ width: 13, height: 13 }} />
              </button>
              <button onClick={() => remove(post)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171' }}>
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
