import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function MemberDashboard() {
  const { user, profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestForm, setRequestForm] = useState({ title: '', description: '', affected_person: '' })
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [review, setReview] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [activeTab, setActiveTab] = useState('tickets')
  const [todayLogin, setTodayLogin] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceDate, setAttendanceDate] = useState(getLocalDateString())

  useEffect(() => {
    if (!user) return
    fetchTickets()
    fetchMyRequests()
    fetchNotifications()
    checkTodayLogin()

    const channel = supabase
      .channel('member-notifs-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchNotifications()
        fetchTickets()
        fetchMyRequests()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (selectedTicket) fetchReplies(selectedTicket.id)
  }, [selectedTicket])

  useEffect(() => {
    if (profile?.can_view_attendance) {
      fetchAttendanceRecords()
    }
  }, [profile?.can_view_attendance, attendanceDate])

  async function checkTodayLogin() {
    const today = getLocalDateString()
    const { data, error } = await supabase
      .from('login_times')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()
    setTodayLogin(data)
  }

  async function registerLogin() {
    setLoggingIn(true)

    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      setLoggingIn(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { error } = await supabase.rpc('register_attendance', {
            user_lat: position.coords.latitude,
            user_lon: position.coords.longitude
          })

          if (error) {
            alert(error.message)
          } else {
            checkTodayLogin()
          }
        } catch (err) {
          alert('Unexpected error')
        }

        setLoggingIn(false)
      },
      () => {
        alert('Location permission is required')
        setLoggingIn(false)
      }
    )
  }

  async function registerLogout() {
    if (!todayLogin || todayLogin.logout_time) return
    setLoggingOut(true)

    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      setLoggingOut(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { error } = await supabase.rpc('register_logout', {
            user_lat: position.coords.latitude,
            user_lon: position.coords.longitude
          })

          if (error) {
            alert(error.message)
          } else {
            checkTodayLogin()
          }
        } catch (err) {
          alert('Unexpected error')
        }

        setLoggingOut(false)
      },
      () => {
        alert('Location permission is required')
        setLoggingOut(false)
      }
    )
  }

  async function fetchAttendanceRecords() {
    const { data, error } = await supabase.rpc('get_attendance_records', {
      target_date: attendanceDate
    })
    if (error) {
      console.error('Attendance fetch error:', error)
      setAttendanceRecords([])
      return
    }
    setAttendanceRecords(data || [])
  }

  function formatWorkDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    const diff = new Date(endTime) - new Date(startTime)
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  async function fetchTickets() {
    const { data } = await supabase
      .from('tickets').select('*')
      .eq('assigned_to', user.id)
      .eq('is_request', false)
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  async function fetchMyRequests() {
    const { data } = await supabase
      .from('tickets').select('*')
      .eq('created_by', user.id).eq('is_request', true)
      .order('created_at', { ascending: false })
    setMyRequests(data || [])
  }

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', user.id).eq('read', false)
      .order('created_at', { ascending: false })
    setNotifications(data || [])
  }

  async function fetchReplies(ticketId) {
    const { data } = await supabase
      .from('ticket_replies').select('*, profiles(full_name)')
      .eq('ticket_id', ticketId).order('created_at', { ascending: true })
    setReplies(data || [])
  }

  async function markAsRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    fetchNotifications()
  }

  async function submitRequest(e) {
    e.preventDefault()
    setLoading(true)
    setRequestMsg('')
    const { data: ticket, error } = await supabase
      .from('tickets').insert({
        title: requestForm.title, description: requestForm.description,
        affected_person: requestForm.affected_person,
        created_by: user.id, assigned_to: null, status: 'opened',
        is_request: true, request_status: 'pending_review'
      }).select().single()

    if (error) { setRequestMsg('Error: ' + error.message); setLoading(false); return }

    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins && admins.length > 0) {
      await Promise.all(admins.map(admin => 
        supabase.from('notifications').insert({
          user_id: admin.id, ticket_id: ticket.id,
          message: `📝 New ticket request: ${requestForm.title}`
        })
      ))
    }

    setRequestMsg('✓ Request submitted!')
    setRequestForm({ title: '', description: '', affected_person: '' })
    setShowRequestForm(false)
    fetchMyRequests()
    setLoading(false)
  }

  async function submitReview(ticketId) {
    if (!review.trim()) return
    setSubmittingReview(true)
    await supabase.from('tickets').update({ review }).eq('id', ticketId)
    const { data: ticket } = await supabase.from('tickets').select('assigned_to').eq('id', ticketId).single()
    if (ticket?.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: ticket.assigned_to, ticket_id: ticketId,
        message: `📝 New review received on ticket`
      })
    }
    setReview('')
    setSubmittingReview(false)
    fetchTickets()
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => ({ ...prev, review }))
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  if (selectedTicket) {
    return (
      <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
        <Navbar title="Ticket Details" />
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4">← Back</button>
          
          <div className="glass rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={selectedTicket.status} />
              <span className="text-slate-500 text-xs">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">{selectedTicket.title}</h2>
            {selectedTicket.description && <p className="text-slate-400">{selectedTicket.description}</p>}
            {selectedTicket.affected_person && <p className="text-slate-500 text-sm mt-2">👤 {selectedTicket.affected_person}</p>}
          </div>

          <div className="glass rounded-xl p-5 mb-5">
            <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {replies.length === 0 && <p className="text-slate-500 text-sm">No replies yet</p>}
              {replies.map(r => (
                <div key={r.id} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm font-medium">{r.profiles?.full_name || 'User'}</span>
                    <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.message && <p className="text-slate-300 text-sm">{r.message}</p>}
                  {r.image_url && <img src={r.image_url} alt="Reply" className="mt-2 rounded-lg max-w-sm" />}
                </div>
              ))}
            </div>
          </div>

          {selectedTicket.status === 'solved' && !selectedTicket.review && (
            <div className="glass rounded-xl p-5">
              <h3 className="text-white font-medium mb-3">Leave a Review</h3>
              <textarea
                value={review}
                onChange={e => setReview(e.target.value)}
                placeholder="How was your experience?"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none mb-3"
              />
              <button
                onClick={() => submitReview(selectedTicket.id)}
                disabled={submittingReview || !review.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
      <Navbar title="My Dashboard" />
      <div className="max-w-4xl mx-auto p-6">
        {/* Login Time Card */}
        <div className="glass rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Today's Attendance</p>
              {todayLogin ? (
                <div>
                  <p className="text-white text-lg font-medium">✓ Logged at {new Date(todayLogin.login_time).toLocaleTimeString()}</p>
                  <p className="text-slate-300 text-sm mt-1">
                    Sign Off: {todayLogin.logout_time ? new Date(todayLogin.logout_time).toLocaleTimeString() : 'Not signed off yet'}
                  </p>
                  {todayLogin.logout_time && (
                    <p className="text-green-400 text-xs mt-1">
                      Worked: {formatWorkDuration(todayLogin.login_time, todayLogin.logout_time)}
                    </p>
                  )}
                  {todayLogin.latitude && (
                    <p className="text-slate-400 text-xs mt-1">📍 Location: {todayLogin.latitude.toFixed(4)}, {todayLogin.longitude.toFixed(4)}</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">Not logged yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {!todayLogin && (
                <button
                  onClick={registerLogin}
                  disabled={loggingIn}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105"
                >
                  {loggingIn ? 'Logging...' : 'Register Login'}
                </button>
              )}
              {todayLogin && !todayLogin.logout_time && (
                <button
                  onClick={registerLogout}
                  disabled={loggingOut}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105"
                >
                  {loggingOut ? 'Signing Off...' : 'Sign Off'}
                </button>
              )}
            </div>
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="glass rounded-xl p-4 mb-6 space-y-2">
            <h3 className="text-white text-sm font-medium mb-2">🔔 Notifications ({notifications.length})</h3>
            {notifications.slice(0, 3).map(n => (
              <div key={n.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-start gap-3">
                <p className="text-slate-300 text-sm flex-1">{n.message}</p>
                <button onClick={() => markAsRead(n.id)} className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">Mark Read</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['tickets', 'requests', ...(profile?.can_view_attendance ? ['attendance'] : [])].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab===t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === 'tickets' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total', val: tickets.length, color: 'text-white', icon: '📊' },
                { label: 'Opened', val: tickets.filter(t=>t.status==='opened').length, color: 'text-blue-400', icon: '🔵' },
                { label: 'Pending', val: tickets.filter(t=>t.status==='pending').length, color: 'text-yellow-400', icon: '🟡' },
                { label: 'Solved', val: tickets.filter(t=>t.status==='solved').length, color: 'text-green-400', icon: '✅' },
              ].map((s, i) => (
                <div key={s.label} className="glass rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                    <span>{s.icon}</span>
                    {s.label}
                  </p>
                  <p className={`text-2xl font-semibold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {['all','opened','pending','solved'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter===f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'}`}>
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filtered.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No tickets</div>}
              {filtered.map(t => (
                <div key={t.id} className="glass rounded-xl p-4 cursor-pointer" onClick={() => setSelectedTicket(t)}>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={t.status} />
                    <span className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-white font-medium">{t.title}</h3>
                  {t.description && <p className="text-slate-400 text-sm mt-1">{t.description}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'requests' && (
          <>
            <div className="mb-4">
              <button
                onClick={() => setShowRequestForm(v => !v)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
              >
                + New Request
              </button>
            </div>

            {showRequestForm && (
              <form onSubmit={submitRequest} className="glass rounded-xl p-5 mb-4 space-y-4">
                {requestMsg && <div className={`${requestMsg.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'} text-sm rounded-lg p-3`}>{requestMsg}</div>}
                <input type="text" required placeholder="Title" value={requestForm.title} onChange={e => setRequestForm(f => ({...f,title:e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                <textarea required placeholder="Description" rows={3} value={requestForm.description} onChange={e => setRequestForm(f => ({...f,description:e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                <input type="text" placeholder="Affected Person (optional)" value={requestForm.affected_person} onChange={e => setRequestForm(f => ({...f,affected_person:e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button type="button" onClick={() => setShowRequestForm(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {myRequests.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No requests yet</div>}
              {myRequests.map(r => (
                <div key={r.id} className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.request_status === 'accepted' ? 'bg-green-900/30 text-green-400' :
                      r.request_status === 'refused' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {r.request_status?.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-white font-medium">{r.title}</h3>
                  {r.description && <p className="text-slate-400 text-sm mt-1">{r.description}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'attendance' && profile?.can_view_attendance && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-medium">Attendance Table</h2>
              <input
                type="date"
                value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Name', 'Email', 'Role', 'Login Time', 'Sign Off', 'Worked', 'Date'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500 py-8">
                        No attendance recorded for {new Date(attendanceDate).toLocaleDateString()}
                      </td>
                    </tr>
                  )}
                  {attendanceRecords.map(record => (
                    <tr key={record.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{record.full_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{record.email}</td>
                      <td className="px-4 py-3 text-slate-300 capitalize">{record.role}</td>
                      <td className="px-4 py-3 text-white font-mono">{new Date(record.login_time).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{record.logout_time ? new Date(record.logout_time).toLocaleTimeString() : 'Still working'}</td>
                      <td className="px-4 py-3 text-green-400 text-xs font-medium">{record.logout_time ? formatWorkDuration(record.login_time, record.logout_time) : 'In progress'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(record.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
