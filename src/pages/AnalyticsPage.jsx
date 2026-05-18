import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

const RANGE_OPTIONS = [
  { label: 'Last 7 days',  value: 'week' },
  { label: 'Last 30 days', value: 'month' },
  { label: 'Last 90 days', value: '3months' },
]

function StatCard({ label, value, sub, color = '#6366f1' }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value ?? '—'}</p>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-white text-sm font-semibold mb-4">{title}</p>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
}

export default function AnalyticsPage() {
  const [range, setRange] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load(r) {
    setLoading(true)
    try {
      const d = await api.getAnalytics(r)
      setData(d)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load(range) }, [range])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span> Analytics
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Ticket performance metrics and trends</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setRange(o.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={range === o.value
                ? { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500 animate-pulse text-sm">Loading analytics...</div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-600 text-sm">Failed to load analytics data.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Tickets" value={data.total} color="#6366f1" />
            <StatCard label="SLA Compliance" value={data.slaRate != null ? `${data.slaRate}%` : 'N/A'} color="#10b981" sub="tickets resolved within deadline" />
            <StatCard label="Avg Resolution" value={data.avgResolutionHours != null ? `${data.avgResolutionHours}h` : 'N/A'} color="#f59e0b" sub="across all solved tickets" />
            <StatCard label="Resolved" value={data.byStatus?.solved ?? 0} color="#10b981" sub={`${data.byStatus?.opened ?? 0} open · ${data.byStatus?.pending ?? 0} pending`} />
          </div>

          {/* Weekly Created vs Resolved */}
          <ChartCard title="Tickets Created vs Resolved — Weekly">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.weeklyTrend} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="created" name="Created" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Avg Resolution by Priority */}
            <ChartCard title="Avg Resolution Time by Priority (hours)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.avgResolutionByPriority} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="priority" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip {...tooltipStyle} formatter={v => [`${v}h`, 'Avg Time']} />
                  <Bar dataKey="avgHours" name="Avg Hours" radius={[0, 4, 4, 0]}>
                    {data.avgResolutionByPriority?.map((_, i) => (
                      <Cell key={i} fill={['#ef4444', '#f59e0b', '#6366f1', '#64748b'][i] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Ticket Distribution by Category */}
            <ChartCard title="Ticket Distribution by Category">
              {data.topCategories?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.topCategories} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'rgba(255,255,255,0.15)' }}>
                      {data.topCategories.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No category data</div>
              )}
            </ChartCard>
          </div>

          {/* SLA Compliance Over Time */}
          <ChartCard title="SLA Compliance Rate Over Time (%)">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.slaOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip {...tooltipStyle} formatter={v => [`${v}%`, 'SLA Rate']} />
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Assignees */}
          <ChartCard title="Top Assignees — Ticket Count & Avg Resolution Speed">
            {data.techPerformance?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Assignee', 'Assigned', 'Resolved', 'Avg Resolution', 'Avg Rating'].map(h => (
                        <th key={h} className="text-left pb-3 pr-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.techPerformance.slice(0, 10).map((t, i) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: `${COLORS[i % COLORS.length]}33`, border: `1px solid ${COLORS[i % COLORS.length]}66` }}>
                              {(t.name || '?')[0].toUpperCase()}
                            </div>
                            <span className="text-slate-300 text-xs font-medium truncate max-w-[140px]">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-400 text-xs">{t.assigned}</td>
                        <td className="py-2.5 pr-4 text-xs">
                          <span className="text-emerald-400 font-semibold">{t.solved}</span>
                          <span className="text-slate-600 ml-1">({t.assigned > 0 ? Math.round((t.solved / t.assigned) * 100) : 0}%)</span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-400 text-xs">{t.avgResolutionHours ? `${t.avgResolutionHours}h` : '—'}</td>
                        <td className="py-2.5 text-xs">
                          {t.avgRating ? (
                            <span className="flex items-center gap-1">
                              <span className="text-amber-400">★</span>
                              <span className="text-slate-300">{t.avgRating}</span>
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-slate-600 text-sm text-center py-8">No assignee data yet</div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  )
}
