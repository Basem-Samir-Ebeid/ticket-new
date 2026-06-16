import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

const CRITERIA = [
  { key: 'technical_skills',    label: 'المهارات التقنية',       icon: '💻', desc: 'مستوى الكفاءة التقنية وإتقان الأدوات' },
  { key: 'communication',       label: 'التواصل والتعاون',       icon: '🤝', desc: 'التواصل مع الفريق والتعاون في العمل' },
  { key: 'punctuality',         label: 'الالتزام بالمواعيد',     icon: '⏰', desc: 'الحضور والانتظام والالتزام بالمواعيد' },
  { key: 'task_completion',     label: 'إنجاز المهام',           icon: '✅', desc: 'مدى إتمام المهام الموكلة بجودة وكفاءة' },
  { key: 'initiative',          label: 'المبادرة والإبداع',      icon: '💡', desc: 'المبادرة في حل المشكلات وتقديم أفكار جديدة' },
  { key: 'work_quality',        label: 'جودة العمل',             icon: '⭐', desc: 'مستوى الدقة والجودة في المخرجات' },
]

const STATUS_MAP = {
  draft:             { label: 'مسودة',              color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', dot: '#94a3b8' },
  submitted:         { label: 'أُرسل للـ HR',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', dot: '#f59e0b' },
  employee_notified: { label: 'أُبلغ الموظف',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  dot: '#22c55e' },
}

const SCORE_LABELS = { 1: 'ضعيف', 2: 'مقبول', 3: 'جيد', 4: 'جيد جداً', 5: 'ممتاز' }
const SCORE_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#10b981' }

function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value || 0
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange && onChange(s === value ? 0 : s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-all duration-100 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          style={{ background: 'none', border: 'none', padding: '2px' }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill={s <= display ? (SCORE_COLORS[display] || '#f59e0b') : 'none'} stroke={s <= display ? (SCORE_COLORS[display] || '#f59e0b') : '#334155'} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      ))}
      {display > 0 && (
        <span className="text-xs font-semibold ml-1" style={{ color: SCORE_COLORS[display] }}>
          {SCORE_LABELS[display]}
        </span>
      )}
    </div>
  )
}

function ScoreCircle({ score }) {
  if (score === null || score === undefined) return <span className="text-slate-600 text-sm">—</span>
  const pct = (score / 5) * 100
  const color = score >= 4.5 ? '#10b981' : score >= 3.5 ? '#22c55e' : score >= 2.5 ? '#eab308' : score >= 1.5 ? '#f97316' : '#ef4444'
  const r = 20, cx = 24, cy = 24, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="11" fontWeight="700">{score.toFixed(1)}</text>
      </svg>
      <span className="text-[10px] font-medium" style={{ color }}>{SCORE_LABELS[Math.round(score)] || ''}</span>
    </div>
  )
}

