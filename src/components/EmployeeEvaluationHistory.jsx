import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function EmployeeEvaluationHistory({ employeeId }) {
  const { profile } = useAuth()
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canView = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.id === employeeId

  useEffect(() => {
    if (!canView) return
    
    const loadHistory = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api.get(`/api/evaluations/employee/${employeeId}/history`)
        setHistory(res.data)
      } catch (err) {
        setError(err.message || 'خطأ في تحميل السجل')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [employeeId, canView])

  if (!canView) {
    return <div className="p-4 text-center text-slate-500">غير مصرح بعرض هذه المعلومات</div>
  }

  if (loading) {
    return <div className="p-4 text-center text-slate-500">جاري التحميل...</div>
  }

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>
  }

  if (!history) {
    return <div className="p-4 text-center text-slate-500">لا توجد بيانات</div>
  }

  return (
    <div className="space-y-6">
      {/* Employee info */}
      {history.employee && (
        <div className="bg-slate-50 border rounded-lg p-4">
          <h3 className="font-semibold">{history.employee.full_name}</h3>
          <p className="text-sm text-slate-600">{history.employee.job_title}</p>
          {history.employee.department && (
            <p className="text-sm text-slate-600">القسم: {history.employee.department}</p>
          )}
        </div>
      )}

      {/* Trend info */}
      {history.trend && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard 
            label="آخر تقييم" 
            value={history.trend.latest_score?.toFixed(2)} 
            icon="📊"
          />
          <StatCard 
            label="أول تقييم" 
            value={history.trend.oldest_score?.toFixed(2)} 
            icon="📈"
          />
          <StatCard 
            label="المتوسط" 
            value={history.trend.average_score?.toFixed(2)} 
            icon="⭐"
          />
        </div>
      )}

      {/* History timeline */}
      {history.history && history.history.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-50 border-b px-4 py-3 font-semibold">السجل التاريخي</div>
          <div className="divide-y">
            {history.history.map((eval) => (
              <EvaluationHistoryItem key={eval.id} evaluation={eval} />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-slate-500">لا توجد تقييمات بعد</div>
      )}
    </div>
  )
}

function EvaluationHistoryItem({ evaluation }) {
  const monthLabel = MONTHS[evaluation.month - 1]
  const getScoreColor = (score) => {
    if (score >= 4.5) return 'text-green-600'
    if (score >= 3.5) return 'text-green-500'
    if (score >= 2.5) return 'text-yellow-500'
    if (score >= 1.5) return 'text-orange-500'
    return 'text-red-600'
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">{monthLabel} {evaluation.year}</h4>
        <span className={`text-lg font-bold ${getScoreColor(evaluation.overall_score)}`}>
          {evaluation.overall_score?.toFixed(2) || '—'}
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-slate-600">المهارات التقنية</p>
          <p className="font-semibold">{evaluation.technical_skills || '—'}</p>
        </div>
        <div>
          <p className="text-slate-600">التواصل</p>
          <p className="font-semibold">{evaluation.communication || '—'}</p>
        </div>
        <div>
          <p className="text-slate-600">الالتزام</p>
          <p className="font-semibold">{evaluation.punctuality || '—'}</p>
        </div>
      </div>

      {evaluation.notes && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
          <p className="text-slate-700">{evaluation.notes}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-slate-50 border rounded-lg p-4 text-center">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value || '—'}</p>
    </div>
  )
}
