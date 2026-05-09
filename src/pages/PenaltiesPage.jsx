import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const PENALTY_TYPES = [
  { value: 'verbal_warning',    label: 'تنبيه شفهي',         icon: '💬', color: 'text-sky-400',     bg: 'bg-sky-900/30',    border: 'border-sky-500/25',    severity: 1, hasAmount: false },
  { value: 'reprimand',         label: 'لفت نظر',             icon: '📋', color: 'text-orange-400',  bg: 'bg-orange-900/30', border: 'border-orange-500/25', severity: 1, hasAmount: false },
  { value: 'warning',           label: 'إنذار',               icon: '⚠️', color: 'text-yellow-400',  bg: 'bg-yellow-900/30', border: 'border-yellow-500/25', severity: 2, hasAmount: false },
  { value: 'final_warning',     label: 'إنذار نهائي',         icon: '🔔', color: 'text-amber-400',   bg: 'bg-amber-900/30',  border: 'border-amber-500/25',  severity: 2, hasAmount: false },
  { value: 'late_penalty',      label: 'جزاء تأخر',           icon: '⏰', color: 'text-purple-400',  bg: 'bg-purple-900/30', border: 'border-purple-500/25', severity: 2, hasAmount: true  },
  { value: 'absence_deduction', label: 'خصم غياب',            icon: '📅', color: 'text-violet-400',  bg: 'bg-violet-900/30', border: 'border-violet-500/25', severity: 2, hasAmount: true  },
  { value: 'deduction',         label: 'خصم راتب',            icon: '💰', color: 'text-red-400',     bg: 'bg-red-900/30',    border: 'border-red-500/25',    severity: 3, hasAmount: true  },
  { value: 'bonus_forfeiture',  label: 'حرمان من مكافأة',     icon: '🎁', color: 'text-rose-400',    bg: 'bg-rose-900/30',   border: 'border-rose-500/25',   severity: 3, hasAmount: true  },
  { value: 'task_failure',      label: 'إخلال بالمهام',       icon: '📌', color: 'text-fuchsia-400', bg: 'bg-fuchsia-900/30',border: 'border-fuchsia-500/25',severity: 3, hasAmount: false },
  { value: 'suspension',        label: 'إيقاف عن العمل',      icon: '🚫', color: 'text-red-500',     bg: 'bg-red-950/40',    border: 'border-red-600/30',    severity: 4, hasAmount: false },
  { value: 'demotion',          label: 'تخفيض درجة وظيفية',  icon: '📉', color: 'text-red-600',     bg: 'bg-red-950/50',    border: 'border-red-700/30',    severity: 4, hasAmount: false },
  { value: 'termination',       label: 'إنهاء خدمة',          icon: '❌', color: 'text-red-700',     bg: 'bg-red-950/60',    border: 'border-red-800/30',    severity: 5, hasAmount: false },
  { value: 'other',             label: 'أخرى',                icon: '📌', color: 'text-slate-400',   bg: 'bg-slate-800/40',  border: 'border-slate-500/25',  severity: 1, hasAmount: false },
]

const TYPE_LABELS = Object.fromEntries(
  PENALTY_TYPES.map(t => [t.value, { label: t.label, color: t.color, bg: t.bg, border: t.border, icon: t.icon }])
)

const AMOUNT_TYPES = new Set(PENALTY_TYPES.filter(t => t.hasAmount).map(t => t.value))

// ── Escalation logic ──────────────────────────────────────────────────
const ESCALATION_CHAIN = [
  { minSeverity: 0, minTotal: 0, suggest: 'verbal_warning',    reason: 'لا توجد جزاءات سابقة — يُنصح بالبدء بتنبيه شفهي' },
  { minSeverity: 1, minTotal: 1, suggest: 'warning',           reason: 'يوجد جزاء سابق خفيف — يُنصح بإنذار' },
  { minSeverity: 1, minTotal: 3, suggest: 'final_warning',     reason: '3 جزاءات أو أكثر — يُنصح بإنذار نهائي' },
  { minSeverity: 2, minTotal: 1, suggest: 'deduction',         reason: 'سبق صدور إنذار — يُنصح بالخصم المالي' },
  { minSeverity: 2, minTotal: 3, suggest: 'suspension',        reason: '3 جزاءات إنذار أو أكثر — يُنصح بالإيقاف' },
  { minSeverity: 3, minTotal: 1, suggest: 'suspension',        reason: 'سبق خصم الراتب — يُنصح بالإيقاف عن العمل' },
  { minSeverity: 4, minTotal: 1, suggest: 'termination',       reason: 'سبق الإيقاف أو التخفيض — يُنصح بإنهاء الخدمة' },
]

