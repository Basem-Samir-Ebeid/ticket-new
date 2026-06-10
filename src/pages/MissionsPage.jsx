import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const PRIORITY_MAP = {
  low:    { label: 'منخفضة', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
  medium: { label: 'متوسطة', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  high:   { label: 'عالية',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)'   },
  urgent: { label: 'عاجلة',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)',   border: 'rgba(168,85,247,0.3)'  },
}

const STATUS_MAP = {
  pending_approval: { label: '⏳ بانتظار الموافقة', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)'  },
  pending:          { label: 'قيد الانتظار',        color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
  in_progress:      { label: 'جارية',               color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',    border: 'rgba(6,182,212,0.3)'   },
  completed:        { label: 'مكتملة',              color: '#10b981', bg: 'rgba(16,185,129,0.12)',   border: 'rgba(16,185,129,0.3)'  },
  cancelled:        { label: 'ملغية',               color: '#94a3b8', bg: 'rgba(100,116,139,0.08)',  border: 'rgba(100,116,139,0.18)' },
  rejected:         { label: '❌ مرفوضة',           color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)'   },
}

function Badge({ value }) {
  const cfg = STATUS_MAP[value] || STATUS_MAP.pending
  return (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

function PriorityBadge({ value }) {
  const cfg = PRIORITY_MAP[value] || PRIORITY_MAP.medium
  return (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

const EMPTY_FORM = { title: '', description: '', assigned_to: '', location: '', priority: 'medium', status: 'pending', start_date: '', end_date: '', notes: '' }

const ACTIVE_STATUSES = ['pending', 'in_progress']

export default function MissionsPage() {
  const { user, profile } = useAuth()
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'super_admin'
  const isSuperAdmin = profile?.role === 'super_admin'

  const [missions, setMissions]   = useState([])
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [success, setSuccess]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId]     = useState(null)
  const [approvingId, setApprovingId]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3500); return () => clearTimeout(t) }
  }, [success])

  async function load() {
    setLoading(true)
    try {
      const [m, u] = await Promise.all([
        api.getMissions(),
        isAdmin ? api.getUsers() : Promise.resolve([]),
      ])
      setMissions(m)
      setUsers(u)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, assigned_to: isAdmin ? '' : (user?.id || '') })
    setErr('')
    setShowModal(true)
  }

  function openEdit(m) {
    setEditing(m)
    setForm({
      title: m.title,
      description: m.description || '',
      assigned_to: m.assigned_to || '',
      location: m.location || '',
      priority: m.priority,
      status: m.status,
      start_date: m.start_date || '',
      end_date: m.end_date || '',
      notes: m.notes || '',
    })
    setErr('')
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return setErr('العنوان مطلوب')
    setSaving(true); setErr('')
    try {
      if (editing) {
        await api.updateMission(editing.id, form)
        setSuccess('تم تحديث المأمورية بنجاح')
      } else {
        await api.createMission(form)
        setSuccess(isAdmin ? 'تم إنشاء المأمورية بنجاح' : '✅ تم إرسال طلب المأمورية — في انتظار موافقة السوبر أدمن')
      }
      setShowModal(false)
      await load()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function handleStatusChange(missionId, newStatus) {
    setUpdatingId(missionId)
    try {
      await api.updateMissionStatus(missionId, newStatus)
      setMissions(prev => prev.map(m => m.id === missionId ? { ...m, status: newStatus } : m))
      setSuccess('تم تحديث الحالة')
    } catch (e) { setErr(e.message) }
    setUpdatingId(null)
  }

  async function handleApprove(id) {
    setApprovingId(id)
    try {
      await api.approveMission(id)
      setSuccess('✅ تمت الموافقة على المأمورية')
      await load()
    } catch (e) { setErr(e.message) }
    setApprovingId(null)
  }

  async function handleAdminReject(id) {
    setApprovingId(id)
    try {
      await api.adminRejectMission(id)
      setSuccess('تم رفض طلب المأمورية')
      await load()
    } catch (e) { setErr(e.message) }
    setApprovingId(null)
  }

  async function handleDelete(id) {
    try {
      await api.deleteMission(id)
      setMissions(prev => prev.filter(m => m.id !== id))
      setSuccess('تم حذف المأمورية')
    } catch (e) { setErr(e.message) }
    setConfirmDelete(null)
  }

  // Pending approval — only visible to super admin
  const pendingApproval = missions.filter(m => m.status === 'pending_approval')

  // Filter tabs — exclude pending_approval from main list (shown separately above)
  const mainMissions = missions.filter(m => m.status !== 'pending_approval')
  const filtered = statusFilter === 'all'
    ? mainMissions
    : mainMissions.filter(m => m.status === statusFilter)

  const counts = {
    all: mainMissions.length,
    ...Object.fromEntries(
      Object.keys(STATUS_MAP)
        .filter(s => s !== 'pending_approval')
        .map(s => [s, mainMissions.filter(m => m.status === s).length])
    ),
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div dir="rtl" className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">📋</span> الماموريات
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {isAdmin ? 'إدارة وتتبع المأموريات' : 'طلب مأمورية وتتبع حالتها'}
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
          {isAdmin ? '+ مأمورية جديدة' : '+ طلب مأمورية'}
        </button>
      </div>

      {/* ── Alerts ── */}
      {err     && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
      {success && <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}

      {/* ── Pending Approval Section (super admin only) ── */}
      {isSuperAdmin && pendingApproval.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <h3 className="text-amber-400 text-sm font-semibold flex items-center gap-2">
            <span>⏳</span> طلبات ماموريات تنتظر موافقتك
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
              {pendingApproval.length}
            </span>
          </h3>
          <div className="space-y-2">
            {pendingApproval.map(m => {
              const processing = approvingId === m.id
              return (
                <div key={m.id} className="rounded-xl p-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">{m.title}</span>
                        <PriorityBadge value={m.priority} />
                      </div>
                      {m.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{m.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        {(m.assignee_name || m.assignee_email) && (
                          <span className="text-xs text-amber-300/80 flex items-center gap-1">
                            👤 {m.assignee_name || m.assignee_email}
                          </span>
                        )}
                        {m.location && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">📍 {m.location}</span>
                        )}
                        {m.start_date && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            📅 {m.start_date}{m.end_date ? ` ← ${m.end_date}` : ''}
                          </span>
                        )}
                      </div>
                      {m.notes && <p className="text-slate-500 text-xs mt-1 italic">"{m.notes}"</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleApprove(m.id)} disabled={processing}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                        {processing ? '...' : '✓ موافقة'}
                      </button>
                      <button onClick={() => handleAdminReject(m.id)} disabled={processing}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 transition-all">
                        ✕ رفض
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Employee: show their own pending_approval mission (not super admin) */}
      {!isAdmin && pendingApproval.filter(m => m.assigned_to === user?.id).length > 0 && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <h3 className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2">
            <span>⏳</span> طلباتي — بانتظار الموافقة
          </h3>
          {pendingApproval.filter(m => m.assigned_to === user?.id).map(m => (
            <div key={m.id} className="rounded-xl p-3 flex items-center justify-between gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.1)' }}>
              <div>
                <p className="text-white text-sm font-medium">{m.title}</p>
                {m.location && <p className="text-slate-400 text-xs mt-0.5">📍 {m.location}</p>}
                {m.start_date && <p className="text-slate-400 text-xs">📅 {m.start_date}{m.end_date ? ` ← ${m.end_date}` : ''}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge value="pending_approval" />
                <button onClick={() => setConfirmDelete(m.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="سحب الطلب">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Status filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'الكل'],
          ['pending', 'قيد الانتظار'],
          ['in_progress', 'جارية'],
          ['completed', 'مكتملة'],
          ['cancelled', 'ملغية'],
          ['rejected', 'مرفوضة'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${statusFilter === key ? 'text-white' : 'text-slate-400 border border-white/8 bg-white/3 hover:bg-white/6'}`}
            style={statusFilter === key ? { background: 'linear-gradient(135deg,#d97706,#f59e0b)', border: '1px solid rgba(245,158,11,0.4)' } : {}}>
            {label}
            <span className="ml-1.5 opacity-60">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── Main missions list ── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-400 text-sm">
              {statusFilter === 'all' ? 'لا توجد ماموريات حتى الآن' : `لا توجد ماموريات بحالة "${STATUS_MAP[statusFilter]?.label}"`}
            </p>
          </div>
        )}

        {filtered.map(mission => {
          const isOwn = mission.assigned_to === user?.id || mission.assigned_by === user?.id
          const canChangeStatus = (isAdmin || isOwn) && !['cancelled', 'rejected', 'pending_approval'].includes(mission.status)
          const canEdit   = isAdmin
          const canDelete = isAdmin || (mission.assigned_by === user?.id && mission.status === 'pending_approval')
          return (
            <div key={mission.id} className="rounded-2xl p-4 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-semibold text-sm truncate">{mission.title}</span>
                    <PriorityBadge value={mission.priority} />
                    <Badge value={mission.status} />
                  </div>
                  {mission.description && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{mission.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {isAdmin && (mission.assignee_name || mission.assignee_email) && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        👤 {mission.assignee_name || mission.assignee_email}
                      </span>
                    )}
                    {mission.location && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">📍 {mission.location}</span>
                    )}
                    {mission.start_date && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        📅 {mission.start_date}{mission.end_date ? ` ← ${mission.end_date}` : ''}
                      </span>
                    )}
                    {isAdmin && mission.assigner_name && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">✍️ {mission.assigner_name}</span>
                    )}
                  </div>
                  {mission.notes && (
                    <p className="text-slate-500 text-xs mt-1.5 italic">"{mission.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {canChangeStatus && (
                    <select value={mission.status}
                      onChange={e => handleStatusChange(mission.id, e.target.value)}
                      disabled={updatingId === mission.id}
                      className="bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-50">
                      {ACTIVE_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_MAP[s].label}</option>
                      ))}
                      <option value="completed">{STATUS_MAP.completed.label}</option>
                      <option value="cancelled">{STATUS_MAP.cancelled.label}</option>
                    </select>
                  )}
                  {canEdit && (
                    <button onClick={() => openEdit(mission)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setConfirmDelete(mission.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl my-4"
            style={{ background: 'linear-gradient(135deg,#1a1206,#150e04)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <h3 className="text-white font-semibold text-base mb-1">
              {editing ? '✏️ تعديل المأمورية' : isAdmin ? '📋 مأمورية جديدة' : '📋 طلب مأمورية'}
            </h3>
            {!isAdmin && !editing && (
              <p className="text-amber-400/70 text-xs mb-4">سيتم إرسال طلبك للسوبر أدمن للموافقة عليه.</p>
            )}
            <form onSubmit={handleSave} className="space-y-3 mt-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">العنوان *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                  placeholder="عنوان المأمورية..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الوصف</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  placeholder="تفاصيل المأمورية..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {isAdmin && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الموظف المكلَّف</label>
                    <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                      <option value="">— لا أحد —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الأولوية</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {isAdmin && editing && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الحالة</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الموقع / الجهة</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="مكان المأمورية..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">تاريخ البداية</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">تاريخ النهاية</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="ملاحظات إضافية..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </div>
              {err && <div className="text-red-400 text-xs">{err}</div>}
              <div className="flex gap-3 mt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}>
                  {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : isAdmin ? 'إنشاء المأمورية' : 'إرسال الطلب'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setErr('') }}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm delete / cancel ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'linear-gradient(135deg,#1a0c10,#1a0c10)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <h3 className="text-white font-semibold mb-2">⚠️ تأكيد</h3>
            <p className="text-slate-400 text-sm mb-5">
              {isAdmin ? 'هل أنت متأكد من حذف هذه المأمورية؟' : 'هل تريد سحب طلب المأمورية؟'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-500 transition-all">
                {isAdmin ? 'حذف' : 'سحب الطلب'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
