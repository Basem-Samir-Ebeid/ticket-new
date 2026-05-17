import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

export default function KnowledgeSuggest({ title, onResolved }) {
  const [suggestions, setSuggestions] = useState([])
  const [visible, setVisible] = useState(true)
  const [openArticle, setOpenArticle] = useState(null)
  const [articleContent, setArticleContent] = useState(null)
  const [loadingArticle, setLoadingArticle] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!title || title.length < 3) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.suggestKnowledge(title)
        setSuggestions(results || [])
      } catch {}
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [title])

  async function openArt(article) {
    setOpenArticle(article)
    setLoadingArticle(true)
    try {
      const full = await api.getKnowledgeArticle(article.id)
      setArticleContent(full)
    } catch {}
    setLoadingArticle(false)
  }

  if (!suggestions.length || !visible) return null

  return (
    <>
      <div className="rounded-xl p-3 mt-2 animate-fadeIn"
        style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.354a15.055 15.055 0 01-4.5 0M12 3v1.5m0 15V21m-6.364-2.636l1.06-1.06M18.364 5.636l1.06-1.06M3 12H1.5M22.5 12H21m-2.636 6.364l-1.06-1.06M5.636 5.636l-1.06-1.06" />
            </svg>
            💡 Related articles that might help:
          </p>
          <button type="button" onClick={() => setVisible(false)} className="text-slate-600 hover:text-slate-400 text-sm">×</button>
        </div>
        <div className="space-y-1.5">
          {suggestions.map(s => (
            <button key={s.id} type="button"
              onClick={() => openArt(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200 text-xs font-medium truncate">{s.title}</p>
                <p className="text-slate-500 text-[10px]">{s.category}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Article modal */}
      {openArticle && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setOpenArticle(null); setArticleContent(null) }}>
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/8">
              <div>
                <p className="text-white font-semibold text-sm">{openArticle.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{openArticle.category}</p>
              </div>
              <button type="button" onClick={() => { setOpenArticle(null); setArticleContent(null) }}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingArticle ? (
                <div className="text-slate-500 text-sm text-center py-8">Loading article...</div>
              ) : articleContent ? (
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: articleContent.content }} />
              ) : null}
            </div>
            <div className="px-5 py-4 border-t border-white/8 flex justify-end">
              <button type="button"
                onClick={() => { setOpenArticle(null); setArticleContent(null); setVisible(false); onResolved?.() }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                My issue is resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
