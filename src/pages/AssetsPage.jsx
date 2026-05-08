import { useState, useEffect, useRef } from 'react'
import { api, exportCsv } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const ASSET_TYPES = [
  { value: 'laptop',    label: 'Laptop',    icon: '💻' },
  { value: 'desktop',   label: 'Desktop',   icon: '🖥️' },
  { value: 'printer',   label: 'Printer',   icon: '🖨️' },
  { value: 'server',    label: 'Server',    icon: '🗄️' },
  { value: 'phone',     label: 'Phone',     icon: '📱' },
  { value: 'tablet',    label: 'Tablet',    icon: '📲' },
  { value: 'switch',    label: 'Switch',    icon: '🔀' },
  { value: 'router',    label: 'Router',    icon: '📡' },
  { value: 'ups',       label: 'UPS',       icon: '🔋' },
  { value: 'monitor',   label: 'Monitor',   icon: '🖵'  },
  { value: 'keyboard',  label: 'Keyboard',  icon: '⌨️' },
  { value: 'other',     label: 'Other',     icon: '📦' },
]

const ASSET_STATUSES = [
  { value: 'active',            label: 'Active',          color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  { value: 'under_maintenance', label: 'Maintenance',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  { value: 'retired',           label: 'Retired',         color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
  { value: 'lost',              label: 'Lost',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)' },
]

const ASSET_CONDITIONS = [
  { value: 'excellent', label: 'Excellent', color: '#10b981' },
  { value: 'good',      label: 'Good',      color: '#6366f1' },
  { value: 'fair',      label: 'Fair',      color: '#f59e0b' },
  { value: 'poor',      label: 'Poor',      color: '#ef4444' },
]

const ACTION_LABELS = {
  created:          { label: 'Created',          icon: '✨', color: '#10b981' },
  updated:          { label: 'Updated',          icon: '✏️', color: '#6366f1' },
  assigned:         { label: 'Assigned',         icon: '👤', color: '#3b82f6' },
  unassigned:       { label: 'Unassigned',       icon: '🔓', color: '#64748b' },
  status_changed:   { label: 'Status Changed',   icon: '🔄', color: '#f59e0b' },
  condition_changed:{ label: 'Condition Changed',icon: '🔧', color: '#8b5cf6' },
  renamed:          { label: 'Renamed',          icon: '📝', color: '#06b6d4' },
}

function getTypeInfo(type) {
  return ASSET_TYPES.find(t => t.value === type) || ASSET_TYPES[ASSET_TYPES.length - 1]
}
function getStatusInfo(status) {
  return ASSET_STATUSES.find(s => s.value === status) || ASSET_STATUSES[0]
}
function getConditionInfo(condition) {
  return ASSET_CONDITIONS.find(c => c.value === condition) || ASSET_CONDITIONS[1]
}

function StatusBadge({ status }) {
  const info = getStatusInfo(status)
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: info.color, background: info.bg, border: `1px solid ${info.border}` }}>
      {info.label}
    </span>
  )
}

function ConditionDot({ condition }) {
  const info = getConditionInfo(condition)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: info.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: info.color }} />
      {info.label}
    </span>
  )
}

function WarrantyBadge({ date }) {
  if (!date) return <span className="text-slate-600 text-xs">—</span>
  const d = new Date(date)
  const now = new Date()
  const diff = d - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (diff < 0) return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
      Expired
    </span>
  )
  if (days <= 30) return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
      {days}d left
    </span>
  )
  return <span className="text-slate-400 text-xs">{d.toLocaleDateString()}</span>
}

const EMPTY_FORM = {
  name: '', type: 'laptop', serial_number: '', brand: '', model: '',
  status: 'active', condition: 'good', purchase_date: '', warranty_expires: '',
  purchase_price: '', location: '', notes: '', image_url: '', assigned_to: '',
}

