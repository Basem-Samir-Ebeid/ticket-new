import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const STATUS_COLORS = {
  pending: { bg: '#e0e7ff', text: '#4f46e5', label: 'قيد الانتظار' },
  pending_admin: { bg: '#fef3c7', text: '#d97706', label: 'بانتظار الإدارة' },
  approved: { bg: '#dcfce7', text: '#16a34a', label: 'موافق عليه' },
  rejected: { bg: '#fee2e2', text: '#dc2626', label: 'مرفوض' },
}

export default function RotationSwapRequests({ module = 'factory' }) {
  const { profile } = useAuth()
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all, pending, approved, rejected

  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    loadSwaps()
  }, [module])

  const loadSwaps = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/api/rotation-attendance/swaps')
      const filtered = res.data.filter(s => s.module === module)
      setSwaps(filtered)
    } catch (err) {
      setError(err.message || 'خطأ في تحميل الطلبات')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (swapId) => {
    try {
      await api.post(`/api/rotation-attendance/approve-swap/${swapId}`, {})
      await loadSwaps()
    } catch (err) {
      setError(err.message || 'خطأ في الموافقة')
    }
  }

  const handleReject = async (swapId, reason) => {
    try {
      await api.post(`/api/rotation-attendance/reject-swap/${swapId}`, { reason })
      await loadSwaps()
    } catch (err) {
      setError(err.message || 'خطأ في الرفض')
    }
  }

  const handleAdminApprove = async (swapId) => {
    if (!isSuperAdmin) return
    try {
      await api.post(`/api/rotation-attendance/approve-swap-admin/${swapId}`, {})
      await loadSwaps()
    } catch (err) {
      setError(err.message || 'خطأ في الموافقة')
    }
  }

  const getFilteredSwaps = () => {
    if (filter === 'all') return swaps
    return swaps.filter(s => s.status === filter)
  }

  const filteredSwaps = getFilteredSwaps()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">طلبات تبديل التناوب</h2>
        <button
          onClick={loadSwaps}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          تحديث
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {['all', 'pending', 'pending_admin', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? 'الكل' : f === 'pending' ? 'قيد الانتظار' : f === 'pending_admin' ? 'بانتظار الإدارة' : f === 'approved' ? 'موافق عليه' : 'مرفوض'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : filteredSwaps.length === 0 ? (
        <div className="text-center py-8 text-gray-500">لا توجد طلبات</div>
      ) : (
        <div className="space-y-3">
          {filteredSwaps.map(swap => {
            const statusInfo = STATUS_COLORS[swap.status] || STATUS_COLORS.pending
            const isUserTarget = swap.target_id === profile?.id
            const isAdmin = isSuperAdmin

            return (
              <div key={swap.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">طلب من: {swap.requester?.full_name || 'موظف'}</p>
                    <p className="text-sm text-gray-600">
                      التاريخ: {new Date(swap.requester_date).toLocaleDateString('ar-EG')}
                    </p>
                    {swap.note && (
                      <p className="text-sm text-gray-600 mt-1">ملاحظة: {swap.note}</p>
                    )}
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ background: statusInfo.bg, color: statusInfo.text }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Target user actions */}
                {isUserTarget && swap.user_approval_status === 'pending' && (
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <button
                      onClick={() => handleApprove(swap.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      وافق
                    </button>
                    <button
                      onClick={() => handleReject(swap.id, 'غير موافق')}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      رفض
                    </button>
                  </div>
                )}

                {/* Admin actions */}
                {isAdmin && swap.status === 'pending_admin' && (
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <button
                      onClick={() => handleAdminApprove(swap.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      وافق من الإدارة
                    </button>
                  </div>
                )}

                {/* Show approval status */}
                {swap.user_approval_status !== 'pending' && (
                  <div className="mt-2 text-sm text-gray-600">
                    {swap.user_approval_status === 'approved'
                      ? `وافق: ${swap.target?.full_name || 'موظف'}`
                      : `رفض: ${swap.target?.full_name || 'موظف'}`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
