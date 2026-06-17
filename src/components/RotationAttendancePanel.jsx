import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  pending: { bg: '#e0e7ff', text: '#4f46e5', label: 'في الانتظار' },
  present: { bg: '#dcfce7', text: '#16a34a', label: 'حاضر' },
  absent: { bg: '#fee2e2', text: '#dc2626', label: 'غياب' },
  swap_pending: { bg: '#fef3c7', text: '#d97706', label: 'تبديل قيد الانتظار' },
}

export default function RotationAttendancePanel({ 
  module = 'factory',
  schedule,
  onStatusChange,
  isAdmin = false,
  employees = []
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState('')
  const [swapNote, setSwapNote] = useState('')
  const [error, setError] = useState('')

  if (!schedule) return null

  const isCurrentUser = schedule.user_id === user?.id
  const isAfterDeadline = new Date(schedule.scheduled_date) < new Date()
  const statusInfo = STATUS_COLORS[schedule.user_status] || STATUS_COLORS.pending

  const handleMarkPresent = async () => {
    if (!isCurrentUser) return
    setLoading(true)
    setError('')
    try {
      await api.post('/api/rotation-attendance/mark-present', {
        scheduleId: schedule.id,
        module
      })
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAbsentUser = async () => {
    if (!isCurrentUser) return
    setLoading(true)
    setError('')
    try {
      await api.post('/api/rotation-attendance/mark-absent', {
        scheduleId: schedule.id,
        module,
        reason: 'لن أستطيع الحضور'
      })
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSwap = async () => {
    if (!selectedTarget) {
      setError('اختر موظف لتحويل الدوام إليه')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/api/rotation-attendance/request-swap', {
        module,
        scheduleId: schedule.id,
        targetUserId: selectedTarget,
        note: swapNote || null
      })
      onStatusChange?.()
      setShowSwapModal(false)
      setSwapNote('')
      setSelectedTarget('')
    } catch (err) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAbsentAdmin = async () => {
    if (!isAdmin) return
    setLoading(true)
    setError('')
    try {
      await api.post(`/api/rotation-attendance/mark-absent-admin/${schedule.id}`, {
        module,
        reason: 'تم التسجيل من قبل الإدارة'
      })
      onStatusChange?.()
    } catch (err) {
      setError(err.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4" style={{ borderColor: statusInfo.bg }}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        <span 
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{ background: statusInfo.bg, color: statusInfo.text }}
        >
          {statusInfo.label}
        </span>
        {schedule.marked_by_user_at && (
          <span className="text-xs text-slate-500">
            سجل: {new Date(schedule.marked_by_user_at).toLocaleDateString('ar-EG')}
          </span>
        )}
      </div>

      {/* Actions for current user */}
      {isCurrentUser && !isAfterDeadline && schedule.user_status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={handleMarkPresent}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'جاري...' : 'تسجيل حضور'}
          </button>
          <button
            onClick={handleMarkAbsentUser}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            غير قادر على الحضور
          </button>
          <button
            onClick={() => setShowSwapModal(true)}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            طلب تبديل
          </button>
        </div>
      )}

      {isAdmin && schedule.user_status !== 'absent' && isAfterDeadline && (
        <button
          onClick={handleMarkAbsentAdmin}
          disabled={loading}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'جاري...' : 'تسجيل غياب'}
        </button>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Swap modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 rounded">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">طلب تبديل الدوام</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">اختر الموظف</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">اختر موظف...</option>
                {employees.map(emp => (
                  <option key={emp.user_id} value={emp.user_id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">ملاحظة</label>
              <textarea
                value={swapNote}
                onChange={(e) => setSwapNote(e.target.value)}
                placeholder="أضف ملاحظة (اختياري)"
                className="w-full border rounded px-3 py-2 h-20 resize-none"
              />
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSwapModal(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleRequestSwap}
                disabled={loading || !selectedTarget}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'جاري...' : 'إرسال الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
