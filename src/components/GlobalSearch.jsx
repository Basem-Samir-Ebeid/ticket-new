import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'

const RECENT_KEY = 'finest_recent_searches'
const MAX_RECENT = 5

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function addRecent(q) {
  const prev = getRecent().filter(r => r !== q)
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)))
}

const TYPE_CONFIG = {
  tickets: { label: 'Ticket', color: '#6366f1', icon: 'M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z' },
  assets: { label: 'Asset', color: '#10b981', icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25' },
  articles: { label: 'Article', color: '#f59e0b', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  employees: { label: 'Employee', color: '#8b5cf6', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
}

export default function GlobalSearch({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState(getRecent())
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setRecent(getRecent())
    } else {
      setQuery('')
      setResults(null)
    }
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) { setResults(null); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api.search(query)
        setResults(r)
      } catch {}
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSelect(type, item) {
    addRecent(query)
    setOpen(false)
    if (onNavigate) onNavigate(type, item)
  }

  const hasResults = results && (results.tickets?.length || results.assets?.length || results.articles?.length || results.employees?.length)

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
        title="Search (Ctrl+K)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.06)', color: '#475569' }}>⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div ref={containerRef} className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search tickets, assets, articles, employees..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 outline-none"
              />
              {loading && <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />}
              <kbd onClick={() => setOpen(false)} className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer font-mono text-slate-600 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.06)' }}>Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {!query && recent.length > 0 && (
                <div className="p-3">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold px-2 mb-2">Recent Searches</p>
                  {recent.map(r => (
                    <button key={r} onClick={() => setQuery(r)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left">
                      <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {results && !hasResults && (
                <div className="py-12 text-center text-slate-600 text-sm">No results for "{query}"</div>
              )}

              {results && hasResults && (
                <div className="p-3 space-y-4">
                  {Object.entries(results).map(([type, items]) => {
                    if (!items?.length) return null
                    const config = TYPE_CONFIG[type]
                    if (!config) return null
                    return (
                      <div key={type}>
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold px-2 mb-1.5">{type}</p>
                        {items.map(item => (
                          <button key={item.id} onClick={() => handleSelect(type, item)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: config.color + '22' }}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={config.color} strokeWidth={1.75}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-200 text-sm font-medium truncate">
                                {item.title || item.name || item.full_name || item.email}
                              </p>
                              <p className="text-slate-600 text-xs">
                                {item.category || item.type || item.department || item.serial_number || ''}
                                {item.status ? ` · ${item.status}` : ''}
                              </p>
                            </div>
                            <svg className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              {!query && !recent.length && (
                <div className="py-10 text-center text-slate-600 text-sm">Start typing to search...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
