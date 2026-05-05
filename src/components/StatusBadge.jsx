export default function StatusBadge({ status }) {
  const map = {
    opened:  { label: 'Opened',  bg: 'rgba(37,99,235,0.15)',  border: 'rgba(59,130,246,0.3)',  text: '#60a5fa' },
    pending: { label: 'Pending', bg: 'rgba(180,83,9,0.15)',   border: 'rgba(251,146,60,0.3)',  text: '#fbbf24' },
    solved:  { label: 'Solved',  bg: 'rgba(22,101,52,0.15)',  border: 'rgba(34,197,94,0.3)',   text: '#4ade80' },
    accepted:{ label: 'Accepted',bg: 'rgba(22,101,52,0.15)',  border: 'rgba(34,197,94,0.3)',   text: '#4ade80' },
    refused: { label: 'Refused', bg: 'rgba(153,27,27,0.15)',  border: 'rgba(239,68,68,0.3)',   text: '#f87171' },
    approved:{ label: 'Approved',bg: 'rgba(22,101,52,0.15)',  border: 'rgba(34,197,94,0.3)',   text: '#4ade80' },
    rejected:{ label: 'Rejected',bg: 'rgba(153,27,27,0.15)',  border: 'rgba(239,68,68,0.3)',   text: '#f87171' },
  }
  const s = map[status] || { label: status, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)', text: '#94a3b8' }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.text, opacity: 0.8 }} />
      {s.label}
    </span>
  )
}
