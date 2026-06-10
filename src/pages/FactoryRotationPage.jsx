import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const COLORS = [
  '#3b82f6','#06b6d4','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#ec4899','#14b8a6','#f97316','#a855f7','#6366f1','#22c55e',
]

function getColor(idx) {
  return COLORS[idx % COLORS.length]
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

function normDate(d) {
  if (!d) return ''
  // If it's already YYYY-MM-DD, return as-is
  const s = String(d)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Handle ISO datetime strings like "2026-05-20T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
  // Handle Date objects or any other format — reformat to Cairo date
  try {
    return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
  } catch {
    return s.slice(0, 10)
  }
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

function firstOfMonth(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }).slice(0, 7) + '-01'
}

function lastOfMonth(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset + 1, 0)
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

function dateStrCairo(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
}

export default function FactoryRotationPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  return isAdmin ? <AdminView /> : <EmployeeView />
}

// ─────────────────────────────────── ADMIN VIEW ───────────────────────────────
function AdminView() {
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [monthOffset, setMonthOffset] = useState(0)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genForm, setGenForm] = useState({ group_id: '', from_date: '', to_date: '' })
  const [overrideEntry, setOverrideEntry] = useState(null)
  const [overrideUser, setOverrideUser] = useState('')
  const [assignDay, setAssignDay] = useState(null)
  const [assignUser, setAssignUser] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  // Personal attendance state
  const [myDays, setMyDays] = useState([])
  const [markingId, setMarkingId] = useState(null)
  const [attendToast, setAttendToast] = useState('')

  function showAttendToast(msg) {
    setAttendToast(msg)
    setTimeout(() => setAttendToast(''), 3000)
  }

  async function loadMyDays() {
    try {
      const data = await api.getMyNextFactory()
      const rows = Array.isArray(data) ? data : (data.rows || [])
      setMyDays(rows)
    } catch (e) { console.error(e) }
  }

  async function handleAttendSelf(entry) {
    setMarkingId(entry.id)
    try {
      await api.markFactoryAttendance(entry.id)
      setMyDays(prev => prev.map(d => d.id === entry.id ? { ...d, attended_at: new Date().toISOString() } : d))
      showAttendToast('✅ تم تسجيل حضورك في المصنع بنجاح!')
    } catch (e) {
      showAttendToast('❌ ' + (e.message || 'حدث خطأ'))
    } finally {
      setMarkingId(null)
    }
  }

  const [adminPendingSwaps, setAdminPendingSwaps] = useState([])
  const [adminSwapProcessing, setAdminSwapProcessing] = useState(null)

  async function loadAdminPendingSwaps() {
    try {
      const data = await api.getAdminPendingSwaps()
      setAdminPendingSwaps((data || []).filter(s => s.module === 'factory'))
    } catch {}
  }

  async function handleAdminApproveSwap(id) {
    setAdminSwapProcessing(id)
    try {
      await api.adminApproveSwap(id)
      setSuccess('✅ تمت الموافقة وتطبيق التبديل')
      loadAdminPendingSwaps()
    } catch (e) { setErr(e.message) }
    setAdminSwapProcessing(null)
  }

  async function handleAdminRejectSwap(id) {
    setAdminSwapProcessing(id)
    try {
      await api.adminRejectSwap(id)
      setSuccess('تم رفض طلب التبديل')
      loadAdminPendingSwaps()
    } catch (e) { setErr(e.message) }
    setAdminSwapProcessing(null)
  }

  useEffect(() => { load(); loadMyDays(); loadAdminPendingSwaps() }, [])

  useEffect(() => {
    if (selectedGroup) loadSchedule(selectedGroup, monthOffset)
  }, [selectedGroup, monthOffset])

  async function load() {
    setLoading(true)
    try {
      const [g, u] = await Promise.all([api.getFactoryGroups(), api.getUsers()])
      setGroups(g)
      setUsers(u)
      if (g.length > 0 && !selectedGroup) setSelectedGroup(g[0].id)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  async function loadSchedule(groupId, offset) {
    try {
      const rows = await api.getFactorySchedule(groupId, firstOfMonth(offset), lastOfMonth(offset))
      setSchedule(rows)
    } catch (e) {
      console.error('[loadSchedule]', e)
    }
  }

  async function handleSaveGroup(name, members) {
    setSaving(true); setErr(''); setSuccess('')
    try {
      if (editingGroup) {
        await api.updateFactoryGroup(editingGroup.id, name, members)
        setSuccess('تم تحديث المجموعة بنجاح')
      } else {
        await api.createFactoryGroup(name, members)
        setSuccess('تم إنشاء المجموعة بنجاح')
      }
      setShowGroupModal(false)
      setEditingGroup(null)
      await load()
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function handleDeleteGroup(id) {
    if (!confirm('هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جدول التناوب أيضاً.')) return
    try {
      await api.deleteFactoryGroup(id)
      if (selectedGroup === id) setSelectedGroup(null)
      await load()
      setSuccess('تم حذف المجموعة')
    } catch (e) { setErr(e.message) }
  }

  async function handleGenerate() {
    setGenerating(true); setErr(''); setSuccess('')
    try {
      const r = await api.generateFactorySchedule(genForm.group_id, genForm.from_date, genForm.to_date)
      setSuccess(`تم إنشاء ${r.generated} يوم في الجدول`)
      setShowGenerateModal(false)
      if (genForm.group_id === selectedGroup) loadSchedule(selectedGroup, monthOffset)
    } catch (e) { setErr(e.message) }
    setGenerating(false)
  }

  async function handleOverride() {
    if (!overrideUser) return
    setSaving(true)
    setErr('')
    try {
      await api.overrideFactoryEntry(overrideEntry.id, overrideUser)
      await loadSchedule(selectedGroup, monthOffset)
      setOverrideEntry(null)
      setOverrideUser('')
      setSuccess('تم تغيير الموظف بنجاح')
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  async function handleAssign() {
    if (!assignUser || !assignDay) return
    setAssignSaving(true)
    setErr('')
    try {
      await api.assignFactoryEntry(selectedGroup, assignUser, assignDay)
      await loadSchedule(selectedGroup, monthOffset)
      setAssignDay(null)
      setAssignUser('')
      setSuccess('تم تعيين الموظف بنجاح')
    } catch (e) { setErr(e.message) }
    setAssignSaving(false)
  }

  const currentGroup = groups.find(g => g.id === selectedGroup)
  const memberColorMap = {}
  currentGroup?.members?.forEach((m, i) => { memberColorMap[m.user_id] = getColor(i) })

  const today = todayStr()
  const tomorrow = tomorrowStr()

  const monthLabel = new Date(firstOfMonth(monthOffset)).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

  const scheduleByDate = {}
  schedule.forEach(s => { scheduleByDate[normDate(s.scheduled_date)] = s })

  const firstDay = new Date(firstOfMonth(monthOffset))
  const lastDay = new Date(lastOfMonth(monthOffset))
  const calDays = []
  const startPad = firstDay.getDay()
  for (let i = 0; i < startPad; i++) calDays.push(null)
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    calDays.push(dateStrCairo(d))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">🏭</span> تناوب المصنع
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">إدارة مجموعات وجداول تناوب المصنع</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingGroup(null); setShowGroupModal(true) }}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
            style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}
          >
            + مجموعة جديدة
          </button>
          <button
            onClick={() => {
              setGenForm({ group_id: selectedGroup || '', from_date: firstOfMonth(), to_date: lastOfMonth() })
              setShowGenerateModal(true)
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all"
          >
            ⚡ توليد الجدول
          </button>
        </div>
      </div>

      {/* Personal Attendance Section */}
      {(() => {
        const td = todayStr()
        const todayEntry = myDays.find(d => normDate(d.scheduled_date) === td)
        const upcomingMine = myDays.filter(d => normDate(d.scheduled_date) > td).sort((a,b) => normDate(a.scheduled_date).localeCompare(normDate(b.scheduled_date))).slice(0,3)
        const pastMine = myDays.filter(d => normDate(d.scheduled_date) < td).sort((a,b) => normDate(b.scheduled_date).localeCompare(normDate(a.scheduled_date))).slice(0,3)
        if (!todayEntry && upcomingMine.length === 0 && pastMine.length === 0) return null
        return (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👤</span>
              <span className="text-violet-300 font-semibold text-sm">دورتي في المصنع</span>
            </div>
            {todayEntry && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-amber-300 font-bold text-sm">🏭 يومك في المصنع اليوم!</div>
                  <div className="text-slate-400 text-xs mt-0.5">{todayEntry.scheduled_date}</div>
                </div>
                {todayEntry.attended_at ? (
                  <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-1.5">
                    <span className="text-emerald-400 text-sm font-bold">✓ تم تسجيل الحضور</span>
                    <span className="text-slate-500 text-xs">{new Date(todayEntry.attended_at).toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAttendSelf(todayEntry)}
                    disabled={markingId === todayEntry.id}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                    style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)'}}
                  >
                    {markingId === todayEntry.id ? '...' : '✋ سجّل حضورك'}
                  </button>
                )}
              </div>
            )}
            {(upcomingMine.length > 0 || pastMine.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {upcomingMine.map(d => (
                  <div key={d.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                    <span>📅</span> {d.scheduled_date}
                  </div>
                ))}
                {pastMine.map(d => (
                  <div key={d.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border ${d.attended_at ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {d.attended_at ? '✓' : '✗'} {d.scheduled_date}
                  </div>
                ))}
              </div>
            )}
            {attendToast && (
              <div className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-sm">
                {attendToast}
              </div>
            )}
          </div>
        )
      })()}

      {err && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
      {success && <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}

      {/* ── Admin Pending Swap Approvals ── */}
      {adminPendingSwaps.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.25)'}}>
          <h3 className="text-amber-400 text-sm font-semibold flex items-center gap-2">
            <span>⏳</span> طلبات تبديل تنتظر موافقتك ({adminPendingSwaps.length})
          </h3>
          <div className="space-y-2">
            {adminPendingSwaps.map(swap => (
              <div key={swap.id} className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
                style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(245,158,11,0.15)'}}>
                <div>
                  <p className="text-white text-sm font-medium">
                    <span className="text-amber-300">{swap.requester_name}</span> ↔ <span className="text-cyan-300">{swap.target_name}</span>
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    يوم {swap.requester_date}{swap.target_date ? ` ↔ ${swap.target_date}` : ''}
                  </p>
                  {swap.note && <p className="text-slate-500 text-xs italic mt-0.5">"{swap.note}"</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminApproveSwap(swap.id)}
                    disabled={adminSwapProcessing === swap.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all"
                    style={{background:'linear-gradient(135deg,#059669,#10b981)'}}>
                    {adminSwapProcessing === swap.id ? '...' : '✓ موافقة'}
                  </button>
                  <button
                    onClick={() => handleAdminRejectSwap(swap.id)}
                    disabled={adminSwapProcessing === swap.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 transition-all">
                    ✕ رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(g => (
          <div
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className="rounded-2xl p-4 cursor-pointer transition-all"
            style={{
              background: selectedGroup === g.id ? 'rgba(8,145,178,0.15)' : 'rgba(255,255,255,0.03)',
              border: selectedGroup === g.id ? '1px solid rgba(8,145,178,0.4)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold text-sm">{g.name}</p>
                <p className="text-slate-500 text-xs mt-1">{g.members?.length || 0} أعضاء</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); setEditingGroup(g); setShowGroupModal(true) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {g.members?.slice(0, 6).map((m, i) => (
                <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{background:`${getColor(i)}22`, color: getColor(i), border:`1px solid ${getColor(i)}44`}}>
                  {m.full_name || m.email}
                </span>
              ))}
              {g.members?.length > 6 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full text-slate-500 bg-white/5">+{g.members.length - 6}</span>
              )}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-3 text-center py-10 text-slate-500">لا توجد مجموعات. أنشئ مجموعة جديدة للبدء.</div>
        )}
      </div>

      {/* Calendar */}
      {currentGroup && (
        <div className="rounded-2xl p-5" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">📅 جدول: {currentGroup.name}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setMonthOffset(m => m - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all">‹</button>
              <span className="text-slate-300 text-sm font-medium min-w-[130px] text-center">{monthLabel}</span>
              <button onClick={() => setMonthOffset(m => m + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['أح','إث','ث','أر','خ','ج','س'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calDays.map((dateStr, i) => {
              if (!dateStr) return <div key={`pad-${i}`} />
              const entry = scheduleByDate[dateStr]
              const isToday = dateStr === today
              const isTomorrow = dateStr === tomorrow
              const dayNum = new Date(dateStr).getDay()
              const isWeekend = dayNum === 5 || dayNum === 6
              const color = entry ? (memberColorMap[entry.user_id] || '#64748b') : null

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (isWeekend) return
                    if (entry) setOverrideEntry(entry)
                    else setAssignDay(dateStr)
                  }}
                  className={`rounded-lg p-1 min-h-[60px] flex flex-col items-center justify-start transition-all group ${!isWeekend ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                  style={{
                    background: isToday ? 'rgba(8,145,178,0.15)' : isTomorrow ? 'rgba(8,145,178,0.08)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                    border: isToday ? '1px solid rgba(8,145,178,0.5)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className={`text-[11px] font-semibold mb-1 ${isToday ? 'text-cyan-400' : isWeekend ? 'text-slate-600' : 'text-slate-400'}`}>
                    {new Date(dateStr).getDate()}
                  </span>
                  {entry && (() => {
                    const isPast = dateStr < today
                    const isDateToday = dateStr === today
                    const attended = !!entry.attended_at
                    const showCheck = attended
                    const showCross = !!entry.is_absent
                    return (
                      <>
                        <span
                          className="text-[10px] font-semibold px-1 py-0.5 rounded-md text-center leading-tight w-full truncate block mt-0.5"
                          style={{background:`${color}25`, color, border:`1px solid ${color}40`}}>
                          {entry.full_name?.split(' ')[0] || entry.email?.split('@')[0]}
                        </span>
                        {(showCheck || showCross) && (
                          <span
                            className={`text-[11px] font-extrabold mt-0.5 leading-none ${showCheck ? 'text-emerald-400' : 'text-red-400'}`}
                            title={showCheck ? `حضر — ${new Date(entry.attended_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}` : 'تغيّب'}
                          >
                            {showCheck ? '✓' : '✗'}
                          </span>
                        )}
                      </>
                    )
                  })()}
                  {!entry && !isWeekend && (
                    <span className="text-slate-700 group-hover:text-slate-400 transition-colors text-base leading-none opacity-0 group-hover:opacity-100 mt-0.5">+</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
            {currentGroup.members?.map((m, i) => (
              <div key={m.user_id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{background: getColor(i)}} />
                <span className="text-[11px] text-slate-400">{m.full_name || m.email}</span>
              </div>
            ))}
          </div>

          {/* Monthly assignment stats */}
          {currentGroup.members?.length > 0 && (() => {
            const counts = currentGroup.members.map(m => schedule.filter(s => s.user_id === m.user_id).length)
            const total = counts.reduce((a, b) => a + b, 0)
            const avg = currentGroup.members.length > 0 ? total / currentGroup.members.length : 0

            const getLoadColor = (count) => {
              if (avg === 0) return { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: '#94a3b8' }
              const ratio = count / avg
              if (ratio > 1.2)  return { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  text: '#f87171' }
              if (ratio > 1.0)  return { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', text: '#fbbf24' }
              if (ratio >= 0.8) return { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  text: '#4ade80' }
              return { bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.15)', text: '#64748b' }
            }

            const handleExportCSV = () => {
              const monthKey = firstOfMonth(monthOffset).slice(0, 7)
              const rows = [['Name', 'Days Assigned', 'Month']]
              currentGroup.members.forEach(m => {
                const days = schedule.filter(s => s.user_id === m.user_id).length
                rows.push([m.full_name || m.email, days, monthKey])
              })
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `rotation-stats-${monthKey}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }

            return (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest">إحصائيات التعيينات — {monthLabel}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.3)'}}>
                      avg {avg % 1 === 0 ? avg : avg.toFixed(1)}
                    </span>
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    تصدير CSV
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {currentGroup.members.map((m, i) => {
                    const memberDays = schedule
                      .filter(s => s.user_id === m.user_id)
                      .sort((a, b) => normDate(a.scheduled_date).localeCompare(normDate(b.scheduled_date)))
                    const today2 = todayStr()
                    const pastMemberDays = memberDays.filter(s => normDate(s.scheduled_date) < today2)
                    const attendedDays = pastMemberDays.filter(s => s.attended_at)
                    const attendRate = pastMemberDays.length > 0 ? Math.round((attendedDays.length / pastMemberDays.length) * 100) : null
                    const dotColor = getColor(i)
                    const { bg, border, text } = getLoadColor(counts[i])
                    return (
                      <div
                        key={m.user_id}
                        className="rounded-xl px-3 py-3"
                        style={{background: bg, border: `1px solid ${border}`}}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: dotColor}} />
                            <span className="text-sm font-semibold" style={{color: dotColor}}>
                              {m.full_name || m.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {attendRate !== null && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background: attendRate >= 80 ? 'rgba(16,185,129,0.15)' : attendRate >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)',
                                  color: attendRate >= 80 ? '#34d399' : attendRate >= 50 ? '#fbbf24' : '#f87171',
                                  border: `1px solid ${attendRate >= 80 ? 'rgba(16,185,129,0.3)' : attendRate >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.25)'}`,
                                }}>
                                حضور {attendRate}%
                              </span>
                            )}
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:`${dotColor}22`, color: text}}>
                              {memberDays.length} يوم
                            </span>
                          </div>
                        </div>
                        {pastMemberDays.length > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-emerald-400">✓ {attendedDays.length} حضر</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-[10px] text-red-400">✗ {pastMemberDays.length - attendedDays.length} تغيّب</span>
                          </div>
                        )}
                        {memberDays.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {memberDays.map(s => {
                              const isPast = normDate(s.scheduled_date) < today2
                              const att = !!s.attended_at
                              return (
                                <span
                                  key={s.id}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                  style={{background:`${dotColor}18`, color: dotColor, border:`1px solid ${dotColor}35`}}
                                >
                                  {new Date(s.scheduled_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                  {isPast && <span style={{color: att ? '#34d399' : '#f87171'}}>{att ? '✓' : '✗'}</span>}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {avg > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-white/5">
                    <span className="text-[10px] flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400"></span><span className="text-slate-500">مثقل (&gt;20% فوق المتوسط)</span></span>
                    <span className="text-[10px] flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span><span className="text-slate-500">فوق المتوسط</span></span>
                    <span className="text-[10px] flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-400"></span><span className="text-slate-500">قريب من المتوسط</span></span>
                    <span className="text-[10px] flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-500"></span><span className="text-slate-500">أقل من المتوسط</span></span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <GroupModal
          group={editingGroup}
          users={users}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null) }}
          saving={saving}
        />
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#0c1a2e,#0a1628)', border:'1px solid rgba(8,145,178,0.3)'}}>
            <h3 className="text-white font-semibold text-base mb-4" dir="rtl">⚡ توليد جدول التناوب</h3>
            <div className="space-y-3" dir="rtl">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">المجموعة</label>
                <select
                  value={genForm.group_id}
                  onChange={e => setGenForm(f => ({ ...f, group_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="">اختر مجموعة</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">من تاريخ</label>
                <input type="date" value={genForm.from_date} onChange={e => setGenForm(f => ({ ...f, from_date: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">إلى تاريخ</label>
                <input type="date" value={genForm.to_date} onChange={e => setGenForm(f => ({ ...f, to_date: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              {err && <p className="text-red-400 text-xs">{err}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleGenerate} disabled={generating || !genForm.group_id || !genForm.from_date || !genForm.to_date}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>
                {generating ? 'جارٍ التوليد...' : 'توليد'}
              </button>
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal (empty day) */}
      {assignDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#0c1a2e,#0a1628)', border:'1px solid rgba(8,145,178,0.3)'}}>
            <h3 className="text-white font-semibold text-base mb-1" dir="rtl">➕ تعيين موظف</h3>
            <p className="text-slate-400 text-xs mb-4" dir="rtl">{assignDay} — لا يوجد موظف مُعيَّن</p>
            <div dir="rtl">
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">اختر موظفاً</label>
              <select value={assignUser} onChange={e => setAssignUser(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500">
                <option value="">اختر موظفاً</option>
                {currentGroup?.members?.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>
                ))}
              </select>
            </div>
            {err && <p className="text-red-400 text-xs mt-3 text-right">{err}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={handleAssign} disabled={assignSaving || !assignUser}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>
                {assignSaving ? 'جارٍ الحفظ...' : 'تعيين'}
              </button>
              <button onClick={() => { setAssignDay(null); setAssignUser(''); setErr('') }}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#0c1a2e,#0a1628)', border:'1px solid rgba(8,145,178,0.3)'}}>
            <h3 className="text-white font-semibold text-base mb-1" dir="rtl">✏️ تعديل اليوم</h3>
            <p className="text-slate-400 text-xs mb-4" dir="rtl">{overrideEntry.scheduled_date} — الموظف الحالي: {overrideEntry.full_name || overrideEntry.email}</p>
            <div dir="rtl">
              <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الموظف الجديد</label>
              <select value={overrideUser} onChange={e => setOverrideUser(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500">
                <option value="">اختر موظفاً</option>
                {currentGroup?.members?.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>
                ))}
              </select>
            </div>
            {err && <p className="text-red-400 text-xs mt-3 text-right">{err}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={handleOverride} disabled={saving || !overrideUser}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => { setOverrideEntry(null); setOverrideUser('') }}
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

// ─────────────────────────────── GROUP MODAL ─────────────────────────────────
function GroupModal({ group, users, onSave, onClose, saving }) {
  const [name, setName] = useState(group?.name || '')
  const [members, setMembers] = useState(group?.members?.map(m => m.user_id) || [])
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    (u.role === 'employee' || u.role === 'admin' || u.role === 'member' || u.role === 'super_admin') &&
    ((u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
     (u.email || '').toLowerCase().includes(search.toLowerCase()))
  )

  function toggleMember(uid) {
    setMembers(m => m.includes(uid) ? m.filter(x => x !== uid) : [...m, uid])
  }

  function moveUp(idx) {
    if (idx === 0) return
    setMembers(m => { const a = [...m]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a })
  }

  function moveDown(idx) {
    setMembers(m => { if (idx === m.length - 1) return m; const a = [...m]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a })
  }

  function handleSave() {
    const memberList = members.map((uid, i) => ({ user_id: uid, order_index: i }))
    onSave(name, memberList)
  }

  const getUserName = uid => {
    const u = users.find(x => x.id === uid)
    return u?.full_name || u?.email || uid
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
      <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#0c1a2e,#0a1628)', border:'1px solid rgba(8,145,178,0.3)'}}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-base" dir="rtl">{group ? 'تعديل المجموعة' : 'مجموعة جديدة'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4" dir="rtl">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">اسم المجموعة</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: مجموعة أ"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500" />
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">الأعضاء (الترتيب يحدد دورة التناوب)</label>
            {members.length > 0 && (
              <div className="space-y-1 mb-3 max-h-36 overflow-y-auto">
                {members.map((uid, idx) => (
                  <div key={uid} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/8 border border-cyan-500/15">
                    <span className="text-cyan-400 text-[11px] font-bold w-5 text-center">{idx + 1}</span>
                    <span className="text-white text-sm flex-1">{getUserName(uid)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => moveUp(idx)} className="text-slate-500 hover:text-white transition-colors text-xs px-1">↑</button>
                      <button onClick={() => moveDown(idx)} className="text-slate-500 hover:text-white transition-colors text-xs px-1">↓</button>
                      <button onClick={() => toggleMember(uid)} className="text-red-400 hover:text-red-300 transition-colors text-xs px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن موظف..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 mb-2" />
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filtered.filter(u => !members.includes(u.id)).map(u => (
                <button key={u.id} onClick={() => toggleMember(u.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all text-right">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  {u.full_name || u.email}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving || !name}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
            style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)'}}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────── EMPLOYEE VIEW ───────────────────────────────
function EmployeeView() {
  const { profile } = useAuth()
  const [allDays, setAllDays] = useState([])
  const [serverToday, setServerToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState(null)
  const [toast, setToast] = useState('')
  const [groupMembers, setGroupMembers] = useState([])
  const [swaps, setSwaps] = useState({ incoming: [], outgoing: [], pending_admin: [] })
  const [adminSwaps, setAdminSwaps] = useState([])
  const [adminSwapLoading, setAdminSwapLoading] = useState(false)
  const [swapModal, setSwapModal] = useState(null)
  const [swapTarget, setSwapTarget] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [swapSaving, setSwapSaving] = useState(false)
  const [acceptingSwap, setAcceptingSwap] = useState(null)
  const [myDayForSwap, setMyDayForSwap] = useState('')

  const today = serverToday || todayStr()
  const tomorrow = tomorrowStr()

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function loadDays() {
    try {
      const data = await api.getMyNextFactory()
      // API returns { rows, today } or plain array (backwards compat)
      const rows = Array.isArray(data) ? data : (data.rows || [])
      const srvToday = Array.isArray(data) ? '' : (data.today || '')
      setAllDays(rows)
      if (srvToday) setServerToday(srvToday)
      const groupId = rows[0]?.group_id
      if (groupId) {
        try {
          const members = await api.getFactoryGroupMembers(groupId)
          setGroupMembers(members)
        } catch {}
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadSwaps() {
    try {
      const data = await api.getMyRotationSwaps()
      setSwaps({
        incoming: (data.incoming || []).filter(s => s.module === 'factory'),
        outgoing: (data.outgoing || []).filter(s => s.module === 'factory'),
        pending_admin: (data.pending_admin || []).filter(s => s.module === 'factory'),
      })
    } catch {}
  }

  useEffect(() => { loadDays(); loadSwaps() }, [])

  async function handleAttend(entry) {
    setMarkingId(entry.id)
    try {
      await api.markFactoryAttendance(entry.id)
      setAllDays(prev => prev.map(d => d.id === entry.id ? { ...d, attended_at: new Date().toISOString() } : d))
      showToast('✅ تم تسجيل حضورك في المصنع بنجاح!')
    } catch (e) {
      showToast('❌ ' + (e.message || 'حدث خطأ'))
    } finally {
      setMarkingId(null)
    }
  }

  async function handleCreateSwap() {
    if (!swapModal || !swapTarget) return
    setSwapSaving(true)
    try {
      await api.createRotationSwap({
        module: 'factory',
        requester_schedule_id: swapModal.id,
        requester_date: normDate(swapModal.scheduled_date),
        target_id: swapTarget,
        note: swapNote || null,
      })
      showToast('✅ تم إرسال طلب التبديل')
      setSwapModal(null); setSwapTarget(''); setSwapNote('')
      loadSwaps()
    } catch (e) {
      showToast('❌ ' + (e.message || 'حدث خطأ'))
    } finally {
      setSwapSaving(false)
    }
  }

  async function handleAcceptSwap(swap) {
    try {
      await api.acceptRotationSwap(swap.id, myDayForSwap || null)
      showToast('✅ تم قبول الطلب — في انتظار موافقة الإدارة')
      setAcceptingSwap(null); setMyDayForSwap('')
      loadSwaps(); loadDays()
    } catch (e) {
      showToast('❌ ' + (e.message || 'حدث خطأ'))
    }
  }

  async function handleRejectSwap(swapId) {
    try {
      await api.rejectRotationSwap(swapId)
      showToast('تم رفض طلب التبديل')
      loadSwaps()
    } catch (e) {
      showToast('❌ ' + (e.message || 'حدث خطأ'))
    }
  }

  const attendedDays = allDays.filter(d => d.attended_at).sort((a, b) => normDate(b.scheduled_date).localeCompare(normDate(a.scheduled_date)))
  const todayEntry = allDays.find(d => normDate(d.scheduled_date) === today && !d.attended_at)
  const futureDays = allDays.filter(d => normDate(d.scheduled_date) > today)
  const missedDays = allDays.filter(d => normDate(d.scheduled_date) < today && !d.attended_at).sort((a, b) => normDate(b.scheduled_date).localeCompare(normDate(a.scheduled_date)))

  const attendedCount = attendedDays.length
  const absentCount = missedDays.length

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div dir="rtl" className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl"
          style={{background: toast.startsWith('✅') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: toast.startsWith('✅') ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
            color: toast.startsWith('✅') ? '#34d399' : '#f87171', backdropFilter:'blur(12px)'}}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">🏭</span> جدول المصنع الخاص بي
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">أيام دورتك — سجّل حضورك في يومك المحدد</p>
        </div>
        {allDays.length > 0 && (
          <div className="flex gap-3">
            <div className="text-center px-3 py-2 rounded-xl" style={{background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)'}}>
              <p className="text-emerald-400 text-lg font-bold">{attendedCount}</p>
              <p className="text-[10px] text-slate-500">حضر</p>
            </div>
            <div className="text-center px-3 py-2 rounded-xl" style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)'}}>
              <p className="text-red-400 text-lg font-bold">{absentCount}</p>
              <p className="text-[10px] text-slate-500">تغيّب</p>
            </div>
          </div>
        )}
      </div>

      {/* Today's entry — prominent card with attend button */}
      {todayEntry && (
        <div className="rounded-2xl p-5" style={{background:'linear-gradient(135deg,rgba(8,145,178,0.18),rgba(6,182,212,0.08))', border:'2px solid rgba(8,145,178,0.5)'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{background:'rgba(8,145,178,0.2)'}}>🏭</div>
              <div>
                <p className="text-cyan-300 text-[11px] font-semibold uppercase tracking-widest mb-0.5">اليوم — دورتك في المصنع</p>
                <p className="text-white text-base font-bold">
                  {new Date(todayEntry.scheduled_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleAttend(todayEntry)}
              disabled={markingId === todayEntry.id}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 active:scale-95"
              style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)', boxShadow:'0 4px 20px rgba(8,145,178,0.4)'}}
            >
              {markingId === todayEntry.id ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />جارٍ التسجيل...</span>
              ) : '✋ سجّل حضورك'}
            </button>
          </div>
        </div>
      )}

      {/* Incoming swap requests */}
      {swaps.incoming.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="text-violet-400">🔄</span> طلبات التبديل الواردة
          </h3>
          <div className="space-y-2">
            {swaps.incoming.map(swap => (
              <div key={swap.id} className="rounded-xl p-3.5"
                style={{background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)'}}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-white text-sm font-medium">{swap.requester_name}</p>
                    <p className="text-violet-300 text-xs mt-0.5">يطلب تبديل يومه: {swap.requester_date}</p>
                    {swap.note && <p className="text-slate-400 text-xs mt-1 italic">"{swap.note}"</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {acceptingSwap?.id === swap.id ? (
                      <div className="flex items-center gap-2">
                        <select value={myDayForSwap} onChange={e => setMyDayForSwap(e.target.value)}
                          className="bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500">
                          <option value="">اختر يومك</option>
                          {futureDays.map(d => (
                            <option key={d.id} value={d.id}>{normDate(d.scheduled_date)}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAcceptSwap(swap)} disabled={!myDayForSwap}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all"
                          style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)'}}>
                          تأكيد
                        </button>
                        <button onClick={() => { setAcceptingSwap(null); setMyDayForSwap('') }}
                          className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-white/10 transition-all">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setAcceptingSwap(swap); setMyDayForSwap('') }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                          style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)'}}>
                          ✓ قبول
                        </button>
                        <button onClick={() => handleRejectSwap(swap.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
                          ✕ رفض
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming days — only non-attended future days */}
      {futureDays.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">الأيام القادمة</h3>
          <div className="space-y-2">
            {futureDays.map(entry => {
              const dateStr = normDate(entry.scheduled_date)
              const isTomorrow = dateStr === tomorrow
              const isActuallyPastOrToday = dateStr <= today && !entry.attended_at
              return (
                <div key={entry.id} className="rounded-xl p-3.5 flex items-center justify-between"
                  style={{
                    background: isActuallyPastOrToday ? 'rgba(239,68,68,0.06)' : isTomorrow ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.03)',
                    border: isActuallyPastOrToday ? '1px solid rgba(239,68,68,0.15)' : isTomorrow ? '1px solid rgba(8,145,178,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏭</span>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {new Date(entry.scheduled_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {isActuallyPastOrToday
                        ? <span className="text-[11px] text-red-400/70">لم يُسجَّل الحضور</span>
                        : isTomorrow
                          ? <span className="text-[11px] text-cyan-300 font-medium">◎ غداً</span>
                          : <span className="text-slate-500 text-xs">قادم</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActuallyPastOrToday ? (
                      <button
                        onClick={() => handleAttend(entry)}
                        disabled={markingId === entry.id}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition-all active:scale-95"
                        style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)', boxShadow:'0 2px 10px rgba(8,145,178,0.3)'}}
                      >
                        {markingId === entry.id
                          ? <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />...</span>
                          : '✋ سجّل حضور'}
                      </button>
                    ) : (
                      <>
                        {groupMembers.length > 1 && (
                          <button
                            onClick={() => { setSwapModal(entry); setSwapTarget(''); setSwapNote('') }}
                            className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/35 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-all"
                          >
                            🔄 تبديل
                          </button>
                        )}
                        <span className="text-[11px] font-medium px-3 py-1 rounded-full"
                          style={{background:'rgba(100,116,139,0.15)', color:'#94a3b8', border:'1px solid rgba(100,116,139,0.2)'}}>
                          لم يحن بعد
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Attended days — moves here after marking attendance */}
      {attendedDays.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="text-emerald-500">✓</span> الأيام التي تم الحضور فيها
          </h3>
          <div className="space-y-2">
            {attendedDays.map(entry => (
              <div key={entry.id} className="rounded-xl p-3.5 flex items-center justify-between"
                style={{background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)'}}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{background:'rgba(16,185,129,0.15)'}}>✅</div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">
                      {new Date(entry.scheduled_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-emerald-500">
                      سُجّل الحضور في {new Date(entry.attended_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full"
                  style={{background:'rgba(16,185,129,0.15)', color:'#34d399', border:'1px solid rgba(16,185,129,0.3)'}}>
                  حضر ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missed days */}
      {missedDays.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="text-red-500">✗</span> الأيام الفائتة
          </h3>
          <div className="space-y-2">
            {missedDays.map(entry => (
              <div key={entry.id} className="rounded-xl p-3.5 flex items-center justify-between"
                style={{background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)'}}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{background:'rgba(239,68,68,0.12)'}}>❌</div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">
                      {new Date(entry.scheduled_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-red-400/70">لم يُسجَّل الحضور</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAttend(entry)}
                  disabled={markingId === entry.id}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition-all active:scale-95"
                  style={{background:'linear-gradient(135deg,#0891b2,#06b6d4)', boxShadow:'0 2px 10px rgba(8,145,178,0.3)'}}
                >
                  {markingId === entry.id
                    ? <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />...</span>
                    : '✋ سجّل حضور'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {allDays.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="text-4xl mb-3">🏭</div>
          <p className="text-slate-400 text-sm">لا توجد أيام مصنع مجدولة لك حالياً</p>
        </div>
      )}

      {/* Outgoing swap requests (my requests to others) */}
      {swaps.outgoing.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="text-cyan-400">📤</span> طلبات التبديل التي أرسلتها
          </h3>
          <div className="space-y-2">
            {swaps.outgoing.map(swap => {
              const statusCfg = {
                pending:        { label: 'في انتظار موافقة الزميل', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)'  },
                peer_accepted:  { label: 'وافق الزميل — تنتظر الإدارة', color: '#06b6d4', bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.2)'   },
                admin_approved: { label: 'موافَق عليه ✓',               color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)'  },
                admin_rejected: { label: 'مرفوض من الإدارة',            color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.15)'  },
                rejected:       { label: 'مرفوض من الزميل',             color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.15)'  },
              }[swap.status] || { label: swap.status, color: '#94a3b8', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.2)' }
              return (
                <div key={swap.id} className="rounded-xl p-3.5"
                  style={{background: statusCfg.bg, border: `1px solid ${statusCfg.border}`}}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-white text-sm font-medium">{swap.target_name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">يومك: {swap.requester_date}</p>
                      {swap.note && <p className="text-slate-500 text-xs italic mt-0.5">"{swap.note}"</p>}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`}}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Swap Request Modal */}
      {swapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#0c1a2e,#0a1628)', border:'1px solid rgba(139,92,246,0.35)'}}>
            <h3 className="text-white font-semibold text-base mb-1" dir="rtl">🔄 طلب تبديل دوام</h3>
            <p className="text-slate-400 text-xs mb-4" dir="rtl">يومك: {normDate(swapModal.scheduled_date)}</p>
            <div className="space-y-3" dir="rtl">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">تبديل مع</label>
                <select value={swapTarget} onChange={e => setSwapTarget(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                  <option value="">اختر زميلاً</option>
                  {groupMembers.filter(m => m.user_id !== profile?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest">ملاحظة (اختياري)</label>
                <input value={swapNote} onChange={e => setSwapNote(e.target.value)} placeholder="سبب الطلب..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateSwap} disabled={swapSaving || !swapTarget}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)'}}>
                {swapSaving ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
              </button>
              <button onClick={() => { setSwapModal(null); setSwapTarget(''); setSwapNote('') }}
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
