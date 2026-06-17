import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingTrips: 0,
    pendingRotations: 0,
    pendingEvaluations: 0,
  })
  const [recentTrips, setRecentTrips] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [tripsRes] = await Promise.all([
        api.get('/api/trips?status=pending'),
      ])
      setRecentTrips(tripsRes.data || [])
      setPendingApprovals(tripsRes.data?.slice(0, 5) || [])
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">لوحة التحكم الإدارية</h1>
          <p className="text-slate-600 mt-2">مرحبًا بك في لوحة تحكم الإدارة</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-bento mb-8">
          <Card accent="blue">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">الموظفين</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalEmployees}</p>
              </div>
              <div className="text-3xl">👥</div>
            </CardContent>
          </Card>
          <Card accent="amber">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">ماموريات قيد الانتظار</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{pendingApprovals.length}</p>
              </div>
              <div className="text-3xl">📍</div>
            </CardContent>
          </Card>
          <Card accent="emerald">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">تناوبات معلقة</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.pendingRotations}</p>
              </div>
              <div className="text-3xl">🔄</div>
            </CardContent>
          </Card>
          <Card accent="violet">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">تقييمات معلقة</p>
                <p className="text-3xl font-bold text-violet-600 mt-1">{stats.pendingEvaluations}</p>
              </div>
              <div className="text-3xl">⭐</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pending Approvals */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>الطلبات المعلقة</CardTitle>
                <CardDescription>طلبات بحاجة للموافقة</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-slate-600">جاري التحميل...</p>
                ) : pendingApprovals.length === 0 ? (
                  <p className="text-slate-600">لا توجد طلبات معلقة</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.map((trip) => (
                      <div
                        key={trip.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{trip.trip_name}</p>
                          <p className="text-sm text-slate-600">
                            {trip.location_from} → {trip.location_to}
                          </p>
                        </div>
                        <StatusBadge status={trip.status} size="sm" />
                        <Button size="sm" variant="primary" className="ml-2">
                          مراجعة
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>الإجراءات السريعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button fullWidth variant="primary">
                  إدارة الماموريات
                </Button>
                <Button fullWidth variant="secondary">
                  تقييم الموظفين
                </Button>
                <Button fullWidth variant="secondary">
                  إدارة التناوبات
                </Button>
                <Button fullWidth variant="secondary">
                  عرض التقارير
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
