import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

const isAdmin = (role) => role === 'admin' || role === 'super_admin'

const CATEGORY_COLORS = {
  general: '#6366f1', hardware: '#f59e0b', software: '#10b981', network: '#3b82f6',
  security: '#ef4444', hr: '#8b5cf6', other: '#64748b',
}

function getCatColor(cat) {
  return CATEGORY_COLORS[cat?.toLowerCase()] || '#6366f1'
}

export default function KnowledgePage({ onArticleSelect }) {
  const { profile } = useAuth()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingArticle, setEditingArticle] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '', is_published: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [arts, cats] = await Promise.all([api.getKnowledgeArticles(), api.getKnowledgeCategories()])
      setArticles(arts)
      setCategories(cats)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = articles.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.title.toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q))
    const matchCat = !catFilter || a.category === catFilter
    return matchSearch && matchCat
  })

  async function viewArticle(article) {
    try {
      const full = await api.getKnowledgeArticle(article.id)
      setSelectedArticle(full)
    } catch {}
  }

  async function rateArticle(id, helpful) {
    try {
      await api.rateKnowledgeArticle(id, helpful)
      const updated = { ...selectedArticle }
      if (helpful) updated.helpful_count = (updated.helpful_count || 0) + 1
      else updated.not_helpful_count = (updated.not_helpful_count || 0) + 1
      setSelectedArticle(updated)
    } catch {}
  }

  function openNewEditor() {
    setEditingArticle(null)
    setForm({ title: '', content: '', category: 'general', tags: '', is_published: true })
    setShowEditor(true)
    setMsg('')
  }

  function openEditEditor(a) {
    setEditingArticle(a)
    setForm({
      title: a.title,
      content: a.content || '',
      category: a.category,
      tags: (a.tags || []).join(', '),
      is_published: a.is_published,
    })
    setShowEditor(true)
    setMsg('')
  }

  async function saveArticle(e) {
    e.preventDefault()
    if (!form.title.trim()) return setMsg('Title is required')
    setSaving(true)
    try {
      const data = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      }
      if (editingArticle) {
        await api.updateKnowledgeArticle(editingArticle.id, data)
      } else {
        await api.createKnowledgeArticle(data)
      }
      setShowEditor(false)
      setMsg('')
      load()
    } catch (err) {
      setMsg(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  async function deleteArticle(id) {
    if (!confirm('Delete this article?')) return
    try {
      await api.deleteKnowledgeArticle(id)
      load()
    } catch {}
  }

  // Article Detail View
  if (selectedArticle) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <button onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to Knowledge Base
        </button>

        <div className="rounded-xl p-6 border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-white text-xl font-bold">{selectedArticle.title}</h2>
            {isAdmin(profile?.role) && (
              <button onClick={() => { setSelectedArticle(null); openEditEditor(selectedArticle) }}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
              style={{ background: getCatColor(selectedArticle.category) + '22', color: getCatColor(selectedArticle.category) }}>
              {selectedArticle.category}
            </span>
            {(selectedArticle.tags || []).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-slate-400">#{t}</span>
            ))}
            <span className="text-slate-600 text-xs">{selectedArticle.views_count} views</span>
          </div>

          <div
            className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
            style={{ '--tw-prose-body': '#cbd5e1', '--tw-prose-headings': '#f1f5f9' }}
          />

          <div className="mt-6 pt-4 border-t border-white/8 flex items-center gap-4">
            <p className="text-slate-500 text-sm">Was this helpful?</p>
            <button onClick={() => rateArticle(selectedArticle.id, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              👍 Yes ({selectedArticle.helpful_count || 0})
            </button>
            <button onClick={() => rateArticle(selectedArticle.id, false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              👎 No ({selectedArticle.not_helpful_count || 0})
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Editor Modal
  if (showEditor && isAdmin(profile?.role)) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <button onClick={() => setShowEditor(false)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Cancel
        </button>

        <div className="rounded-xl p-6 border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="text-white font-bold text-lg mb-5">{editingArticle ? 'Edit Article' : 'New Article'}</h2>

          <form onSubmit={saveArticle} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                placeholder="Article title..." required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50">
                  {['general', 'hardware', 'software', 'network', 'security', 'hr', 'other'].map(c => (
                    <option key={c} value={c} style={{ background: '#1e1e2e' }}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Tags (comma separated)</label>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  placeholder="vpn, password, wifi" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Content</label>
              <div style={{ '--ql-color': '#fff', '--ql-bg': '#1e1e2e' }}>
                <ReactQuill
                  theme="snow"
                  value={form.content}
                  onChange={val => setForm(f => ({ ...f, content: val }))}
                  style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', minHeight: '200px' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="published" checked={form.is_published}
                onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                className="rounded" />
              <label htmlFor="published" className="text-sm text-slate-400">Published (visible to employees)</label>
            </div>

            {msg && <p className="text-red-400 text-sm">{msg}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {saving ? 'Saving...' : (editingArticle ? 'Update Article' : 'Create Article')}
              </button>
              <button type="button" onClick={() => setShowEditor(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-bold text-xl">Knowledge Base</h2>
          <p className="text-slate-500 text-xs mt-0.5">{articles.length} articles</p>
        </div>
        {isAdmin(profile?.role) && (
          <button onClick={openNewEditor}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Article
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50">
          <option value="" style={{ background: '#1e1e2e' }}>All Categories</option>
          {categories.map(c => <option key={c} value={c} style={{ background: '#1e1e2e' }}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12 animate-pulse">Loading articles...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-600 py-12">No articles found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id}
              className="rounded-xl p-4 border cursor-pointer transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
              onClick={() => viewArticle(a)}>
              <div className="flex items-start justify-between mb-2">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                  style={{ background: getCatColor(a.category) + '22', color: getCatColor(a.category) }}>
                  {a.category}
                </span>
                {!a.is_published && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400">Draft</span>
                )}
              </div>
              <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">{a.title}</h3>
              {(a.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {(a.tags || []).slice(0, 3).map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-500">#{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>👁 {a.views_count}</span>
                  <span>👍 {a.helpful_count}</span>
                </div>
                {isAdmin(profile?.role) && (
                  <button onClick={e => { e.stopPropagation(); deleteArticle(a.id) }}
                    className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
