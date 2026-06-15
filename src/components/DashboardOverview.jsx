import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { SkeletonCard } from './EmptyState'

function StatCard({ icon, label, value, sub, color, glow }) {
  return (
    <div className={`hover-lift`} style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}20`,
      borderRadius: 16, padding: '20px 22px',
      boxShadow: `0 0 0 1px ${color}10, 0 8px 32px ${color}08`,
      transition: 'all 0.2s',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `${color}08`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
          <p className="counter-animate" style={{ color, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{value ?? '—'}</p>
          {sub && <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>{sub}</p>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}15`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function ActivityItem({ icon, text, time, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: `${color}15`,
        border: `1px solid ${color}25`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 15, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>{text}</p>
        <p style={{ color: '#334155', fontSize: 11, marginTop: 2 }}>{time}</p>
      </div>
    </div>
  )
}

function QuickActionBtn({ icon, label, onClick, color = '#6366f1' }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      transition: 'all 0.15s', width: '100%',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}30` }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
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

  const openTickets   = tickets.filter(t => t.status === 'opened').length
  const pendingTickets= tickets.filter(t => t.status === 'pending').length
  const solvedToday   = tickets.filter(t => t.status === 'solved' && t.solved_at && new Date(t.solved_at).toDateString() === new Date().toDateString()).length
  const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'solved').length
  const breachedSLA   = tickets.filter(t => t.sla_deadline && new Date(t.sla_deadline) < new Date() && t.status !== 'solved').length

  const recentActivity = tickets
    .filter(t => t.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)
    .map(t => ({
      icon: t.priority === 'urgent' ? '🚨' : t.status === 'solved' ? '✅' : '🎫',
      text: `تذكرة "${t.title?.slice(0, 40) || '...'}${t.title?.length > 40 ? '...' : ''}" — ${t.status === 'solved' ? 'تم الحل' : t.status === 'pending' ? 'قيد المعالجة' : 'مفتوحة'}`,
      time: formatRelative(t.created_at),
      color: t.priority === 'urgent' ? '#ef4444' : t.status === 'solved' ? '#10b981' : '#6366f1',
    }))

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 20 }}>
            لوحة التحكم
          </h2>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {liveAttendance && (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse-slow 2s infinite' }} />
            <span style={{ color: '#34d399', fontSize: 13, fontWeight: 500 }}>
              {liveAttendance.present_count ?? 0} موظف حاضر الآن
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          <StatCard icon="🎫" label="مفتوحة" value={openTickets} sub="تذكرة بانتظار المعالجة" color="#6366f1" />
          <StatCard icon="⏳" label="قيد المعالجة" value={pendingTickets} sub="يعمل عليها الفريق" color="#f59e0b" />
          <StatCard icon="✅" label="تم الحل اليوم" value={solvedToday} sub="تذاكر مغلقة اليوم" color="#10b981" />
          <StatCard icon="🚨" label="عاجلة" value={urgentTickets} sub="تحتاج استجابة فورية" color="#ef4444" />
          {breachedSLA > 0 && (
            <StatCard icon="⚠️" label="SLA مخترقة" value={breachedSLA} sub="تجاوزت الموعد المحدد" color="#f97316" />
          )}
          <StatCard icon="👥" label="الموظفون" value={users.length} sub="إجمالي المستخدمين" color="#8b5cf6" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 20,
        }}>
          <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>⚡ إجراءات سريعة</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <QuickActionBtn icon="🎫" label="تذكرة جديدة" onClick={() => onNavigate?.('tickets')} color="#6366f1" />
            <QuickActionBtn icon="👤" label="موظف جديد" onClick={() => onNavigate?.('users')} color="#8b5cf6" />
            <QuickActionBtn icon="📊" label="التحليلات" onClick={() => onNavigate?.('analytics')} color="#06b6d4" />
            <QuickActionBtn icon="📅" label="الإجازات" onClick={() => onNavigate?.('leave')} color="#f59e0b" />
            <QuickActionBtn icon="⏰" label="الحضور" onClick={() => onNavigate?.('attendance')} color="#10b981" />
            <QuickActionBtn icon="📢" label="إعلان جديد" onClick={() => onNavigate?.('announcements')} color="#ec4899" />
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 20,
        }}>
          <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🕐 آخر النشاطات</p>
          {recentActivity.length === 0 ? (
            <p style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>لا توجد نشاطات بعد</p>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {recentActivity.map((a, i) => <ActivityItem key={i} {...a} />)}
            </div>
          )}
        </div>
      </div>

      {analytics && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 20,
        }}>
          <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>📈 مؤشرات الأسبوع</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'إجمالي التذاكر', value: analytics.totalTickets ?? '—', color: '#6366f1' },
              { label: 'تم الحل', value: analytics.resolvedTickets ?? '—', color: '#10b981' },
              { label: 'SLA امتثال', value: analytics.slaCompliance ? `${analytics.slaCompliance}%` : '—', color: '#06b6d4' },
              { label: 'متوسط الحل', value: analytics.avgResolutionTime ? `${analytics.avgResolutionTime}h` : '—', color: '#f59e0b' },
            ].map((m, i) => (
              <div key={i} style={{
                background: `${m.color}08`, border: `1px solid ${m.color}15`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ color: '#475569', fontSize: 11, marginBottom: 6 }}>{m.label}</p>
                <p style={{ color: m.color, fontWeight: 700, fontSize: 22 }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
