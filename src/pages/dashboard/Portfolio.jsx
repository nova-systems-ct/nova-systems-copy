import { useState, useEffect, useRef } from 'react'
import { Upload, Star, Trash2, Edit3, X, Check, Plus, ImageIcon, Loader2, AlertCircle } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const CATEGORIES = ['Website', 'Branding', 'Social Media', 'Apparel', 'Other']
const CLIENT_OPTIONS = ['Mars Hill Apologetics', 'TRIO Upward Bound', 'Flow Barbershop', 'Wepaa', 'Custom…']
const CAT_COLORS = { Website: '#60a5fa', Branding: '#a78bfa', 'Social Media': '#4ade80', Apparel: '#f97316', Other: GOLD }

const inp = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = {
  display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7,
}

export default function Portfolio() {
  const fileRef = useRef(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState('')
  const [fileData, setFileData] = useState('')
  const [form, setForm] = useState({ title: '', category: 'Website', client_name: '', customClient: '', featured: false })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [supabaseError, setSupabaseError] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/portfolio-items')
      if (!r.ok) { setSupabaseError(true); setLoading(false); return }
      const data = await r.json()
      if (!Array.isArray(data)) { setSupabaseError(true); setLoading(false); return }
      setItems(data)
      if (supabaseError) setSupabaseError(false)
    } catch {
      setSupabaseError(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleFileSelect = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('File must be an image'); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError('File must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => { setPreview(ev.target.result); setFileData(ev.target.result) }
    reader.readAsDataURL(file)
    setUploadError('')
  }

  const handleUpload = async () => {
    if (!fileData || !form.title.trim()) return
    setUploading(true)
    setUploadError('')
    const clientName = form.client_name === 'Custom…' ? form.customClient.trim() : form.client_name
    try {
      const r = await fetch('/api/portfolio-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          client_name: clientName || null,
          featured: form.featured,
          image_base64: fileData,
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) {
        setUploadError(d.error || 'Upload failed')
        setUploading(false)
        return
      }
      setUploadSuccess(true)
      setPreview('')
      setFileData('')
      setForm({ title: '', category: 'Website', client_name: '', customClient: '', featured: false })
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => { setUploadSuccess(false); setShowUpload(false) }, 1200)
      load()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    }
    setUploading(false)
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setDeletingId(item.id)
    const filename = item.image_url?.split('/portfolio/')[1]
    await fetch('/api/portfolio-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: item.id, filename }),
    })
    setDeletingId(null)
    load()
  }

  const handleToggleFeatured = async (item) => {
    setTogglingId(item.id)
    await fetch('/api/portfolio-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: item.id, featured: !item.featured }),
    })
    setTogglingId(null)
    load()
  }

  const openEdit = (item) => {
    setEditItem(item)
    setEditForm({ title: item.title || '', category: item.category || 'Other', client_name: item.client_name || '', featured: !!item.featured })
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    await fetch('/api/portfolio-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: editItem.id, ...editForm }),
    })
    setEditItem(null)
    load()
  }

  const featuredCount = items.filter(i => i.featured).length

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Portfolio Manager</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Portfolio</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
            {items.length} item{items.length !== 1 ? 's' : ''} · {featuredCount} featured on homepage
          </p>
        </div>
        <button
          onClick={() => { setShowUpload(!showUpload); setUploadError(''); setPreview(''); setFileData('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: showUpload ? 'rgba(255,255,255,0.06)' : G, border: showUpload ? '1px solid rgba(255,255,255,0.12)' : 'none', borderRadius: 8, color: showUpload ? 'rgba(255,255,255,0.5)' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {showUpload ? <><X style={{ width: 14, height: 14 }} /> Cancel</> : <><Plus style={{ width: 14, height: 14 }} /> Upload Image</>}
        </button>
      </div>

      {/* Supabase setup required notice */}
      {supabaseError && (
        <div style={{ padding: '20px 24px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>Supabase setup required</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
            Run this SQL in your Supabase dashboard → SQL Editor, then create a public storage bucket named <code style={{ color: GOLD, background: 'rgba(212,160,48,0.1)', padding: '1px 6px', borderRadius: 4 }}>portfolio</code>:
          </p>
          <pre style={{ padding: '14px 18px', background: 'rgba(0,0,0,0.5)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.55)', overflowX: 'auto', lineHeight: 1.8 }}>
{`CREATE TABLE IF NOT EXISTS portfolio (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  category   TEXT DEFAULT 'Other',
  client_name TEXT,
  featured   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}
          </pre>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, marginBottom: 32 }}>
          <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 20 }}>Upload New Item</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Drop zone */}
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files?.[0]) }}
                onDragOver={e => e.preventDefault()}
                style={{ height: 220, borderRadius: 10, border: `2px dashed ${preview ? GOLD : 'rgba(255,255,255,0.12)'}`, background: preview ? 'transparent' : 'rgba(255,255,255,0.02)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {preview ? (
                  <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Upload style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Click or drag to upload</p>
                    <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, marginTop: 5 }}>JPEG, PNG, WebP · Max 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => handleFileSelect(e.target.files?.[0])} style={{ display: 'none' }} />
              {preview && (
                <button onClick={() => { setPreview(''); setFileData(''); if (fileRef.current) fileRef.current.value = '' }}
                  style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Remove image
                </button>
              )}
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} placeholder="e.g. Flow Barbershop Instagram" />
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Client</label>
                <select value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111' }}>— None —</option>
                  {CLIENT_OPTIONS.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
                {form.client_name === 'Custom…' && (
                  <input value={form.customClient} onChange={e => setForm(f => ({ ...f, customClient: e.target.value }))} style={{ ...inp, marginTop: 8 }} placeholder="Enter client name" />
                )}
              </div>
              <div
                onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${form.featured ? GOLD : 'rgba(255,255,255,0.2)'}`, background: form.featured ? `${GOLD}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.featured && <Check style={{ width: 11, height: 11, color: GOLD }} />}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Feature on homepage</span>
                <Star style={{ width: 12, height: 12, color: form.featured ? GOLD : 'rgba(255,255,255,0.2)' }} />
              </div>

              {uploadError && <p style={{ color: '#f87171', fontSize: 12 }}>{uploadError}</p>}

              <button onClick={handleUpload} disabled={!fileData || !form.title.trim() || uploading}
                style={{ marginTop: 'auto', padding: '12px 18px', background: fileData && form.title.trim() && !uploading ? G : '#161410', border: fileData && form.title.trim() && !uploading ? 'none' : '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: fileData && form.title.trim() && !uploading ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: fileData && form.title.trim() && !uploading ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {uploading
                  ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Uploading…</>
                  : uploadSuccess
                  ? <><Check style={{ width: 13, height: 13 }} /> Saved!</>
                  : <><Upload style={{ width: 13, height: 13 }} /> Save to Portfolio</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} />
        </div>
      ) : items.length === 0 && !supabaseError ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ImageIcon style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 8 }}>No portfolio items yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Click "Upload Image" to add your first item.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {items.map(item => (
            <PortfolioCard
              key={item.id}
              item={item}
              onDelete={() => handleDelete(item)}
              onToggleFeatured={() => handleToggleFeatured(item)}
              onEdit={() => openEdit(item)}
              onLightbox={() => setLightbox(item)}
              deleting={deletingId === item.id}
              toggling={togglingId === item.id}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setEditItem(null)}>
          <div style={{ width: '100%', maxWidth: 480, background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Edit Item</h3>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            {editItem.image_url && (
              <img src={editItem.image_url} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Title</label>
                <input value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={editForm.category || 'Other'} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, appearance: 'none' }}>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Client</label>
                <input value={editForm.client_name || ''} onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))} style={inp} placeholder="Client name" />
              </div>
              <div
                onClick={() => setEditForm(f => ({ ...f, featured: !f.featured }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${editForm.featured ? GOLD : 'rgba(255,255,255,0.2)'}`, background: editForm.featured ? `${GOLD}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {editForm.featured && <Check style={{ width: 11, height: 11, color: GOLD }} />}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Featured on homepage</span>
                <Star style={{ width: 12, height: 12, color: editForm.featured ? GOLD : 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
            <button onClick={handleSaveEdit}
              style={{ width: '100%', marginTop: 22, padding: 12, background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, cursor: 'pointer', color: '#fff', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ maxWidth: 800, width: '100%' }}>
            <img src={lightbox.image_url} alt={lightbox.title} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, display: 'block' }} />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, flex: 1 }}>{lightbox.title}</p>
              {lightbox.client_name && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{lightbox.client_name}</p>}
              {lightbox.category && <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${CAT_COLORS[lightbox.category] || GOLD}18`, color: CAT_COLORS[lightbox.category] || GOLD, border: `1px solid ${CAT_COLORS[lightbox.category] || GOLD}30`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lightbox.category}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioCard({ item, onDelete, onToggleFeatured, onEdit, onLightbox, deleting, toggling }) {
  const [hov, setHov] = useState(false)
  const catColor = CAT_COLORS[item.category] || GOLD

  return (
    <div
      style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.025)', border: `1px solid ${hov ? 'rgba(212,160,48,0.2)' : 'rgba(255,255,255,0.07)'}`, transition: 'border-color 0.15s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>

      {/* Image area */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', cursor: 'zoom-in', background: '#050403' }} onClick={onLightbox}>
        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hov ? 'scale(1.04)' : 'scale(1)' }} />

        {/* Hover action overlay */}
        {hov && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActionBtn icon={Edit3} onClick={e => { e.stopPropagation(); onEdit() }} title="Edit" />
            <ActionBtn icon={Star} onClick={e => { e.stopPropagation(); onToggleFeatured() }} title={item.featured ? 'Unfeature' : 'Feature on homepage'} gold={item.featured} loading={toggling} />
            <ActionBtn icon={Trash2} onClick={e => { e.stopPropagation(); onDelete() }} title="Delete" red loading={deleting} />
          </div>
        )}

        {/* Featured badge */}
        {item.featured && (
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', background: 'rgba(0,0,0,0.8)', borderRadius: 20, border: `1px solid ${GOLD}40`, backdropFilter: 'blur(4px)' }}>
            <Star style={{ width: 9, height: 9, color: GOLD }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>FEATURED</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{item.title}</p>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}28`, flexShrink: 0, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {item.category || 'Other'}
          </span>
        </div>
        {item.client_name && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{item.client_name}</p>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ icon: Icon, onClick, title, gold, red, loading }) {
  return (
    <button
      onClick={onClick} title={title} disabled={loading}
      style={{ width: 36, height: 36, borderRadius: 8, background: red ? 'rgba(239,68,68,0.2)' : gold ? `${GOLD}25` : 'rgba(255,255,255,0.12)', border: `1px solid ${red ? 'rgba(239,68,68,0.4)' : gold ? `${GOLD}50` : 'rgba(255,255,255,0.2)'}`, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: red ? '#f87171' : gold ? GOLD : '#fff', flexShrink: 0 }}>
      {loading ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Icon style={{ width: 13, height: 13 }} />}
    </button>
  )
}
