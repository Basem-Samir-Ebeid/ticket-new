import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import AttendanceButton from '../components/AttendanceButton'

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
  const [leaveRequests, setLeaveRequests] = useState([])
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [leaveMsg, setLeaveMsg] = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)

  const selectedTicketRef = useRef(null)
  useEffect(() => { selectedTicketRef.current = selectedTicket }, [selectedTicket])

  useEffect(() => {
    if (!user) return
    fetchTickets()
    fetchMyRequests()
    fetchNotifications()
    checkTodayLogin()
    fetchLeaveRequests()
  }, [user])

  useEffect(() => {
    const onTicketUpdate = () => { fetchTickets(); fetchMyRequests() }
    const onTicketReply = (e) => {
      if (selectedTicketRef.current?.id === e.detail?.ticket_id) fetchReplies(selectedTicketRef.current.id)
    }
    const onLeaveUpdate = () => fetchLeaveRequests()
    const onAttendanceUpdate = () => checkTodayLogin()
    const onNotification = () => fetchNotifications()
    window.addEventListener('ws:ticket_update', onTicketUpdate)
    window.addEventListener('ws:ticket_reply', onTicketReply)
    window.addEventListener('ws:leave_update', onLeaveUpdate)
    window.addEventListener('ws:attendance_update', onAttendanceUpdate)
    window.addEventListener('ws:notification', onNotification)
    return () => {
      window.removeEventListener('ws:ticket_update', onTicketUpdate)
      window.removeEventListener('ws:ticket_reply', onTicketReply)
      window.removeEventListener('ws:leave_update', onLeaveUpdate)
      window.removeEventListener('ws:attendance_update', onAttendanceUpdate)
      window.removeEventListener('ws:notification', onNotification)
    }
  }, [])

  useEffect(() => {
    if (selectedTicket) fetchReplies(selectedTicket.id)
  }, [selectedTicket])

  useEffect(() => {
    if (profile?.can_view_attendance) fetchAttendanceRecords()
  }, [profile?.can_view_attendance, attendanceDate])

  async function checkTodayLogin() {
    try { setTodayLogin(await api.getTodayAttendance()) } catch {}
  }

  async function registerLogin() {
    setLoggingIn(true)
    if (!navigator.geolocation) { alert('Geolocation not supported'); setLoggingIn(false); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { await api.registerLogin(pos.coords.latitude, pos.coords.longitude); await checkTodayLogin() } catch (e) { alert(e.message) }
      setLoggingIn(false)
    }, () => { alert('Location permission is required'); setLoggingIn(false) })
  }

  async function registerLogout() {
    if (!todayLogin || todayLogin.logout_time) return
    setLoggingOut(true)
    if (!navigator.geolocation) { alert('Geolocation not supported'); setLoggingOut(false); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { await api.registerLogout(pos.coords.latitude, pos.coords.longitude); await checkTodayLogin() } catch (e) { alert(e.message) }
      setLoggingOut(false)
    }, () => { alert('Location permission is required'); setLoggingOut(false) })
  }

  async function fetchAttendanceRecords() {
    try { setAttendanceRecords(await api.getAttendance(attendanceDate)) } catch { setAttendanceRecords([]) }
  }

  function formatWorkDuration(s, e) {
    if (!s || !e) return null
    const d = new Date(e) - new Date(s)
    return `${Math.floor(d/(1000*60*60))}h ${Math.floor((d%(1000*60*60))/(1000*60))}m`
  }

  async function fetchTickets() {
    try { setTickets(await api.getTickets()) } catch {}
  }
  async function fetchMyRequests() {
    try { setMyRequests(await api.getRequests()) } catch {}
  }
  async function fetchNotifications() {
    try { setNotifications(await api.getNotifications()) } catch {}
  }
  async function fetchLeaveRequests() {
    try { setLeaveRequests(await api.getLeaves()) } catch {}
  }
  async function fetchReplies(ticketId) {
    try { setReplies(await api.getReplies(ticketId)) } catch {}
  }

  async function submitLeaveRequest(e) {
    e.preventDefault(); setLeaveMsg('')
    if (!leaveForm.start_date || !leaveForm.end_date) { setLeaveMsg('Error: Please pick start and end dates'); return }
    if (leaveForm.end_date < leaveForm.start_date) { setLeaveMsg('Error: End date must be after start date'); return }
    setSubmittingLeave(true)
    try {
      await api.createLeave(leaveForm)
      setLeaveMsg('✓ Leave request submitted!')
      setLeaveForm({ start_date: '', end_date: '', reason: '' })
      setShowLeaveForm(false)
      fetchLeaveRequests()
    } catch (e) { setLeaveMsg('Error: ' + e.message) }
    setSubmittingLeave(false)
  }

  async function markAsRead(id) {
    try { await api.markRead(id); fetchNotifications() } catch {}
  }

  async function submitRequest(e) {
    e.preventDefault(); setLoading(true); setRequestMsg('')
    try {
      await api.createTicket({
        title: requestForm.title,
        description: requestForm.description,
        affected_person: requestForm.affected_person,
        is_request: true,
      })
      setRequestMsg('✓ Request submitted!')
      setRequestForm({ title: '', description: '', affected_person: '' })
      setShowRequestForm(false)
      fetchMyRequests()
    } catch (e) { setRequestMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function submitReview(ticketId) {
    if (!review.trim()) return
    setSubmittingReview(true)
    try {
      await api.updateTicket(ticketId, { review })
      setReview('')
      fetchTickets()
      if (selectedTicket?.id === ticketId) setSelectedTicket(p => ({...p, review}))
    } catch {}
    setSubmittingReview(false)
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  if (selectedTicket) {
    return (
      <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
        <Navbar title="Finest" />
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={()=>setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4">← Back</button>

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
              <textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="How was your experience?" rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none mb-3" />
              <button onClick={()=>submitReview(selectedTicket.id)} disabled={submittingReview||!review.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
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
      <Navbar title="Finest" />
      <div className="max-w-4xl mx-auto p-6">
        {/* Attendance */}
        <div className="glass rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-slate-400 text-sm mb-2 uppercase tracking-wider font-medium">Today's Attendance</p>
              {todayLogin ? (
                <div className="space-y-1">
                  <p className="text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                    Check-in: {new Date(todayLogin.login_time).toLocaleTimeString()}
                  </p>
                  <p className="text-slate-300 text-sm">
                    Check-out: {todayLogin.logout_time ? new Date(todayLogin.logout_time).toLocaleTimeString() : <span className="text-amber-400">Pending</span>}
                  </p>
                  {todayLogin.logout_time && <p className="text-green-400 text-xs font-medium">⏱ Worked: {formatWorkDuration(todayLogin.login_time, todayLogin.logout_time)}</p>}
                  {todayLogin.latitude && <p className="text-slate-500 text-xs">📍 {todayLogin.latitude.toFixed(4)}, {todayLogin.longitude.toFixed(4)}</p>}
                </div>
              ) : <p className="text-slate-500 text-sm">No check-in recorded today</p>}
            </div>
            <AttendanceButton
              todayLogin={todayLogin}
              loggingIn={loggingIn}
              loggingOut={loggingOut}
              onLogin={registerLogin}
              onLogout={registerLogout}
            />
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="glass rounded-xl p-4 mb-6 space-y-2">
            <h3 className="text-white text-sm font-medium mb-2">🔔 Notifications ({notifications.length})</h3>
            {notifications.slice(0, 3).map(n => (
              <div key={n.id} className="bg-white/5 rounded-lg p-3 flex justify-between items-start gap-3">
                <p className="text-slate-300 text-sm flex-1">{n.message}</p>
                <button onClick={()=>markAsRead(n.id)} className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">Mark Read</button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 border-b border-white/10 scrollbar-hide">
          {['tickets', 'requests', 'leave', ...(profile?.can_view_attendance ? ['attendance'] : [])].map(t => (
            <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize transition-all whitespace-nowrap flex-shrink-0 ${activeTab===t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>{t}</button>
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
              ].map(s => (
                <div key={s.label} className="glass rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-2"><span>{s.icon}</span>{s.label}</p>
                  <p className={`text-2xl font-semibold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {['all','opened','pending','solved'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter===f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'}`}>{f}</button>
              ))}
            </div>

            <div className="space-y-3">
              {filtered.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No tickets</div>}
              {filtered.map(t => (
                <div key={t.id} className="glass rounded-xl p-4 cursor-pointer" onClick={()=>setSelectedTicket(t)}>
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
              <button onClick={()=>setShowRequestForm(v=>!v)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">+ New Request</button>
            </div>

            {showRequestForm && (
              <form onSubmit={submitRequest} className="glass rounded-xl p-5 mb-4 space-y-4">
                {requestMsg && <div className={`${requestMsg.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'} text-sm rounded-lg p-3`}>{requestMsg}</div>}
                <input type="text" required placeholder="Title" value={requestForm.title} onChange={e=>setRequestForm(f=>({...f,title:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                <textarea required placeholder="Description" rows={3} value={requestForm.description} onChange={e=>setRequestForm(f=>({...f,description:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                <input type="text" placeholder="Affected Person (optional)" value={requestForm.affected_person} onChange={e=>setRequestForm(f=>({...f,affected_person:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{loading ? 'Submitting...' : 'Submit Request'}</button>
                  <button type="button" onClick={()=>setShowRequestForm(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {myRequests.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No requests yet</div>}
              {myRequests.map(r => (
                <div key={r.id} className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.request_status==='accepted' ? 'bg-green-900/30 text-green-400' : r.request_status==='refused' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
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

        {activeTab === 'leave' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button onClick={()=>{setShowLeaveForm(v=>!v);setLeaveMsg('')}} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">
                {showLeaveForm ? 'Close' : '+ Request Leave'}
              </button>
              <div className="text-xs text-slate-400 flex gap-3">
                <span>Pending: <span className="text-yellow-400 font-medium">{leaveRequests.filter(r=>r.status==='pending').length}</span></span>
                <span>Approved: <span className="text-green-400 font-medium">{leaveRequests.filter(r=>r.status==='approved').length}</span></span>
              </div>
            </div>

            {showLeaveForm && (
              <form onSubmit={submitLeaveRequest} className="glass rounded-xl p-5 mb-4 space-y-3">
                {leaveMsg && <div className={`${leaveMsg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'} text-sm rounded-lg p-3`}>{leaveMsg}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Start Date</label>
                    <input type="date" required value={leaveForm.start_date} onChange={e=>setLeaveForm(f=>({...f,start_date:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">End Date</label>
                    <input type="date" required value={leaveForm.end_date} onChange={e=>setLeaveForm(f=>({...f,end_date:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <textarea placeholder="Reason (optional)" rows={2} value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                <div className="flex gap-2">
                  <button type="submit" disabled={submittingLeave} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{submittingLeave ? 'Submitting...' : 'Submit'}</button>
                  <button type="button" onClick={()=>setShowLeaveForm(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {leaveRequests.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No leave requests yet</p>}
              {leaveRequests.map(r => (
                <div key={r.id} className={`bg-white/5 rounded-lg p-3 border ${r.status==='pending' ? 'border-yellow-500/20' : r.status==='approved' ? 'border-green-500/20' : 'border-red-500/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status==='approved' ? 'bg-green-900/30 text-green-400' : r.status==='rejected' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                      {r.status==='pending' ? '⏳ Pending' : r.status==='approved' ? '✅ Approved' : '❌ Rejected'}
                    </span>
                    <span className="text-slate-300 text-sm">{new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}</span>
                  </div>
                  {r.reason && <p className="text-slate-400 text-xs mt-1">{r.reason}</p>}
                  {r.admin_note && <p className="text-slate-300 text-xs mt-2 bg-white/5 rounded p-2"><span className="text-slate-500">Admin note: </span>{r.admin_note}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'attendance' && profile?.can_view_attendance && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium">Attendance Table</h2>
              <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Name','Email','Role','Login Time','Sign Off','Worked','Date'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No attendance recorded</td></tr>}
                  {attendanceRecords.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{r.full_name||'—'}</td>
                      <td className="px-4 py-3 text-slate-300">{r.email}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${r.role==='admin' ? 'bg-purple-900/30 text-purple-400' : r.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{r.role}</span></td>
                      <td className="px-4 py-3 text-white font-mono">{new Date(r.login_time).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : 'Still working'}</td>
                      <td className="px-4 py-3 text-green-400 text-xs">{r.logout_time ? formatWorkDuration(r.login_time, r.logout_time) : 'In progress'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
