import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const STATUS_COLOR = {
  opened:  { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  solved:  { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
}
const PRIORITY_COLOR = {
  critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#60a5fa'
}

function StatBadge({ label, value, color }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-lg font-semibold" style={{ color }}>{value}</span>
      <span className="text-[10px] text-slate-500 mt-0.5">{label}</span>
    </div>
  )
}

export default function StaffOverviewPage() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(null)
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy]     = useState('total')

  useEffect(() => {
    api.getStaffOverview()
      .then(setData)
      .catch((err) => {
        if (err?.status === 403 || err?.message?.includes('403')) {
          setError('غير مصرح لك بعرض هذه الصفحة')
        } else {
          setError('فشل تحميل البيانات')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = data
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => {
      const q = search.toLowerCase()
      return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'total') return b.total - a.total
      if (sortBy === 'open')  return (b.open + b.in_progress) - (a.open + a.in_progress)
      if (sortBy === 'sla')   return b.sla_breached - a.sla_breached
      if (sortBy === 'avg')   return (a.avg_resolution_hours ?? 9999) - (b.avg_resolution_hours ?? 9999)
      return 0
    })

  const totalTickets  = data.reduce((s, u) => s + u.total, 0)
  const totalOpen     = data.reduce((s, u) => s + u.open + u.in_progress, 0)
  const totalBreached = data.reduce((s, u) => s + u.sla_breached, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">Staff Ticket Overview</h1>
        <p className="text-slate-500 text-sm">Ticket workload and performance per team member</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Tickets Assigned', value: totalTickets,  color: '#e2e8f0' },
          { label: 'Open / In Progress',      value: totalOpen,     color: '#fbbf24' },
          { label: 'SLA Breaches',            value: totalBreached, color: '#f87171' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-3xl font-semibold mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 min-w-48 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none">
          <option value="all">All roles</option>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
          <option value="employee">Employee</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none">
          <option value="total">Sort: Most tickets</option>
          <option value="open">Sort: Most open</option>
          <option value="sla">Sort: SLA breaches</option>
          <option value="avg">Sort: Fastest resolution</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-12 text-center">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-600 text-sm py-12 text-center">No users found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <div key={u.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                  style={{ background: 'rgba(217,119,6,0.2)', color: '#fbbf24', border: '1px solid rgba(217,119,6,0.3)' }}>
                  {(u.full_name || u.email || '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{u.full_name || u.email}</p>
                  <p className="text-slate-500 text-xs truncate">{u.email} · <span className="capitalize">{u.role}</span>{u.department ? ` · ${u.department}` : ''}</p>
                </div>

                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  <StatBadge label="Total"   value={u.total}                                             color="#e2e8f0" />
                  <StatBadge label="Open"    value={u.open}                                              color="#60a5fa" />
                  <StatBadge label="Active"  value={u.in_progress}                                       color="#fbbf24" />
                  <StatBadge label="Closed"  value={u.closed}                                            color="#4ade80" />
                  <StatBadge label="SLA ⚠"   value={u.sla_breached}  color={u.sla_breached > 0 ? '#f87171' : '#4ade80'} />
                  <StatBadge label="Avg hrs" value={u.avg_resolution_hours ?? '—'}                       color="#c084fc" />
                </div>

                <span className="text-slate-600 text-xs ml-2">{expanded === u.id ? '▲' : '▼'}</span>
              </div>

              {expanded === u.id && (
                <div className="px-5 pb-4 border-t border-white/5">
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mt-3 mb-2">Last 5 tickets</p>
                  {u.recent_tickets.length === 0 ? (
                    <p className="text-slate-600 text-xs">No tickets assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {u.recent_tickets.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[t.priority] || '#64748b' }} />
                          <p className="text-slate-300 text-xs flex-1 truncate">{t.title}</p>
                          {t.category && <span className="text-slate-500 text-[10px] hidden sm:block">{t.category}</span>}
                          <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                            style={{
                              background: STATUS_COLOR[t.status]?.bg || 'rgba(255,255,255,0.05)',
                              color:      STATUS_COLOR[t.status]?.text || '#94a3b8',
                              border: `1px solid ${STATUS_COLOR[t.status]?.border || 'rgba(255,255,255,0.1)'}`,
                            }}>
                            {t.status.replace('_', ' ')}
                          </span>
                          <span className="text-slate-600 text-[10px] flex-shrink-0">
                            {new Date(t.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
