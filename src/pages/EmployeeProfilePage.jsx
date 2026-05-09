import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const STATUS_COLORS = {
  opened: 'bg-blue-900/40 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
  solved: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30',
}

const LEAVE_LABELS = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب', other: 'أخرى' }
const LEAVE_COLORS = { annual: 'text-emerald-400', sick: 'text-blue-400', emergency: 'text-orange-400', unpaid: 'text-red-400', other: 'text-slate-400' }
const PENALTY_COLORS = { warning: 'text-amber-400', deduction: 'text-red-400', suspension: 'text-orange-500', termination: 'text-red-600', other: 'text-slate-400' }
const PENALTY_LABELS = { warning: 'إنذار', deduction: 'خصم', suspension: 'إيقاف', termination: 'إنهاء خدمة', other: 'أخرى' }

const PRIORITY_CLS = {
  urgent: 'bg-red-900/40 text-red-400 border-red-500/30',
  high: 'bg-orange-900/40 text-orange-400 border-orange-500/30',
  medium: 'bg-blue-900/40 text-blue-400 border-blue-500/30',
  low: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30',
}

function StatCard({ label, value, color = 'text-white', sub }) {
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-slate-500 text-[11px] uppercase tracking-widest mt-1">{label}</p>
      {sub && <p className="text-slate-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

export default function EmployeeProfilePage({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState('overview')

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError('')
    api.getEmployeeProfile(userId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  const bgGrad = 'radial-gradient(ellipse at 60% -10%, rgba(49,46,129,0.4) 0%, transparent 55%), #05050a'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: bgGrad }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/8 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          رجوع
        </button>
        {data && (
          <div className="flex items-center gap-3 ml-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              {(data.profile.full_name || data.profile.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{data.profile.full_name || data.profile.email}</p>
              <p className="text-slate-500 text-xs">{data.profile.role}</p>
            </div>
          </div>
        )}
        <span className="ml-auto text-slate-600 text-xs">ملف الموظف الشامل</span>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">جاري تحميل البيانات...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-400 text-sm bg-red-900/20 px-5 py-3 rounded-xl border border-red-500/20">{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

            {/* Profile Card */}
            <div className="rounded-2xl p-6 flex flex-wrap items-start gap-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
                {(data.profile.full_name || data.profile.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white text-xl font-bold">{data.profile.full_name || '—'}</h2>
                <p className="text-slate-400 text-sm mt-0.5">{data.profile.email}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${data.profile.role === 'super_admin' ? 'bg-amber-900/30 text-amber-400' : data.profile.role === 'admin' ? 'bg-purple-900/30 text-purple-400' : data.profile.role === 'member' ? 'bg-slate-800/60 text-slate-300' : 'bg-blue-900/30 text-blue-400'}`}>
                    {data.profile.role === 'super_admin' ? '👑 Super Admin' : data.profile.role}
                  </span>
                  {!data.profile.must_change_password && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">✓ نشط</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-emerald-400 font-bold text-lg">{data.profile.leave_balance}</p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">إجازة سنوية</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-blue-400 font-bold text-lg">{data.profile.sick_leave_balance}</p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">إجازة مرضية</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-orange-400 font-bold text-lg">{data.profile.emergency_leave_balance}</p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">إجازة طارئة</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="أيام الحضور" value={data.attendance.thisMonthDays} color="text-emerald-400" sub="هذا الشهر" />
              <StatCard label="متوسط ساعات" value={data.attendance.avgHoursPerDay > 0 ? `${data.attendance.avgHoursPerDay}س` : '—'} color="text-blue-400" sub="يومياً" />
              <StatCard label="تذاكر مفتوحة" value={data.tickets.stats.open + data.tickets.stats.pending} color="text-amber-400" sub="نشطة الآن" />
              <StatCard label="تذاكر محلولة" value={data.tickets.stats.solved} color="text-emerald-400" sub="إجمالي" />
            </div>

            {/* Sections Nav */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'overview', label: 'نظرة عامة' },
                { key: 'tickets', label: `التذاكر (${data.tickets.stats.total})` },
                { key: 'leaves', label: `الإجازات (${data.leaves.list.length})` },
                { key: 'penalties', label: `الجزاءات (${data.penalties.stats.total})` },
                { key: 'assets', label: `الأصول (${data.assets.length})` },
              ].map(s => (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${section === s.key ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/8 border border-white/8'}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Overview */}
            {section === 'overview' && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Attendance */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <span className="text-base">📅</span> الحضور — هذا الشهر
                  </h3>
                  <div className="space-y-2">
                    {data.attendance.recentDays.length === 0 && (
                      <p className="text-slate-500 text-sm text-center py-4">لا توجد سجلات هذا الشهر</p>
                    )}
                    {data.attendance.recentDays.map(a => {
                      const duration = a.logout_time
                        ? ((new Date(a.logout_time) - new Date(a.login_time)) / (1000 * 60 * 60)).toFixed(1)
                        : null
                      return (
                        <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-white/5">
                          <span className="text-slate-400 text-sm">{a.date}</span>
                          <span className="text-slate-500 text-xs">{new Date(a.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {duration ? <span className="text-emerald-400 text-xs font-semibold">{duration}س</span> : <span className="text-amber-400 text-xs">لم يغادر</span>}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-slate-600 text-xs mt-3">إجمالي السجلات: {data.attendance.totalRecords}</p>
                </div>

                {/* Penalties Summary */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <span className="text-base">⚠</span> الجزاءات
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-amber-400 font-bold text-xl">{data.penalties.stats.warnings}</p>
                      <p className="text-slate-500 text-[10px]">إنذارات</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-red-400 font-bold text-xl">{data.penalties.stats.deductions}</p>
                      <p className="text-slate-500 text-[10px]">خصومات</p>
                    </div>
                  </div>
                  {data.penalties.stats.totalAmount > 0 && (
                    <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-red-400 font-bold">{data.penalties.stats.totalAmount.toLocaleString()} جنيه</p>
                      <p className="text-slate-500 text-[10px]">إجمالي الخصومات</p>
                    </div>
                  )}
                  {data.penalties.stats.total === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">لا توجد جزاءات</p>
                  )}
                </div>

                {/* Leave Balance */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <span className="text-base">🌴</span> رصيد الإجازات
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'سنوية', val: data.leaves.balance.annual, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)' },
                      { label: 'مرضية', val: data.leaves.balance.sick, color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)' },
                      { label: 'طارئة', val: data.leaves.balance.emergency, color: 'text-orange-400', bg: 'rgba(249,115,22,0.1)' },
                    ].map(b => (
                      <div key={b.label} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: b.bg }}>
                        <span className="text-slate-300 text-sm">{b.label}</span>
                        <span className={`${b.color} font-bold`}>{b.val} يوم</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                    <span className="text-slate-500">معتمدة هذا العام</span>
                    <span className="text-emerald-400 font-semibold">{data.leaves.stats.totalDays} يوم</span>
                  </div>
                </div>

                {/* Active Tickets */}
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                    <span className="text-base">🎫</span> التذاكر المسندة
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <p className="text-blue-400 font-bold">{data.tickets.stats.open}</p>
                      <p className="text-slate-500 text-[10px]">مفتوحة</p>
                    </div>
                    <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                      <p className="text-amber-400 font-bold">{data.tickets.stats.pending}</p>
                      <p className="text-slate-500 text-[10px]">معلقة</p>
                    </div>
                    <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <p className="text-emerald-400 font-bold">{data.tickets.stats.solved}</p>
                      <p className="text-slate-500 text-[10px]">محلولة</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {data.tickets.assigned.filter(t => t.status !== 'solved').slice(0, 4).map(t => (
                      <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                        <span className="text-slate-300 text-xs truncate flex-1">{t.title}</span>
                      </div>
                    ))}
                    {data.tickets.assigned.filter(t => t.status !== 'solved').length === 0 && (
                      <p className="text-slate-500 text-xs text-center py-2">لا توجد تذاكر نشطة</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tickets Section */}
            {section === 'tickets' && (
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm">التذاكر المسندة ({data.tickets.stats.total})</h3>
                {data.tickets.assigned.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">لا توجد تذاكر مسندة</div>
                )}
                {data.tickets.assigned.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                    {t.priority && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_CLS[t.priority] || ''}`}>{t.priority}</span>}
                    <span className="text-slate-200 text-sm flex-1 truncate">{t.title}</span>
                    {t.category && <span className="text-slate-500 text-xs hidden sm:block">{t.category}</span>}
                    <span className="text-slate-600 text-xs flex-shrink-0">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Leaves Section */}
            {section === 'leaves' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="text-white font-semibold text-sm">طلبات الإجازة</h3>
                  <div className="flex gap-3 text-xs">
                    <span>معتمدة: <span className="text-emerald-400 font-semibold">{data.leaves.stats.approved}</span></span>
                    <span>معلقة: <span className="text-amber-400 font-semibold">{data.leaves.stats.pending}</span></span>
                    <span>مرفوضة: <span className="text-red-400 font-semibold">{data.leaves.stats.rejected}</span></span>
                  </div>
                </div>
                {data.leaves.list.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">لا توجد طلبات إجازة</div>
                )}
                {data.leaves.list.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${l.status === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : l.status === 'pending' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'}`}>
                      {l.status === 'approved' ? 'معتمدة' : l.status === 'pending' ? 'معلقة' : 'مرفوضة'}
                    </span>
                    <span className={`text-xs font-medium ${LEAVE_COLORS[l.leave_type] || 'text-slate-400'}`}>{LEAVE_LABELS[l.leave_type] || l.leave_type}</span>
                    <span className="text-slate-300 text-sm flex-1">{l.start_date} → {l.end_date}</span>
                    <span className="text-slate-500 text-xs">{l.days_count} يوم</span>
                  </div>
                ))}
              </div>
            )}

            {/* Penalties Section */}
            {section === 'penalties' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="text-white font-semibold text-sm">الجزاءات ({data.penalties.stats.total})</h3>
                  {data.penalties.stats.totalAmount > 0 && (
                    <span className="text-red-400 text-sm font-semibold">إجمالي الخصومات: {data.penalties.stats.totalAmount.toLocaleString()} جنيه</span>
                  )}
                </div>
                {data.penalties.list.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">لا توجد جزاءات</div>
                )}
                {data.penalties.list.map(p => (
                  <div key={p.id} className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${PENALTY_COLORS[p.type] || 'text-slate-400'}`}>{PENALTY_LABELS[p.type] || p.type}</span>
                        {p.amount > 0 && <span className="text-red-400 text-xs font-bold">{p.amount} جنيه</span>}
                      </div>
                      <p className="text-slate-300 text-sm">{p.reason}</p>
                      {p.notes && <p className="text-slate-500 text-xs mt-1">{p.notes}</p>}
                    </div>
                    <span className="text-slate-600 text-xs flex-shrink-0">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Assets Section */}
            {section === 'assets' && (
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm">الأصول المسندة ({data.assets.length})</h3>
                {data.assets.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">لا توجد أصول مسندة لهذا الموظف</div>
                )}
                {data.assets.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-semibold">{a.name}</p>
                      <p className="text-slate-500 text-xs">{a.type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-emerald-900/30 text-emerald-400' : a.status === 'under_maintenance' ? 'bg-amber-900/30 text-amber-400' : 'bg-slate-800/60 text-slate-400'}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
