import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const TYPE_LABELS = {
  warning: { label: 'إنذار', color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-500/25', icon: '⚠️' },
  deduction: { label: 'خصم راتب', color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-500/25', icon: '💰' },
  reprimand: { label: 'لفت نظر', color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-500/25', icon: '📋' },
  suspension: { label: 'إيقاف', color: 'text-red-500', bg: 'bg-red-950/40', border: 'border-red-600/30', icon: '🚫' },
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

  useEffect(() => {
    fetchPenalties()
    if (isAdmin) fetchUsers()
  }, [])

  async function fetchPenalties() {
    setLoading(true)
    try { setPenalties(await api.getPenalties()) } catch {}
    setLoading(false)
  }

  async function fetchUsers() {
    try {
      const all = await api.getUsers()
      setUsers(all.filter(u => u.role === 'employee'))
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

  const filtered = penalties.filter(p => {
    const matchType = filterType === 'all' || p.type === filterType
    const matchUser = !filterUser || p.user_id === filterUser
    const q = search.toLowerCase()
    const matchSearch = !q || (p.reason||'').toLowerCase().includes(q) || (p.user?.full_name||'').toLowerCase().includes(q) || (p.user?.email||'').toLowerCase().includes(q)
    return matchType && matchUser && matchSearch
  })

  const stats = {
    total: penalties.length,
    warnings: penalties.filter(p => p.type === 'warning').length,
    deductions: penalties.filter(p => p.type === 'deduction').length,
    reprimands: penalties.filter(p => p.type === 'reprimand').length,
    suspensions: penalties.filter(p => p.type === 'suspension').length,
    totalAmount: penalties.filter(p => p.type === 'deduction' && p.amount).reduce((s, p) => s + (p.amount || 0), 0),
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
        {[
          { label: 'الإجمالي', value: stats.total, color: 'text-slate-300' },
          { label: 'إنذارات', value: stats.warnings, color: 'text-yellow-400' },
          { label: 'لفت نظر', value: stats.reprimands, color: 'text-orange-400' },
          { label: 'خصم راتب', value: stats.deductions, color: 'text-red-400' },
          { label: 'إيقاف', value: stats.suspensions, color: 'text-red-500' },
          { label: 'إجمالي الخصم', value: stats.totalAmount > 0 ? `${stats.totalAmount.toFixed(0)} ج` : '—', color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-3 text-center" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-[11px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

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
            <option value="warning">إنذار</option>
            <option value="reprimand">لفت نظر</option>
            <option value="deduction">خصم راتب</option>
            <option value="suspension">إيقاف</option>
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

      {/* Create Form */}
      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="glass-card rounded-2xl p-5 mb-4 space-y-4 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
          <h3 className="text-white font-semibold text-sm">إضافة جزاء جديد</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الموظف</label>
              <select required value={form.user_id} onChange={e => setForm(f => ({...f, user_id: e.target.value}))}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50">
                <option value="">اختر موظف</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">نوع الجزاء</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50">
                <option value="warning">⚠️ إنذار</option>
                <option value="reprimand">📋 لفت نظر</option>
                <option value="deduction">💰 خصم راتب</option>
                <option value="suspension">🚫 إيقاف</option>
              </select>
            </div>
            {form.type === 'deduction' && (
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">مبلغ الخصم (جنيه)</label>
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
                        <option value="warning">⚠️ إنذار</option>
                        <option value="reprimand">📋 لفت نظر</option>
                        <option value="deduction">💰 خصم راتب</option>
                        <option value="suspension">🚫 إيقاف</option>
                      </select>
                      {editForm.type === 'deduction' && (
                        <input type="number" value={editForm.amount || ''} onChange={e => setEditForm(f => ({...f, amount: e.target.value}))}
                          placeholder="مبلغ الخصم" className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
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
    </div>
  )
}
