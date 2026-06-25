import { useEffect, useRef } from 'react'
import KnowledgeSuggest from './KnowledgeSuggest'

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.3)' },
  { value: 'medium', label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.12)',    border: 'rgba(234,179,8,0.3)' },
  { value: 'high',   label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.12)',   border: 'rgba(249,115,22,0.3)' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)' },
]

const STATUS_OPTIONS = [
  { value: 'opened',  label: 'Open',    color: '#818cf8' },
  { value: 'pending', label: 'Pending', color: '#fbbf24' },
  { value: 'solved',  label: 'Solved',  color: '#34d399' },
]

export default function TicketCreateModal({
  open, onClose, onSubmit, loading,
  ticketForm, setTicketForm,
  users, assignedToIds, setAssignedToIds,
  ticketAssets, fetchTicketAssets,
  ticketSubcatMap,
  aiSuggestion, setAiSuggestion, aiLoading, onAiSuggest,
  isSuperAdmin,
}) {
  const overlayRef = useRef(null)
  const accentColor = isSuperAdmin ? '#f59e0b' : '#6366f1'

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (open && !ticketAssets.length) fetchTicketAssets()
  }, [open])

  if (!open) return null

  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === (ticketForm.priority || 'medium'))

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[300] flex"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Slide-over panel */}
      <div className="ml-auto h-full w-full max-w-2xl flex flex-col shadow-2xl animate-slideInRight"
        style={{
          background: 'linear-gradient(180deg, #0c0c1a 0%, #080810 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}40` }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">New Ticket</h2>
              <p className="text-slate-500 text-xs">Fill in the details to create a support ticket</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>

          {/* AI Suggestion Banner */}
          {aiSuggestion && (
            <div className="rounded-xl p-3.5 animate-fadeIn"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-violet-400 text-[10px] uppercase tracking-widest font-bold mb-2">🤖 AI Suggestion</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Priority: {aiSuggestion.priority}
                    </span>
                    {aiSuggestion.category && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                        {aiSuggestion.category}
                      </span>
                    )}
                    {aiSuggestion.tags?.map(t => (
                      <span key={t} className="px-2 py-1 rounded-full text-[11px]"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>#{t}</span>
                    ))}
                  </div>
                  {aiSuggestion.reasoning && (
                    <p className="text-slate-500 text-[11px] italic leading-relaxed">{aiSuggestion.reasoning}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button type="button"
                    onClick={() => setTicketForm(f => ({ ...f, priority: aiSuggestion.priority, category: aiSuggestion.category || f.category }))}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', color: '#c4b5fd' }}>
                    Apply
                  </button>
                  <button type="button" onClick={() => setAiSuggestion(null)}
                    className="text-slate-600 hover:text-slate-400 transition-colors text-lg leading-none">×</button>
                </div>
              </div>
            </div>
          )}

          {/* Section: Title & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest px-2">Basic Info</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Issue Title *</label>
                <button type="button"
                  disabled={aiLoading || !ticketForm.title.trim()}
                  onClick={onAiSuggest}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all disabled:opacity-40"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                  {aiLoading ? (
                    <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analyzing...</>
                  ) : (
                    <><span>🤖</span>AI Suggest</>
                  )}
                </button>
              </div>
              <input
                required
                value={ticketForm.title}
                onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Describe the issue briefly…"
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = `${accentColor}60`; e.target.style.boxShadow = `0 0 0 3px ${accentColor}12` }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
              />
              <KnowledgeSuggest query={ticketForm.title} />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                rows={4}
                value={ticketForm.description}
                onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Provide more details about the issue…"
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = `${accentColor}60`; e.target.style.boxShadow = `0 0 0 3px ${accentColor}12` }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          {/* Section: Assignment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest px-2">Assignment</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Affected Person</label>
              <select
                value={ticketForm.affected_user_id || ''}
                onChange={e => {
                  const uid = e.target.value
                  setTicketForm(f => ({ ...f, affected_user_id: uid, affected_person: uid ? (users.find(u => u.id === uid)?.full_name || '') : f.affected_person }))
                }}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all mb-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
              >
                <option value="">— Select from employees —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
              <input
                value={ticketForm.affected_person}
                onChange={e => setTicketForm(f => ({ ...f, affected_person: e.target.value }))}
                placeholder="Or type a name manually…"
                className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = `${accentColor}60` }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Assign To</label>
                {assignedToIds.length > 0 && (
                  <span className="text-[10px] text-indigo-400/70">{assignedToIds.length} selected</span>
                )}
              </div>
              {assignedToIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {assignedToIds.map(uid => {
                    const u = users.find(x => x.id === uid)
                    return u ? (
                      <span key={uid} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {u.full_name || u.email}
                        <button type="button"
                          onClick={() => setAssignedToIds(prev => prev.filter(id => id !== uid))}
                          className="text-indigo-300 hover:text-red-400 transition-colors ml-0.5">×</button>
                      </span>
                    ) : null
                  })}
                </div>
              )}
              <div className="rounded-xl overflow-hidden max-h-44 overflow-y-auto"
                style={{ border: '1px solid rgba(255,255,255,0.09)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                {users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'member').length === 0 && (
                  <p className="text-slate-600 text-xs px-4 py-3">No IT staff available</p>
                )}
                {users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'member').map((u, i, arr) => {
                  const selected = assignedToIds.includes(u.id)
                  return (
                    <label key={u.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all"
                      style={{
                        background: selected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                        borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                      <div className="flex-shrink-0 w-4.5 h-4.5 rounded flex items-center justify-center transition-all"
                        style={{
                          width: '18px', height: '18px',
                          background: selected ? 'rgba(99,102,241,0.9)' : 'transparent',
                          border: selected ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.2)',
                        }}>
                        {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                      </div>
                      <input type="checkbox" checked={selected} className="sr-only"
                        onChange={e => setAssignedToIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: selected ? '#c7d2fe' : '#94a3b8' }}>{u.full_name || u.email}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#475569' }}>
                        {u.role === 'super_admin' ? 'Super Admin' : u.role}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section: Classification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest px-2">Classification</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p.value} type="button"
                    onClick={() => setTicketForm(f => ({ ...f, priority: p.value }))}
                    className="py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center"
                    style={{
                      background: ticketForm.priority === p.value ? p.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${ticketForm.priority === p.value ? p.border : 'rgba(255,255,255,0.08)'}`,
                      color: ticketForm.priority === p.value ? p.color : '#64748b',
                      boxShadow: ticketForm.priority === p.value ? `0 0 12px ${p.color}20` : 'none',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Initial Status</label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setTicketForm(f => ({ ...f, status: s.value }))}
                    className="py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center"
                    style={{
                      background: ticketForm.status === s.value ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${ticketForm.status === s.value ? `${s.color}40` : 'rgba(255,255,255,0.08)'}`,
                      color: ticketForm.status === s.value ? s.color : '#64748b',
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Category</label>
              {Object.keys(ticketSubcatMap).length > 0 ? (
                <select
                  value={ticketForm.category}
                  onChange={e => setTicketForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                  <option value="">— Select category —</option>
                  {Object.keys(ticketSubcatMap).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  value={ticketForm.category}
                  onChange={e => setTicketForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}
                  placeholder="e.g. Hardware, Network, Software…"
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = `${accentColor}60` }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              )}
              {ticketForm.category && ticketSubcatMap[ticketForm.category]?.length > 0 && (
                <select
                  value={ticketForm.subcategory}
                  onChange={e => setTicketForm(f => ({ ...f, subcategory: e.target.value }))}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all mt-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                  <option value="">— Select subcategory —</option>
                  {ticketSubcatMap[ticketForm.category].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Section: Additional */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest px-2">Additional</span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={ticketForm.due_date}
                  onChange={e => setTicketForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  onFocus={e => { e.target.style.borderColor = `${accentColor}60` }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Linked Asset</label>
                <select
                  value={ticketForm.asset_id}
                  onChange={e => setTicketForm(f => ({ ...f, asset_id: e.target.value }))}
                  onFocus={() => { if (!ticketAssets.length) fetchTicketAssets() }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
                  <option value="">No linked asset</option>
                  {ticketAssets.map(a => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` (${a.serial_number})` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="h-4" />
        </form>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
            Cancel
          </button>
          <button
            form="ticket-create-form"
            type="submit"
            disabled={loading}
            onClick={onSubmit}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
            style={{
              background: isSuperAdmin ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
              boxShadow: isSuperAdmin ? '0 4px 18px rgba(245,158,11,0.3)' : '0 4px 18px rgba(99,102,241,0.3)',
            }}>
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating…</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
