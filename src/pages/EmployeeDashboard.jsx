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

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [replyImage, setReplyImage] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState('all')
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

  useEffect(() => { 
    if (user) {
      fetchTickets()
      checkTodayLogin()
      fetchLeaveRequests()

      const leaveChannel = supabase
        .channel('emp-leaves-' + user.id)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'leave_requests',
          filter: `user_id=eq.${user.id}`
        }, () => fetchLeaveRequests())
        .subscribe()

      return () => { supabase.removeChannel(leaveChannel) }
    }
  }, [user])

  useEffect(() => {
    if (profile?.can_view_attendance) {
      fetchAttendanceRecords()
    }
  }, [profile?.can_view_attendance, attendanceDate])

  useEffect(() => {
    if (selectedTicket) fetchReplies(selectedTicket.id)
  }, [selectedTicket])

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
      .from('tickets')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  async function fetchLeaveRequests() {
    const { data } = await supabase
      .from('leave_requests').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLeaveRequests(data || [])
  }

  async function submitLeaveRequest(e) {
    e.preventDefault()
    setLeaveMsg('')
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setLeaveMsg('Error: Please pick start and end dates'); return
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveMsg('Error: End date must be after start date'); return
    }
    setSubmittingLeave(true)
    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason || null,
      status: 'pending'
    })
    if (error) { setLeaveMsg('Error: ' + error.message); setSubmittingLeave(false); return }

    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins && admins.length > 0) {
      await Promise.all(admins.map(admin =>
        supabase.from('notifications').insert({
          user_id: admin.id,
          message: `🌴 New leave request from ${profile?.full_name || profile?.email || 'a user'} (${leaveForm.start_date} → ${leaveForm.end_date})`
        })
      ))
    }

    setLeaveMsg('✓ Leave request submitted!')
    setLeaveForm({ start_date: '', end_date: '', reason: '' })
    setShowLeaveForm(false)
    fetchLeaveRequests()
    setSubmittingLeave(false)
  }

  async function fetchReplies(ticketId) {
    const { data } = await supabase
      .from('ticket_replies')
      .select('*, profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    setReplies(data || [])
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!replyText.trim() && !replyImage) return

    setUploading(true)
    let imageUrl = null

    if (replyImage) {
      const fileName = `${user.id}_${Date.now()}_${replyImage.name}`
      const { data: uploadData } = await supabase.storage
        .from('ticket-images')
        .upload(fileName, replyImage)
      
      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('ticket-images')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }
    }

    await supabase.from('ticket_replies').insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      message: replyText,
      image_url: imageUrl
    })

    const { data: ticket } = await supabase
      .from('tickets')
      .select('created_by, title')
      .eq('id', selectedTicket.id)
      .single()
    
    if (ticket?.created_by) {
      await supabase.from('notifications').insert({
        user_id: ticket.created_by,
        message: `New reply on ticket: ${ticket.title}`,
        ticket_id: selectedTicket.id
      })
    }

    setReplyText('')
    setReplyImage(null)
    fetchReplies(selectedTicket.id)
    setUploading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('tickets').update({ status }).eq('id', id)
    fetchTickets()
    if (selectedTicket?.id === id) {
      setSelectedTicket(prev => ({ ...prev, status }))
    }
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  if (selectedTicket) {
    return (
      <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
        <Navbar title="Ticket Details" />
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">
            ← Back
          </button>

          <div className="glass rounded-xl p-5 mb-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="text-slate-500 text-xs">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                </div>
                <h2 className="text-white text-xl font-semibold">{selectedTicket.title}</h2>
                {selectedTicket.description && <p className="text-slate-400 mt-2">{selectedTicket.description}</p>}
                {selectedTicket.affected_person && <p className="text-slate-500 text-sm mt-2">👤 {selectedTicket.affected_person}</p>}
              </div>
              <select value={selectedTicket.status} onChange={e => updateStatus(selectedTicket.id, e.target.value)}
                className="bg-white/5 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="opened">Opened</option>
                <option value="pending">Pending</option>
                <option value="solved">Solved</option>
              </select>
            </div>
          </div>

          <div className="glass rounded-xl p-5 mb-5">
            <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
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

            <form onSubmit={submitReply} className="space-y-3">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex items-center gap-3">
                <label className="cursor-pointer bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
                  📎 {replyImage ? replyImage.name : 'Attach Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setReplyImage(e.target.files[0])} />
                </label>
                <button type="submit" disabled={uploading || (!replyText.trim() && !replyImage)}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                  {uploading ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
      <Navbar title="Assigned Tickets" />
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', val: tickets.length, color: 'text-white', icon: '📊' },
            { label: 'Opened', val: tickets.filter(t=>t.status==='opened').length, color: 'text-blue-400', icon: '🔵' },
            { label: 'Pending', val: tickets.filter(t=>t.status==='pending').length, color: 'text-yellow-400', icon: '🟡' },
            { label: 'Solved', val: tickets.filter(t=>t.status==='solved').length, color: 'text-green-400', icon: '✅' },
          ].map((s, i) => (
            <div key={s.label} className="glass rounded-xl p-4 hover-lift animate-fadeIn" style={{animationDelay: `${i * 0.1}s`}}>
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
          {filtered.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No tickets assigned</div>}
          {filtered.map((t, i) => (
            <div key={t.id} className="glass rounded-xl p-4 hover:border-white/15 transition-all cursor-pointer" onClick={() => setSelectedTicket(t)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={t.status} />
                    <span className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-white font-medium">{t.title}</h3>
                  {t.description && <p className="text-slate-400 text-sm mt-1">{t.description}</p>}
                  {t.affected_person && <p className="text-slate-500 text-xs mt-2">👤 {t.affected_person}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-medium">🌴 Leave Requests</h2>
            <button
              onClick={() => { setShowLeaveForm(v => !v); setLeaveMsg('') }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
            >
              {showLeaveForm ? 'Close' : '+ Request Leave'}
            </button>
          </div>

          {showLeaveForm && (
            <form onSubmit={submitLeaveRequest} className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
              {leaveMsg && <div className={`${leaveMsg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'} text-sm rounded-lg p-3`}>{leaveMsg}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Start Date</label>
                  <input type="date" required value={leaveForm.start_date}
                    onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">End Date</label>
                  <input type="date" required value={leaveForm.end_date}
                    onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <textarea placeholder="Reason (optional)" rows={2} value={leaveForm.reason}
                onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <div className="flex gap-2">
                <button type="submit" disabled={submittingLeave}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                  {submittingLeave ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowLeaveForm(false)}
                  className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {leaveRequests.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No leave requests yet</p>
            )}
            {leaveRequests.map(r => (
              <div key={r.id} className={`bg-white/5 rounded-lg p-3 border ${
                r.status === 'pending' ? 'border-yellow-500/20' :
                r.status === 'approved' ? 'border-green-500/20' :
                'border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                    r.status === 'rejected' ? 'bg-red-900/30 text-red-400' :
                    'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {r.status === 'pending' ? '⏳ Pending' : r.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                  </span>
                  <span className="text-slate-300 text-sm">
                    {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                  </span>
                </div>
                {r.reason && <p className="text-slate-400 text-xs mt-1">{r.reason}</p>}
                {r.admin_note && (
                  <p className="text-slate-300 text-xs mt-2 bg-white/5 rounded p-2">
                    <span className="text-slate-500">Admin note: </span>{r.admin_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {profile?.can_view_attendance && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
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
