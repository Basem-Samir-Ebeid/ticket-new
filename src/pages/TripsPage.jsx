import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
import Button from './Button'
import StatusBadge from './StatusBadge'
import { api } from '../lib/api'

export default function TripsPage() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    trip_name: '',
    purpose: '',
    location_from: '',
    location_to: '',
    departure_time: '',
    return_time: '',
    transport_type: 'car',
    transport_notes: '',
    notes: '',
  })
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadTrips()
  }, [filter])

  const loadTrips = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await api.get(`/api/trips${params}`)
      setTrips(res.data || [])
    } catch (err) {
      console.error('Failed to load trips:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingId) {
        await api.put(`/api/trips/${editingId}`, formData)
      } else {
        await api.post('/api/trips', formData)
      }
      loadTrips()
      setShowForm(false)
      setFormData({
        trip_name: '',
        purpose: '',
        location_from: '',
        location_to: '',
        departure_time: '',
        return_time: '',
        transport_type: 'car',
        transport_notes: '',
        notes: '',
      })
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save trip:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTrips = trips.filter((t) => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const getStatusColor = (status) => {
    const colors = {
      pending: 'amber',
      approved: 'emerald',
      rejected: 'red',
      'in-progress': 'blue',
      completed: 'green',
    }
    return colors[status] || 'slate'
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">الماموريات</h1>
            <p className="text-slate-600 mt-1">إدارة وتتبع الماموريات والرحلات</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} variant="primary">
            {showForm ? 'إلغاء' : 'طلب ماموريه جديدة'}
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-8" accent="blue">
            <CardHeader>
              <CardTitle>طلب ماموريه جديدة</CardTitle>
              <CardDescription>أدخل تفاصيل الماموريه المطلوبة</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="اسم الماموريه"
                    value={formData.trip_name}
                    onChange={(e) => setFormData({ ...formData, trip_name: e.target.value })}
                    className="input"
                    required
                  />
                  <input
                    type="text"
                    placeholder="الغرض"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="مكان البداية"
                    value={formData.location_from}
                    onChange={(e) => setFormData({ ...formData, location_from: e.target.value })}
                    className="input"
                    required
                  />
                  <input
                    type="text"
                    placeholder="مكان النهاية"
                    value={formData.location_to}
                    onChange={(e) => setFormData({ ...formData, location_to: e.target.value })}
                    className="input"
                    required
                  />
                  <input
                    type="datetime-local"
                    placeholder="وقت الذهاب"
                    value={formData.departure_time}
                    onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                    className="input"
                    required
                  />
                  <input
                    type="datetime-local"
                    placeholder="وقت العودة"
                    value={formData.return_time}
                    onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                    className="input"
                    required
                  />
                  <select
                    value={formData.transport_type}
                    onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                    className="input"
                  >
                    <option value="car">سيارة</option>
                    <option value="taxi">تاكسي</option>
                    <option value="bus">حافلة</option>
                    <option value="train">قطار</option>
                    <option value="flight">طائرة</option>
                    <option value="other">أخرى</option>
                  </select>
                  <input
                    type="text"
                    placeholder="ملاحظات المواصلات"
                    value={formData.transport_notes}
                    onChange={(e) => setFormData({ ...formData, transport_notes: e.target.value })}
                    className="input"
                  />
                </div>
                <textarea
                  placeholder="ملاحظات إضافية"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input mt-4"
                  rows={3}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="primary" loading={loading}>
                  {editingId ? 'تحديث' : 'إرسال الطلب'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                >
                  إلغاء
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'approved', 'in-progress', 'completed', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {status === 'all' ? 'الكل' : status}
            </button>
          ))}
        </div>

        {/* Trips Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">جاري التحميل...</p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-slate-600">لا توجد ماموريات</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => (
              <Card key={trip.id} accent={getStatusColor(trip.status)} hoverable>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{trip.trip_name}</CardTitle>
                      <CardDescription>{trip.purpose}</CardDescription>
                    </div>
                    <StatusBadge status={trip.status} size="sm" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">المسار:</span>
                      <span className="font-medium">{trip.location_from} → {trip.location_to}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">الذهاب:</span>
                      <span>{new Date(trip.departure_time).toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">العودة:</span>
                      <span>{new Date(trip.return_time).toLocaleString('ar-EG')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">المواصلات:</span>
                      <span className="capitalize">{trip.transport_type}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  {trip.status === 'pending' && (
                    <>
                      <Button size="sm" variant="primary" onClick={() => setEditingId(trip.id)}>
                        تعديل
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => {}}>
                        حذف
                      </Button>
                    </>
                  )}
                  {trip.status === 'approved' && (
                    <Button size="sm" variant="primary" onClick={() => {}}>
                      بدء الماموريه
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
