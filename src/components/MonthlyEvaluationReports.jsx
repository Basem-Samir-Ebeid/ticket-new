import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function MonthlyEvaluationReports() {
  const { profile } = useAuth()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [deptStats, setDeptStats] = useState([])
  const [topPerformers, setTopPerformers] = useState([])

  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    loadReports()
  }, [month, year])

  const loadReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [reportsRes, statsRes, performersRes] = await Promise.all([
        api.get(`/api/evaluation-reports/monthly-reports?month=${month}&year=${year}`),
        api.get(`/api/evaluation-reports/department-stats?month=${month}&year=${year}`),
        api.get(`/api/evaluation-reports/top-performers?month=${month}&year=${year}&limit=5`)
      ])
      setReports(reportsRes.data)
      setDeptStats(statsRes.data)
      setTopPerformers(performersRes.data)
    } catch (err) {
      setError(err.message || 'خطأ في تحميل التقارير')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    setError('')
    try {
      await api.post('/api/evaluation-reports/generate-monthly-report', {
        month,
        year
      })
      await loadReports()
    } catch (err) {
      setError(err.message || 'خطأ في توليد التقرير')
    } finally {
      setGenerating(false)
    }
  }

  const getScoreColor = (score) => {
    if (!score) return 'text-gray-400'
    if (score >= 4.5) return 'text-green-600'
    if (score >= 3.5) return 'text-blue-600'
    if (score >= 2.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score) => {
    if (!score) return 'bg-gray-50'
    if (score >= 4.5) return 'bg-green-50'
    if (score >= 3.5) return 'bg-blue-50'
    if (score >= 2.5) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">التقارير الشهرية للتقييمات</h2>
        {isSuperAdmin && (
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {generating ? 'جاري التوليد...' : 'توليد التقرير'}
          </button>
        )}
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">الشهر</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border rounded px-4 py-2"
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
            className="border rounded px-4 py-2"
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

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🏆</span> أفضل الأداء
          </h3>
          <div className="space-y-2">
            {topPerformers.map((perf, idx) => (
              <div key={perf.employee_id} className="flex items-center justify-between p-2 bg-white rounded">
                <div>
                  <p className="font-semibold">{idx + 1}. {perf.full_name}</p>
                  <p className="text-sm text-gray-600">{perf.department} - {perf.job_title}</p>
                </div>
                <div className={`text-lg font-bold ${getScoreColor(perf.overall_score)}`}>
                  {perf.overall_score || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department statistics */}
      {deptStats.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-xl font-semibold mb-4">إحصائيات الأقسام</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">القسم</th>
                  <th className="px-4 py-2 text-center">العدد</th>
                  <th className="px-4 py-2 text-center">المتوسط العام</th>
                  <th className="px-4 py-2 text-center">المهارات التقنية</th>
                  <th className="px-4 py-2 text-center">التواصل</th>
                  <th className="px-4 py-2 text-center">الانضباط</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept) => (
                  <tr key={dept.department} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{dept.department || 'بدون قسم'}</td>
                    <td className="px-4 py-2 text-center">{dept.count}</td>
                    <td className={`px-4 py-2 text-center font-semibold ${getScoreColor(dept.avgOverall)}`}>
                      {dept.avgOverall ? dept.avgOverall.toFixed(2) : 'N/A'}
                    </td>
                    <td className={`px-4 py-2 text-center ${getScoreColor(dept.avgTechnicalSkills)}`}>
                      {dept.avgTechnicalSkills ? dept.avgTechnicalSkills.toFixed(2) : 'N/A'}
                    </td>
                    <td className={`px-4 py-2 text-center ${getScoreColor(dept.avgCommunication)}`}>
                      {dept.avgCommunication ? dept.avgCommunication.toFixed(2) : 'N/A'}
                    </td>
                    <td className={`px-4 py-2 text-center ${getScoreColor(dept.avgPunctuality)}`}>
                      {dept.avgPunctuality ? dept.avgPunctuality.toFixed(2) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual reports */}
      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded">
          <p className="text-gray-600 mb-2">لم يتم توليد تقرير لهذا الشهر بعد</p>
          {isSuperAdmin && (
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-4"
            >
              توليد التقرير الآن
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-xl font-semibold mb-4">التقارير الفردية</h3>
          <div className="space-y-3">
            {reports.map(report => (
              <div key={report.id} className={`p-4 rounded border ${getScoreBg(report.overall_score_avg)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{report.employee?.full_name}</p>
                    <p className="text-sm text-gray-600">
                      {report.employee?.department} - {report.employee?.job_title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {report.evaluation_count} تقييم
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(report.overall_score_avg)}`}>
                      {report.overall_score_avg ? report.overall_score_avg.toFixed(2) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600">المتوسط العام</div>
                  </div>
                </div>

                {/* Mini chart */}
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {[
                    { label: 'تقنية', value: report.technical_skills_avg },
                    { label: 'تواصل', value: report.communication_avg },
                    { label: 'انضباط', value: report.punctuality_avg },
                    { label: 'مهام', value: report.task_completion_avg },
                    { label: 'مبادرة', value: report.initiative_avg },
                    { label: 'جودة', value: report.work_quality_avg },
                  ].map(criterion => (
                    <div key={criterion.label} className="text-center">
                      <div className="text-xs text-gray-600 mb-1">{criterion.label}</div>
                      <div className={`text-sm font-bold ${getScoreColor(criterion.value)}`}>
                        {criterion.value ? criterion.value.toFixed(1) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
