import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function EvaluationReports() {
  const { profile } = useAuth()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const isSuperAdmin = profile?.role === 'super_admin'

  const loadReport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/evaluations/monthly-report?month=${month}&year=${year}`)
      setReport(res.data)
    } catch (err) {
      setError(err.message || 'خطأ في تحميل التقرير')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (!isSuperAdmin) return
    setGenerating(true)
    setError('')
    try {
      await api.post('/api/evaluations/generate-monthly-report', {
        month,
        year
      })
      await loadReport()
    } catch (err) {
      setError(err.message || 'خطأ في توليد التقرير')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [month, year])

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">التقارير الشهرية</h2>
        {isSuperAdmin && (
          <button
            onClick={generateReport}
            disabled={generating || !report?.exists}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'جاري...' : 'توليد التقرير'}
          </button>
        )}
      </div>

      {/* Month and year selector */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">الشهر</label>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="border rounded px-3 py-2"
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
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {[...Array(3)].map((_, i) => {
              const y = new Date().getFullYear() - 1 + i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500">جاري التحميل...</div>
      ) : !report?.exists ? (
        <div className="text-center py-8 text-slate-500">
          لم يتم توليد تقرير لهذا الشهر بعد
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="عدد الموظفين المقيّمين" value={report.total_employees_evaluated} />
            <StatCard label="متوسط المهارات التقنية" value={report.avg_technical_skills?.toFixed(2)} />
            <StatCard label="متوسط التواصل" value={report.avg_communication?.toFixed(2)} />
            <StatCard label="متوسط الالتزام بالمواعيد" value={report.avg_punctuality?.toFixed(2)} />
            <StatCard label="متوسط إنجاز المهام" value={report.avg_task_completion?.toFixed(2)} />
            <StatCard label="متوسط جودة العمل" value={report.avg_work_quality?.toFixed(2)} />
          </div>

          {/* Overall score */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-sm text-slate-600 mb-2">متوسط الدرجة الإجمالية</p>
            <p className="text-4xl font-bold text-indigo-600">
              {report.avg_overall_score?.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-2">من أصل 5</p>
          </div>

          {/* Top performers */}
          {report.top_performers?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">أفضل الأداء</h3>
              <div className="space-y-2">
                {report.top_performers.map((eval, i) => (
                  <div key={eval.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="font-medium">{eval.employee?.full_name}</span>
                    <span className="text-green-600 font-bold">{eval.overall_score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom performers */}
          {report.bottom_performers?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">يحتاج تحسين</h3>
              <div className="space-y-2">
                {report.bottom_performers.map((eval, i) => (
                  <div key={eval.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                    <span className="font-medium">{eval.employee?.full_name}</span>
                    <span className="text-orange-600 font-bold">{eval.overall_score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value || '—'}</p>
    </div>
  )
}
