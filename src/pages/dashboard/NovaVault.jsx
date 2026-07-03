import { useState, useEffect, useRef, useMemo } from 'react'
import { Lock, FileText, Receipt, FolderOpen, Upload, Search, Download, Eye, Trash2, X, Loader2, HardDrive } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const SIDEBAR = [
  { key: 'all',       label: 'All Documents', icon: FolderOpen },
  { key: 'Contract',  label: 'Contracts',     icon: FileText },
  { key: 'Invoice',   label: 'Invoices',      icon: Receipt },
  { key: 'Client File', label: 'Client Files', icon: FolderOpen },
  { key: 'mine',      label: 'My Uploads',    icon: Upload },
]

const STATUS_COLORS = {
  Signed:  { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  Paid:    { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  Pending: { bg: `${GOLD}15`, color: GOLD },
  Active:  { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
}

const inp = {
  padding: '10px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

function fmtBytes(n) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function NovaVault() {
  const fileRef = useRef(null)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({ client_name: '', doc_type: 'Client File', category: 'files' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/vault-list')
      const data = await r.json()
      setDocs(Array.isArray(data) ? data : [])
    } catch { setDocs([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clientOptions = useMemo(() => [...new Set(docs.map(d => d.client_name).filter(Boolean))].sort(), [docs])
  const statusOptions = useMemo(() => [...new Set(docs.map(d => d.status).filter(Boolean))].sort(), [docs])

  const filtered = useMemo(() => {
    let list = docs
    if (category === 'mine') list = list.filter(d => d.source === 'manual')
    else if (category !== 'all') list = list.filter(d => d.type === category)
    if (clientFilter) list = list.filter(d => d.client_name === clientFilter)
    if (statusFilter) list = list.filter(d => d.status === statusFilter)
    if (dateFilter) list = list.filter(d => (d.created_at || '').slice(0, 10) === dateFilter)
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter(d => (d.file_name || '').toLowerCase().includes(s) || (d.client_name || '').toLowerCase().includes(s))
    }
    return list
  }, [docs, category, q, clientFilter, statusFilter, dateFilter])

  const stats = useMemo(() => ({
    total: docs.length,
    contracts: docs.filter(d => d.type === 'Contract' && d.status === 'Signed').length,
    invoicesPaid: docs.filter(d => d.type === 'Invoice' && d.status === 'Paid').length,
    storage: docs.reduce((sum, d) => sum + (Number(d.file_size) || 0), 0),
  }), [docs])

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    await fetch('/api/vault-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: doc.id, storage_path: doc.storage_path }),
    })
    load()
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadError('')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const r = await fetch('/api/vault-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_base64: reader.result, file_name: uploadFile.name,
            category: uploadForm.category, doc_type: uploadForm.doc_type,
            client_name: uploadForm.client_name, status: 'Active',
          }),
        })
        const d = await r.json()
        if (!r.ok || d.error) throw new Error(d.error || 'Upload failed')
        setUploadOpen(false)
        setUploadFile(null)
        setUploadForm({ client_name: '', doc_type: 'Client File', category: 'files' })
        if (fileRef.current) fileRef.current.value = ''
        load()
      } catch (e) {
        setUploadError(e.message)
      }
      setUploading(false)
    }
    reader.readAsDataURL(uploadFile)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1300 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock style={{ width: 11, height: 11 }} /> SECURE DOCUMENT CENTER
          </p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Nova Vault</h1>
        </div>
        <button onClick={() => setUploadOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Upload style={{ width: 14, height: 14 }} /> Upload
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard icon={FolderOpen} label="Total Documents" value={stats.total} />
        <StatCard icon={FileText} label="Contracts Signed" value={stats.contracts} />
        <StatCard icon={Receipt} label="Invoices Paid" value={stats.invoicesPaid} />
        <StatCard icon={HardDrive} label="Storage Used" value={fmtBytes(stats.storage)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }} className="grid-vault">
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SIDEBAR.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setCategory(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 8, background: category === key ? `${GOLD}12` : 'transparent', border: 'none', cursor: 'pointer', color: category === key ? GOLD : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: category === key ? 600 : 400, textAlign: 'left', fontFamily: 'inherit' }}>
              <Icon style={{ width: 14, height: 14 }} /> {label}
            </button>
          ))}
        </div>

        {/* Main */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340 }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by client or file name…" style={{ ...inp, width: '100%', paddingLeft: 34 }} />
            </div>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              <option value="" style={{ background: '#111' }}>All Clients</option>
              {clientOptions.map(c => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
              <option value="" style={{ background: '#111' }}>All Statuses</option>
              {statusOptions.map(s => <option key={s} value={s} style={{ background: '#111' }}>{s}</option>)}
            </select>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <Lock style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No documents yet. Contracts and invoices will appear here automatically, or upload a file manually.</p>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 100px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['File', 'Client', 'Type', 'Date', 'Status', ''].map(h => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
                ))}
              </div>
              {filtered.map(doc => {
                const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.Active
                return (
                  <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 100px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{doc.client_name || '—'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{doc.type}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.color, width: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{doc.status}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <IconBtn icon={Eye} onClick={() => setPreview(doc)} />
                      <IconBtn icon={Download} as="a" href={doc.file_url} />
                      <IconBtn icon={Trash2} onClick={() => handleDelete(doc)} red />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setUploadOpen(false)}>
          <div style={{ width: '100%', maxWidth: 460, background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Upload Document</h3>
              <button onClick={() => setUploadOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div onClick={() => fileRef.current?.click()} style={{ padding: '22px', border: `2px dashed ${uploadFile ? GOLD : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', background: uploadFile ? `${GOLD}08` : 'rgba(255,255,255,0.02)' }}>
                {uploadFile ? <span style={{ color: GOLD, fontSize: 13 }}>{uploadFile.name}</span> : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Click to choose a file</span>}
              </div>
              <input ref={fileRef} type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <input placeholder="Client name (optional)" value={uploadForm.client_name} onChange={e => setUploadForm(f => ({ ...f, client_name: e.target.value }))} style={inp} />
              <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value, doc_type: e.target.value === 'contracts' ? 'Contract' : e.target.value === 'invoices' ? 'Invoice' : 'Client File' }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                <option value="files" style={{ background: '#111' }}>Client File</option>
                <option value="contracts" style={{ background: '#111' }}>Contract</option>
                <option value="invoices" style={{ background: '#111' }}>Invoice</option>
              </select>
              {uploadError && <p style={{ color: '#f87171', fontSize: 12 }}>{uploadError}</p>}
              <button onClick={handleUpload} disabled={!uploadFile || uploading} style={{ padding: 13, background: uploadFile && !uploading ? G : '#161410', border: 'none', borderRadius: 9, color: uploadFile && !uploading ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: uploadFile && !uploading ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {uploading ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', margin: '0 auto' }} /> : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div style={{ width: '100%', maxWidth: 820, height: '85vh', background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{preview.file_name}</p>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <iframe title="preview" src={preview.file_url} style={{ flex: 1, width: '100%', border: 'none', borderRadius: 8, background: '#fff' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon style={{ width: 13, height: 13, color: GOLD }} />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  )
}

function IconBtn({ icon: Icon, onClick, href, as, red }) {
  const Comp = as || 'button'
  return (
    <Comp onClick={onClick} href={href} target={href ? '_blank' : undefined} rel={href ? 'noreferrer' : undefined}
      style={{ width: 28, height: 28, borderRadius: 6, background: red ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${red ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: red ? '#f87171' : 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
      <Icon style={{ width: 12, height: 12 }} />
    </Comp>
  )
}
