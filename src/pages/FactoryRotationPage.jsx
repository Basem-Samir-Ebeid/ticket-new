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
  return new Date().toISOString().slice(0, 10)
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function firstOfMonth(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toISOString().slice(0, 10)
}

function lastOfMonth(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset + 1, 0)
  return d.toISOString().slice(0, 10)
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
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [])

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
    } catch {}
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
    try {
      await api.overrideFactoryEntry(overrideEntry.id, overrideUser)
      setOverrideEntry(null)
      setOverrideUser('')
      loadSchedule(selectedGroup, monthOffset)
      setSuccess('تم تغيير الموظف بنجاح')
    } catch (e) { setErr(e.message) }
    setSaving(false)
  }

  const currentGroup = groups.find(g => g.id === selectedGroup)
  const memberColorMap = {}
  currentGroup?.members?.forEach((m, i) => { memberColorMap[m.user_id] = getColor(i) })

  const today = todayStr()
  const tomorrow = tomorrowStr()

  const monthLabel = new Date(firstOfMonth(monthOffset)).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

  const scheduleByDate = {}
  schedule.forEach(s => { scheduleByDate[s.scheduled_date] = s })

  const firstDay = new Date(firstOfMonth(monthOffset))
  const lastDay = new Date(lastOfMonth(monthOffset))
  const calDays = []
  const startPad = firstDay.getDay()
  for (let i = 0; i < startPad; i++) calDays.push(null)
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    calDays.push(d.toISOString().slice(0, 10))
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

      {err && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
      {success && <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}

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
                  onClick={() => entry && setOverrideEntry(entry)}
                  className={`rounded-lg p-1 min-h-[52px] flex flex-col items-center justify-start transition-all ${entry ? 'cursor-pointer hover:opacity-80' : ''}`}
                  style={{
                    background: isToday ? 'rgba(8,145,178,0.15)' : isTomorrow ? 'rgba(8,145,178,0.08)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                    border: isToday ? '1px solid rgba(8,145,178,0.5)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className={`text-[11px] font-semibold mb-1 ${isToday ? 'text-cyan-400' : isWeekend ? 'text-slate-600' : 'text-slate-400'}`}>
                    {new Date(dateStr).getDate()}
                  </span>
                  {entry && (
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded text-center leading-tight w-full truncate"
                      style={{background:`${color}22`, color, border:`1px solid ${color}33`}}>
                      {entry.full_name?.split(' ')[0] || entry.email?.split('@')[0]}
                    </span>
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
    (u.role === 'employee' || u.role === 'admin') &&
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
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMyNextFactory().then(setEntries).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const today = todayStr()
  const tomorrow = tomorrowStr()

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div dir="rtl" className="space-y-5">
      <div>
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <span className="text-2xl">🏭</span> أيام المصنع القادمة
        </h2>
        <p className="text-slate-400 text-sm mt-0.5">هذه هي أيام دورتك في المصنع</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)'}}>
          <div className="text-4xl mb-3">🏭</div>
          <p className="text-slate-400 text-sm">لا توجد أيام مصنع مجدولة لك حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const isTomorrow = entry.scheduled_date === tomorrow
            const isToday = entry.scheduled_date === today
            return (
              <div key={entry.id} className="rounded-2xl p-4 transition-all"
                style={{
                  background: isToday ? 'rgba(8,145,178,0.15)' : isTomorrow ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.03)',
                  border: isToday || isTomorrow ? '1px solid rgba(8,145,178,0.4)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{background: isToday || isTomorrow ? 'rgba(8,145,178,0.2)' : 'rgba(255,255,255,0.05)'}}>
                      🏭
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {new Date(entry.scheduled_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {isToday && <span className="text-[11px] text-cyan-400 font-medium">● اليوم</span>}
                      {isTomorrow && <span className="text-[11px] text-cyan-300 font-medium">◎ غداً</span>}
                      {!isToday && !isTomorrow && <span className="text-slate-500 text-xs">قادم</span>}
                    </div>
                  </div>
                  {(isToday || isTomorrow) && (
                    <span className="text-[11px] font-medium px-3 py-1.5 rounded-full"
                      style={{background:'rgba(8,145,178,0.2)', color:'#06b6d4', border:'1px solid rgba(8,145,178,0.3)'}}>
                      {isToday ? 'اليوم 🏭' : 'غداً 🏭'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
