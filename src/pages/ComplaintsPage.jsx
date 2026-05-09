import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STATUS_INFO = {
  pending:      { label: 'قيد الانتظار',  color: 'text-yellow-400', bg: 'bg-yellow-900/25', border: 'border-yellow-500/20', icon: '⏳' },
  under_review: { label: 'قيد الدراسة',   color: 'text-blue-400',   bg: 'bg-blue-900/25',   border: 'border-blue-500/20',   icon: '🔍' },
  resolved:     { label: 'محلولة',         color: 'text-emerald-400', bg: 'bg-emerald-900/25', border: 'border-emerald-500/20', icon: '✅' },
  rejected:     { label: 'مرفوضة',         color: 'text-red-400',    bg: 'bg-red-900/25',    border: 'border-red-500/20',    icon: '❌' },
}

export default function ComplaintsPage({ isSuperAdmin = false, isEmployee = false }) {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  const [complaints, setComplaints] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ against_user_id: '', subject: '', description: '', is_anonymous: false })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [respondingId, setRespondingId] = useState(null)
  const [responseForm, setResponseForm] = useState({ status: '', admin_response: '' })

  useEffect(() => {
    fetchComplaints()
    if (isAdmin) fetchUsers()
  }, [])

  async function fetchComplaints() {
    setLoading(true)
    try { setComplaints(await api.getComplaints()) } catch {}
    setLoading(false)
  }

  async function fetchUsers() {
    try { setUsers(await api.getUsers()) } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) return
    setSubmitting(true); setMsg('')
    try {
      await api.createComplaint(form)
      setMsg('✓ تم إرسال شكواك بنجاح')
      setForm({ against_user_id: '', subject: '', description: '', is_anonymous: false })
      setShowForm(false)
      fetchComplaints()
    } catch (err) { setMsg('خطأ: ' + err.message) }
    setSubmitting(false)
  }

  async function handleRespond(id) {
    if (!responseForm.status) return
    try {
      await api.updateComplaint(id, responseForm)
      setRespondingId(null)
      fetchComplaints()
    } catch (err) { setMsg('خطأ: ' + err.message) }
  }

  async function handleDelete(id) {
    if (!confirm('هل تريد حذف هذه الشكوى؟')) return
    try { await api.deleteComplaint(id); fetchComplaints() } catch (err) { setMsg('خطأ: ' + err.message) }
  }

  const filtered = complaints.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q || (c.subject||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'pending').length,
    under_review: complaints.filter(c => c.status === 'under_review').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    rejected: complaints.filter(c => c.status === 'rejected').length,
  }

  return (
    <div>
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msg.startsWith('✓') ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20' : 'bg-red-900/30 text-red-300 border border-red-500/20'}`}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'الإجمالي', value: stats.total, color: 'text-slate-300' },
          { label: 'انتظار', value: stats.pending, color: 'text-yellow-400' },
          { label: 'قيد الدراسة', value: stats.under_review, color: 'text-blue-400' },
          { label: 'محلولة', value: stats.resolved, color: 'text-emerald-400' },
          { label: 'مرفوضة', value: stats.rejected, color: 'text-red-400' },
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
          {isAdmin ? 'جميع الشكاوي' : 'شكاواي'}
          <span className="text-slate-500 font-normal mr-1">({filtered.length})</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 w-40 placeholder-slate-600" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none">
            <option value="all">كل الحالات</option>
            <option value="pending">انتظار</option>
            <option value="under_review">قيد الدراسة</option>
            <option value="resolved">محلولة</option>
            <option value="rejected">مرفوضة</option>
          </select>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-all">
            + شكوى جديدة
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card rounded-2xl p-5 mb-4 space-y-4 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
          <h3 className="text-white font-semibold text-sm">تقديم شكوى جديدة</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الشكوى ضد (اختياري)</label>
              <select value={form.against_user_id} onChange={e => setForm(f => ({...f, against_user_id: e.target.value}))}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50">
                <option value="">غير محدد / الإدارة</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">موضوع الشكوى</label>
              <input required value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600"
                placeholder="اكتب موضوع الشكوى..." />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">تفاصيل الشكوى</label>
            <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none"
              placeholder="اكتب تفاصيل الشكوى بوضوح..." />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(f => ({...f, is_anonymous: e.target.checked}))}
              className="w-4 h-4 rounded border-white/20 bg-white/5" />
            <span className="text-slate-300 text-sm group-hover:text-white transition-colors">إرسال بشكل مجهول</span>
            <span className="text-slate-500 text-xs">(لن يظهر اسمك للإدارة)</span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-all">
              {submitting ? 'جاري الإرسال...' : 'إرسال الشكوى'}
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
          <p className="text-4xl mb-3">📣</p>
          <p className="text-sm">لا توجد شكاوي</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const st = STATUS_INFO[c.status] || STATUS_INFO.pending
            const isResponding = respondingId === c.id
            return (
              <div key={c.id} className={`glass-card rounded-2xl p-4 border ${st.border}`} style={{background:'rgba(10,10,20,0.6)'}}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${st.bg} border ${st.border}`}>
                      {st.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color} border ${st.border}`}>{st.label}</span>
                        {c.is_anonymous && <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/8">مجهول</span>}
                      </div>
                      <p className="text-white font-semibold text-sm">{c.subject}</p>
                      <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{c.description}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { setRespondingId(c.id); setResponseForm({ status: c.status, admin_response: c.admin_response || '' }) }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all">
                        رد / تحديث
                      </button>
                      <button onClick={() => handleDelete(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-900/20 transition-all border border-red-500/10">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-2 text-xs text-slate-500 mt-2">
                  {isAdmin && <span>من: {c.is_anonymous ? 'مجهول' : (c.complainant?.full_name || c.complainant?.email || '—')}</span>}
                  <span>ضد: {c.against_user?.full_name || c.against_user?.email || 'الإدارة'}</span>
                  <span>{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                </div>

                {c.admin_response && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1">رد الإدارة</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{c.admin_response}</p>
                  </div>
                )}

                {isAdmin && isResponding && (
                  <div className="mt-3 pt-3 border-t border-white/8 animate-scaleIn space-y-3">
                    <select value={responseForm.status} onChange={e => setResponseForm(f => ({...f, status: e.target.value}))}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none">
                      <option value="pending">⏳ انتظار</option>
                      <option value="under_review">🔍 قيد الدراسة</option>
                      <option value="resolved">✅ محلولة</option>
                      <option value="rejected">❌ مرفوضة</option>
                    </select>
                    <textarea rows={2} value={responseForm.admin_response} onChange={e => setResponseForm(f => ({...f, admin_response: e.target.value}))}
                      placeholder="رد الإدارة (اختياري)..."
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none resize-none placeholder-slate-600" />
                    <div className="flex gap-2">
                      <button onClick={() => handleRespond(c.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-medium transition-all">حفظ</button>
                      <button onClick={() => setRespondingId(null)} className="text-slate-400 hover:text-white text-xs px-4 py-2 rounded-xl border border-white/8 transition-all">إلغاء</button>
                    </div>
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
