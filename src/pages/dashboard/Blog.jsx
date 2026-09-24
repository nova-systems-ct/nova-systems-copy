import { useState, useEffect } from 'react'
import { Plus, X, Loader2, FileText, Send, CheckCircle2, XCircle, CalendarClock, Rocket, Trash2, Edit3, AlertCircle } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const CATEGORIES = ['AI and Technology', 'Connecticut Business', 'Case Studies', 'News', 'Tips and Strategy']
const SWATCHES = ['#C49A3C', '#C9A84C', '#C9A84C', '#a78bfa', '#4ade80', '#f97316', '#f87171']

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

const STATUS_CFG = {
  draft:      { label: 'Draft',       bg: 'rgba(255,255,255,0.06)',  color: 'rgba(255,255,255,0.4)' },
  in_review:  { label: 'In Review',   bg: `${GOLD}18`,                color: GOLD },
  approved:   { label: 'Approved',    bg: 'rgba(74,222,128,0.12)',   color: '#4ade80' },
  scheduled:  { label: 'Scheduled',   bg: 'rgba(167,139,250,0.12)',  color: '#a78bfa' },
  published:  { label: 'Published',   bg: 'rgba(74,222,128,0.12)',   color: '#4ade80' },
}

const emptyForm = { id: '', title: '', slug: '', category: CATEGORIES[0], excerpt: '', content: '', thumbnail_color: '#C49A3C', seo_title: '', seo_description: '', slugTouched: false }

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
      const r = await authedFetch('/api/client?resource=blog&op=posts&admin=true')
      const data = await r.json()
      setPosts(Array.isArray(data) ? data : [])
      setError(!Array.isArray(data))
    } catch { setError(true) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(emptyForm); setEditing(true) }
  const openEdit = (post) => { setForm({ ...emptyForm, ...post, slugTouched: true }); setEditing(true) }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=blog&op=admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...form }),
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

  // draft -> in_review -> (admin) approved -> scheduled/published. Going live is never a single
  // toggle any growth.view staff member can flip — see api/client.js's handleBlogAdmin for why.
  const doWorkflow = async (post, action, extra = {}) => {
    try {
      const r = await authedFetch('/api/client?resource=blog&op=admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: post.id, ...extra }),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Action failed')
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const requestChanges = async (post) => {
    const notes = window.prompt('What needs to change before this can be approved?')
    if (!notes) return
    await doWorkflow(post, 'request-changes', { notes })
  }

  const schedule = async (post) => {
    const when = window.prompt('Schedule for (e.g. 2026-10-01T09:00):')
    if (!when) return
    await doWorkflow(post, 'schedule', { scheduled_at: new Date(when).toISOString() })
  }

  const remove = async (post) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    await authedFetch('/api/client?resource=blog&op=admin', {
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

            {form.review_notes && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                <p style={{ color: '#f87171', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Changes requested</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{form.review_notes}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={save} disabled={saving || !form.title.trim()}
                style={{ flex: 1, padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', margin: '0 auto' }} /> : 'Save Draft'}
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>Save the draft first, then submit it for review from the list below — publishing is no longer a single toggle.</p>
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
            <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: post.thumbnail_color || GOLD, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{post.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 3 }}>
                  {post.category} · {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                  {post.status === 'scheduled' && post.scheduled_at ? ` · scheduled for ${new Date(post.scheduled_at).toLocaleString()}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase', background: (STATUS_CFG[post.status] || STATUS_CFG.draft).bg, color: (STATUS_CFG[post.status] || STATUS_CFG.draft).color }}>
                {(STATUS_CFG[post.status] || STATUS_CFG.draft).label}
              </span>

              {post.status === 'draft' && (
                <button onClick={() => doWorkflow(post, 'submit-for-review')} title="Submit for review" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: `${GOLD}18`, border: '1px solid rgba(201,168,76,0.3)', borderRadius: 7, color: GOLD, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Send style={{ width: 12, height: 12 }} /> Submit
                </button>
              )}
              {post.status === 'in_review' && (
                <>
                  <button onClick={() => doWorkflow(post, 'approve')} title="Approve (requires admin.view)" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 7, color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <CheckCircle2 style={{ width: 12, height: 12 }} /> Approve
                  </button>
                  <button onClick={() => requestChanges(post)} title="Request changes" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7, color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <XCircle style={{ width: 12, height: 12 }} /> Changes
                  </button>
                </>
              )}
              {(post.status === 'approved' || post.status === 'scheduled') && (
                <>
                  {post.status === 'approved' && (
                    <button onClick={() => schedule(post)} title="Schedule" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 7, color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <CalendarClock style={{ width: 12, height: 12 }} /> Schedule
                    </button>
                  )}
                  <button onClick={() => doWorkflow(post, 'publish-now')} title="Publish now" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Rocket style={{ width: 12, height: 12 }} /> Publish Now
                  </button>
                </>
              )}

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
