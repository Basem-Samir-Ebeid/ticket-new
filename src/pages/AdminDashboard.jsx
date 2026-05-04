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

export default function AdminDashboard({ isSuperAdmin = false }) {
  const { user } = useAuth()
  const btnPrimary = isSuperAdmin ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
  const tabActiveCls = isSuperAdmin ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
  const bgGrad = isSuperAdmin
    ? 'radial-gradient(ellipse at 70% 0%, #2a1500 0%, #0a0a0f 55%)'
    : 'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'
  const focusBorder = isSuperAdmin ? 'focus:border-amber-500' : 'focus:border-blue-500'
  const [tab, setTab] = useState('dashboard')
  const [tickets, setTickets] = useState([])
  const [users, setUsers] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false, profile_picture_url: '' })
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState([])
  const [acceptingRequest, setAcceptingRequest] = useState(null)
  const [assignTo, setAssignTo] = useState('')
  const [loginTimes, setLoginTimes] = useState([])
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [todayLogin, setTodayLogin] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [resettingUserId, setResettingUserId] = useState(null)
  const [visiblePasswords, setVisiblePasswords] = useState({})
  const [leaveRequests, setLeaveRequests] = useState([])
  const [rejectingLeaveId, setRejectingLeaveId] = useState(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [processingLeaveId, setProcessingLeaveId] = useState(null)
  const [resetPwdTarget, setResetPwdTarget] = useState(null)
  const [resetPwdValue, setResetPwdValue] = useState('')
  const [resetPwdShow, setResetPwdShow] = useState(false)
  const [resetPwdError, setResetPwdError] = useState('')
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [uploadingPic, setUploadingPic] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [officeForm, setOfficeForm] = useState({ latitude: '', longitude: '', radius_meters: '' })
  const [officeMsg, setOfficeMsg] = useState('')
  const [savingOffice, setSavingOffice] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [settingsLog, setSettingsLog] = useState([])
  const [loadingLog, setLoadingLog] = useState(false)

  const selectedTicketRef = useRef(null)
  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedTicketRef.current = selectedTicket }, [selectedTicket])
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  useEffect(() => {
    fetchTickets()
    fetchUsers()
    fetchRequests()
    fetchLoginTimes()
    checkTodayLogin()
    fetchLeaveRequests()
  }, [])

  useEffect(() => {
    const onTicketUpdate = () => { fetchTickets(); fetchRequests() }
    const onTicketReply = (e) => {
      if (selectedTicketRef.current?.id === e.detail?.ticket_id) fetchReplies(selectedTicketRef.current.id)
    }
    const onLeaveUpdate = () => fetchLeaveRequests()
    const onAttendanceUpdate = async () => {
      checkTodayLogin()
      try { setLoginTimes(await api.getAttendance(selectedDateRef.current)) } catch {}
    }
    const onNotification = () => {}
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

  useEffect(() => { if (selectedTicket) fetchReplies(selectedTicket.id) }, [selectedTicket])
  useEffect(() => { if (selectedDate) fetchLoginTimes() }, [selectedDate])

  async function fetchOfficeSettings() {
    setLoadingSettings(true)
    try {
      const data = await api.getOfficeLocation()
      setOfficeForm({ latitude: String(data.latitude), longitude: String(data.longitude), radius_meters: String(data.radius_meters) })
    } catch {}
    setLoadingSettings(false)
  }

  async function fetchSettingsLog() {
    setLoadingLog(true)
    try { setSettingsLog(await api.getSettingsLog()) } catch {}
    setLoadingLog(false)
  }

  async function handleSaveOffice(e) {
    e.preventDefault()
    setSavingOffice(true)
    setOfficeMsg('')
    try {
      await api.saveOfficeLocation({
        latitude: parseFloat(officeForm.latitude),
        longitude: parseFloat(officeForm.longitude),
        radius_meters: parseFloat(officeForm.radius_meters),
      })
      setOfficeMsg('Office location saved successfully.')
      fetchSettingsLog()
    } catch (err) {
      setOfficeMsg('Error: ' + err.message)
    }
    setSavingOffice(false)
  }

  async function fetchTickets() {
    try { setTickets(await api.getTickets()) } catch {}
  }
  async function fetchUsers() {
    try { setUsers(await api.getUsers()) } catch {}
  }
  async function fetchReplies(ticketId) {
    try { setReplies(await api.getReplies(ticketId)) } catch {}
  }
  async function fetchRequests() {
    try { setRequests(await api.getRequests()) } catch {}
  }
  async function fetchLeaveRequests() {
    try { setLeaveRequests(await api.getLeaves()) } catch {}
  }
  async function fetchLoginTimes() {
    try { setLoginTimes(await api.getAttendance(selectedDate)) } catch (e) {
      setMsg('Error: ' + e.message); setLoginTimes([])
    }
  }
  async function checkTodayLogin() {
    try { setTodayLogin(await api.getTodayAttendance()) } catch {}
  }

  async function approveLeaveRequest(req) {
    setProcessingLeaveId(req.id)
    try {
      await api.approveLeave(req.id)
      setMsg('✓ Leave approved')
      fetchLeaveRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
    setProcessingLeaveId(null)
  }

  async function rejectLeaveRequest(req) {
    setProcessingLeaveId(req.id)
    try {
      await api.rejectLeave(req.id, rejectionNote.trim() || null)
      setMsg('✓ Leave rejected')
      setRejectingLeaveId(null)
      setRejectionNote('')
      fetchLeaveRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
    setProcessingLeaveId(null)
  }

  async function deleteLeaveRequest(id) {
    if (!window.confirm('Delete this leave request?')) return
    try {
      await api.deleteLeave(id)
      setMsg('✓ Leave request deleted')
      fetchLeaveRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
  }

  async function registerLogin() {
    setLoggingIn(true)
    if (!navigator.geolocation) { alert('Geolocation not supported'); setLoggingIn(false); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api.registerLogin(pos.coords.latitude, pos.coords.longitude)
        await checkTodayLogin()
        if (selectedDate === getLocalDateString()) await fetchLoginTimes()
      } catch (e) { alert(e.message) }
      setLoggingIn(false)
    }, () => { alert('Location permission is required'); setLoggingIn(false) })
  }

  async function registerLogout() {
    if (!todayLogin || todayLogin.logout_time) return
    setLoggingOut(true)
    if (!navigator.geolocation) { alert('Geolocation not supported'); setLoggingOut(false); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api.registerLogout(pos.coords.latitude, pos.coords.longitude)
        await checkTodayLogin()
        if (selectedDate === getLocalDateString()) await fetchLoginTimes()
      } catch (e) { alert(e.message) }
      setLoggingOut(false)
    }, () => { alert('Location permission is required'); setLoggingOut(false) })
  }

  async function acceptRequest(request) {
    if (!assignTo) return
    setLoading(true)
    try {
      await api.acceptRequest(request.id, assignTo)
      setAcceptingRequest(null); setAssignTo('')
      fetchRequests(); fetchTickets()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function refuseRequest(request) {
    if (!confirm('Refuse this request?')) return
    setLoading(true)
    try {
      await api.refuseRequest(request.id)
      fetchRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function updateUser(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    try {
      let profile_picture_url = userForm.profile_picture_url
      if (profilePicFile) {
        setUploadingPic(true)
        try { profile_picture_url = await api.uploadFile(profilePicFile) } catch {}
        setUploadingPic(false)
      }
      await api.updateUser(editingUser.id, {
        full_name: userForm.full_name,
        role: userForm.role,
        can_view_attendance: userForm.can_view_attendance,
        profile_picture_url,
      })
      setMsg('✓ User updated!'); setEditingUser(null); setProfilePicFile(null); fetchUsers()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function deleteUser(userId) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setLoading(true)
    try {
      await api.deleteUser(userId)
      setMsg('✓ User deleted!'); fetchUsers()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function createUser(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    try {
      let profile_picture_url = null
      if (profilePicFile) {
        setUploadingPic(true)
        try { profile_picture_url = await api.uploadFile(profilePicFile) } catch {}
        setUploadingPic(false)
      }
      await api.createUser({ ...userForm, profile_picture_url })
      setMsg('✓ User created!')
      setUserForm({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false })
      setProfilePicFile(null)
      setShowCreateUser(false)
      fetchUsers()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  function openResetPwd(targetUser) {
    setResetPwdTarget(targetUser)
    setResetPwdValue('')
    setResetPwdError('')
    setResetPwdShow(false)
  }

  async function submitResetPwd(e) {
    e.preventDefault()
    if (resetPwdValue.length < 6) { setResetPwdError('Password must be at least 6 characters'); return }
    setResettingUserId(resetPwdTarget.id); setResetPwdError('')
    try {
      await api.resetPassword(resetPwdTarget.id, resetPwdValue)
      setMsg(`✓ Password reset for ${resetPwdTarget.email}`)
      setResetPwdTarget(null)
    } catch (e) { setResetPwdError(e.message) }
    setResettingUserId(null)
  }

  async function createTicket(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    try {
      await api.createTicket({
        title: ticketForm.title,
        description: ticketForm.description,
        affected_person: ticketForm.affected_person,
        assigned_to: ticketForm.assigned_to || null,
        status: ticketForm.status,
      })
      setMsg('✓ Ticket created!')
      setTicketForm({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened' })
      setShowCreateTicket(false)
      fetchTickets()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function updateStatus(id, newStatus) {
    try {
      await api.updateTicket(id, { status: newStatus })
      fetchTickets()
    } catch {}
  }

  async function deleteTicket(id) {
    if (!confirm('Delete this ticket? This cannot be undone.')) return
    setLoading(true)
    try {
      await api.deleteTicket(id)
      setMsg('✓ Ticket deleted!'); fetchTickets()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this request? This cannot be undone.')) return
    setLoading(true)
    try {
      await api.deleteTicket(id)
      if (acceptingRequest?.id === id) { setAcceptingRequest(null); setAssignTo('') }
      setMsg('✓ Request deleted!'); fetchRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function deleteAttendance(id) {
    if (!confirm('Delete this attendance record?')) return
    setLoading(true)
    try {
      await api.deleteAttendance(id)
      setMsg('✓ Attendance record deleted!'); fetchLoginTimes()
    } catch (e) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }

  function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    const diff = new Date(endTime) - new Date(startTime)
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  function calculateDurationHours(startTime, endTime) {
    if (!startTime || !endTime) return null
    return (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60)
  }

  function calculateMemberPerformance() {
    const members = users.filter(u => u.role === 'member')
    const memberStats = members.map(member => {
      const memberTickets = tickets.filter(t => t.assigned_to === member.id)
      const solvedTickets = memberTickets.filter(t => t.status === 'solved' && t.solved_at)
      const totalTickets = memberTickets.length
      const openTickets = memberTickets.filter(t => t.status === 'opened').length
      const pendingTickets = memberTickets.filter(t => t.status === 'pending').length
      const completionRate = totalTickets > 0 ? (solvedTickets.length / totalTickets) * 100 : 0
      const resolutionTimes = solvedTickets.map(t => calculateDurationHours(t.created_at, t.solved_at)).filter(Boolean)
      const avgResolutionTime = resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0
      const responseTimes = memberTickets.filter(t => t.pending_at).map(t => calculateDurationHours(t.created_at, t.pending_at)).filter(Boolean)
      const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0
      const volume = solvedTickets.length
      const currentLoad = openTickets + pendingTickets
      const speedScore = avgResolutionTime > 0 ? Math.min(100, 100 * Math.exp(-avgResolutionTime / 24)) : 0
      const completionScore = completionRate
      const responseScore = avgResponseTime > 0 ? Math.min(100, 100 * Math.exp(-avgResponseTime / 6)) : 0
      const workloadPenalty = Math.min(20, currentLoad * 2)
      return { member, totalTickets, solvedTickets: volume, openTickets, pendingTickets, completionRate, avgResolutionTime, avgResponseTime, speedScore, completionScore, volumeRaw: volume, responseScore, workloadPenalty, currentLoad }
    })
    const maxVolume = Math.max(...memberStats.map(s => s.volumeRaw), 1)
    memberStats.forEach(stat => {
      stat.volumeScore = (stat.volumeRaw / maxVolume) * 100
      stat.finalScore = Math.max(0, Math.min(100, (stat.speedScore * 0.35) + (stat.completionScore * 0.30) + (stat.volumeScore * 0.20) + (stat.responseScore * 0.15) - stat.workloadPenalty))
    })
    return memberStats.sort((a, b) => b.finalScore - a.finalScore)
  }

  const memberPerformance = calculateMemberPerformance()

  function getRankMedal(index) {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  function getPerformanceGrade(score) {
    if (score >= 90) return { grade: 'A+', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 80) return { grade: 'A', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 70) return { grade: 'B+', color: 'text-blue-400', bg: 'bg-blue-900/30' }
    if (score >= 60) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-900/30' }
    if (score >= 50) return { grade: 'C', color: 'text-yellow-400', bg: 'bg-yellow-900/30' }
    return { grade: 'D', color: 'text-red-400', bg: 'bg-red-900/30' }
  }

  function formatTime(hours) {
    if (!hours || hours === 0) return '—'
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    const days = Math.floor(hours / 24)
    return `${days}d ${Math.round(hours % 24)}h`
  }

  const employeeCount = users.filter(u => u.role === 'employee').length
  const memberCount = users.filter(u => u.role === 'member').length
  const openedTickets = tickets.filter(t => t.status === 'opened').length
  const pendingTickets = tickets.filter(t => t.status === 'pending').length
  const solvedTickets = tickets.filter(t => t.status === 'solved').length

  // ── Ticket detail view ──
  if (selectedTicket) {
    return (
      <div className="min-h-screen" style={{background: bgGrad}}>
        <Navbar title={isSuperAdmin ? '👑 Ticket Details' : 'Ticket Details'} />
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>

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
                <p className="text-slate-500 text-xs mt-2">Assigned to: <span className="text-slate-300">{selectedTicket.assigned_to_profile?.full_name || 'Unassigned'}</span></p>
              </div>
              <select value={selectedTicket.status} onChange={e => { updateStatus(selectedTicket.id, e.target.value); setSelectedTicket(p => ({...p, status: e.target.value})) }}
                className="bg-white/5 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="opened">Opened</option>
                <option value="pending">Pending</option>
                <option value="solved">Solved</option>
              </select>
            </div>
          </div>

          <div className="glass rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
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
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background: bgGrad}}>
      <Navbar title={isSuperAdmin ? '👑 Super Admin Panel' : 'Admin Panel'} />

      <div className="max-w-7xl mx-auto p-6">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg animate-fadeIn ${msg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto pb-2">
          {['dashboard', 'tickets', 'requests', 'leave', 'users', 'attendance', 'performance', 'settings'].map(t => (
            <button key={t} onClick={() => {
              setTab(t); setSelectedTicket(null)
              if (t === 'settings') { fetchOfficeSettings(); fetchSettingsLog() }
            }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${tab === t ? tabActiveCls : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {t === 'performance' ? '⭐ Performance'
                : t === 'requests' ? `📋 Requests${requests.filter(r=>r.request_status==='pending_review').length > 0 ? ` (${requests.filter(r=>r.request_status==='pending_review').length})` : ''}`
                : t === 'leave' ? `🌴 Leave${leaveRequests.filter(r=>r.status==='pending').length > 0 ? ` (${leaveRequests.filter(r=>r.status==='pending').length})` : ''}`
                : t === 'settings' ? '⚙️ Settings'
                : t}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="glass rounded-xl p-5 animate-fadeIn">
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
                      {todayLogin.logout_time && <p className="text-green-400 text-xs font-medium">⏱ Worked: {calculateDuration(todayLogin.login_time, todayLogin.logout_time)}</p>}
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

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Tickets', val: tickets.length, color: 'text-white', icon: '📊', bg: 'bg-gradient-to-br from-blue-600/20 to-blue-900/20' },
                { label: 'Opened', val: openedTickets, color: 'text-blue-400', icon: '🔵', bg: 'bg-gradient-to-br from-blue-500/20 to-blue-700/20' },
                { label: 'Pending', val: pendingTickets, color: 'text-yellow-400', icon: '🟡', bg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-700/20' },
                { label: 'Solved', val: solvedTickets, color: 'text-green-400', icon: '✅', bg: 'bg-gradient-to-br from-green-500/20 to-green-700/20' },
                { label: 'Total Users', val: users.length, color: 'text-purple-400', icon: '👥', bg: 'bg-gradient-to-br from-purple-500/20 to-purple-700/20' },
              ].map((s, i) => (
                <div key={s.label} className={`${s.bg} glass rounded-xl p-5 hover-lift animate-fadeIn`} style={{animationDelay:`${i*0.1}s`}}>
                  <p className="text-xs text-slate-400 mb-2 flex items-center gap-2 uppercase tracking-wider"><span className="text-lg">{s.icon}</span>{s.label}</p>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-5">
                <h3 className="text-white font-medium mb-4">👥 User Breakdown</h3>
                <div className="space-y-3">
                  {[['Members', memberCount], ['Employees', employeeCount], ['Admins', users.filter(u=>u.role==='admin').length]].map(([l,v]) => (
                    <div key={l} className="flex justify-between"><span className="text-slate-400 text-sm">{l}</span><span className="text-white font-medium">{v}</span></div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-xl p-5">
                <h3 className="text-white font-medium mb-4">📈 Ticket Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Resolution Rate</span><span className="text-green-400 font-medium">{tickets.length > 0 ? ((solvedTickets/tickets.length)*100).toFixed(1) : 0}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Active Tickets</span><span className="text-yellow-400 font-medium">{openedTickets + pendingTickets}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Avg per User</span><span className="text-white font-medium">{users.length > 0 ? (tickets.length/users.length).toFixed(1) : 0}</span></div>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-white font-medium mb-4">🕐 Recent Tickets</h3>
              <div className="space-y-2">
                {tickets.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors" style={{animationDelay:`${i*0.1}s`}}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <StatusBadge status={t.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{t.title}</p>
                        <p className="text-slate-400 text-xs">Assigned to {t.assigned_to_profile?.full_name || 'Unassigned'}</p>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs ml-3">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {tab === 'tickets' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-medium">All Tickets</h2>
              <button onClick={() => setShowCreateTicket(v=>!v)} className={`${btnPrimary} text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105`}>+ New Ticket</button>
            </div>

            {showCreateTicket && (
              <form onSubmit={createTicket} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Title</label>
                    <input required value={ticketForm.title} onChange={e=>setTicketForm(f=>({...f,title:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Issue title" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Affected Person</label>
                    <input value={ticketForm.affected_person} onChange={e=>setTicketForm(f=>({...f,affected_person:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Person with issue" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Assign To</label>
                    <select value={ticketForm.assigned_to} onChange={e=>setTicketForm(f=>({...f,assigned_to:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name||u.email} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                    <select value={ticketForm.status} onChange={e=>setTicketForm(f=>({...f,status:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="opened">Opened</option>
                      <option value="pending">Pending</option>
                      <option value="solved">Solved</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Description</label>
                  <textarea rows={3} value={ticketForm.description} onChange={e=>setTicketForm(f=>({...f,description:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" placeholder="Describe the issue..." />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className={`${btnPrimary} disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg`}>{loading ? 'Creating...' : 'Create Ticket'}</button>
                  <button type="button" onClick={()=>setShowCreateTicket(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {tickets.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No tickets yet</div>}
              {tickets.map((t, i) => (
                <div key={t.id} className="glass rounded-xl p-4 hover:border-white/15 transition-all animate-fadeIn" style={{animationDelay:`${i*0.05}s`}}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 cursor-pointer" onClick={()=>setSelectedTicket(t)}>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={t.status} />
                        <span className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-white font-medium">{t.title}</h3>
                      {t.description && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{t.description}</p>}
                      {t.affected_person && <p className="text-slate-500 text-xs mt-1">👤 {t.affected_person}</p>}
                      <p className="text-slate-500 text-xs mt-1">Assigned to: <span className="text-slate-300">{t.assigned_to_profile?.full_name || 'Unassigned'}</span></p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select value={t.status} onChange={e=>updateStatus(t.id, e.target.value)} className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none">
                        <option value="opened">Opened</option>
                        <option value="pending">Pending</option>
                        <option value="solved">Solved</option>
                      </select>
                      <button onClick={()=>deleteTicket(t.id)} disabled={loading} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-2 py-1">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {tab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-medium">Ticket Requests from Members</h2>
              <div className="flex gap-3 text-xs text-slate-400">
                <span>Pending: <span className="text-yellow-400 font-medium">{requests.filter(r=>r.request_status==='pending_review').length}</span></span>
                <span>Accepted: <span className="text-green-400 font-medium">{requests.filter(r=>r.request_status==='accepted').length}</span></span>
                <span>Refused: <span className="text-red-400 font-medium">{requests.filter(r=>r.request_status==='refused').length}</span></span>
              </div>
            </div>

            {requests.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No requests yet</div>}

            {requests.map((r, i) => (
              <div key={r.id} className={`glass rounded-xl p-5 animate-fadeIn hover-lift border ${r.request_status==='pending_review' ? 'border-yellow-500/20' : r.request_status==='accepted' ? 'border-green-500/20' : 'border-red-500/20'}`} style={{animationDelay:`${i*0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.request_status==='pending_review' ? 'bg-yellow-900/30 text-yellow-400' : r.request_status==='accepted' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {r.request_status==='pending_review' ? '⏳ Pending' : r.request_status==='accepted' ? '✅ Accepted' : '❌ Refused'}
                      </span>
                      <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-white font-medium">{r.title}</h3>
                    {r.description && <p className="text-slate-400 text-sm mt-1">{r.description}</p>}
                    {r.affected_person && <p className="text-slate-500 text-xs mt-1">👤 {r.affected_person}</p>}
                    <p className="text-slate-500 text-xs mt-2">Requested by: <span className="text-slate-300">{r.created_by_profile?.full_name || r.created_by_profile?.email || 'Unknown'}</span></p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-fit">
                    {r.request_status === 'pending_review' && (
                      <>
                        <button onClick={()=>{setAcceptingRequest(r);setAssignTo('')}} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg">Accept</button>
                        <button onClick={()=>refuseRequest(r)} disabled={loading} className="bg-red-900/40 hover:bg-red-800/60 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20">Refuse</button>
                      </>
                    )}
                    <button onClick={()=>deleteRequest(r.id)} disabled={loading} className="bg-red-950/40 hover:bg-red-900/60 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 disabled:opacity-50">Delete</button>
                  </div>
                </div>

                {acceptingRequest?.id === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-scaleIn">
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Assign to</label>
                    <div className="flex gap-2">
                      <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-green-500">
                        <option value="">— Select a member —</option>
                        {users.filter(u=>u.role!=='admin').map(u => <option key={u.id} value={u.id}>{u.full_name||u.email} ({u.role})</option>)}
                      </select>
                      <button onClick={()=>acceptRequest(r)} disabled={!assignTo||loading} className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg">{loading ? 'Saving...' : 'Confirm'}</button>
                      <button onClick={()=>setAcceptingRequest(null)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-3 py-2 rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Leave Tab */}
        {tab === 'leave' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-medium">Leave Requests</h2>
              <div className="flex gap-3 text-xs text-slate-400">
                <span>Pending: <span className="text-yellow-400 font-medium">{leaveRequests.filter(r=>r.status==='pending').length}</span></span>
                <span>Approved: <span className="text-green-400 font-medium">{leaveRequests.filter(r=>r.status==='approved').length}</span></span>
                <span>Rejected: <span className="text-red-400 font-medium">{leaveRequests.filter(r=>r.status==='rejected').length}</span></span>
              </div>
            </div>

            {leaveRequests.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">No leave requests yet</div>}

            {leaveRequests.map((r, i) => (
              <div key={r.id} className={`glass rounded-xl p-5 animate-fadeIn hover-lift border ${r.status==='pending' ? 'border-yellow-500/20' : r.status==='approved' ? 'border-green-500/20' : 'border-red-500/20'}`} style={{animationDelay:`${i*0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.status==='pending' ? 'bg-yellow-900/30 text-yellow-400' : r.status==='approved' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {r.status==='pending' ? '⏳ Pending' : r.status==='approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                      <span className="text-slate-500 text-xs">Submitted {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-white font-medium">{new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}</h3>
                    {r.reason && <p className="text-slate-400 text-sm mt-1">{r.reason}</p>}
                    <p className="text-slate-500 text-xs mt-2">Requested by: <span className="text-slate-300">{r.user?.full_name || r.user?.email || 'Unknown'}</span>{r.user?.role && <span className="text-slate-500 ml-1">({r.user.role})</span>}</p>
                    {r.admin_note && <p className="text-slate-300 text-xs mt-2 bg-white/5 rounded-lg p-2"><span className="text-slate-500">Admin note: </span>{r.admin_note}</p>}
                  </div>
                  <div className="flex flex-col gap-2 min-w-fit">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={()=>approveLeaveRequest(r)} disabled={processingLeaveId===r.id} className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg">{processingLeaveId===r.id ? '...' : 'Approve'}</button>
                        <button onClick={()=>{setRejectingLeaveId(r.id);setRejectionNote('')}} disabled={processingLeaveId===r.id} className="bg-red-900/40 hover:bg-red-800/60 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20">Reject</button>
                      </>
                    )}
                    <button onClick={()=>deleteLeaveRequest(r.id)} className="bg-red-950/40 hover:bg-red-900/60 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20">Delete</button>
                  </div>
                </div>

                {rejectingLeaveId === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-scaleIn">
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Reason (optional)</label>
                    <div className="flex gap-2">
                      <input type="text" value={rejectionNote} onChange={e=>setRejectionNote(e.target.value)} placeholder="Why is this rejected?" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-red-500" />
                      <button onClick={()=>rejectLeaveRequest(r)} disabled={processingLeaveId===r.id} className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg">{processingLeaveId===r.id ? 'Saving...' : 'Confirm Reject'}</button>
                      <button onClick={()=>{setRejectingLeaveId(null);setRejectionNote('')}} className="text-slate-400 hover:text-white border border-white/10 text-sm px-3 py-2 rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="text-white font-medium">Users ({users.length})</h2>
              <div className="flex gap-3 flex-1 justify-end">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email or role..."
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 w-56 placeholder-slate-500"
                />
                <button onClick={()=>setShowCreateUser(v=>!v)} className={`${btnPrimary} text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105 whitespace-nowrap`}>+ New User</button>
              </div>
            </div>

            {showCreateUser && (
              <form onSubmit={createUser} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                    <input required type="email" value={userForm.email} onChange={e=>setUserForm(f=>({...f,email:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="user@company.com" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Password</label>
                    <input required type="password" value={userForm.password} onChange={e=>setUserForm(f=>({...f,password:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="••••••••" autoComplete="new-password" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Full Name</label>
                    <input value={userForm.full_name} onChange={e=>setUserForm(f=>({...f,full_name:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Role</label>
                    <select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="member">Member</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">👑 Super Admin</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={userForm.can_view_attendance} onChange={e=>setUserForm(f=>({...f,can_view_attendance:e.target.checked}))} className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">Can view attendance</span>
                </label>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Profile Picture</label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/8 transition-colors">
                    <span className="text-slate-400 text-sm">📷 {profilePicFile ? profilePicFile.name : 'Choose from device...'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e=>setProfilePicFile(e.target.files[0])} />
                  </label>
                  {profilePicFile && <p className="text-xs text-green-400 mt-1">✓ {profilePicFile.name} selected</p>}
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading || uploadingPic} className={`${btnPrimary} disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg`}>{uploadingPic ? 'Uploading...' : loading ? 'Creating...' : 'Create User'}</button>
                  <button type="button" onClick={()=>{setShowCreateUser(false);setProfilePicFile(null)}} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            {editingUser && (
              <form onSubmit={updateUser} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn border border-blue-500/30">
                <h3 className="text-white font-medium">Edit: {editingUser.email}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Full Name</label>
                    <input value={userForm.full_name} onChange={e=>setUserForm(f=>({...f,full_name:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Role</label>
                    <select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="member">Member</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">👑 Super Admin</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={userForm.can_view_attendance} onChange={e=>setUserForm(f=>({...f,can_view_attendance:e.target.checked}))} className="w-4 h-4 rounded" />
                  <span className="text-slate-300 text-sm">Can view attendance</span>
                </label>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Profile Picture</label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:bg-white/8 transition-colors">
                    <span className="text-slate-400 text-sm">📷 {profilePicFile ? profilePicFile.name : 'Choose from device...'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e=>setProfilePicFile(e.target.files[0])} />
                  </label>
                  {profilePicFile && <p className="text-xs text-green-400 mt-1">✓ {profilePicFile.name} selected</p>}
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading || uploadingPic} className={`${btnPrimary} disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg`}>{uploadingPic ? 'Uploading...' : loading ? 'Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={()=>{setEditingUser(null);setProfilePicFile(null)}} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Name', 'Email', 'Role', ...(isSuperAdmin ? ['Password', 'Status'] : ['Attendance']), 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && <tr><td colSpan={isSuperAdmin ? 6 : 5} className="text-center text-slate-500 py-8">No users yet</td></tr>}
                  {users.filter(u => {
                    const q = userSearch.toLowerCase()
                    return !q || (u.full_name||'').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
                  }).map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{u.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${u.role==='super_admin' ? 'bg-amber-900/30 text-amber-400' : u.role==='admin' ? 'bg-purple-900/30 text-purple-400' : u.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{u.role==='super_admin' ? '👑 Super Admin' : u.role}</span>
                      </td>
                      {isSuperAdmin ? (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {u.plain_password ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-200 bg-white/5 px-2 py-1 rounded">
                                  {visiblePasswords[u.id] ? u.plain_password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => setVisiblePasswords(v => ({ ...v, [u.id]: !v[u.id] }))}
                                  className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                                  title={visiblePasswords[u.id] ? 'Hide' : 'Show'}
                                >
                                  {visiblePasswords[u.id]
                                    ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  }
                                </button>
                              </div>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {u.must_change_password
                              ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400">لم يغير الباسورد</span>
                              : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">✓ نشط</span>
                            }
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-slate-400 text-xs">{u.can_view_attendance ? '✓ Yes' : '—'}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>{setEditingUser(u);setUserForm({full_name:u.full_name||'',role:u.role,can_view_attendance:u.can_view_attendance,email:'',password:''})}} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                          <button onClick={()=>openResetPwd(u)} disabled={resettingUserId===u.id} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">{resettingUserId===u.id ? '...' : 'Reset Pwd'}</button>
                          <button onClick={()=>deleteUser(u.id)} disabled={loading} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-medium">Attendance</h2>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Name','Email','Role','Login Time','Sign Off','Worked','Date','Actions'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loginTimes.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">No attendance recorded for {new Date(selectedDate).toLocaleDateString()}</td></tr>}
                  {loginTimes.map(lt => (
                    <tr key={lt.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{lt.full_name||'—'}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{lt.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${lt.role==='super_admin' ? 'bg-amber-900/30 text-amber-400' : lt.role==='admin' ? 'bg-purple-900/30 text-purple-400' : lt.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{lt.role==='super_admin' ? '👑 Super Admin' : lt.role}</span>
                      </td>
                      <td className="px-4 py-3 text-white font-mono whitespace-nowrap">{new Date(lt.login_time).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{lt.logout_time ? new Date(lt.logout_time).toLocaleTimeString() : 'Still working'}</td>
                      <td className="px-4 py-3 text-green-400 text-xs font-medium whitespace-nowrap">{lt.logout_time ? calculateDuration(lt.login_time, lt.logout_time) : 'In progress'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(lt.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><button onClick={()=>deleteAttendance(lt.id)} disabled={loading} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Total Logins</p><p className="text-2xl font-semibold text-white">{loginTimes.length}</p></div>
              <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Signed Off</p><p className="text-2xl font-semibold text-amber-400">{loginTimes.filter(lt=>lt.logout_time).length}</p></div>
              <div className="glass rounded-xl p-4"><p className="text-xs text-slate-400 mb-1">Still Working</p><p className="text-2xl font-semibold text-green-400">{loginTimes.filter(lt=>!lt.logout_time).length}</p></div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {tab === 'performance' && (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6 animate-scaleIn">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="text-3xl">⭐</span>Member Performance Leaderboard</h2>
                <div className="text-right"><p className="text-xs text-slate-400 uppercase tracking-wider">Evaluating</p><p className="text-2xl font-bold text-blue-400">{memberPerformance.length}</p><p className="text-xs text-slate-400">Members</p></div>
              </div>
              <p className="text-slate-400 text-sm">Rankings based on resolution speed (35%), completion rate (30%), volume (20%), and response time (15%)</p>
            </div>

            {memberPerformance.length >= 3 && (
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 0, 2].map((rankIdx, colIdx) => {
                  const perf = memberPerformance[rankIdx]
                  const grade = getPerformanceGrade(perf.finalScore)
                  const medals = ['🥇','🥈','🥉']
                  return (
                    <div key={perf.member.id} className={`glass rounded-xl p-6 hover-lift animate-fadeIn ${rankIdx===0 ? 'md:order-2 md:scale-105 glow-blue' : rankIdx===1 ? 'md:order-1' : 'md:order-3'}`} style={{animationDelay:`${colIdx*0.1}s`}}>
                      <div className="text-center">
                        <div className={`text-5xl mb-3 ${rankIdx===0 ? 'text-6xl animate-bounce-slow' : ''}`}>{medals[rankIdx]}</div>
                        <h3 className="text-white font-bold text-lg mb-1">{perf.member.full_name}</h3>
                        <p className="text-slate-400 text-xs mb-4">{perf.member.email}</p>
                        <div className={`inline-block px-4 py-2 rounded-lg ${grade.bg} mb-3`}>
                          <p className="text-xs text-slate-400 mb-1">Score</p>
                          <p className={`text-3xl font-bold ${grade.color}`}>{perf.finalScore.toFixed(1)}</p>
                          <p className={`text-sm font-medium ${grade.color}`}>{grade.grade}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><p className="text-slate-500">Solved</p><p className="text-white font-medium">{perf.solvedTickets}</p></div>
                          <div><p className="text-slate-500">Avg Time</p><p className="text-white font-medium">{formatTime(perf.avgResolutionTime)}</p></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="glass rounded-xl overflow-hidden animate-fadeIn">
              <div className="p-4 border-b border-white/10"><h3 className="text-white font-medium flex items-center gap-2">📊 Complete Rankings</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/5">
                      {['Rank','Member','Score','Grade','Solved','Total','Rate','Avg Time','Response','Load'].map(h => (
                        <th key={h} className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberPerformance.length === 0 && <tr><td colSpan={10} className="text-center text-slate-500 py-12">No members to evaluate yet</td></tr>}
                    {memberPerformance.map((perf, index) => {
                      const grade = getPerformanceGrade(perf.finalScore)
                      return (
                        <tr key={perf.member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4"><span className="text-2xl">{getRankMedal(index)}</span></td>
                          <td className="px-4 py-4"><p className="text-white font-medium">{perf.member.full_name}</p><p className="text-slate-400 text-xs">{perf.member.email}</p></td>
                          <td className="px-4 py-4 text-center"><div className={`inline-block px-3 py-1 rounded-lg ${grade.bg}`}><p className={`text-xl font-bold ${grade.color}`}>{perf.finalScore.toFixed(1)}</p></div></td>
                          <td className="px-4 py-4 text-center"><span className={`text-lg font-bold ${grade.color}`}>{grade.grade}</span></td>
                          <td className="px-4 py-4 text-center"><span className="text-green-400 font-medium text-lg">{perf.solvedTickets}</span></td>
                          <td className="px-4 py-4 text-center"><span className="text-white font-medium">{perf.totalTickets}</span></td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-blue-400 font-medium">{perf.completionRate.toFixed(0)}%</span>
                              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1"><div className="h-full bg-blue-500 rounded-full" style={{width:`${perf.completionRate}%`}} /></div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center"><span className={`font-medium ${perf.avgResolutionTime < 6 ? 'text-green-400' : perf.avgResolutionTime < 24 ? 'text-yellow-400' : 'text-red-400'}`}>{formatTime(perf.avgResolutionTime)}</span></td>
                          <td className="px-4 py-4 text-center"><span className={`font-medium text-sm ${perf.avgResponseTime < 2 ? 'text-green-400' : perf.avgResponseTime < 6 ? 'text-yellow-400' : 'text-red-400'}`}>{formatTime(perf.avgResponseTime)}</span></td>
                          <td className="px-4 py-4 text-center"><span className={`font-medium ${perf.currentLoad === 0 ? 'text-green-400' : perf.currentLoad < 5 ? 'text-yellow-400' : 'text-red-400'}`}>{perf.currentLoad}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass rounded-xl p-6 animate-fadeIn">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">📐 Scoring Methodology</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {[['Resolution Speed','How fast tickets are solved','35%','text-blue-400'],['Completion Rate','% of tickets solved','30%','text-green-400'],['Ticket Volume','Total tickets handled','20%','text-yellow-400'],['Response Time','How fast to start work','15%','text-purple-400']].map(([t,d,p,c]) => (
                  <div key={t} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div><p className="text-white font-medium text-sm">{t}</p><p className="text-slate-400 text-xs">{d}</p></div>
                    <span className={`${c} font-bold text-lg`}>{p}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">⚠️ Workload Penalty</p>
                <p className="text-slate-400 text-xs mt-1">High current workload (open/pending tickets) reduces the final score</p>
              </div>
            </div>
          </div>
        )}
        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Office Geofence</h2>
                  <p className="text-slate-400 text-xs">Only employees within the radius can check in or check out</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              {loadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="ml-3 text-slate-400 text-sm">Loading settings…</span>
                </div>
              ) : (
                <form onSubmit={handleSaveOffice} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Latitude</label>
                      <input
                        type="number" step="any" required
                        value={officeForm.latitude}
                        onChange={e => setOfficeForm(f => ({ ...f, latitude: e.target.value }))}
                        placeholder="e.g. 30.0726"
                        className={`w-full bg-white/5 border border-white/10 ${focusBorder} focus:outline-none text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Longitude</label>
                      <input
                        type="number" step="any" required
                        value={officeForm.longitude}
                        onChange={e => setOfficeForm(f => ({ ...f, longitude: e.target.value }))}
                        placeholder="e.g. 31.3211"
                        className={`w-full bg-white/5 border border-white/10 ${focusBorder} focus:outline-none text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500`}
                      />
                    </div>
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Allowed Radius (meters)</label>
                    <input
                      type="number" step="1" min="1" required
                      value={officeForm.radius_meters}
                      onChange={e => setOfficeForm(f => ({ ...f, radius_meters: e.target.value }))}
                      placeholder="e.g. 30"
                      className={`w-full bg-white/5 border border-white/10 ${focusBorder} focus:outline-none text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500`}
                    />
                  </div>

                  {officeForm.latitude && officeForm.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${officeForm.latitude},${officeForm.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Verify on Google Maps
                    </a>
                  )}

                  {officeMsg && (
                    <div className={`px-4 py-3 rounded-lg text-sm ${officeMsg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                      {officeMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button type="submit" disabled={savingOffice}
                      className={`${btnPrimary} px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-60 flex items-center gap-2`}>
                      {savingOffice ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          Saving…
                        </>
                      ) : 'Save Settings'}
                    </button>
                    <button type="button" onClick={fetchOfficeSettings}
                      className="px-4 py-2.5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 text-sm rounded-lg transition-all">
                      Reset
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="glass rounded-xl p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">How it works</p>
              <div className="space-y-2">
                {[
                  ['📍', 'Set your office latitude and longitude (use Google Maps to find exact coordinates)'],
                  ['📏', 'Set the allowed radius in meters — employees must be within this distance to check in or out'],
                  ['🔒', 'All checks happen server-side — employees cannot bypass this from the app'],
                  ['🗺️', 'Use the "Verify on Google Maps" link to confirm the pin is placed correctly'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                    <span className="text-lg leading-none mt-0.5">{icon}</span>
                    <p className="text-slate-300 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log */}
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  <h3 className="text-white font-medium text-sm">Change History</h3>
                </div>
                <button onClick={fetchSettingsLog} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                  <svg className={`w-3.5 h-3.5 ${loadingLog ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Refresh
                </button>
              </div>

              {loadingLog ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span className="ml-2 text-slate-400 text-sm">Loading…</span>
                </div>
              ) : settingsLog.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">No changes recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/5">
                        {['Date & Time', 'Changed By', 'Previous Location', 'New Location', 'Radius'].map(h => (
                          <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {settingsLog.map((entry, i) => (
                        <tr key={entry.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-blue-900/10' : ''}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-white text-xs font-medium">{new Date(entry.created_at).toLocaleDateString()}</p>
                            <p className="text-slate-400 text-xs">{new Date(entry.created_at).toLocaleTimeString()}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white text-xs">{entry.changed_by_name || '—'}</p>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {entry.from_lat != null ? (
                              <a href={`https://www.google.com/maps?q=${entry.from_lat},${entry.from_lng}`} target="_blank" rel="noreferrer"
                                className="text-slate-400 hover:text-blue-400 text-xs transition-colors">
                                {Number(entry.from_lat).toFixed(4)}, {Number(entry.from_lng).toFixed(4)}
                              </a>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <a href={`https://www.google.com/maps?q=${entry.to_lat},${entry.to_lng}`} target="_blank" rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                              {Number(entry.to_lat).toFixed(4)}, {Number(entry.to_lng).toFixed(4)}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {entry.from_radius != null && entry.from_radius !== entry.to_radius && (
                                <span className="text-slate-500 text-xs line-through">{entry.from_radius}m</span>
                              )}
                              <span className="text-green-400 text-xs font-medium">{entry.to_radius}m</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Reset Password Modal ── */}
      {resetPwdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-sm glass rounded-2xl p-6 animate-scaleIn border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Reset Password</h3>
                <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">{resetPwdTarget.email}</p>
              </div>
            </div>

            <form onSubmit={submitResetPwd} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <input
                    type={resetPwdShow ? 'text' : 'password'}
                    value={resetPwdValue}
                    onChange={e => { setResetPwdValue(e.target.value); setResetPwdError('') }}
                    autoFocus
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 pr-10 transition-all"
                  />
                  <button type="button" onClick={() => setResetPwdShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {resetPwdShow
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
                {resetPwdError && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {resetPwdError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={resettingUserId === resetPwdTarget.id || !resetPwdValue}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-all">
                  {resettingUserId === resetPwdTarget.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Resetting...
                    </span>
                  ) : 'Reset Password'}
                </button>
                <button type="button" onClick={() => setResetPwdTarget(null)}
                  className="px-4 py-2.5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 text-sm rounded-lg transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