function getEscalationSuggestion(userPenalties) {
  if (!userPenalties.length) return null
  const maxSeverity = Math.max(...userPenalties.map(p => PENALTY_TYPES.find(t => t.value === p.type)?.severity || 1))
  const total = userPenalties.length
  // Walk chain from highest to lowest threshold — first match wins
  const match = [...ESCALATION_CHAIN].reverse().find(r => maxSeverity >= r.minSeverity && total >= r.minTotal)
  if (!match) return null
  const pt = PENALTY_TYPES.find(t => t.value === match.suggest)
  return pt ? { ...pt, reason: match.reason, total, maxSeverity } : null
}

function EmployeeSummary({ penalties, users, onFilterEmployee }) {
  const [sortBy, setSortBy] = useState('total')

  const summaryMap = {}
  for (const p of penalties) {
    if (!summaryMap[p.user_id]) {
      summaryMap[p.user_id] = { user: p.user, total: 0, byType: {}, totalAmount: 0, maxSeverity: 0 }
    }
    const s = summaryMap[p.user_id]
    s.total++
    s.byType[p.type] = (s.byType[p.type] || 0) + 1
    if (AMOUNT_TYPES.has(p.type) && p.amount) s.totalAmount += p.amount
    const pt = PENALTY_TYPES.find(t => t.value === p.type)
    if (pt && pt.severity > s.maxSeverity) s.maxSeverity = pt.severity
  }

  const rows = Object.entries(summaryMap).map(([uid, s]) => ({ uid, ...s }))

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'total') return b.total - a.total
    if (sortBy === 'amount') return b.totalAmount - a.totalAmount
    if (sortBy === 'severity') return b.maxSeverity - a.maxSeverity
    return b.total - a.total
  })

  const riskLevel = (row) => {
    if (row.maxSeverity >= 5) return { label: 'إنهاء خدمة', color: 'text-red-700', dot: 'bg-red-700' }
    if (row.maxSeverity >= 4) return { label: 'عالي جداً', color: 'text-red-500', dot: 'bg-red-500' }
    if (row.maxSeverity >= 3) return { label: 'عالي', color: 'text-red-400', dot: 'bg-red-400' }
    if (row.maxSeverity >= 2 || row.total >= 3) return { label: 'متوسط', color: 'text-orange-400', dot: 'bg-orange-400' }
    if (row.total > 0) return { label: 'منخفض', color: 'text-yellow-400', dot: 'bg-yellow-400' }
    return { label: 'لا يوجد', color: 'text-slate-500', dot: 'bg-slate-600' }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-sm">لا توجد جزاءات مسجلة بعد</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-xs">{sorted.length} موظف لديهم جزاءات</p>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">ترتيب حسب:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-white/5 border border-white/8 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none">
            <option value="total">إجمالي الجزاءات</option>
            <option value="amount">أعلى خصم مالي</option>
            <option value="severity">أعلى خطورة</option>
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((row, i) => {
          const risk = riskLevel(row)
          const name = row.user?.full_name || row.user?.email || 'موظف محذوف'
          const topTypes = Object.entries(row.byType)
            .sort((a, b) => {
              const sa = PENALTY_TYPES.find(t => t.value === a[0])?.severity || 0
              const sb = PENALTY_TYPES.find(t => t.value === b[0])?.severity || 0
              return sb - sa
            })
            .slice(0, 4)
          return (
            <div key={row.uid}
              className="glass-card rounded-2xl p-4 border border-white/7 hover:border-indigo-500/20 transition-all cursor-pointer group"
              style={{ background: 'rgba(10,10,20,0.6)' }}
              onClick={() => onFilterEmployee(row.uid)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-900/40 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-xs font-bold">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm font-medium truncate">{name}</span>
                    <span className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`}></span>
                      <span className={`text-[10px] font-medium ${risk.color}`}>{risk.label}</span>
                    </span>
                    <span className="text-indigo-400 text-[10px] group-hover:text-indigo-300 transition-colors mr-auto flex-shrink-0">عرض التفاصيل ←</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topTypes.map(([type, count]) => {
                      const pt = TYPE_LABELS[type] || TYPE_LABELS.other || { label: type, color: 'text-slate-400', bg: 'bg-slate-800/40', border: 'border-slate-500/25', icon: '📌' }
                      return (
                        <span key={type} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${pt.bg} ${pt.color} border ${pt.border}`}>
                          {pt.icon} {count} {pt.label}
                        </span>
                      )
                    })}
                    {row.totalAmount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-500/20">
                        💸 {row.totalAmount.toFixed(0)} ج.م
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/8 mr-auto">
                      المجموع: {row.total}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PenaltiesPage({ isSuperAdmin = false, isEmployee = false }) {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  const [penalties, setPenalties] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user_id: '', type: 'warning', reason: '', amount: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterUser, setFilterUser] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [view, setView] = useState('log')
  const [escalation, setEscalation] = useState(null)

  useEffect(() => {
    fetchPenalties()
    if (isAdmin) fetchUsers()
  }, [])

  useEffect(() => {
    if (!form.user_id) { setEscalation(null); return }
    const userPenalties = penalties.filter(p => p.user_id === form.user_id)
    setEscalation(getEscalationSuggestion(userPenalties))
  }, [form.user_id, penalties])

  async function fetchPenalties() {
    setLoading(true)
    try { setPenalties(await api.getPenalties()) }
    catch (err) { setMsg('خطأ: ' + err.message) }
    setLoading(false)
  }

  async function fetchUsers() {
    try {
      const all = await api.getUsers()
      setUsers(all)
    } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.user_id || !form.reason.trim()) return
    setSubmitting(true); setMsg('')
    try {
      await api.createPenalty({ ...form, amount: form.amount ? Number(form.amount) : null })
      setMsg('✓ تم إضافة الجزاء بنجاح')
      setForm({ user_id: '', type: 'warning', reason: '', amount: '', notes: '' })
      setShowForm(false)
      fetchPenalties()
    } catch (err) { setMsg('خطأ: ' + err.message) }
    setSubmitting(false)
  }

  async function handleDelete(id) {
    if (!confirm('هل تريد حذف هذا الجزاء؟')) return
    try { await api.deletePenalty(id); fetchPenalties() } catch (err) { setMsg('خطأ: ' + err.message) }
  }

  async function handleEdit(id) {
    try {
      await api.updatePenalty(id, editForm)
      setEditingId(null)
      fetchPenalties()
    } catch (err) { setMsg('خطأ: ' + err.message) }
  }

  function handleFilterEmployee(uid) {
    setFilterUser(uid)
    setView('log')
  }

  const filtered = penalties.filter(p => {
    const matchType = filterType === 'all' || p.type === filterType
    const matchUser = !filterUser || p.user_id === filterUser
    const q = search.toLowerCase()
    const matchSearch = !q || (p.reason||'').toLowerCase().includes(q) || (p.user?.full_name||'').toLowerCase().includes(q) || (p.user?.email||'').toLowerCase().includes(q)
    return matchType && matchUser && matchSearch
  })

  const totalAmount = penalties.filter(p => AMOUNT_TYPES.has(p.type) && p.amount).reduce((s, p) => s + (p.amount || 0), 0)
  const typeCounts = {}
  for (const p of penalties) typeCounts[p.type] = (typeCounts[p.type] || 0) + 1
  const topTypes = PENALTY_TYPES.filter(t => typeCounts[t.value]).sort((a, b) => (typeCounts[b.value] || 0) - (typeCounts[a.value] || 0)).slice(0, 4)
  const stats = {
    total: penalties.length,
    totalAmount,
  }

  return (
    <div>
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msg.startsWith('✓') ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20' : 'bg-red-900/30 text-red-300 border border-red-500/20'}`}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <div className="glass-card rounded-2xl p-3 text-center" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
          <p className="text-xl font-bold text-slate-300">{stats.total}</p>
          <p className="text-slate-500 text-[11px] mt-0.5">الإجمالي</p>
        </div>
        {topTypes.map(t => (
          <div key={t.value} className={`glass-card rounded-2xl p-3 text-center ${t.bg} border ${t.border}`}>
            <p className={`text-xl font-bold ${t.color}`}>{typeCounts[t.value]}</p>
            <p className="text-slate-400 text-[11px] mt-0.5">{t.icon} {t.label}</p>
          </div>
        ))}
        <div className="glass-card rounded-2xl p-3 text-center" style={{border:'1px solid rgba(239,68,68,0.15)'}}>
          <p className="text-xl font-bold text-red-400">{stats.totalAmount > 0 ? `${stats.totalAmount.toFixed(0)}` : '—'}</p>
          <p className="text-slate-500 text-[11px] mt-0.5">💸 إجمالي الخصم (ج)</p>
        </div>
      </div>

      {/* View Toggle (admin only) */}
      {isAdmin && (
        <div className="flex gap-1 mb-4 bg-white/4 rounded-xl p-1 w-fit border border-white/6">
          <button
            onClick={() => setView('log')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'log' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            سجل الجزاءات
          </button>
          <button
            onClick={() => setView('summary')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'summary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            ملخص الموظفين
          </button>
        </div>
      )}

      {/* Summary View */}
      {isAdmin && view === 'summary' && (
        <EmployeeSummary penalties={penalties} users={users} onFilterEmployee={handleFilterEmployee} />
      )}

      {/* Log View */}
      {view === 'log' && (
        <>
          {/* Header */}
          <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">
              {isAdmin ? 'سجل الجزاءات' : 'جزاءاتي'}
              <span className="text-slate-500 font-normal mr-1">({filtered.length})</span>
            </h2>
            <div className="flex gap-2 flex-wrap">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث..."
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 w-40 placeholder-slate-600"
              />
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none">
                <option value="all">كل الأنواع</option>
                {PENALTY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
              {isAdmin && (
                <>
                  <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                    className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none">
                    <option value="">كل الموظفين</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                  <button onClick={() => setShowForm(v => !v)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-all">
                    + جزاء جديد
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Active filter badge */}
          {filterUser && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">فلتر:</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5">
                {users.find(u => u.id === filterUser)?.full_name || users.find(u => u.id === filterUser)?.email || 'موظف'}
                <button onClick={() => setFilterUser('')} className="text-indigo-400 hover:text-white transition-colors">✕</button>
              </span>
            </div>
          )}

          {/* Create Form */}
          {isAdmin && showForm && (
            <form onSubmit={handleCreate} className="glass-card rounded-2xl p-5 mb-4 space-y-4 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
              <h3 className="text-white font-semibold text-sm">إضافة جزاء جديد</h3>

              {/* Employee selector */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الموظف</label>
                <select required value={form.user_id} onChange={e => setForm(f => ({...f, user_id: e.target.value}))}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50">
                  <option value="">اختر موظف</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>

              {/* Escalation Banner */}
              {form.user_id && escalation && (
                <div className={`rounded-2xl p-4 border ${escalation.severity >= 4 ? 'bg-red-950/40 border-red-600/30' : escalation.severity >= 3 ? 'bg-orange-950/40 border-orange-600/30' : 'bg-amber-950/30 border-amber-500/25'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${escalation.bg} border ${escalation.border}`}>
                      {escalation.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white text-xs font-semibold">اقتراح التصعيد التلقائي</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${escalation.bg} ${escalation.color} border ${escalation.border}`}>
                          {escalation.icon} {escalation.label}
                        </span>
                      </div>
                      <p className={`text-xs ${escalation.severity >= 4 ? 'text-red-300' : escalation.severity >= 3 ? 'text-orange-300' : 'text-amber-300'} mb-1`}>{escalation.reason}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>إجمالي الجزاءات السابقة: <span className="text-slate-300 font-medium">{escalation.total}</span></span>
                        <span>أعلى خطورة: <span className="text-slate-300 font-medium">{escalation.maxSeverity}/5</span></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: escalation.value, amount: '' }))}
                      className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all
                        ${escalation.severity >= 4
                          ? 'bg-red-900/50 border-red-500/30 text-red-300 hover:bg-red-800/60'
                          : escalation.severity >= 3
                          ? 'bg-orange-900/50 border-orange-500/30 text-orange-300 hover:bg-orange-800/60'
                          : 'bg-amber-900/50 border-amber-500/30 text-amber-300 hover:bg-amber-800/60'
                        }`}
                    >
                      تطبيق ←
                    </button>
                  </div>
                </div>
              )}

              {/* No history notice */}
              {form.user_id && !escalation && (
                <div className="rounded-xl px-4 py-3 bg-emerald-950/30 border border-emerald-600/20 flex items-center gap-2 text-xs text-emerald-400">
                  <span>✅</span>
                  <span>لا توجد جزاءات سابقة لهذا الموظف — أول جزاء</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">نوع الجزاء</label>
                  <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value, amount: ''}))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50">
                    {PENALTY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
                {AMOUNT_TYPES.has(form.type) && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">المبلغ (جنيه)</label>
                    <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600"
                      placeholder="0" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">السبب</label>
                <textarea required rows={2} value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none"
                  placeholder="اكتب سبب الجزاء..." />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">ملاحظات إضافية (اختياري)</label>
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600"
                  placeholder="أي تفاصيل إضافية..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-all">
                  {submitting ? 'جاري الحفظ...' : 'حفظ الجزاء'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm px-4 py-2 rounded-xl border border-white/8 transition-all">إلغاء</button>
              </div>
            </form>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-16 text-slate-500">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">⚖️</p>
              <p className="text-sm">لا توجد جزاءات</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => {
                const t = TYPE_LABELS[p.type] || TYPE_LABELS.warning
                const isEditing = editingId === p.id
                return (
                  <div key={p.id} className={`glass-card rounded-2xl p-4 border ${t.border}`} style={{background: 'rgba(10,10,20,0.6)'}}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <select value={editForm.type} onChange={e => setEditForm(f => ({...f, type: e.target.value}))}
                            className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none">
                            {PENALTY_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                            ))}
                          </select>
                          {AMOUNT_TYPES.has(editForm.type) && (
                            <input type="number" value={editForm.amount || ''} onChange={e => setEditForm(f => ({...f, amount: e.target.value}))}
                              placeholder="المبلغ (جنيه)" className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
                          )}
                        </div>
                        <textarea rows={2} value={editForm.reason} onChange={e => setEditForm(f => ({...f, reason: e.target.value}))}
                          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(p.id)} className="bg-emerald-800/60 hover:bg-emerald-700/70 text-emerald-300 text-xs px-4 py-2 rounded-xl border border-emerald-600/20 transition-all">حفظ</button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white text-xs px-4 py-2 rounded-xl border border-white/8 transition-all">إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${t.bg} border ${t.border}`}>
                            {t.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.bg} ${t.color} border ${t.border}`}>{t.label}</span>
                              {isAdmin && <span className="text-slate-300 text-sm font-medium">{p.user?.full_name || p.user?.email || '—'}</span>}
                              {p.amount && <span className="text-red-400 text-xs font-semibold">{p.amount} ج.م</span>}
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed">{p.reason}</p>
                            {p.notes && <p className="text-slate-500 text-xs mt-1">{p.notes}</p>}
                            <div className="flex items-center gap-3 mt-2 text-slate-600 text-xs">
                              <span>{new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                              {p.issued_by_user && <span>بواسطة: {p.issued_by_user.full_name || p.issued_by_user.email}</span>}
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => { setEditingId(p.id); setEditForm({ type: p.type, reason: p.reason, amount: p.amount || '', notes: p.notes || '' }) }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all border border-white/6">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-900/20 transition-all border border-red-500/10">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
