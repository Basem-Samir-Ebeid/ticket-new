import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { exportToExcel } from '../lib/exportUtils'

const TYPE_COLORS = {
  'per-seat': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
  'site-license': { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  'subscription': { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
  'open-source': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
  'other': { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
}
const STATUS_COLORS = {
  active: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', label: 'Active' },
  expiring_soon: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', label: 'Expiring Soon' },
  expired: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', label: 'Expired' },
}

const BLANK = { software_name: '', vendor: '', license_key: '', license_type: 'per-seat', total_seats: '', expiry_date: '', cost: '', renewal_reminder_days: '30', notes: '' }

export default function SoftwareLicensesPage() {
  const [licenses, setLicenses] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [selectedLicense, setSelectedLicense] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loadingAssign, setLoadingAssign] = useState(false)
  const [assignUserId, setAssignUserId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [l, u] = await Promise.all([api.getLicenses(), api.getUsers()])
      setLicenses(l)
      setUsers(u)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadAssignments(id) {
    setLoadingAssign(true)
    try {
      const a = await api.getLicenseAssignments(id)
      setAssignments(a)
    } catch {}
    setLoadingAssign(false)
  }

  async function openLicense(l) {
    setSelectedLicense(l)
    await loadAssignments(l.id)
  }

  async function assignUser() {
    if (!assignUserId || !selectedLicense) return
    try {
      await api.assignLicense(selectedLicense.id, assignUserId)
      setAssignUserId('')
      await loadAssignments(selectedLicense.id)
      load()
    } catch (err) { setMsg(err.message || 'Failed') }
  }

  async function unassignUser(userId) {
    if (!selectedLicense) return
    try {
      await api.unassignLicense(selectedLicense.id, userId)
      await loadAssignments(selectedLicense.id)
      load()
    } catch {}
  }

  function openNew() { setEditingId(null); setForm(BLANK); setShowForm(true); setMsg('') }
  function openEdit(l) {
    setEditingId(l.id)
    setForm({
      software_name: l.software_name || '', vendor: l.vendor || '', license_key: l.license_key || '',
      license_type: l.license_type || 'per-seat', total_seats: l.total_seats || '',
      expiry_date: l.expiry_date || '', cost: l.cost || '', renewal_reminder_days: l.renewal_reminder_days || 30,
      notes: l.notes || '',
    })
    setShowForm(true); setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form.software_name.trim()) return setMsg('Software name is required')
    setSaving(true)
    try {
      if (editingId) await api.updateLicense(editingId, form)
      else await api.createLicense(form)
      setShowForm(false)
      load()
    } catch (err) { setMsg(err.message || 'Failed') }
    setSaving(false)
  }

  async function deleteLicense(id) {
    if (!confirm('Delete this license?')) return
    try { await api.deleteLicense(id); load() } catch {}
  }

  function exportExcel() {
    const rows = licenses.map(l => ({
      'Software': l.software_name,
      'Vendor': l.vendor || '',
      'Type': l.license_type,
      'Total Seats': l.total_seats || 'Unlimited',
      'Used Seats': l.used_seats || 0,
      'Expiry Date': l.expiry_date || '',
      'Status': STATUS_COLORS[l.status]?.label || l.status,
      'Cost': l.cost || '',
    }))
    exportToExcel('licenses.xlsx', [{ name: 'Licenses', rows }])
  }

  const filtered = filterStatus ? licenses.filter(l => l.status === filterStatus) : licenses
  const expiringSoon = licenses.filter(l => l.status === 'expiring_soon').length
  const expired = licenses.filter(l => l.status === 'expired').length

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔑</span> Software Licenses
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">{licenses.length} licenses tracked</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add License
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(expiringSoon > 0 || expired > 0) && (
        <div className="flex gap-3 flex-wrap">
          {expired > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              ⚠ {expired} license{expired > 1 ? 's' : ''} expired
            </div>
          )}
          {expiringSoon > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              ⏰ {expiringSoon} license{expiringSoon > 1 ? 's' : ''} expiring soon
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'active', 'expiring_soon', 'expired'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterStatus === s ? { background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }
              : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
            {s === '' ? 'All' : STATUS_COLORS[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-slate-500 text-sm text-center py-10 animate-pulse">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-600 text-sm text-center py-10">No licenses found</div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Software', 'Type', 'Seats Used', 'Expiry', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const typeStyle = TYPE_COLORS[l.license_type] || TYPE_COLORS.other
                const statusStyle = STATUS_COLORS[l.status] || STATUS_COLORS.active
                const seatPct = l.total_seats ? Math.round((l.used_seats / l.total_seats) * 100) : null
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    className="hover:bg-white/2 transition-colors cursor-pointer"
                    onClick={() => openLicense(l)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{l.software_name}</div>
                      {l.vendor && <div className="text-xs text-slate-600">{l.vendor}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>
                        {l.license_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 text-sm">
                        {l.used_seats}/{l.total_seats || '∞'}
                      </div>
                      {seatPct !== null && (
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(seatPct, 100)}%`, background: seatPct >= 90 ? '#ef4444' : seatPct >= 70 ? '#f59e0b' : '#10b981' }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {l.expiry_date || <span className="text-slate-600">No expiry</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button onClick={() => deleteLicense(l.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* License Detail / Assignments Drawer */}
      {selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedLicense(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto shadow-2xl" style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-white/8" style={{ background: '#0d0d1a' }}>
              <div>
                <h3 className="text-white font-bold">{selectedLicense.software_name}</h3>
                <p className="text-slate-600 text-xs">{selectedLicense.vendor || 'No vendor'}</p>
              </div>
              <button onClick={() => setSelectedLicense(null)} className="text-slate-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {selectedLicense.license_key && (
                <div className="px-3 py-2 rounded-xl font-mono text-xs text-emerald-400" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {selectedLicense.license_key}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Type', value: selectedLicense.license_type },
                  { label: 'Status', value: STATUS_COLORS[selectedLicense.status]?.label || selectedLicense.status },
                  { label: 'Total Seats', value: selectedLicense.total_seats || 'Unlimited' },
                  { label: 'Used Seats', value: selectedLicense.used_seats || 0 },
                  { label: 'Expiry', value: selectedLicense.expiry_date || 'None' },
                  { label: 'Cost', value: selectedLicense.cost ? `$${selectedLicense.cost}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-slate-200 text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {/* Assign User */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Assign to Employee</p>
                <div className="flex gap-2">
                  <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                    <option value="" style={{ background: '#1e1e2e' }}>Select employee...</option>
                    {users.filter(u => !assignments.find(a => a.user_id === u.id)).map(u => (
                      <option key={u.id} value={u.id} style={{ background: '#1e1e2e' }}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                  <button onClick={assignUser} disabled={!assignUserId}
                    className="px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    Assign
                  </button>
                </div>
              </div>

              {/* Current Assignments */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                  Assigned Users ({assignments.length})
                </p>
                {loadingAssign ? (
                  <div className="text-slate-600 text-xs animate-pulse">Loading...</div>
                ) : assignments.length === 0 ? (
                  <div className="text-slate-700 text-sm">No users assigned</div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-slate-300 text-sm">{a.user_name}</span>
                        <button onClick={() => unassignUser(a.user_id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ background: 'linear-gradient(135deg,#1e1b2e,#16132a)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <h3 className="text-white font-bold text-lg mb-4">{editingId ? 'Edit License' : 'Add Software License'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'software_name', label: 'Software Name', required: true },
                  { key: 'vendor', label: 'Vendor' },
                  { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
                  { key: 'cost', label: 'Cost ($)', type: 'number' },
                  { key: 'total_seats', label: 'Total Seats', type: 'number' },
                  { key: 'renewal_reminder_days', label: 'Reminder (days)', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-slate-500 mb-1">{f.label}{f.required && ' *'}</label>
                    <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">License Type</label>
                <select value={form.license_type} onChange={e => setForm(p => ({ ...p, license_type: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                  {['per-seat', 'site-license', 'subscription', 'open-source', 'other'].map(t => (
                    <option key={t} value={t} style={{ background: '#1e1e2e' }}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">License Key</label>
                <input value={form.license_key} onChange={e => setForm(p => ({ ...p, license_key: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500/50"
                  placeholder="XXXX-XXXX-XXXX-XXXX" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none" />
              </div>
              {msg && <p className="text-red-400 text-xs">{msg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add License'}
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
