import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a3e635']

const RANGES = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
]

function StatCard({ label, value, color = '#6366f1', sub }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">{children}</h3>
}

export default function ReportsPage() {
  const [range, setRange] = useState('month')
  const [ticketData, setTicketData] = useState(null)
  const [assetData, setAssetData] = useState(null)
  const [attendanceData, setAttendanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const reportRef = useRef(null)

  async function loadAll() {
    setLoading(true)
    try {
      const [td, ad, att] = await Promise.all([
        api.getTicketReports(range),
        api.getAssetReports(),
        api.getAttendanceReports(range),
      ])
      setTicketData(td)
      setAssetData(ad)
      setAttendanceData(att)
    } catch (err) {
      console.error('Reports load error:', err)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [range])

  function exportTicketsExcel() {
    if (!ticketData) return
    const rows = ticketData.techPerformance.map(t => ({
      'Technician': t.name,
      'Assigned': t.assigned,
      'Solved': t.solved,
      'Avg Resolution (hrs)': t.avgResolutionHours,
      'Avg Rating': t.avgRating ?? 'N/A',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tech Performance')

    const catRows = (ticketData.topCategories || []).map(c => ({ Category: c.name, Count: c.count }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'Top Categories')

    XLSX.writeFile(wb, `ticket-reports-${range}.xlsx`)
  }

  async function exportPdf() {
    if (!reportRef.current) return
    setExportingPdf(true)
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: '#05050a', scale: 1.5, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`finest-reports-${range}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    }
    setExportingPdf(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-sm animate-pulse">Loading reports...</div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Reports & Analytics</h2>
          <p className="text-slate-500 text-xs mt-0.5">Insights across tickets, assets, and attendance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range */}
          <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={range === r.value ? { background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' } : { color: '#64748b' }}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={exportTicketsExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Excel
          </button>
          <button onClick={exportPdf} disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        {/* ─── Ticket Analytics ─── */}
        {ticketData && (
          <section className="mb-8">
            <SectionTitle>Ticket Analytics</SectionTitle>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Tickets" value={ticketData.total} color="#6366f1" />
              <StatCard label="Opened" value={ticketData.byStatus.opened} color="#3b82f6" />
              <StatCard label="Pending" value={ticketData.byStatus.pending} color="#f59e0b" />
              <StatCard label="Solved" value={ticketData.byStatus.solved} color="#10b981" />
              <StatCard label="SLA Compliance" value={ticketData.slaRate != null ? `${ticketData.slaRate}%` : 'N/A'} color={ticketData.slaRate >= 80 ? '#10b981' : ticketData.slaRate >= 60 ? '#f59e0b' : '#ef4444'} />
              <StatCard label="Avg Resolution" value={ticketData.avgResolutionHours ? `${ticketData.avgResolutionHours}h` : '—'} color="#8b5cf6" />
              <StatCard label="Avg Satisfaction" value={ticketData.avgSatisfaction ? `${ticketData.avgSatisfaction}/5` : '—'} color="#f59e0b" />
              <StatCard label="Rated Tickets" value={ticketData.ratingDistribution?.reduce((s, r) => s + r.count, 0) || 0} color="#06b6d4" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Tickets per Day */}
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Tickets Over Time</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={ticketData.perDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Tickets" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top Categories */}
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Top Categories</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ticketData.topCategories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={90} />
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Tickets" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* By Priority */}
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Tickets by Priority</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={ticketData.byPriority} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {ticketData.byPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Rating Distribution */}
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Satisfaction Rating Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ticketData.ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="star" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v}★`} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(v, n, p) => [v, `${p.payload.star} Stars`]} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Ratings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Tags */}
            {ticketData.topTags?.length > 0 && (
              <div className="rounded-xl p-4 border mb-4" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Top Ticket Tags</p>
                <div className="flex flex-wrap gap-2">
                  {ticketData.topTags.map((t, i) => (
                    <span key={t.tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: `${COLORS[i % COLORS.length]}22`, color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}44` }}>
                      {t.tag}
                      <span className="opacity-70">×{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Team Performance ─── */}
        {ticketData?.techPerformance?.length > 0 && (
          <section className="mb-8">
            <SectionTitle>Team Performance</SectionTitle>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Technician</th>
                    <th className="text-center px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Assigned</th>
                    <th className="text-center px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Solved</th>
                    <th className="text-center px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Avg Resolution</th>
                    <th className="text-center px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Avg Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketData.techPerformance.map((tech, i) => (
                    <tr key={tech.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: COLORS[i % COLORS.length] + '33', color: COLORS[i % COLORS.length] }}>
                            {i + 1}
                          </span>
                          <span className="text-slate-200 font-medium">{tech.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">{tech.assigned}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-400 font-medium">{tech.solved}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">
                        {tech.avgResolutionHours ? `${tech.avgResolutionHours}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tech.avgRating ? (
                          <span className="text-amber-400 font-medium">{tech.avgRating} ★</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Low Ratings */}
            {ticketData.lowRatings?.length > 0 && (
              <div className="mt-4 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' }}>
                <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-3">⚠ Low Ratings (1-2 Stars) — Follow Up</p>
                <div className="space-y-2">
                  {ticketData.lowRatings.map(r => (
                    <div key={r.id} className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <span className="text-slate-300 font-medium">{r.title}</span>
                        {r.comment && <p className="text-slate-500 mt-0.5 italic">"{r.comment}"</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-red-400 font-bold">{r.rating}★</span>
                        <p className="text-slate-600">{r.techName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Asset Analytics ─── */}
        {assetData && (
          <section className="mb-8">
            <SectionTitle>Asset Analytics</SectionTitle>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard label="Expiring in 30d" value={assetData.warrantyExpiring.in30} color="#ef4444" />
              <StatCard label="Expiring in 60d" value={assetData.warrantyExpiring.in60} color="#f59e0b" />
              <StatCard label="Expiring in 90d" value={assetData.warrantyExpiring.in90} color="#6366f1" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Assets by Type</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={assetData.byType} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                      {assetData.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-slate-400 font-semibold mb-3">Assets by Condition</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={assetData.byCondition}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Assets">
                      {assetData.byCondition.map((entry, i) => {
                        const cols = { excellent: '#10b981', good: '#6366f1', fair: '#f59e0b', poor: '#ef4444' }
                        return <Cell key={i} fill={cols[entry.name] || COLORS[i]} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {assetData.expiringSoon?.length > 0 && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Warranty Expiring Soon</span>
                </div>
                <div className="divide-y divide-white/5">
                  {assetData.expiringSoon.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-slate-300 text-sm">{a.name}</span>
                      <div className="text-right">
                        <span className="text-xs font-medium" style={{ color: a.daysLeft <= 30 ? '#ef4444' : a.daysLeft <= 60 ? '#f59e0b' : '#6366f1' }}>
                          {a.daysLeft}d left
                        </span>
                        <p className="text-slate-600 text-[10px]">{a.warranty_expires}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ─── Attendance Analytics ─── */}
        {attendanceData && (
          <section className="mb-8">
            <SectionTitle>Attendance Analytics</SectionTitle>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <StatCard label="Total Records" value={attendanceData.total} color="#6366f1" />
              <StatCard label="Office" value={attendanceData.officeCount} color="#10b981" sub={`${attendanceData.total ? Math.round(attendanceData.officeCount / attendanceData.total * 100) : 0}%`} />
              <StatCard label="Remote" value={attendanceData.remoteCount} color="#3b82f6" sub={`${attendanceData.total ? Math.round(attendanceData.remoteCount / attendanceData.total * 100) : 0}%`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {attendanceData.lateArrivals?.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <p className="px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Late Arrivals (This Period)</p>
                  <div className="divide-y divide-white/5">
                    {attendanceData.lateArrivals.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-slate-300 text-sm">{e.name}</span>
                        <span className="text-amber-400 text-xs font-medium">{e.count} late day{e.count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {attendanceData.avgHoursPerEmployee?.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <p className="px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Avg Working Hours / Employee</p>
                  <div className="divide-y divide-white/5">
                    {attendanceData.avgHoursPerEmployee.slice(0, 8).map(e => (
                      <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-slate-300 text-sm">{e.name}</span>
                        <span className="text-emerald-400 text-xs font-medium">{e.avgHours}h avg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
