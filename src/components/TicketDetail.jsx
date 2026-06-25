import { useState } from 'react'
import SLABadge from './SLABadge'
import TagChipInput, { TagPills } from './TagChipInput'
import FileAttachment from './FileAttachment'

const PRIORITY_MAP = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  medium: { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)' },
  low:    { label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)' },
}

const STATUS_MAP = {
  opened:  { label: 'Open',    color: '#818cf8', dot: '#6366f1' },
  pending: { label: 'Pending', color: '#fbbf24', dot: '#f59e0b' },
  solved:  { label: 'Solved',  color: '#34d399', dot: '#10b981' },
  merged:  { label: 'Merged',  color: '#94a3b8', dot: '#64748b' },
}

function Avatar({ name, isMe, size = 9 }) {
  const initials = (name || 'U')[0].toUpperCase()
  return (
    <div
      className={`flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white`}
      style={{
        width: `${size * 4}px`, height: `${size * 4}px`,
        background: isMe
          ? 'linear-gradient(135deg,#d97706,#b45309)'
          : 'linear-gradient(135deg,#1e3a5f,#2563eb)',
        flexShrink: 0,
      }}>
      {initials}
    </div>
  )
}

export default function TicketDetail({
  ticket, onBack, replies, replyText, setReplyText,
  replyFiles, setReplyFiles, replyError, setReplyError,
  submitReply, uploading, user,
  users, assigneeEditorIds, setAssigneeEditorIds,
  handleSaveAssignees, savingAssignees,
  editingTags, setEditingTags, editTagsValue, setEditTagsValue,
  handleSaveTags, savingTags,
  updateStatus, setTicket,
  mergeModal, setMergeModal, mergeTargetId, setMergeTargetId,
  handleMerge, merging, mergeMsg,
  tickets, deleteTicket, loading,
  isSuperAdmin,
}) {
  const [showAssigneeEditor, setShowAssigneeEditor] = useState(false)
  const accentGrad = isSuperAdmin ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)'
  const accentGlow = isSuperAdmin ? '0 4px 14px rgba(217,119,6,0.3)' : '0 4px 14px rgba(37,99,235,0.3)'
  const accentColor = isSuperAdmin ? '#f59e0b' : '#6366f1'

  const priority = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.medium
  const status = STATUS_MAP[ticket.status] || STATUS_MAP.opened
  const assigneeNames = ticket.assignees?.length > 0
    ? ticket.assignees.map(a => a.profile?.full_name || a.profile?.email || '?')
    : []

  return (
    <div className="flex flex-col min-h-0">
      {/* Back Button + Title Bar */}
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Tickets
        </button>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs font-mono">#{ticket.id?.slice(0, 8)}</span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500 text-xs">{new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

        {/* ─── LEFT: Content + Replies ─── */}
        <div className="space-y-4 min-w-0">

          {/* Ticket Header Card */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Status */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${status.dot}18`, color: status.color, border: `1px solid ${status.dot}35` }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: status.dot, boxShadow: `0 0 5px ${status.dot}` }} />
                {status.label}
              </span>
              {/* Priority */}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.border}` }}>
                {priority.label}
              </span>
              {/* SLA */}
              <SLABadge ticket={ticket} />
              {/* Merged */}
              {ticket.merged_into && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
                  Merged
                </span>
              )}
              {/* Category */}
              {ticket.category && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {ticket.category}{ticket.subcategory ? ` › ${ticket.subcategory}` : ''}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-white text-xl font-bold leading-snug mb-2">{ticket.title}</h1>

            {/* Description */}
            {ticket.description && (
              <p className="text-slate-400 text-sm leading-relaxed mb-3">{ticket.description}</p>
            )}

            {/* Metadata pills */}
            <div className="flex flex-wrap items-center gap-3 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {ticket.affected_person && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span className="text-slate-300">{ticket.affected_person}</span>
                </span>
              )}
              {ticket.asset && (
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25" />
                  </svg>
                  {ticket.asset.name}{ticket.asset.serial_number ? ` · ${ticket.asset.serial_number}` : ''}
                </span>
              )}
              {ticket.due_date && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                  Due: <span className="text-slate-300 font-medium">{new Date(ticket.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </span>
              )}
              {ticket.rating && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400">
                  {'★'.repeat(ticket.rating)}{'☆'.repeat(5 - ticket.rating)}
                </span>
              )}
            </div>

            {/* Tags */}
            {(ticket.tags?.length > 0 || editingTags) && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {!editingTags ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TagPills tags={ticket.tags} />
                    <button type="button"
                      onClick={() => { setEditingTags(true); setEditTagsValue(ticket.tags || []) }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all">
                      ✎ Edit Tags
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <TagChipInput value={editTagsValue} onChange={setEditTagsValue} />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSaveTags} disabled={savingTags}
                        className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                        {savingTags ? 'Saving…' : 'Save Tags'}
                      </button>
                      <button type="button" onClick={() => setEditingTags(false)}
                        className="text-xs px-3 py-1.5 rounded-xl text-slate-500 hover:text-white border border-white/10 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!ticket.tags?.length && !editingTags && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button"
                  onClick={() => { setEditingTags(true); setEditTagsValue([]) }}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-600 hover:text-slate-300 hover:border-white/20 transition-all">
                  + Add Tags
                </button>
              </div>
            )}
          </div>

          {/* Replies Thread */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Thread header */}
            <div className="flex items-center gap-2 px-5 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <span className="text-slate-300 text-sm font-semibold">Conversation</span>
              {replies.length > 0 && (
                <span className="ml-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}>
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="px-5 py-4 space-y-5 max-h-[480px] overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              {replies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium">No replies yet</p>
                    <p className="text-slate-600 text-xs mt-0.5">Be the first to respond to this ticket</p>
                  </div>
                </div>
              )}
              {replies.map(r => {
                const isMe = r.user_id === user?.id
                const name = r.profiles?.full_name || r.profiles?.email || 'User'
                return (
                  <div key={r.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <Avatar name={name} isMe={isMe} size={9} />
                    <div className={`flex-1 min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-white text-xs font-semibold">{name}</span>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(217,119,6,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>You</span>}
                        <span className="text-slate-600 text-[10px]">
                          {new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[88%] ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={{
                          background: isMe ? 'rgba(217,119,6,0.12)' : 'rgba(255,255,255,0.05)',
                          border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.07)',
                        }}>
                        {r.message && <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{r.message}</p>}
                        {r.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {r.attachments.map((url, i) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
                              return isImage ? (
                                <img key={i} src={url} alt="" className="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer border border-white/10 hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(url, '_blank')} />
                              ) : (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2 transition-colors">
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                                  </svg>
                                  {url.split('/').pop()}
                                </a>
                              )
                            })}
                          </div>
                        )}
                        {!r.attachments?.length && <FileAttachment url={r.image_url} name={r.attachment_name} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Reply Form */}
            <div className="px-5 pb-5 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {replyError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2 mb-3">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {replyError}
                </div>
              )}

              {/* File Previews */}
              {replyFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {replyFiles.map((file, i) => {
                    const isImage = file.type.startsWith('image/')
                    return (
                      <div key={i} className="relative group">
                        {isImage ? (
                          <img src={URL.createObjectURL(file)} alt={file.name}
                            className="w-16 h-16 object-cover rounded-xl border border-white/10" />
                        ) : (
                          <div className="w-16 h-16 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5">
                            <span className="text-lg">📎</span>
                            <span className="text-[8px] text-slate-400 mt-0.5">{file.name.split('.').pop().toUpperCase()}</span>
                          </div>
                        )}
                        <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center text-slate-400 bg-black/50 rounded-b-xl py-0.5">
                          {(file.size / 1024).toFixed(0)}KB
                        </span>
                        <button type="button"
                          onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <form onSubmit={submitReply}>
                <div className="relative">
                  <textarea
                    value={replyText}
                    onChange={e => { setReplyText(e.target.value); setReplyError('') }}
                    placeholder="Write a reply…"
                    rows={3}
                    className="w-full rounded-2xl px-4 py-3 text-white text-sm outline-none resize-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={e => { e.target.style.borderColor = `${accentColor}50`; e.target.style.boxShadow = `0 0 0 3px ${accentColor}10` }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <label className="cursor-pointer flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    {replyFiles.length ? `${replyFiles.length} file(s)` : 'Attach'}
                    <input type="file" multiple className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={e => {
                        const files = Array.from(e.target.files)
                        const oversized = files.filter(f => f.size > 5 * 1024 * 1024)
                        if (oversized.length) { setReplyError(`Files exceed 5MB: ${oversized.map(f => f.name).join(', ')}`); return }
                        setReplyFiles(prev => [...prev, ...files].slice(0, 5))
                        setReplyError('')
                        e.target.value = ''
                      }} />
                  </label>
                  {replyFiles.length > 0 && (
                    <button type="button" onClick={() => setReplyFiles([])}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors">✕ Clear</button>
                  )}
                  <button type="submit"
                    disabled={uploading || (!replyText.trim() && !replyFiles.length)}
                    className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: accentGrad, boxShadow: accentGlow }}>
                    {uploading ? (
                      <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>Send Reply</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Metadata Sidebar ─── */}
        <div className="space-y-4 lg:sticky lg:top-4">

          {/* Actions Card */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Actions</p>

            {/* Status */}
            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 font-medium">Status</label>
              <select
                value={ticket.status}
                onChange={e => { updateStatus(ticket.id, e.target.value); setTicket(p => ({ ...p, status: e.target.value })) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none cursor-pointer transition-all"
                style={{
                  background: `${status.dot}15`,
                  border: `1px solid ${status.dot}35`,
                  color: status.color,
                }}>
                <option value="opened">Opened</option>
                <option value="pending">Pending</option>
                <option value="solved">Solved</option>
              </select>
            </div>

            {/* Merge + Delete buttons */}
            <div className="grid grid-cols-2 gap-2">
              {ticket.status !== 'merged' && (
                <button type="button"
                  onClick={() => { setMergeModal(true); setMergeTargetId('') }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.1)' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
                  </svg>
                  Merge
                </button>
              )}
              <button type="button"
                onClick={() => deleteTicket(ticket.id)}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
          </div>

          {/* Ticket Info */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Details</p>

            <div className="space-y-2.5">
              {[
                { label: 'Created', value: new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Ticket ID', value: `#${ticket.id?.slice(0, 8)}` },
                { label: 'Created by', value: ticket.created_by_profile?.full_name || ticket.created_by_profile?.email || '—' },
              ].map(item => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex-shrink-0">{item.label}</span>
                  <span className="text-[11px] text-slate-300 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Assignees</p>
              <button type="button"
                onClick={() => setShowAssigneeEditor(v => !v)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-all"
                style={{ color: showAssigneeEditor ? '#818cf8' : '#475569', border: `1px solid ${showAssigneeEditor ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`, background: showAssigneeEditor ? 'rgba(99,102,241,0.12)' : 'transparent' }}>
                {showAssigneeEditor ? 'Close' : 'Edit'}
              </button>
            </div>

            {/* Current assignees */}
            {assigneeNames.length > 0 ? (
              <div className="space-y-2 mb-3">
                {ticket.assignees.map(a => (
                  <div key={a.user_id || a.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
                      {(a.profile?.full_name || 'U')[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-300 truncate">{a.profile?.full_name || a.profile?.email || '?'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic mb-3">Unassigned</p>
            )}

            {/* Assignee editor */}
            {showAssigneeEditor && (
              <div className="space-y-2 animate-fadeIn">
                <div className="rounded-xl overflow-hidden max-h-40 overflow-y-auto"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'thin' }}>
                  {users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'member').map((u, i, arr) => {
                    const sel = assigneeEditorIds.includes(u.id)
                    return (
                      <label key={u.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all"
                        style={{
                          background: sel ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                          borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        }}>
                        <div className="flex-shrink-0 flex items-center justify-center transition-all"
                          style={{ width: '16px', height: '16px', borderRadius: '4px', background: sel ? 'rgba(99,102,241,0.9)' : 'transparent', border: sel ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.2)' }}>
                          {sel && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        </div>
                        <input type="checkbox" checked={sel} className="sr-only"
                          onChange={e => setAssigneeEditorIds(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                        <span className="text-xs flex-1 truncate" style={{ color: sel ? '#c7d2fe' : '#94a3b8' }}>{u.full_name || u.email}</span>
                      </label>
                    )
                  })}
                </div>
                <button type="button" onClick={handleSaveAssignees} disabled={savingAssignees}
                  className="w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {savingAssignees ? 'Saving…' : 'Save Assignees'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      {mergeModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setMergeModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scaleIn"
            style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)' }}>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">Merge Ticket</h3>
                <p className="text-slate-500 text-xs">This ticket will be closed and its replies moved to the target.</p>
              </div>
            </div>
            <form onSubmit={handleMerge} className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 font-semibold uppercase tracking-widest">Target Ticket</label>
                <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)} required
                  className="w-full bg-white/5 border border-white/10 text-slate-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50 transition-all">
                  <option value="">— Select ticket to merge into —</option>
                  {tickets.filter(t => t.id !== ticket?.id && t.status !== 'merged').map(t => (
                    <option key={t.id} value={t.id}>{t.title.slice(0, 60)} ({t.status})</option>
                  ))}
                </select>
              </div>
              {mergeMsg && <p className="text-sm rounded-xl px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{mergeMsg}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={merging || !mergeTargetId}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#64748b,#475569)' }}>
                  {merging ? 'Merging…' : 'Merge Ticket'}
                </button>
                <button type="button" onClick={() => setMergeModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
