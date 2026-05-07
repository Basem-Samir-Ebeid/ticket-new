export default function StatusBadge({ status }) {
  const map = {
    opened:  { label: 'Opened',   bg: 'rgba(37,99,235,0.12)',  border: 'rgba(59,130,246,0.28)',  text: '#60a5fa',  dot: '#3b82f6' },
    pending: { label: 'Pending',  bg: 'rgba(180,83,9,0.12)',   border: 'rgba(251,146,60,0.28)',  text: '#fbbf24',  dot: '#f59e0b' },
    solved:  { label: 'Solved',   bg: 'rgba(16,185,129,0.12)', border: 'rgba(52,211,153,0.28)',  text: '#34d399',  dot: '#10b981' },
    accepted:{ label: 'Accepted', bg: 'rgba(16,185,129,0.12)', border: 'rgba(52,211,153,0.28)',  text: '#34d399',  dot: '#10b981' },
    refused: { label: 'Refused',  bg: 'rgba(153,27,27,0.12)',  border: 'rgba(239,68,68,0.28)',   text: '#f87171',  dot: '#ef4444' },
    approved:{ label: 'Approved', bg: 'rgba(16,185,129,0.12)', border: 'rgba(52,211,153,0.28)',  text: '#34d399',  dot: '#10b981' },
    rejected:{ label: 'Rejected', bg: 'rgba(153,27,27,0.12)',  border: 'rgba(239,68,68,0.28)',   text: '#f87171',  dot: '#ef4444' },
  }
  const s = map[status] || { label: status, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', text: '#94a3b8', dot: '#64748b' }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize tracking-wide"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-slow" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}
