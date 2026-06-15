import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import EmptyState from '../components/EmptyState'

const TYPE_STYLES = {
  info:    { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)',  icon: '📢', badge: '#6366f1', badgeBg: 'rgba(99,102,241,0.15)', label: 'إعلان' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '⚠️', badge: '#f59e0b', badgeBg: 'rgba(245,158,11,0.15)', label: 'تنبيه' },
  success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', icon: '✅', badge: '#10b981', badgeBg: 'rgba(16,185,129,0.15)', label: 'خبر سار' },
  urgent:  { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  icon: '🚨', badge: '#ef4444', badgeBg: 'rgba(239,68,68,0.15)', label: 'عاجل' },
}

const ROLES_AR = { employee: 'موظفون', member: 'أعضاء فريق', admin: 'مدراء', super_admin: 'سوبر أدمن' }

function formatRelative(dateStr) {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `منذ ${days} يوم`
  return d.toLocaleDateString('ar-EG')
}

export default function AnnouncementsPage({ isAdmin = false }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', type: 'info', target_roles: [], expires_at: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const data = await api.getAnnouncements()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      toast.error('فشل تحميل الإعلانات')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return toast.warning('يرجى ملء العنوان والمحتوى')
    setSaving(true)
    try {
      await api.createAnnouncement(form)
      toast.success('تم نشر الإعلان بنجاح')
      setShowForm(false)
      setForm({ title: '', content: '', type: 'info', target_roles: [], expires_at: '' })
      load()
    } catch {
      toast.error('فشل نشر الإعلان')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('حذف هذا الإعلان نهائياً؟')) return
    setDeletingId(id)
    try {
      await api.deleteAnnouncement(id)
      toast.success('تم حذف الإعلان')
      setItems(prev => prev.filter(a => a.id !== id))
    } catch {
      toast.error('فشل حذف الإعلان')
    }
    setDeletingId(null)
  }

  async function handleMarkRead(id) {
    try {
      await api.markAnnouncementRead(id)
      setItems(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
    } catch {}
  }

  function toggleRole(role) {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const filtered = typeFilter === 'all' ? items : items.filter(a => a.type === typeFilter)
  const unread = items.filter(a => !a.is_read).length

  return (
    <div className="animate-fadeIn space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📢</span> الإعلانات
            {unread > 0 && (
              <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                {unread} جديد
              </span>
            )}
          </h2>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>إعلانات الشركة والتحديثات المهمة</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            إعلان جديد
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="animate-scaleIn" style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 16, padding: 24,
        }}>
          <h3 style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 20 }}>نشر إعلان جديد</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>عنوان الإعلان *</label>
                <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="أدخل عنوان الإعلان..." required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>النوع</label>
                <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="info">📢 إعلان</option>
                  <option value="warning">⚠️ تنبيه</option>
                  <option value="success">✅ خبر سار</option>
                  <option value="urgent">🚨 عاجل</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>المحتوى *</label>
              <textarea className="input-field" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="اكتب تفاصيل الإعلان..." rows={4} required style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  الاستهداف (اتركه فارغاً للجميع)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(ROLES_AR).map(([role, label]) => (
                    <button key={role} type="button" onClick={() => toggleRole(role)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        background: form.target_roles.includes(role) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        border: form.target_roles.includes(role) ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: form.target_roles.includes(role) ? '#a5b4fc' : '#64748b',
                        transition: 'all 0.15s',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>تاريخ الانتهاء (اختياري)</label>
                <input type="date" className="input-field" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">إلغاء</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'جاري النشر...' : 'نشر الإعلان'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {['all', 'info', 'warning', 'success', 'urgent'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: typeFilter === t ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: typeFilter === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: typeFilter === t ? '#a5b4fc' : '#64748b',
              transition: 'all 0.15s',
            }}>
            {t === 'all' ? 'الكل' : TYPE_STYLES[t]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, height: 100 }} className="shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📢" title="لا توجد إعلانات" subtitle="لم يتم نشر أي إعلانات بعد" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(item => {
            const s = TYPE_STYLES[item.type] || TYPE_STYLES.info
            const isExpired = item.expires_at && new Date(item.expires_at) < new Date()
            return (
              <div key={item.id} className="animate-fadeIn" style={{
                background: item.is_read ? 'rgba(255,255,255,0.02)' : s.bg,
                border: `1px solid ${item.is_read ? 'rgba(255,255,255,0.07)' : s.border}`,
                borderRadius: 14, padding: '18px 20px',
                opacity: isExpired ? 0.5 : 1,
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{item.title}</span>
                      <span style={{ background: s.badgeBg, color: s.badge, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                        {s.label}
                      </span>
                      {!item.is_read && (
                        <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>جديد</span>
                      )}
                      {isExpired && (
                        <span style={{ background: 'rgba(100,116,139,0.15)', color: '#64748b', borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>منتهي</span>
                      )}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{item.content}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ color: '#475569', fontSize: 11 }}>{formatRelative(item.created_at)}</span>
                      {item.created_by_name && (
                        <span style={{ color: '#475569', fontSize: 11 }}>بواسطة {item.created_by_name}</span>
                      )}
                      {item.target_roles && item.target_roles.length > 0 && (
                        <span style={{ color: '#475569', fontSize: 11 }}>
                          لـ: {item.target_roles.map(r => ROLES_AR[r] || r).join('، ')}
                        </span>
                      )}
                      {item.expires_at && (
                        <span style={{ color: '#475569', fontSize: 11 }}>
                          ينتهي: {new Date(item.expires_at).toLocaleDateString('ar-EG')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {!item.is_read && !isAdmin && (
                      <button onClick={() => handleMarkRead(item.id)} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}>
                        تم القراءة
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                        className="btn-danger" style={{ fontSize: 11, padding: '5px 10px' }}>
                        {deletingId === item.id ? '...' : 'حذف'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
