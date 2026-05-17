import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const TAG_COLORS = [
  { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
  { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  { bg: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
]
export function getTagColor(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

let cachedAllTags = null

export function TagPills({ tags, small }) {
  if (!tags?.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${small ? '' : 'mt-1'}`}>
      {tags.map(tag => {
        const c = getTagColor(tag)
        return (
          <span key={tag}
            className={`inline-flex items-center font-medium rounded-full ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}
            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
            #{tag}
          </span>
        )
      })}
    </div>
  )
}

export default function TagChipInput({ value = [], onChange, disabled }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [allTags, setAllTags] = useState(cachedAllTags || [])
  const [showSugg, setShowSugg] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!cachedAllTags) {
      api.getTicketTags().then(tags => { cachedAllTags = tags; setAllTags(tags) }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (input.length < 1) { setSuggestions([]); return }
    const q = input.toLowerCase()
    setSuggestions(allTags.filter(t => t.toLowerCase().includes(q) && !value.includes(t)).slice(0, 6))
  }, [input, allTags, value])

  function addTag(tag) {
    const t = tag.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF_-]/g, '')
    if (!t || value.includes(t)) { setInput(''); return }
    onChange([...value, t])
    setInput('')
    setSuggestions([])
    if (!allTags.includes(t)) setAllTags(prev => [...prev, t])
  }

  function removeTag(tag) { onChange(value.filter(t => t !== tag)) }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (input.trim()) addTag(input) }
    if (e.key === 'Backspace' && !input && value.length) removeTag(value[value.length - 1])
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 items-center min-h-[38px] px-2.5 py-1.5 rounded-xl cursor-text"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => {
          const c = getTagColor(tag)
          return (
            <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
              #{tag}
              {!disabled && (
                <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-0.5 leading-none">×</button>
              )}
            </span>
          )
        })}
        {!disabled && (
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setShowSugg(true) }}
            onKeyDown={handleKey}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            placeholder={value.length ? '' : 'Add tags… (Enter or comma)'}
            className="flex-1 min-w-[80px] bg-transparent text-white text-xs outline-none placeholder-slate-600"
          />
        )}
      </div>
      {showSugg && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}>
          {suggestions.map(s => (
            <button key={s} type="button"
              onMouseDown={() => addTag(s)}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2">
              <span className="text-slate-500">#</span>{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