function EvalCard({ ev, isSuperAdmin, onEdit, onSubmit, onNotify, onDelete, submitting }) {
  const st = STATUS_MAP[ev.status] || STATUS_MAP.draft
  const score = ev.overall_score
  const monthLabel = MONTHS[(ev.month || 1) - 1]

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          {ev.employee?.profile_picture_url ? (
            <img src={ev.employee.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              style={{ border: '2px solid rgba(255,255,255,0.1)' }} />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(217,119,6,0.15))', border: '2px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              {(ev.employee?.full_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{ev.employee?.full_name || 'موظف'}</p>
            <p className="text-slate-500 text-xs mt-0.5">{ev.employee?.job_title || ev.employee?.department || ''}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}28` }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-px" style={{ background: st.dot }} />
            {st.label}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}>
            {monthLabel} {ev.year}
          </span>
        </div>
      </div>

      {/* Score + criteria */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4 mb-4">
          <ScoreCircle score={score} />
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {CRITERIA.map(c => {
              const val = ev[c.key]
              return (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 truncate">{c.icon} {c.label}</span>
                  <div className="flex gap-0.5 ml-1 flex-shrink-0">
                    {[1,2,3,4,5].map(s => (
                      <div key={s} className="w-2 h-2 rounded-full" style={{ background: s <= (val || 0) ? (SCORE_COLORS[val] || '#f59e0b') : 'rgba(255,255,255,0.08)' }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {ev.notes && (
          <div className="mt-3 px-3 py-2 rounded-xl text-xs text-slate-400 leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            📝 {ev.notes}
          </div>
        )}

        {ev.strengths && (
          <div className="mt-2 px-3 py-2 rounded-xl text-xs leading-relaxed"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', color: '#86efac' }}>
            💪 {ev.strengths}
          </div>
        )}

        {ev.areas_for_improvement && (
          <div className="mt-2 px-3 py-2 rounded-xl text-xs leading-relaxed"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', color: '#fcd34d' }}>
            🎯 {ev.areas_for_improvement}
          </div>
        )}
      </div>

      {/* Actions — super admin only */}
      {isSuperAdmin && (
        <div className="px-5 pb-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
          {ev.status === 'draft' && (
            <>
              <button onClick={() => onEdit(ev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                تعديل
              </button>
              <button onClick={() => onSubmit(ev.id)} disabled={submitting === ev.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)', color: '#fbbf24' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.12)' }}>
                {submitting === ev.id ? <span className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /> : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
                إرسال للـ HR
              </button>
              <button onClick={() => onDelete(ev.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)', color: '#f87171' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                حذف
              </button>
            </>
          )}
          {ev.status === 'submitted' && (
            <button onClick={() => onNotify(ev.id)} disabled={submitting === ev.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)' }}>
              {submitting === ev.id ? <span className="w-3 h-3 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin" /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              )}
              إبلاغ الموظف
            </button>
          )}
          {ev.status === 'employee_notified' && (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              تم إبلاغ الموظف {ev.employee_notified_at ? new Date(ev.employee_notified_at).toLocaleDateString('ar-EG') : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function EvalForm({ users, editing, onClose, onSaved }) {
  const now = new Date()
  const [form, setForm] = useState({
    employee_id: editing?.employee_id || '',
    month: editing?.month || now.getMonth() + 1,
    year: editing?.year || now.getFullYear(),
    technical_skills: editing?.technical_skills || 0,
    communication: editing?.communication || 0,
    punctuality: editing?.punctuality || 0,
    task_completion: editing?.task_completion || 0,
    initiative: editing?.initiative || 0,
    work_quality: editing?.work_quality || 0,
    notes: editing?.notes || '',
    strengths: editing?.strengths || '',
    areas_for_improvement: editing?.areas_for_improvement || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const avgScore = () => {
    const vals = CRITERIA.map(c => form[c.key]).filter(v => v > 0)
    if (!vals.length) return null
    return (vals.reduce((s, v) => s + v, 0) / vals.length)
  }
  const avg = avgScore()
  const avgColor = avg ? (avg >= 4.5 ? '#10b981' : avg >= 3.5 ? '#22c55e' : avg >= 2.5 ? '#eab308' : avg >= 1.5 ? '#f97316' : '#ef4444') : '#64748b'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.employee_id) { setErr('يرجى اختيار الموظف'); return }
    setSaving(true); setErr('')
    try {
      if (editing) {
        await api.updateEvaluation(editing.id, form)
      } else {
        await api.createEvaluation(form)
      }
      onSaved()
    } catch (ex) { setErr(ex.message) }
    setSaving(false)
  }

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', outline: 'none', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', width: '100%' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'rgba(8,9,22,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h2 className="text-white text-lg font-bold">{editing ? 'تعديل التقييم' : 'تقييم موظف جديد'}</h2>
            <p className="text-slate-500 text-xs mt-0.5">قيّم أداء الموظف بدقة وموضوعية</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Employee + Period */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">الموظف *</label>
              <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                style={inputStyle} disabled={!!editing}>
                <option value="">اختر الموظف...</option>
                {users.filter(u => u.role === 'employee' || u.role === 'member').map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">الشهر *</label>
              <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))} style={inputStyle}>
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">السنة *</label>
              <select value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} style={inputStyle}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Criteria */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-white text-sm font-semibold">معايير التقييم</span>
              {avg !== null && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: `${avgColor}18`, color: avgColor, border: `1px solid ${avgColor}28` }}>
                  المتوسط: {avg.toFixed(2)}/5 — {SCORE_LABELS[Math.round(avg)]}
                </span>
              )}
            </div>
            <div className="divide-y" style={{ divideColor: 'rgba(255,255,255,0.05)' }}>
              {CRITERIA.map(c => (
                <div key={c.key} className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <p className="text-slate-200 text-sm font-medium">{c.icon} {c.label}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{c.desc}</p>
                  </div>
                  <StarRating value={form[c.key]} onChange={v => setForm(f => ({ ...f, [c.key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Text fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">💪 نقاط القوة</label>
              <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                rows={3} placeholder="ما الذي يتميز به الموظف..." style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">🎯 مجالات التطوير</label>
              <textarea value={form.areas_for_improvement} onChange={e => setForm(f => ({ ...f, areas_for_improvement: e.target.value }))}
                rows={3} placeholder="ما الذي يحتاج تحسيناً..." style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">📝 ملاحظات عامة</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="أي ملاحظات إضافية..." style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {err && <p className="text-red-400 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>{err}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1c1004', boxShadow: '0 4px 16px rgba(245,158,11,0.25)' }}>
              {saving && <span className="w-4 h-4 border-2 border-amber-900/40 border-t-amber-900 rounded-full animate-spin" />}
              {saving ? 'جارٍ الحفظ...' : (editing ? 'حفظ التعديلات' : 'إنشاء التقييم')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EvaluationsPage({ employeeView = false }) {
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [evaluations, setEvaluations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(null)
  const [msg, setMsg] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [evs, usrs] = await Promise.all([
        api.getEvaluations(),
        isSuperAdmin ? api.getUsers() : Promise.resolve([]),
      ])
      setEvaluations(evs)
      setUsers(usrs)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(m, isErr = false) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }

  async function handleSubmit(id) {
    setSubmitting(id)
    try { await api.submitEvaluation(id); flash('✓ تم الإرسال للـ HR بنجاح'); load() }
    catch (e) { flash(e.message, true) }
    setSubmitting(null)
  }

  async function handleNotify(id) {
    setSubmitting(id)
    try { await api.notifyEmployeeEvaluation(id); flash('✓ تم إبلاغ الموظف بنجاح'); load() }
    catch (e) { flash(e.message, true) }
    setSubmitting(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('هل تريد حذف هذا التقييم؟')) return
    try { await api.deleteEvaluation(id); flash('✓ تم الحذف'); load() }
    catch (e) { flash(e.message, true) }
  }

  const now = new Date()

  let filtered = evaluations
  if (filterMonth) filtered = filtered.filter(e => e.month === Number(filterMonth))
  if (filterYear)  filtered = filtered.filter(e => e.year === Number(filterYear))
  if (filterEmployee) filtered = filtered.filter(e => e.employee_id === filterEmployee)
  if (filterStatus) filtered = filtered.filter(e => e.status === filterStatus)

  // Summary stats (admin view)
  const thisMonth = evaluations.filter(e => e.month === now.getMonth() + 1 && e.year === now.getFullYear())
  const avgThisMonth = (() => {
    const scores = thisMonth.map(e => e.overall_score).filter(s => s !== null)
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  })()

  const selStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', outline: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📊</span>
            {employeeView ? 'تقييماتي' : 'تقييم الموظفين'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {employeeView
              ? 'تقييماتك الشهرية من إدارة IT'
              : 'تقييم أداء فريق IT الشهري وإرساله للـ HR'}
          </p>
        </div>
        {isSuperAdmin && !employeeView && (
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1c1004', boxShadow: '0 4px 16px rgba(245,158,11,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            تقييم جديد
          </button>
        )}
      </div>

      {/* Stats (admin only) */}
      {!employeeView && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي التقييمات', value: evaluations.length, icon: '📋', color: '#6366f1' },
            { label: 'هذا الشهر', value: thisMonth.length, icon: '📅', color: '#f59e0b' },
            { label: 'أُرسل للـ HR', value: evaluations.filter(e=>e.status==='submitted').length, icon: '📤', color: '#f59e0b' },
            { label: 'متوسط هذا الشهر', value: avgThisMonth !== null ? `${avgThisMonth.toFixed(1)}/5` : '—', icon: '⭐', color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xl">{s.icon}</span>
                <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {!employeeView && (
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={selStyle}>
            <option value="">كل الموظفين</option>
            {users.filter(u => u.role === 'employee' || u.role === 'member').map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        )}
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={selStyle}>
          <option value="">كل الشهور</option>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selStyle}>
          <option value="">كل السنوات</option>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {!employeeView && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="submitted">أُرسل للـ HR</option>
            <option value="employee_notified">أُبلغ الموظف</option>
          </select>
        )}
        {(filterMonth || filterYear || filterEmployee || filterStatus) && (
          <button onClick={() => { setFilterMonth(''); setFilterYear(''); setFilterEmployee(''); setFilterStatus('') }}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Flash msg */}
      {msg && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: msg.startsWith('✓') ? '#86efac' : '#f87171' }}>
          {msg}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">جارٍ التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>📊</div>
          <div className="text-center">
            <p className="text-slate-400 text-sm font-medium">
              {employeeView ? 'لا يوجد تقييمات بعد' : 'لا يوجد تقييمات مطابقة'}
            </p>
            <p className="text-slate-600 text-xs mt-1">
              {employeeView ? 'ستظهر هنا تقييماتك الشهرية عند إرسالها' : 'ابدأ بإنشاء تقييم جديد'}
            </p>
          </div>
          {isSuperAdmin && !employeeView && (
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#1c1004' }}>
              + تقييم جديد
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(ev => (
            <EvalCard
              key={ev.id}
              ev={ev}
              isSuperAdmin={isSuperAdmin && !employeeView}
              onEdit={ev => { setEditing(ev); setShowForm(true) }}
              onSubmit={handleSubmit}
              onNotify={handleNotify}
              onDelete={handleDelete}
              submitting={submitting}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <EvalForm
          users={users}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); flash('✓ تم الحفظ بنجاح') }}
        />
      )}
    </div>
  )
}
