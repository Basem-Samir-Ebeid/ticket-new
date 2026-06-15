export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fadeIn">
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 16,
        boxShadow: '0 0 0 8px rgba(255,255,255,0.02)',
      }}>
        {icon}
      </div>
      <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{title}</p>
      {subtitle && <p style={{ color: '#64748b', fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{
          flex: i === 0 ? '0 0 40px' : 1,
          height: i === 0 ? 40 : 14,
          borderRadius: i === 0 ? '50%' : 6,
          background: 'rgba(255,255,255,0.05)',
        }} className="shimmer" />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} className="shimmer" />
      <div style={{ height: 32, width: '40%', borderRadius: 8, background: 'rgba(255,255,255,0.05)', marginBottom: 8 }} className="shimmer" />
      <div style={{ height: 10, width: '80%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} className="shimmer" />
    </div>
  )
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: '#6366f1',
        animation: 'rotate 0.8s linear infinite',
      }} />
      <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p>
    </div>
  )
}
