import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'
import EmptyState, { PageLoader } from '../components/EmptyState'

const DEPT_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16','#f97316','#14b8a6']

export default function DepartmentsPage({ users = [] }) {
  const toast = useToast()
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', manager_id: '', color: '#6366f1' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.getDepartments()
      setDepts(Array.isArray(data) ? data : [])
    } catch {
      toast.error('فشل تحميل الأقسام')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startCreate() {
    setEditingDept(null)
    setForm({ name: '', description: '', manager_id: '', color: '#6366f1' })
    setShowForm(true)
  }

  function startEdit(dept) {
    setEditingDept(dept)
    setForm({ name: dept.name, description: dept.description || '', manager_id: dept.manager_id || '', color: dept.color || '#6366f1' })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.warning('يرجى إدخال اسم القسم')
    setSaving(true)
    try {
      if (editingDept) {
        await api.updateDepartment(editingDept.id, form)
        toast.success('تم تحديث القسم')
      } else {
        await api.createDepartment(form)
        toast.success('تم إنشاء القسم')
      }
      setShowForm(false)
      setEditingDept(null)
      load()
    } catch (err) {
      toast.error(err.message || 'فشل حفظ القسم')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('حذف هذا القسم نهائياً؟')) return
    setDeletingId(id)
    try {
      await api.deleteDepartment(id)
      toast.success('تم حذف القسم')
      setDepts(prev => prev.filter(d => d.id !== id))
    } catch {
      toast.error('فشل حذف القسم')
    }
    setDeletingId(null)
  }

  const filtered = depts.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const userMap = {}
  users.forEach(u => { userMap[u.id] = u.full_name || u.email })

  const deptStaff = {}
  users.forEach(u => {
    if (u.department) {
      if (!deptStaff[u.department]) deptStaff[u.department] = []
      deptStaff[u.department].push(u)
    }
  })

  return (
    <div className="animate-fadeIn space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            🏢 الأقسام
          </h2>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>إدارة أقسام وفرق الشركة</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <input className="input-field" placeholder="بحث في الأقسام..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingRight: 36, width: 200 }} />
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <button onClick={startCreate} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            قسم جديد
          </button>
        </div>
      </div>

      {showForm && (
        <div className="animate-scaleIn" style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 16, padding: 24,
        }}>
          <h3 style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 20 }}>
            {editingDept ? 'تعديل القسم' : 'إنشاء قسم جديد'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>اسم القسم *</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: تكنولوجيا المعلومات" required />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>مدير القسم</label>
                <select className="input-field" value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
                  <option value="">— بدون مدير —</option>
                  {users.filter(u => u.role !== 'employee').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>وصف القسم</label>
              <textarea className="input-field" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر للقسم ومهامه..." rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>لون القسم</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEPT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #fff' : '2px solid transparent',
                      transition: 'all 0.15s', transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                    }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowForm(false); setEditingDept(null) }} className="btn-ghost">إلغاء</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'جاري الحفظ...' : editingDept ? 'تحديث' : 'إنشاء'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState icon="🏢" title="لا توجد أقسام" subtitle="ابدأ بإنشاء أول قسم في الشركة"
          action={<button onClick={startCreate} className="btn-primary">إنشاء قسم</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(dept => {
            const staffList = deptStaff[dept.name] || []
            return (
              <div key={dept.id} className="hover-lift" style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `4px solid ${dept.color || '#6366f1'}`,
                borderRadius: 14, padding: 20, cursor: 'default',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${dept.color || '#6366f1'}20`,
                      border: `1px solid ${dept.color || '#6366f1'}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>🏢</div>
                    <div>
                      <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{dept.name}</p>
                      {dept.manager_id && userMap[dept.manager_id] && (
                        <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                          مدير: {userMap[dept.manager_id]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(dept)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>تعديل</button>
                    <button onClick={() => handleDelete(dept.id)} disabled={deletingId === dept.id}
                      className="btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}>
                      {deletingId === dept.id ? '...' : 'حذف'}
                    </button>
                  </div>
                </div>

                {dept.description && (
                  <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{dept.description}</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {staffList.slice(0, 5).map((u, i) => (
                      <div key={u.id} style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: `${dept.color || '#6366f1'}30`,
                        border: `2px solid ${dept.color || '#6366f1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: dept.color || '#6366f1',
                        marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: 5 - i,
                      }}>
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                    ))}
                    {staffList.length > 5 && (
                      <span style={{ color: '#64748b', fontSize: 11, marginLeft: 4 }}>+{staffList.length - 5}</span>
                    )}
                  </div>
                  <span style={{
                    background: `${dept.color || '#6366f1'}15`,
                    color: dept.color || '#6366f1',
                    border: `1px solid ${dept.color || '#6366f1'}30`,
                    borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  }}>
                    {staffList.length} موظف
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
