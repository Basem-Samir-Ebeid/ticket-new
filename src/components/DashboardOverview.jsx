import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { SkeletonCard } from './EmptyState'

const STAT_ICONS = {
  tickets: 'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z',
  pending: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  solved:  'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  urgent:  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  sla:     'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  users:   'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  bar:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
}

const QUICK_ACTIONS = [
  { icon: 'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z', label: 'New Ticket', nav: 'tickets', color: '#6366f1' },
  { icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', label: 'New User', nav: 'users', color: '#8b5cf6' },
  { icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', label: 'Analytics', nav: 'analytics', color: '#06b6d4' },
  { icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', label: 'Leave', nav: 'leave', color: '#f59e0b' },
  { icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Attendance', nav: 'attendance', color: '#10b981' },
  { icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0', label: 'Announce', nav: 'announcements', color: '#ec4899' },
]

function StatCard({ iconPath, label, value, sub, color, trend }) {
  return (
    <div className="hover-lift card-shine relative overflow-hidden rounded-2xl p-5 transition-all duration-200" style={{
      background: 'linear-gradient(145deg, rgba(14,16,32,0.97) 0%, rgba(8,10,20,0.98) 100%)',
      border: `1px solid ${color}18`,
      boxShadow: `0 0 0 1px ${color}0f, 0 8px 32px rgba(0,0,0,0.3)`,
    }}>
      {/* Ambient top glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20"
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, filter: 'blur(20px)' }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p style={{ color: '#3d4f65', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{label}</p>
          <p className="counter-animate" style={{ color, fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {value ?? '—'}
          </p>
          {sub && <p style={{ color: '#3a4d63', fontSize: 12, marginTop: 7, lineHeight: 1.4 }}>{sub}</p>}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `${color}14`, border: `1px solid ${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.7}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-4 right-4 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}30, transparent)` }} />
    </div>
  )
}

function ActivityItem({ icon, text, time, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: `${color}12`, border: `1px solid ${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d={
            icon === '🚨' ? 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'
            : icon === '✅' ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            : 'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z'
          } />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#8a9bb5', fontSize: 12.5, lineHeight: 1.45, wordBreak: 'break-word' }}>{text}</p>
        <p style={{ color: '#2d3d52', fontSize: 11, marginTop: 2 }}>{time}</p>
      </div>
    </div>
  )
}

function QuickActionBtn({ action, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.065)',
      borderRadius: 12, padding: '12px 8px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      transition: 'all 0.15s ease', width: '100%',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = `${action.color}0e`; e.currentTarget.style.borderColor = `${action.color}28`; e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.065)'; e.currentTarget.style.transform = '' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `${action.color}12`, border: `1px solid ${action.color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={action.color} strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
        </svg>
      </div>
      <span style={{ color: '#6a7d96', fontSize: 11.5, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{action.label}</span>
    </button>
  )
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  return `منذ ${Math.floor(hrs / 24)} يوم`
}

export default function DashboardOverview({ onNavigate, isSuperAdmin = false, tickets = [], users = [] }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liveAttendance, setLiveAttendance] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [a, live] = await Promise.allSettled([
          api.getAnalytics('week'),
          api.getLiveAttendance(),
        ])
        if (a.status === 'fulfilled') setAnalytics(a.value)
        if (live.status === 'fulfilled') setLiveAttendance(live.value)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const openTickets    = tickets.filter(t => t.status === 'opened').length
  const pendingTickets = tickets.filter(t => t.status === 'pending').length
  const solvedToday    = tickets.filter(t => t.status === 'solved' && t.solved_at && new Date(t.solved_at).toDateString() === new Date().toDateString()).length
  const urgentTickets  = tickets.filter(t => t.priority === 'urgent' && t.status !== 'solved').length
  const breachedSLA    = tickets.filter(t => t.sla_deadline && new Date(t.sla_deadline) < new Date() && t.status !== 'solved').length

  const recentActivity = tickets
    .filter(t => t.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(t => ({
      icon: t.priority === 'urgent' ? '🚨' : t.status === 'solved' ? '✅' : '🎫',
      text: `"${t.title?.slice(0, 38) || '...'}${t.title?.length > 38 ? '...' : ''}" — ${t.status === 'solved' ? 'تم الحل' : t.status === 'pending' ? 'قيد المعالجة' : 'مفتوحة'}`,
      time: formatRelative(t.created_at),
      color: t.priority === 'urgent' ? '#ef4444' : t.status === 'solved' ? '#10b981' : '#6366f1',
    }))

  const accentColor = isSuperAdmin ? '#f59e0b' : '#6366f1'

  return (
    <div className="animate-fadeIn space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl tracking-tight">
            لوحة التحكم
          </h2>
          <p style={{ color: '#3d4f65', fontSize: 13, marginTop: 3 }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {liveAttendance && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl" style={{
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span style={{ color: '#34d399', fontSize: 13, fontWeight: 500 }}>
              {liveAttendance.present_count ?? 0} حاضر الآن
            </span>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}>
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))' }}>
          <StatCard iconPath={STAT_ICONS.tickets} label="مفتوحة" value={openTickets} sub="تذكرة بانتظار المعالجة" color="#6366f1" />
          <StatCard iconPath={STAT_ICONS.pending} label="قيد المعالجة" value={pendingTickets} sub="يعمل عليها الفريق" color="#f59e0b" />
          <StatCard iconPath={STAT_ICONS.solved}  label="تم الحل اليوم" value={solvedToday} sub="تذاكر مغلقة اليوم" color="#10b981" />
          <StatCard iconPath={STAT_ICONS.urgent}  label="عاجلة" value={urgentTickets} sub="تحتاج استجابة فورية" color="#ef4444" />
          {breachedSLA > 0 && (
            <StatCard iconPath={STAT_ICONS.sla}   label="SLA مخترقة" value={breachedSLA} sub="تجاوزت الموعد" color="#f97316" />
          )}
          <StatCard iconPath={STAT_ICONS.users}   label="الموظفون" value={users.length} sub="إجمالي المستخدمين" color="#8b5cf6" />
        </div>
      )}

      {/* ── Quick actions + Recent activity ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Quick actions */}
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(145deg, rgba(12,14,28,0.98) 0%, rgba(8,10,20,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>إجراءات سريعة</p>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {QUICK_ACTIONS.map((a, i) => (
              <QuickActionBtn key={i} action={a} onClick={() => onNavigate?.(a.nav)} />
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(145deg, rgba(12,14,28,0.98) 0%, rgba(8,10,20,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>آخر النشاطات</p>
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p style={{ color: '#2d3d52', fontSize: 13, textAlign: 'center' }}>لا توجد نشاطات بعد</p>
            </div>
          ) : (
            <div style={{ maxHeight: 230, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {recentActivity.map((a, i) => <ActivityItem key={i} {...a} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly metrics ── */}
      {analytics && (
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(145deg, rgba(12,14,28,0.98) 0%, rgba(8,10,20,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>مؤشرات الأسبوع</p>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}>
            {[
              { label: 'إجمالي التذاكر', value: analytics.totalTickets ?? '—', color: '#6366f1', icon: STAT_ICONS.tickets },
              { label: 'تم الحل', value: analytics.resolvedTickets ?? '—', color: '#10b981', icon: STAT_ICONS.solved },
              { label: 'SLA امتثال', value: analytics.slaCompliance ? `${analytics.slaCompliance}%` : '—', color: '#06b6d4', icon: STAT_ICONS.bar },
              { label: 'متوسط الحل', value: analytics.avgResolutionTime ? `${analytics.avgResolutionTime}h` : '—', color: '#f59e0b', icon: STAT_ICONS.pending },
            ].map((m, i) => (
              <div key={i} style={{
                background: `${m.color}08`,
                border: `1px solid ${m.color}14`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <p style={{ color: '#3d4f65', fontSize: 10.5, marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{m.label}</p>
                <p style={{ color: m.color, fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
