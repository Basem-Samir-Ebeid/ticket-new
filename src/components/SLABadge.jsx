import { useState, useEffect } from 'react'

let cachedSlaHours = null
let slaFetchPromise = null

async function fetchSlaHours() {
  if (cachedSlaHours) return cachedSlaHours
  if (slaFetchPromise) return slaFetchPromise
  slaFetchPromise = fetch('/api/settings/sla')
    .then(r => r.json())
    .then(data => {
      cachedSlaHours = {
        urgent: Number(data.sla_urgent) || 4,
        high: Number(data.sla_high) || 24,
        medium: Number(data.sla_medium) || 72,
        low: Number(data.sla_low) || 120,
      }
      slaFetchPromise = null
      return cachedSlaHours
    })
    .catch(() => {
      slaFetchPromise = null
      return { urgent: 4, high: 24, medium: 72, low: 120 }
    })
  return slaFetchPromise
}

export function invalidateSlaCache() { cachedSlaHours = null }

function getSLAInfo(ticket, slaHours) {
  if (ticket.status === 'solved' || ticket.status === 'merged') return null
  const hours = slaHours[ticket.priority] || 72
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
      slaMs,
    }
  }
  if (pct > 0.75) {
    const label = remainD > 0 ? `${remainD}ي ${remainHr}س` : `${Math.max(remainH, 0)}س`
    return { label: `على وشك · ${label}`, type: 'warning', pct, slaMs }
  }
  const label = remainD > 0 ? `${remainD}ي ${remainHr}س` : `${Math.max(remainH, 0)}س`
  return { label: `SLA · ${label}`, type: 'ok', pct, slaMs }
}

export default function SLABadge({ ticket }) {
  const [slaHours, setSlaHours] = useState(cachedSlaHours || { urgent: 4, high: 24, medium: 72, low: 120 })

  useEffect(() => {
    if (!cachedSlaHours) {
      fetchSlaHours().then(setSlaHours)
    }
  }, [])

  const info = getSLAInfo(ticket, slaHours)
  if (!info) return null

  const styles = {
    breach: 'bg-red-900/40 text-red-400 border-red-500/30',
    warning: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
    ok: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30',
  }
  const icons = { breach: '⚠', warning: '⏳', ok: '✓' }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[info.type]}`}>
      <span>{icons[info.type]}</span>
      {info.label}
      {ticket.sla_escalated && <span className="ml-1 text-[9px] bg-red-500/20 border border-red-500/30 text-red-300 px-1 rounded">ESC</span>}
    </span>
  )
}

export { getSLAInfo }
