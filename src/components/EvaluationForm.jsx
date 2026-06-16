import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const SCORE_OPTIONS = [1, 2, 3, 4, 5]
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function EvaluationForm({ employeeId, onSuccess }) {
  const { profile } = useAuth()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    technical_skills: null,
    communication: null,
    punctuality: null,
    task_completion: null,
    initiative: null,
    work_quality: null,
    notes: '',
    strengths: '',
    areas_for_improvement: '',
  })

  const isSuperAdmin = profile?.role === 'super_admin'

  if (!isSuperAdmin) {
    return <div className="p-4 bg-red-100 text-red-700 rounded">يجب أن تكون مسؤولاً لتقييم الموظفين</div>
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value === '' ? null : isNaN(value) ? value : Number(value)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/api/evaluations', {
        employee_id: employeeId,
        month: Number(month),
        year: Number(year),
        ...form
      })
      setSuccess('تم حفظ التقييم بنجاح')
      setForm({
        technical_skills: null,
        communication: null,
        punctuality: null,
        task_completion: null,
        initiative: null,
        work_quality: null,
        notes: '',
        strengths: '',
        areas_for_improvement: '',
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'خطأ في حفظ التقييم')
    } finally {
      setLoading(false)
    }
  }

  const calculateAverage = () => {
    const scores = [
      form.technical_skills,
      form.communication,
      form.punctuality,
      form.task_completion,
      form.initiative,
      form.work_quality
    ].filter(s => s !== null)

    if (!scores.length) return 0
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  }

  const average = calculateAverage()

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg p-6 border">
      <div>
        <h3 className="text-xl font-semibold mb-4">تقييم الموظف - {MONTHS[month - 1]} {year}</h3>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">الشهر</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">السنة</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            {[...Array(3)].map((_, i) => {
              const y = new Date().getFullYear() - 1 + i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      {/* Scoring section */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-700">المعايير (1-5)</h4>

        {[
          { key: 'technical_skills', label: 'المهارات التقنية' },
          { key: 'communication', label: 'التواصل' },
          { key: 'punctuality', label: 'الانضباط' },
          { key: 'task_completion', label: 'إكمال المهام' },
          { key: 'initiative', label: 'المبادرة والابتكار' },
          { key: 'work_quality', label: 'جودة العمل' },
        ].map(criterion => (
          <div key={criterion.key}>
            <label className="block text-sm font-medium mb-2">{criterion.label}</label>
            <div className="flex gap-2">
              {SCORE_OPTIONS.map(score => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setForm(prev => ({...prev, [criterion.key]: score}))}
                  className={`w-10 h-10 rounded border font-semibold transition ${
                    form[criterion.key] === score
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Average score display */}
      {average > 0 && (
        <div className="p-4 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-gray-600">المتوسط الإجمالي</p>
          <p className="text-2xl font-bold text-blue-600">{average}</p>
        </div>
      )}

      {/* Text fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">نقاط القوة</label>
          <textarea
            name="strengths"
            value={form.strengths}
            onChange={handleChange}
            placeholder="أكتب نقاط القوة الملاحظة..."
            className="w-full border rounded px-3 py-2 h-20 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">مجالات التحسين</label>
          <textarea
            name="areas_for_improvement"
            value={form.areas_for_improvement}
            onChange={handleChange}
            placeholder="أكتب المجالات التي تحتاج تحسين..."
            className="w-full border rounded px-3 py-2 h-20 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">ملاحظات عامة</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="أكتب أي ملاحظات إضافية..."
            className="w-full border rounded px-3 py-2 h-20 resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold"
      >
        {loading ? 'جاري الحفظ...' : 'حفظ التقييم'}
      </button>
    </form>
  )
}
