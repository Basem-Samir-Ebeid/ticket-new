import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { exportToExcel } from '../lib/exportUtils'

const ACTION_COLORS = {
  login:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  logout: { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  create: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  update: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  delete: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  assign: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  revoke: { color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
}

function computeDiff(before, after) {
  if (!before && !after) return []
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const changes = []
  for (const key of keys) {
    const bv = before?.[key]
    const av = after?.[key]
    const bStr = JSON.stringify(bv)
    const aStr = JSON.stringify(av)
    if (bStr !== aStr) changes.push({ key, before: bv, after: av })
  }
  return changes
}

function DiffViewer({ before, after }) {
  const changes = computeDiff(before, after)
  if (changes.length === 0) return <p className="text-slate-600 text-xs italic py-2">No field-level diff available</p>

  return (
    <div className="space-y-1.5">
      {changes.map(({ key, before: bv, after: av }) => (
        <div key={key} className="rounded-xl overflow-hidden text-xs font-mono" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-widest font-bold text-slate-500"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            {key}
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/5">
            <div className="px-3 py-2" style={{ background: 'rgba(239,68,68,0.06)' }}>
              <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider block mb-0.5">Before</span>
              <span className="text-red-300 break-all">
                {bv === undefined || bv === null ? <em className="text-slate-600">null</em> : String(typeof bv === 'object' ? JSON.stringify(bv, null, 2) : bv)}
              </span>
            </div>
            <div className="px-3 py-2" style={{ background: 'rgba(16,185,129,0.06)' }}>
              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block mb-0.5">After</span>
              <span className="text-emerald-300 break-all">
                {av === undefined || av === null ? <em className="text-slate-600">null</em> : String(typeof av === 'object' ? JSON.stringify(av, null, 2) : av)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LogRow({ l }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = l.before || l.after
  const style = ACTION_COLORS[l.action_type?.toLowerCase()] || { color: '#94a3b8', bg: 'rgba(255,255,255,0.05)' }

  return (
    <>
      <tr
        style={{ borderBottom: expanded ? 'none' : '1px solid rgba(255,255,255,0.04)', cursor: hasDiff ? 'pointer' : 'default' }}
        className={`transition-colors ${hasDiff ? 'hover:bg-white/3' : 'hover:bg-white/2'}`}
        onClick={() => hasDiff && setExpanded(e => !e)}>
        <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
          {new Date(l.created_at).toLocaleString()}
        </td>
        <td className="px-4 py-2.5 text-slate-300 text-xs">{l.user_name || <span className="text-slate-600">System</span>}</td>
        <td className="px-4 py-2.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
            style={{ background: style.bg, color: style.color }}>
            {l.action_type}
          </span>
        </td>
        <td className="px-4 py-2.5 text-slate-500 text-xs capitalize">{l.entity_type || '—'}</td>
        <td className="px-4 py-2.5 text-slate-300 text-xs max-w-xs truncate">{l.description}</td>
        <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{l.ip_address || '—'}</td>
        <td className="px-4 py-2.5 text-center">
          {hasDiff ? (
            <span className="text-indigo-400 text-xs select-none">{expanded ? '▲' : '▼'}</span>
          ) : <span className="text-slate-700 text-xs">—</span>}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(99,102,241,0.03)' }}>
          <td colSpan={7} className="px-5 pb-4 pt-2">
            <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold mb-2">Field Changes</p>
            <DiffViewer before={l.before} after={l.after} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.getAuditLogs({ limit: 300, from: fromDate || undefined, to: toDate || undefined })
      setLogs(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l => {
    if (filterType && l.action_type !== filterType) return false
    if (filterEntity && l.entity_type !== filterEntity) return false
    if (search) {
      const q = search.toLowerCase()
      return l.description.toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q)
    }
    return true
  })

  const actionTypes = [...new Set(logs.map(l => l.action_type).filter(Boolean))]
  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))]

  function exportExcel() {
    const rows = filtered.map(l => ({
      Time: new Date(l.created_at).toLocaleString(),
      User: l.user_name || '',
      Action: l.action_type,
      Entity: l.entity_type || '',
      'Entity ID': l.entity_id || '',
      Description: l.description,
      IP: l.ip_address || '',
    }))
    exportToExcel('audit-logs.xlsx', [{ name: 'Audit Logs', rows }])
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📋</span> Audit Logs
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">{logs.length} total events · click a row to see field diff</p>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
          <option value="" style={{ background: '#1e1e2e' }}>All Actions</option>
          {actionTypes.map(t => <option key={t} value={t} style={{ background: '#1e1e2e' }}>{t}</option>)}
        </select>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
          <option value="" style={{ background: '#1e1e2e' }}>All Entities</option>
          {entityTypes.map(t => <option key={t} value={t} style={{ background: '#1e1e2e' }}>{t}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50"
            style={{ colorScheme: 'dark' }} placeholder="From" />
          <span className="text-slate-600 text-xs">→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50"
            style={{ colorScheme: 'dark' }} placeholder="To" />
          <button onClick={load}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm text-center py-10 animate-pulse">Loading audit logs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-600 text-sm text-center py-10">No logs found</div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="max-h-[680px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'rgba(8,8,20,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Time', 'User', 'Action', 'Entity', 'Description', 'IP', 'Diff'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => <LogRow key={l.id} l={l} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
