const SLA_HOURS = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 120,
}

function getSLAInfo(ticket) {
  if (ticket.status === 'solved') return null
  const hours = SLA_HOURS[ticket.priority] || 72
  const created = new Date(ticket.opened_at || ticket.created_at)
  const now = new Date()
  const elapsedMs = now - created
  const slaMs = hours * 60 * 60 * 1000
  const pct = elapsedMs / slaMs
  const remainMs = slaMs - elapsedMs
  const remainH = Math.round(remainMs / (1000 * 60 * 60))
  const remainD = Math.floor(Math.abs(remainMs) / (1000 * 60 * 60 * 24))
  const remainHr = Math.round((Math.abs(remainMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (pct > 1) {
    const over = Math.abs(remainMs)
    const overD = Math.floor(over / (1000 * 60 * 60 * 24))
    const overH = Math.round((over % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    return {
      label: overD > 0 ? `متأخر ${overD}ي ${overH}س` : `متأخر ${overH}س`,
      type: 'breach',
      pct: Math.min(pct, 1),
    }
  }
  if (pct > 0.75) {
    const label = remainD > 0 ? `${remainD}ي ${remainHr}س` : `${Math.max(remainH, 0)}س`
    return { label: `على وشك · ${label}`, type: 'warning', pct }
  }
  const label = remainD > 0 ? `${remainD}ي ${remainHr}س` : `${Math.max(remainH, 0)}س`
  return { label: `SLA · ${label}`, type: 'ok', pct }
}

export default function SLABadge({ ticket }) {
  const info = getSLAInfo(ticket)
  if (!info) return null

  const styles = {
    breach: 'bg-red-900/40 text-red-400 border-red-500/30',
    warning: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
    ok: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30',
  }
  const icons = {
    breach: '⚠',
    warning: '⏳',
    ok: '✓',
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[info.type]}`}>
      <span>{icons[info.type]}</span>
      {info.label}
    </span>
  )
}

export { getSLAInfo }
