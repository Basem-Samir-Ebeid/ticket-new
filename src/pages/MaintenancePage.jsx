import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { exportToExcel } from '../lib/exportUtils'

const FREQ_COLORS = {
  daily: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  weekly: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
  monthly: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  quarterly: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  annually: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
}

const BLANK = { asset_id: '', title: '', description: '', frequency: 'monthly', next_due_date: '', assigned_to: '' }

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function MaintenancePage() {
  const [schedules, setSchedules] = useState([])
  const [assets, setAssets] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filterDue, setFilterDue] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [s, a, u] = await Promise.all([
        api.getMaintenanceSchedules(),
        api.getAssets(),
        api.getUsers(),
      ])
      setSchedules(s)
      setAssets(a)
      setUsers(u)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    if (!form.asset_id || !form.title || !form.next_due_date) return setMsg('Asset, title, and due date are required')
    setSaving(true)
    try {
      if (editingId) await api.updateMaintenanceSchedule(editingId, form)
      else await api.createMaintenanceSchedule(form)
      setShowForm(false)
      load()
    } catch (err) { setMsg(err.message || 'Failed') }
    setSaving(false)
  }

  async function markComplete(id, next_due_date) {
    const today = new Date().toISOString().slice(0, 10)
    try {
      await api.updateMaintenanceSchedule(id, { last_completed_date: today })
      load()
    } catch {}
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return
    try { await api.deleteMaintenanceSchedule(id); load() } catch {}
  }

  function openNew() { setEditingId(null); setForm(BLANK); setShowForm(true); setMsg('') }
  function openEdit(s) {
    setEditingId(s.id)
    setForm({
      asset_id: s.asset_id, title: s.title, description: s.description || '',
      frequency: s.frequency, next_due_date: s.next_due_date, assigned_to: s.assigned_to || '',
    })
    setShowForm(true); setMsg('')
  }

  function getAssetName(id) { return assets.find(a => a.id === id)?.name || 'Unknown Asset' }
  function getUserName(id) { return users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || '' }

  const overdueCount = schedules.filter(s => daysUntil(s.next_due_date) < 0).length
  const dueSoon = schedules.filter(s => { const d = daysUntil(s.next_due_date); return d !== null && d >= 0 && d <= 7 }).length

  const filtered = schedules.filter(s => {
    if (!filterDue) return true
    const d = daysUntil(s.next_due_date)
    if (filterDue === 'overdue') return d !== null && d < 0
    if (filterDue === 'week') return d !== null && d >= 0 && d <= 7
    return true
  })

  function exportExcel() {
    const rows = schedules.map(s => ({
      Asset: getAssetName(s.asset_id),
      Task: s.title,
      Frequency: s.frequency,
      'Next Due': s.next_due_date,
      'Last Completed': s.last_completed_date || '',
      'Assigned To': s.assigned_to ? getUserName(s.assigned_to) : '',
    }))
    exportToExcel('maintenance-schedules.xlsx', [{ name: 'Maintenance', rows }])
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔧</span> Maintenance Schedules
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">{schedules.length} scheduled tasks</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Schedule Task
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(overdueCount > 0 || dueSoon > 0) && (
        <div className="flex gap-3 flex-wrap">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              onClick={() => setFilterDue(filterDue === 'overdue' ? '' : 'overdue')}>
              🔴 {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}
            </div>
          )}
          {dueSoon > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}
              onClick={() => setFilterDue(filterDue === 'week' ? '' : 'week')}>
              ⏰ {dueSoon} due this week
            </div>
          )}
        </div>
      )}

      {/* Schedule List */}
      {loading ? (
        <div className="text-slate-500 text-sm text-center py-10 animate-pulse">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-600 text-sm text-center py-10">No maintenance tasks scheduled</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const days = daysUntil(s.next_due_date)
            const isOverdue = days !== null && days < 0
            const isDueSoon = days !== null && days >= 0 && days <= 7
            const freqStyle = FREQ_COLORS[s.frequency] || FREQ_COLORS.monthly

            return (
              <div key={s.id} className="rounded-xl p-4 border transition-all"
                style={{
                  background: isOverdue ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
                  borderColor: isOverdue ? 'rgba(239,68,68,0.2)' : isDueSoon ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-semibold text-sm">{s.title}</h3>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: freqStyle.bg, color: freqStyle.color, border: `1px solid ${freqStyle.border}` }}>
                        {s.frequency}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs">{getAssetName(s.asset_id)}</p>
                    {s.description && <p className="text-slate-600 text-xs mt-1">{s.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className={isOverdue ? 'text-red-400 font-medium' : isDueSoon ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                        Due: {s.next_due_date} {isOverdue ? `(${Math.abs(days)}d overdue)` : days === 0 ? '(Today!)' : isDueSoon ? `(in ${days}d)` : ''}
                      </span>
                      {s.last_completed_date && (
                        <span className="text-emerald-600">✓ Last done: {s.last_completed_date}</span>
                      )}
                      {s.assigned_to && <span className="text-slate-600">👤 {getUserName(s.assigned_to)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => markComplete(s.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      ✓ Done
                    </button>
                    <button onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                    </button>
                    <button onClick={() => deleteSchedule(s.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'linear-gradient(135deg,#1e1b2e,#16132a)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <h3 className="text-white font-bold text-lg mb-4">{editingId ? 'Edit Schedule' : 'New Maintenance Schedule'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asset *</label>
                <select value={form.asset_id} onChange={e => setForm(p => ({ ...p, asset_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                  <option value="" style={{ background: '#1e1e2e' }}>Select asset...</option>
                  {assets.map(a => <option key={a.id} value={a.id} style={{ background: '#1e1e2e' }}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Task Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  placeholder="e.g. Quarterly cleaning" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                    {['daily', 'weekly', 'monthly', 'quarterly', 'annually'].map(f => (
                      <option key={f} value={f} style={{ background: '#1e1e2e' }}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Next Due Date *</label>
                  <input type="date" value={form.next_due_date} onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Assign To</label>
                <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                  <option value="" style={{ background: '#1e1e2e' }}>Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id} style={{ background: '#1e1e2e' }}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              {msg && <p className="text-red-400 text-xs">{msg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create Schedule'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-400 border border-white/10 text-sm hover:border-white/20 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