export default function AssetsPage({ isSuperAdmin = false }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const accent = isSuperAdmin ? '#f59e0b' : '#6366f1'
  const accentBg = isSuperAdmin ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)'
  const accentBorder = isSuperAdmin ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)'
  const btnPrimary = isSuperAdmin
    ? 'bg-amber-600 hover:bg-amber-500 text-white'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white'

  const [assets, setAssets] = useState([])
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssigned, setFilterAssigned] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [detailTab, setDetailTab] = useState('info')
  const imgInputRef = useRef(null)

  useEffect(() => {
    fetchAll()
    fetchUsers()
  }, [])

  useEffect(() => {
    const onUpdate = () => fetchAll()
    window.addEventListener('ws:asset_update', onUpdate)
    return () => window.removeEventListener('ws:asset_update', onUpdate)
  }, [])

  useEffect(() => {
    if (selectedAsset) fetchHistory(selectedAsset.id)
  }, [selectedAsset])

  async function fetchAll() {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([api.getAssets(), api.getAssetStats()])
      setAssets(a)
      setStats(s)
    } catch {}
    setLoading(false)
  }

  async function fetchUsers() {
    try { setUsers(await api.getUsers()) } catch {}
  }

  async function fetchHistory(id) {
    setHistoryLoading(true)
    try { setHistory(await api.getAssetHistory(id)) } catch {}
    setHistoryLoading(false)
  }

  function openCreate() {
    setEditingAsset(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(asset) {
    setEditingAsset(asset)
    setForm({
      name: asset.name || '',
      type: asset.type || 'laptop',
      serial_number: asset.serial_number || '',
      brand: asset.brand || '',
      model: asset.model || '',
      status: asset.status || 'active',
      condition: asset.condition || 'good',
      purchase_date: asset.purchase_date || '',
      warranty_expires: asset.warranty_expires || '',
      purchase_price: asset.purchase_price !== null && asset.purchase_price !== undefined ? String(asset.purchase_price) : '',
      location: asset.location || '',
      notes: asset.notes || '',
      image_url: asset.image_url || '',
      assigned_to: asset.assigned_to || '',
    })
    setFormError('')
    setShowForm(true)
  }

  async function handleUploadImage(file) {
    setUploadingImg(true)
    try {
      const result = await api.uploadFile(file)
      setForm(f => ({ ...f, image_url: result.url }))
    } catch (err) {
      setFormError('Image upload failed: ' + err.message)
    }
    setUploadingImg(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Asset name is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        ...form,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        assigned_to: form.assigned_to || null,
        serial_number: form.serial_number || null,
      }
      if (editingAsset) {
        await api.updateAsset(editingAsset.id, payload)
      } else {
        await api.createAsset(payload)
      }
      setShowForm(false)
      await fetchAll()
    } catch (err) {
      setFormError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(asset) {
    setDeletingId(asset.id)
    try {
      await api.deleteAsset(asset.id)
      setConfirmDelete(null)
      if (selectedAsset?.id === asset.id) setSelectedAsset(null)
      await fetchAll()
    } catch (err) {
      setFormError(err.message)
    }
    setDeletingId(null)
  }

  const filtered = assets.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterAssigned === 'assigned' && !a.assigned_to) return false
    if (filterAssigned === 'unassigned' && a.assigned_to) return false
    if (search) {
      const q = search.toLowerCase()
      const match = [a.name, a.brand, a.model, a.serial_number, a.location,
        a.assigned_user?.full_name, a.assigned_user?.email]
        .filter(Boolean).some(v => v.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  const statCards = stats ? [
    { label: 'Total Assets',       value: stats.total,       color: '#6366f1', icon: '📦' },
    { label: 'Active',             value: stats.active,      color: '#10b981', icon: '✅' },
    { label: 'In Maintenance',     value: stats.maintenance, color: '#f59e0b', icon: '🔧' },
    { label: 'Assigned',           value: stats.assigned,    color: '#3b82f6', icon: '👤' },
    { label: 'Warranty Expiring',  value: stats.warrantyExpiringSoon, color: '#f59e0b', icon: '⚠️' },
    { label: 'Warranty Expired',   value: stats.warrantyExpired,      color: '#ef4444', icon: '❌' },
  ] : []

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Asset Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track and manage all IT equipment and devices</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportCsv('assets.csv', filtered, [
              { label: 'Name', value: r => r.name },
              { label: 'Type', value: r => r.type },
              { label: 'Brand', value: r => r.brand },
              { label: 'Model', value: r => r.model },
              { label: 'Serial', value: r => r.serial_number },
              { label: 'Status', value: r => r.status },
              { label: 'Condition', value: r => r.condition },
              { label: 'Location', value: r => r.location },
              { label: 'Assigned To', value: r => r.assigned_user?.full_name || '' },
              { label: 'Purchase Date', value: r => r.purchase_date },
              { label: 'Warranty Expires', value: r => r.warranty_expires },
              { label: 'Price', value: r => r.purchase_price },
            ])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          {isAdmin && (
            <button onClick={openCreate}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${btnPrimary}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Asset
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {statCards.map(card => (
            <div key={card.label} className="glass-card rounded-xl px-4 py-3.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-lg">{card.icon}</span>
                <span className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-tight mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
            style={{ focusBorderColor: accent }}
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none min-w-[120px]">
          <option value="all">All Types</option>
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none min-w-[130px]">
          <option value="all">All Statuses</option>
          {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none min-w-[130px]">
          <option value="all">All Assets</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      {/* ── Main content area (list + detail side panel) ── */}
      <div className="flex gap-4 items-start">
        {/* Asset List */}
        <div className={`flex-1 min-w-0 ${selectedAsset ? 'hidden xl:block' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-8 h-8 animate-spin" style={{ color: accent }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-slate-500 text-sm">Loading assets...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                📦
              </div>
              <p className="text-slate-400 font-medium">No assets found</p>
              <p className="text-slate-600 text-sm">
                {search || filterType !== 'all' || filterStatus !== 'all' || filterAssigned !== 'all'
                  ? 'Try adjusting your filters'
                  : isAdmin ? 'Add your first asset to get started' : 'No assets have been added yet'}
              </p>
              {isAdmin && !search && filterType === 'all' && filterStatus === 'all' && (
                <button onClick={openCreate}
                  className={`mt-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${btnPrimary}`}>
                  Add First Asset
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2">
                {['Asset', 'Type', 'Status', 'Assigned To', 'Warranty', ''].map(h => (
                  <span key={h} className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">{h}</span>
                ))}
              </div>

              {filtered.map(asset => {
                const typeInfo = getTypeInfo(asset.type)
                const isSelected = selectedAsset?.id === asset.id
                const warrantyOk = asset.warranty_expires && new Date(asset.warranty_expires) > new Date()
                const warrantyExpired = asset.warranty_expires && new Date(asset.warranty_expires) <= new Date()
                return (
                  <div
                    key={asset.id}
                    onClick={() => { setSelectedAsset(asset); setDetailTab('info') }}
                    className="glass-card rounded-xl cursor-pointer transition-all duration-150 hover:border-white/12"
                    style={{
                      border: isSelected ? `1px solid ${accentBorder}` : undefined,
                      background: isSelected ? accentBg : undefined,
                    }}
                  >
                    {/* Mobile layout */}
                    <div className="lg:hidden p-4">
                      <div className="flex items-start gap-3">
                        {asset.image_url ? (
                          <img src={asset.image_url} alt={asset.name}
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {typeInfo.icon}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-white font-semibold text-sm truncate">{asset.name}</p>
                            <StatusBadge status={asset.status} />
                          </div>
                          <p className="text-slate-500 text-xs">{asset.brand} {asset.model}</p>
                          {asset.assigned_user && (
                            <p className="text-slate-400 text-xs mt-1">
                              👤 {asset.assigned_user.full_name || asset.assigned_user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3.5">
                      {/* Asset info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {asset.image_url ? (
                          <img src={asset.image_url} alt={asset.name}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {typeInfo.icon}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{asset.name}</p>
                          <p className="text-slate-500 text-xs truncate">{[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}</p>
                        </div>
                      </div>
                      {/* Type */}
                      <span className="text-slate-400 text-sm">{typeInfo.icon} {typeInfo.label}</span>
                      {/* Status */}
                      <StatusBadge status={asset.status} />
                      {/* Assigned to */}
                      <div>
                        {asset.assigned_user ? (
                          <div className="flex items-center gap-1.5">
                            {asset.assigned_user.profile_picture_url ? (
                              <img src={asset.assigned_user.profile_picture_url} alt=""
                                className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                {(asset.assigned_user.full_name || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-slate-300 text-xs truncate max-w-[100px]">
                              {asset.assigned_user.full_name || asset.assigned_user.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">Unassigned</span>
                        )}
                      </div>
                      {/* Warranty */}
                      <WarrantyBadge date={asset.warranty_expires} />
                      {/* Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(asset)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmDelete(asset)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <p className="text-slate-600 text-xs text-center pt-1">
                Showing {filtered.length} of {assets.length} assets
              </p>
            </div>
          )}
        </div>

        {/* ── Detail Panel ── */}
        {selectedAsset && (
          <div className="w-full xl:w-96 flex-shrink-0">
            <div className="glass-card rounded-xl overflow-hidden sticky top-20">
              {/* Detail header */}
              <div className="p-4 border-b border-white/6 flex items-start gap-3">
                {selectedAsset.image_url ? (
                  <img src={selectedAsset.image_url} alt={selectedAsset.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10" />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {getTypeInfo(selectedAsset.type).icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base leading-tight truncate">{selectedAsset.name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">
                    {[selectedAsset.brand, selectedAsset.model].filter(Boolean).join(' ') || 'No model info'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={selectedAsset.status} />
                    <ConditionDot condition={selectedAsset.condition} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isAdmin && (
                    <>
                      <button onClick={() => openEdit(selectedAsset)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button onClick={() => setSelectedAsset(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/6">
                {['info', 'history'].map(t => (
                  <button key={t} onClick={() => setDetailTab(t)}
                    className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all"
                    style={{
                      color: detailTab === t ? accent : '#475569',
                      borderBottom: detailTab === t ? `2px solid ${accent}` : '2px solid transparent',
                    }}>
                    {t === 'info' ? 'Details' : 'History'}
                  </button>
                ))}
              </div>

              {/* Detail content */}
              <div className="p-4 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {detailTab === 'info' ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Serial Number', value: selectedAsset.serial_number || '—' },
                      { label: 'Type', value: `${getTypeInfo(selectedAsset.type).icon} ${getTypeInfo(selectedAsset.type).label}` },
                      { label: 'Location', value: selectedAsset.location || '—' },
                      { label: 'Purchase Date', value: selectedAsset.purchase_date || '—' },
                      { label: 'Warranty Expires', value: null, custom: <WarrantyBadge date={selectedAsset.warranty_expires} /> },
                      { label: 'Purchase Price', value: selectedAsset.purchase_price ? `$${Number(selectedAsset.purchase_price).toLocaleString()}` : '—' },
                    ].map(row => (
                      <div key={row.label} className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 text-xs flex-shrink-0">{row.label}</span>
                        {row.custom ?? <span className="text-slate-200 text-xs text-right">{row.value}</span>}
                      </div>
                    ))}

                    {/* Assigned user */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-500 text-xs flex-shrink-0">Assigned To</span>
                      {selectedAsset.assigned_user ? (
                        <div className="flex items-center gap-1.5">
                          {selectedAsset.assigned_user.profile_picture_url ? (
                            <img src={selectedAsset.assigned_user.profile_picture_url} alt=""
                              className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                              {(selectedAsset.assigned_user.full_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-slate-200 text-xs">
                            {selectedAsset.assigned_user.full_name || selectedAsset.assigned_user.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">Unassigned</span>
                      )}
                    </div>

                    {selectedAsset.notes && (
                      <div className="pt-2 border-t border-white/6">
                        <p className="text-slate-500 text-xs mb-1.5">Notes</p>
                        <p className="text-slate-300 text-sm leading-relaxed">{selectedAsset.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <svg className="w-5 h-5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : history.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-8">No history yet</p>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <div className="space-y-4 pl-8">
                          {history.map((h, i) => {
                            const act = ACTION_LABELS[h.action] || { label: h.action, icon: '•', color: '#64748b' }
                            return (
                              <div key={h.id} className="relative">
                                <div className="absolute -left-5 top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                                  style={{ background: 'rgba(15,15,25,1)', border: `1px solid ${act.color}40` }}>
                                  <span>{act.icon}</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold" style={{ color: act.color }}>{act.label}</span>
                                    {h.changed_by_name && (
                                      <span className="text-slate-500 text-[10px]">by {h.changed_by_name}</span>
                                    )}
                                  </div>
                                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{h.description}</p>
                                  {(h.old_value || h.new_value) && (
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      {h.old_value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 line-through">{h.old_value}</span>}
                                      {h.old_value && h.new_value && <span className="text-slate-600 text-[10px]">→</span>}
                                      {h.new_value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{h.new_value}</span>}
                                    </div>
                                  )}
                                  <p className="text-slate-600 text-[10px] mt-1">{new Date(h.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-2xl glass-card rounded-2xl overflow-hidden animate-scaleIn shadow-2xl max-h-[90vh] flex flex-col"
            style={{ border: `1px solid ${accentBorder}` }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
                  <svg className="w-4.5 h-4.5" style={{ color: accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h2>
                  <p className="text-slate-500 text-xs">{editingAsset ? `Editing: ${editingAsset.name}` : 'Fill in the asset details below'}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Image upload */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">Asset Photo</label>
                <div className="flex items-center gap-3">
                  {form.image_url ? (
                    <img src={form.image_url} alt="Asset" className="w-16 h-16 rounded-xl object-cover border border-white/12" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                      {getTypeInfo(form.type).icon}
                    </div>
                  )}
                  <div>
                    <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files[0] && handleUploadImage(e.target.files[0])} />
                    <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                      style={{ background: accentBg, border: `1px solid ${accentBorder}`, color: accent }}>
                      {uploadingImg ? 'Uploading...' : form.image_url ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {form.image_url && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                        className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-400 transition-all">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row: Name + Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">
                    Asset Name <span className="text-red-400">*</span>
                  </label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Office Laptop #12"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none">
                    {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Brand + Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Brand</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Dell, HP, Lenovo..."
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Model</label>
                  <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. Latitude 5520"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all" />
                </div>
              </div>

              {/* Row: Serial + Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Serial Number</label>
                  <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    placeholder="Unique serial number"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Floor 2, Room 204"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all" />
                </div>
              </div>

              {/* Row: Status + Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none">
                    {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Condition</label>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none">
                    {ASSET_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Purchase Date + Warranty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none transition-all [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Warranty Expires</label>
                  <input type="date" value={form.warranty_expires} onChange={e => setForm(f => ({ ...f, warranty_expires: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none transition-all [color-scheme:dark]" />
                </div>
              </div>

              {/* Row: Price + Assign */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Purchase Price (USD)</label>
                  <input type="number" min="0" step="0.01" value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Assign To</label>
                  <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none">
                    <option value="">— Unassigned —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Any additional notes about this asset..."
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none placeholder-slate-600 resize-none transition-all" />
              </div>

              {formError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {formError}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${btnPrimary}`}>
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {editingAsset ? 'Saving...' : 'Creating...'}
                  </>
                ) : (editingAsset ? 'Save Changes' : 'Add Asset')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-sm glass-card rounded-2xl p-6 animate-scaleIn shadow-2xl"
            style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete Asset</h3>
                <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">{confirmDelete.name}</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              This will permanently delete this asset and all its history. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deletingId === confirmDelete.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {deletingId === confirmDelete.id ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
