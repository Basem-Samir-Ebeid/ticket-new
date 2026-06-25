import SLABadge from './SLABadge'
import { PRIORITY_BADGE_STYLES, STATUS_BADGE_STYLES, getAccentColor, COMMON_STYLES, COLORS } from '../config/design'

const PRIORITY_COLOR = {
  urgent: COLORS.priority.urgent,
  high: COLORS.priority.high,
  medium: COLORS.priority.medium,
  low: COLORS.priority.low,
}

const STATUS_CONFIG = {
  opened: { label: 'Open', color: '#818cf8', dot: '#6366f1' },
  pending: { label: 'Pending', color: '#fbbf24', dot: '#f59e0b' },
  solved: { label: 'Solved', color: '#34d399', dot: '#10b981' },
  merged: { label: 'Merged', color: '#94a3b8', dot: '#64748b' },
}

const TICKETS_PER_PAGE = 20

export default function TicketList({
  tickets, filteredTickets,
  ticketSearch, setTicketSearch,
  ticketStatusFilter, setTicketStatusFilter,
  ticketPriorityFilter, setTicketPriorityFilter,
  ticketSortByPriority, setTicketSortByPriority,
  ticketTagFilter, setTicketTagFilter,
  ticketPage, setTicketPage,
  updateStatus, deleteTicket, loading,
  onSelectTicket,
  onNewTicket,
  isSuperAdmin,
  onExportCsv, onExportExcel, onStaffOverview,
  showCreateTicket,
}) {
  const accentColor = getAccentColor(isSuperAdmin)
  const allTags = [...new Set(tickets.flatMap(t => t.tags || []))]
  const pageCount = Math.ceil(filteredTickets.length / TICKETS_PER_PAGE)
  const paginated = filteredTickets.slice((ticketPage - 1) * TICKETS_PER_PAGE, ticketPage * TICKETS_PER_PAGE)

  const counts = {
    all: tickets.length,
    opened: tickets.filter(t => t.status === 'opened').length,
    pending: tickets.filter(t => t.status === 'pending').length,
    solved: tickets.filter(t => t.status === 'solved').length,
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-white text-lg font-bold flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-base"
              style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}35` }}>🎫</span>
            All Tickets
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 ml-11">
            <span className="text-slate-300 font-semibold">{tickets.length}</span> total ·{' '}
            <span className="text-indigo-400 font-semibold">{counts.opened}</span> open ·{' '}
            <span className="text-amber-400 font-semibold">{counts.pending}</span> pending ·{' '}
            <span className="text-emerald-400 font-semibold">{counts.solved}</span> solved
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export CSV */}
          <button onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#cbd5e1' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            CSV
          </button>
          {/* Export Excel */}
          <button onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', color: '#34d399' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.14)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.07)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Excel
          </button>
          {/* Staff (super admin) */}
          {onStaffOverview && (
            <button onClick={onStaffOverview}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#cbd5e1' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Staff
            </button>
          )}
          {/* New Ticket */}
          <button onClick={onNewTicket}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: showCreateTicket ? 'rgba(99,102,241,0.25)' : (isSuperAdmin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#6366f1,#4f46e5)'),
              color: isSuperAdmin && !showCreateTicket ? '#1c1004' : 'white',
              boxShadow: showCreateTicket ? 'none' : (isSuperAdmin ? '0 4px 16px rgba(245,158,11,0.3)' : '0 4px 16px rgba(99,102,241,0.3)'),
            }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={showCreateTicket ? 'M6 18L18 6M6 6l12 12' : 'M12 4.5v15m7.5-7.5h-15'} />
            </svg>
            {showCreateTicket ? 'Cancel' : 'New Ticket'}
          </button>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="rounded-2xl p-4 mb-4 space-y-3"
        style={COMMON_STYLES.filterBg}>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={ticketSearch}
            onChange={e => { setTicketSearch(e.target.value); setTicketPage(1) }}
            placeholder="Search by title, description, person, category…"
            className="w-full rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={e => { e.target.style.borderColor = `${accentColor}50`; e.target.style.background = `${accentColor}08` }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
          />
          {ticketSearch && (
            <button onClick={() => setTicketSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all">
              ✕
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600" style={{ minWidth: '42px' }}>Status</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { v: 'all',     label: 'All',     color: '#94a3b8', activeBg: 'rgba(148,163,184,0.18)', border: 'rgba(148,163,184,0.3)' },
              { v: 'opened',  label: 'Open',    color: '#818cf8', activeBg: 'rgba(99,102,241,0.2)',   border: 'rgba(99,102,241,0.4)' },
              { v: 'pending', label: 'Pending', color: '#fbbf24', activeBg: 'rgba(245,158,11,0.2)',   border: 'rgba(245,158,11,0.4)' },
              { v: 'solved',  label: 'Solved',  color: '#34d399', activeBg: 'rgba(16,185,129,0.2)',   border: 'rgba(16,185,129,0.4)' },
            ].map(f => {
              const active = ticketStatusFilter === f.v
              return (
                <button key={f.v}
                  onClick={() => { setTicketStatusFilter(f.v); setTicketPage(1) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? f.activeBg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? f.border : 'rgba(255,255,255,0.07)'}`,
                    color: active ? f.color : '#64748b',
                  }}>
                  {f.label}
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)' }}>
                    {f.v === 'all' ? counts.all : counts[f.v] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600" style={{ minWidth: '42px' }}>Priority</span>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { v: 'all',    label: 'All',    dot: '#64748b' },
              { v: 'low',    label: 'Low',    dot: '#22c55e' },
              { v: 'medium', label: 'Medium', dot: '#eab308' },
              { v: 'high',   label: 'High',   dot: '#f97316' },
              { v: 'urgent', label: 'Urgent', dot: '#ef4444' },
            ].map(f => {
              const active = ticketPriorityFilter === f.v
              return (
                <button key={f.v}
                  onClick={() => { setTicketPriorityFilter(f.v); setTicketPage(1) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    color: active ? '#e2e8f0' : '#64748b',
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: f.dot, boxShadow: active ? `0 0 6px ${f.dot}` : 'none' }} />
                  {f.label}
                </button>
              )
            })}
          </div>
          <button onClick={() => setTicketSortByPriority(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-auto"
            style={{
              background: ticketSortByPriority ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${ticketSortByPriority ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: ticketSortByPriority ? '#fbbf24' : '#64748b',
            }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
            Sort by Priority
          </button>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-1">Tags</span>
            {allTags.map(tag => {
              const active = ticketTagFilter === tag
              return (
                <button key={tag}
                  onClick={() => { setTicketTagFilter(active ? '' : tag); setTicketPage(1) }}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-all"
                  style={{
                    background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#a5b4fc' : '#64748b',
                  }}>
                  #{tag}
                </button>
              )
            })}
            {ticketTagFilter && (
              <button onClick={() => setTicketTagFilter('')}
                className="text-[11px] px-2 py-1 rounded-full transition-all"
                style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
                ✕ clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      {(ticketSearch || ticketStatusFilter !== 'all' || ticketPriorityFilter !== 'all' || ticketTagFilter) && (
        <p className="text-slate-500 text-xs mb-3 px-1">
          Showing <span className="text-slate-300 font-semibold">{filteredTickets.length}</span> of {tickets.length} tickets
          {ticketSearch && <> · matching "<span className="text-slate-300">{ticketSearch}</span>"</>}
          {ticketTagFilter && <> · tagged <span className="text-indigo-400">#{ticketTagFilter}</span></>}
        </p>
      )}

      {/* ── Ticket Cards ── */}
      <div className="space-y-2">
        {filteredTickets.length === 0 && (
          <div className="rounded-2xl py-20 text-center"
            style={COMMON_STYLES.emptyState}>
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-400 font-semibold text-sm">
              {tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            </p>
            <p className="text-slate-600 text-xs mt-1">
              {tickets.length > 0 ? 'Try adjusting your search or filters' : 'Click "New Ticket" to create one'}
            </p>
          </div>
        )}

        {paginated.map((t, i) => {
          const pColor = PRIORITY_COLOR[t.priority] || '#6366f1'
          const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.opened
          const assigneeList = t.assignees?.length > 0
            ? t.assignees.map(a => a.profile?.full_name || a.profile?.email).filter(Boolean).join(', ')
            : (t.assigned_to_profile?.full_name || t.assigned_to_profile?.email || null)

          return (
            <div key={t.id}
              className="group relative rounded-2xl transition-all duration-200 overflow-hidden cursor-pointer"
              style={{
                ...COMMON_STYLES.cardBg,
                animationDelay: `${i * 0.03}s`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}>

              {/* Priority bar */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
                style={{ background: `linear-gradient(180deg, ${pColor}, ${pColor}88)`, boxShadow: `2px 0 8px ${pColor}40` }} />

              <div className="flex items-stretch pl-4">
                {/* Main clickable content */}
                <div className="flex-1 min-w-0 py-3.5 pr-3" onClick={() => onSelectTicket(t)}>
                  {/* Top row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {/* Status badge */}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${st.dot}18`, color: st.color, border: `1px solid ${st.dot}35` }}>
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: st.dot, boxShadow: `0 0 5px ${st.dot}` }} />
                      {st.label}
                    </span>
                    {/* Priority badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30` }}>
                      {t.priority}
                    </span>
                    {/* SLA */}
                    <SLABadge ticket={t} />
                    {/* Category */}
                    {t.category && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {t.category}{t.subcategory ? ` › ${t.subcategory}` : ''}
                      </span>
                    )}
                    <span className="text-slate-600 text-[11px] ml-auto">
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-slate-100 text-sm font-semibold leading-snug group-hover:text-white transition-colors mb-1">
                    {t.title}
                  </h3>

                  {/* Description */}
                  {t.description && (
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-1 mb-2">{t.description}</p>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {t.affected_person && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="text-slate-400">{t.affected_person}</span>
                      </span>
                    )}
                    {assigneeList ? (
                      <span className="flex items-center gap-1 text-[11px] text-indigo-400/80">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {assigneeList}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-600 italic">Unassigned</span>
                    )}
                    {t.rating && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-400">
                        {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                      </span>
                    )}
                    {t.tags?.length > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        {t.tags.slice(0, 3).map(tag => (
                          <button key={tag}
                            onClick={e => { e.stopPropagation(); setTicketTagFilter(ticketTagFilter === tag ? '' : tag) }}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium transition-all"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action column */}
                <div className="flex flex-col gap-2 justify-center px-3 py-3 flex-shrink-0"
                  style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                  <select
                    value={t.status}
                    onChange={e => updateStatus(t.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="rounded-xl px-2.5 py-2 text-xs font-semibold outline-none cursor-pointer transition-all"
                    style={{
                      background: `${st.dot}15`,
                      border: `1px solid ${st.dot}30`,
                      color: st.color,
                      minWidth: '92px',
                    }}>
                    <option value="opened">Opened</option>
                    <option value="pending">Pending</option>
                    <option value="solved">Solved</option>
                  </select>
                  <button
                    onClick={e => { e.stopPropagation(); deleteTicket(t.id) }}
                    disabled={loading}
                    className="flex items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium transition-all disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)' }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pagination ── */}
      {filteredTickets.length > TICKETS_PER_PAGE && (
        <div className="flex items-center justify-between mt-5 px-1">
          <p className="text-slate-500 text-xs">
            Showing <span className="text-slate-300 font-medium">{Math.min((ticketPage - 1) * TICKETS_PER_PAGE + 1, filteredTickets.length)}–{Math.min(ticketPage * TICKETS_PER_PAGE, filteredTickets.length)}</span> of <span className="text-slate-300 font-medium">{filteredTickets.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setTicketPage(p => Math.max(1, p - 1))} disabled={ticketPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
              onMouseEnter={e => { if (ticketPage > 1) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                const p = ticketPage <= 3 ? i + 1 : ticketPage >= pageCount - 2 ? pageCount - 4 + i : ticketPage - 2 + i
                if (p < 1 || p > pageCount) return null
                return (
                  <button key={p} onClick={() => setTicketPage(p)}
                    className="w-7 h-7 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: ticketPage === p ? `${accentColor}25` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${ticketPage === p ? `${accentColor}50` : 'rgba(255,255,255,0.08)'}`,
                      color: ticketPage === p ? accentColor : '#64748b',
                    }}>
                    {p}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setTicketPage(p => Math.min(pageCount, p + 1))} disabled={ticketPage >= pageCount}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
              onMouseEnter={e => { if (ticketPage < pageCount) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
