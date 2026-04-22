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

function formatResetPasswordError(error, data) {
  if (data?.error) return `Error: ${data.error}`

  const message = error?.message || 'Password reset failed'
  if (message.includes('Failed to send a request to the Edge Function')) {
    return 'Error: The admin-reset-password Edge Function is not reachable. Deploy the function and set SUPABASE_SERVICE_ROLE_KEY in Supabase Edge Function secrets.'
  }

  return `Error: ${message}`
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [tickets, setTickets] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false })
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState([])
  const [acceptingRequest, setAcceptingRequest] = useState(null) // request being accepted
  const [assignTo, setAssignTo] = useState('')
  const [loginTimes, setLoginTimes] = useState([])
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [todayLogin, setTodayLogin] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [resettingUserId, setResettingUserId] = useState(null)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [rejectingLeaveId, setRejectingLeaveId] = useState(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [processingLeaveId, setProcessingLeaveId] = useState(null)

  useEffect(() => { 
    fetchTickets(); 
    fetchUsers(); 
    fetchRequests();
    fetchLoginTimes();
    checkTodayLogin();
    fetchLeaveRequests();

    const leaveChannel = supabase
      .channel('admin-leaves')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'leave_requests'
      }, () => fetchLeaveRequests())
      .subscribe()

    return () => { supabase.removeChannel(leaveChannel) }
  }, [])

  useEffect(() => { if (selectedTicket) fetchReplies(selectedTicket.id) }, [selectedTicket])
  useEffect(() => {
    if (selectedDate) fetchLoginTimes()
  }, [selectedDate])

  async function fetchTickets() {
    const { data } = await supabase
      .from('tickets').select('*, created_by_profile:profiles!tickets_created_by_fkey(full_name,email), assigned_to_profile:profiles!tickets_assigned_to_fkey(full_name,email,role)')
      .eq('is_request', false)
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }

  async function fetchReplies(ticketId) {
    const { data } = await supabase
      .from('ticket_replies')
      .select('*, profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    setReplies(data || [])
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('tickets')
      .select('*, created_by_profile:profiles!tickets_created_by_fkey(full_name,email)')
      .eq('is_request', true)
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  async function fetchLeaveRequests() {
    const { data } = await supabase
      .from('leave_requests')
      .select('*, user:profiles!leave_requests_user_id_fkey(full_name,email,role)')
      .order('created_at', { ascending: false })
    setLeaveRequests(data || [])
  }

  async function approveLeaveRequest(req) {
    setProcessingLeaveId(req.id)
    const { error } = await supabase.from('leave_requests').update({
      status: 'approved',
      admin_note: null,
      decided_by: user.id,
      decided_at: new Date().toISOString()
    }).eq('id', req.id)
    if (error) { setMsg('Error: ' + error.message); setProcessingLeaveId(null); return }

    await supabase.from('notifications').insert({
      user_id: req.user_id,
      message: `✅ Your leave request (${req.start_date} → ${req.end_date}) was approved`
    })

    setMsg(`✓ Leave approved`)
    setProcessingLeaveId(null)
    fetchLeaveRequests()
  }

  async function rejectLeaveRequest(req) {
    setProcessingLeaveId(req.id)
    const note = rejectionNote.trim() || null
    const { error } = await supabase.from('leave_requests').update({
      status: 'rejected',
      admin_note: note,
      decided_by: user.id,
      decided_at: new Date().toISOString()
    }).eq('id', req.id)
    if (error) { setMsg('Error: ' + error.message); setProcessingLeaveId(null); return }

    await supabase.from('notifications').insert({
      user_id: req.user_id,
      message: `❌ Your leave request (${req.start_date} → ${req.end_date}) was rejected${note ? ' — ' + note : ''}`
    })

    setMsg(`✓ Leave rejected`)
    setRejectingLeaveId(null)
    setRejectionNote('')
    setProcessingLeaveId(null)
    fetchLeaveRequests()
  }

  async function deleteLeaveRequest(id) {
    if (!window.confirm('Delete this leave request?')) return
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('✓ Leave request deleted')
    fetchLeaveRequests()
  }

  async function fetchLoginTimes() {
    const { data, error } = await supabase.rpc('get_attendance_records', {
      target_date: selectedDate
    })
    if (error) {
      console.error('Attendance fetch error:', error)
      setMsg('Error: ' + error.message)
      setLoginTimes([])
      return
    }
    setLoginTimes(data || [])
  }

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
            await checkTodayLogin()
            if (selectedDate === getLocalDateString()) {
              await fetchLoginTimes()
            }
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
            await checkTodayLogin()
            if (selectedDate === getLocalDateString()) {
              await fetchLoginTimes()
            }
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

  async function acceptRequest(request) {
    if (!assignTo) return
    setLoading(true)
    const { error } = await supabase.from('tickets').update({
      request_status: 'accepted',
      assigned_to: assignTo,
      is_request: false,
      opened_at: new Date().toISOString()
    }).eq('id', request.id)
    if (!error) {
      // Notify the requester
      await supabase.from('notifications').insert({
        user_id: request.created_by,
        ticket_id: request.id,
        message: `✅ Your ticket request "${request.title}" has been accepted and assigned.`
      })
      setAcceptingRequest(null)
      setAssignTo('')
      fetchRequests()
      fetchTickets()
    } else {
      setMsg('Error: ' + error.message)
    }
    setLoading(false)
  }

  async function refuseRequest(request) {
    if (!confirm('Refuse this request?')) return
    setLoading(true)
    const { error } = await supabase.from('tickets').update({
      request_status: 'refused'
    }).eq('id', request.id)
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: request.created_by,
        ticket_id: request.id,
        message: `❌ Your ticket request "${request.title}" has been refused by the admin.`
      })
      fetchRequests()
    } else {
      setMsg('Error: ' + error.message)
    }
    setLoading(false)
  }

  async function updateUser(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    const { error } = await supabase.from('profiles')
      .update({
        full_name: userForm.full_name,
        role: userForm.role,
        can_view_attendance: userForm.can_view_attendance
      })
      .eq('id', editingUser.id)
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✓ User updated!'); setEditingUser(null); fetchUsers() }
    setLoading(false)
  }

  async function deleteUser(userId) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setLoading(true)

    const { error: revokeError } = await supabase
      .from('session_revocations')
      .insert({
        user_id: userId,
        reason: 'account_deleted'
      })

    if (revokeError) {
      setMsg('Error: ' + revokeError.message)
      setLoading(false)
      return
    }

    await new Promise(resolve => setTimeout(resolve, 700))

    const { error } = await supabase.rpc('delete_user', { user_id: userId })
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✓ User deleted!'); fetchUsers() }
    setLoading(false)
  }

  async function createUser(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    
    const { data, error } = await supabase.auth.signUp({
      email: userForm.email,
      password: userForm.password,
      options: {
        data: {
          full_name: userForm.full_name,
          role: userForm.role,
          can_view_attendance: userForm.can_view_attendance
        }
      }
    })
    
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setMsg('✓ User created!')
      setUserForm({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false })
      setShowCreateUser(false)
      setTimeout(fetchUsers, 1000)
    }
    setLoading(false)
  }

  async function resetUserPassword(targetUser) {
    const newPassword = window.prompt(`Enter a new password for ${targetUser.email}`)
    if (!newPassword) return
    if (newPassword.length < 6) {
      setMsg('Error: Password must be at least 6 characters')
      return
    }

    setResettingUserId(targetUser.id)
    setMsg('')

    try {
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        setMsg('Error: Not authenticated. Please sign in again.')
        setResettingUserId(null)
        return
      }

      // Call the edge function with explicit auth token
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: targetUser.id,
          newPassword
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) {
        console.error('Function error:', error)
        setMsg(`Error: ${error.message}`)
      } else if (data?.error) {
        console.error('Function returned error:', data.error)
        setMsg(`Error: ${data.error}`)
      } else {
        setMsg(`✓ Password reset for ${targetUser.email}`)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setMsg(`Error: ${err.message}`)
    }

    setResettingUserId(null)
  }

  async function createTicket(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    
    const ticketData = {
      title: ticketForm.title,
      description: ticketForm.description,
      affected_person: ticketForm.affected_person,
      assigned_to: ticketForm.assigned_to || null,
      created_by: user.id,
      status: ticketForm.status,
      // Initialize status timestamps
      opened_at: new Date().toISOString(),
      pending_at: ticketForm.status === 'pending' ? new Date().toISOString() : null,
      solved_at: ticketForm.status === 'solved' ? new Date().toISOString() : null
    }
    
    const { error } = await supabase.from('tickets').insert(ticketData)
    
    if (error) {
      console.error('Ticket creation error:', error)
      setMsg('Error: ' + error.message)
    } else {
      setMsg('✓ Ticket created and assigned!')
      setTicketForm({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened' })
      setShowCreateTicket(false)
      fetchTickets()
    }
    setLoading(false)
  }

  async function updateStatus(id, newStatus) {
    const updates = { status: newStatus }
    
    // Record timestamp for status change
    if (newStatus === 'pending' && !selectedTicket?.pending_at) {
      updates.pending_at = new Date().toISOString()
    } else if (newStatus === 'solved' && !selectedTicket?.solved_at) {
      updates.solved_at = new Date().toISOString()
    }
    
    await supabase.from('tickets').update(updates).eq('id', id)
    fetchTickets()
  }

  async function deleteTicket(id) {
    if (!confirm('Delete this ticket? This cannot be undone.')) return
    setLoading(true)
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✓ Ticket deleted!'); fetchTickets() }
    setLoading(false)
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this request? This cannot be undone.')) return
    setLoading(true)
    const { error } = await supabase.from('tickets').delete().eq('id', id).eq('is_request', true)

    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      if (acceptingRequest?.id === id) {
        setAcceptingRequest(null)
        setAssignTo('')
      }
      setMsg('✓ Request deleted!')
      fetchRequests()
    }

    setLoading(false)
  }

  async function deleteAttendance(id) {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return
    setLoading(true)
    const record = loginTimes.find(lt => lt.id === id)
    const { data, error } = await supabase
      .from('login_times')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      setMsg('Error: ' + error.message)
    } else if (!data || data.length === 0) {
      setMsg('Error: Attendance delete was blocked. Apply the login_times admin delete policy in Supabase SQL.')
    } else {
      setMsg('✓ Attendance record deleted!')
      await fetchLoginTimes()
      if (record?.user_id === user.id && record?.date === getLocalDateString()) {
        await checkTodayLogin()
      }
    }

    setLoading(false)
  }

  // Calculate duration in hours
  function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    const diff = new Date(endTime) - new Date(startTime)
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  // Calculate duration in hours (numeric)
  function calculateDurationHours(startTime, endTime) {
    if (!startTime || !endTime) return null
    const diff = new Date(endTime) - new Date(startTime)
    return diff / (1000 * 60 * 60) // Return hours as decimal
  }

  // ============================================
  // MEMBER PERFORMANCE EVALUATION SYSTEM
  // ============================================
  
  function calculateMemberPerformance() {
    // Filter only members (not employees or admins)
    const members = users.filter(u => u.role === 'member')
    
    const memberStats = members.map(member => {
      const memberTickets = tickets.filter(t => t.assigned_to === member.id)
      const solvedTickets = memberTickets.filter(t => t.status === 'solved' && t.solved_at)
      const totalTickets = memberTickets.length
      const openTickets = memberTickets.filter(t => t.status === 'opened').length
      const pendingTickets = memberTickets.filter(t => t.status === 'pending').length
      
      // 1. COMPLETION RATE (% of solved tickets)
      const completionRate = totalTickets > 0 ? (solvedTickets.length / totalTickets) * 100 : 0
      
      // 2. AVERAGE RESOLUTION TIME (in hours)
      const resolutionTimes = solvedTickets
        .map(t => calculateDurationHours(t.created_at, t.solved_at))
        .filter(t => t !== null)
      
      const avgResolutionTime = resolutionTimes.length > 0 
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
        : 0
      
      // 3. RESPONSE TIME (time to mark as pending)
      const responseTimes = memberTickets
        .filter(t => t.pending_at)
        .map(t => calculateDurationHours(t.created_at, t.pending_at))
        .filter(t => t !== null)
      
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0
      
      // 4. VOLUME (total solved tickets)
      const volume = solvedTickets.length
      
      // 5. CURRENT WORKLOAD
      const currentLoad = openTickets + pendingTickets
      
      // ============================================
      // SCORING ALGORITHM
      // ============================================
      
      // Speed Score (0-100): Lower time = higher score
      // Using exponential decay: score = 100 * e^(-time/24)
      // Fast resolution (< 6 hours) = 90-100 points
      // Medium (6-24 hours) = 50-90 points
      // Slow (> 24 hours) = < 50 points
      const speedScore = avgResolutionTime > 0 
        ? Math.min(100, 100 * Math.exp(-avgResolutionTime / 24))
        : 0
      
      // Completion Rate Score (0-100): Direct percentage
      const completionScore = completionRate
      
      // Volume Score (0-100): Normalized based on max volume
      // We'll calculate this after we have all members
      const volumeRaw = volume
      
      // Response Score (0-100): Lower response time = higher score
      const responseScore = avgResponseTime > 0
        ? Math.min(100, 100 * Math.exp(-avgResponseTime / 6))
        : 0
      
      // Workload Penalty: High current load reduces score slightly
      const workloadPenalty = Math.min(20, currentLoad * 2) // Max 20 point penalty
      
      return {
        member,
        totalTickets,
        solvedTickets: volume,
        openTickets,
        pendingTickets,
        completionRate,
        avgResolutionTime,
        avgResponseTime,
        speedScore,
        completionScore,
        volumeRaw,
        responseScore,
        workloadPenalty,
        currentLoad
      }
    })
    
    // Calculate Volume Score (normalized)
    const maxVolume = Math.max(...memberStats.map(s => s.volumeRaw), 1)
    
    memberStats.forEach(stat => {
      stat.volumeScore = (stat.volumeRaw / maxVolume) * 100
      
      // FINAL SCORE CALCULATION (Weighted Average)
      // - Speed: 35% (most important)
      // - Completion Rate: 30%
      // - Volume: 20%
      // - Response Time: 15%
      // - Workload Penalty: subtract from total
      
      stat.finalScore = (
        (stat.speedScore * 0.35) +
        (stat.completionScore * 0.30) +
        (stat.volumeScore * 0.20) +
        (stat.responseScore * 0.15)
      ) - stat.workloadPenalty
      
      // Ensure score is between 0-100
      stat.finalScore = Math.max(0, Math.min(100, stat.finalScore))
    })
    
    // Sort by final score (highest first)
    return memberStats.sort((a, b) => b.finalScore - a.finalScore)
  }
  
  const memberPerformance = calculateMemberPerformance()
  
  // Get medal emoji for ranking
  function getRankMedal(index) {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }
  
  // Get performance grade
  function getPerformanceGrade(score) {
    if (score >= 90) return { grade: 'A+', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 80) return { grade: 'A', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 70) return { grade: 'B+', color: 'text-blue-400', bg: 'bg-blue-900/30' }
    if (score >= 60) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-900/30' }
    if (score >= 50) return { grade: 'C', color: 'text-yellow-400', bg: 'bg-yellow-900/30' }
    return { grade: 'D', color: 'text-red-400', bg: 'bg-red-900/30' }
  }
  
  // Format time display
  function formatTime(hours) {
    if (!hours || hours === 0) return '—'
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    return `${days}d ${remainingHours}h`
  }

  // Performance metrics
  const employeeCount = users.filter(u => u.role === 'employee').length
  const memberCount = users.filter(u => u.role === 'member').length
  const openedTickets = tickets.filter(t => t.status === 'opened').length
  const pendingTickets = tickets.filter(t => t.status === 'pending').length
  const solvedTickets = tickets.filter(t => t.status === 'solved').length

  const userTickets = selectedUser ? tickets.filter(t => t.assigned_to === selectedUser.id) : []

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
      <Navbar title="Admin Panel" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Message Banner */}
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg animate-fadeIn ${msg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto pb-2">
          {['dashboard', 'tickets', 'requests', 'leave', 'users', 'attendance', 'performance'].map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedUser(null); setSelectedTicket(null) }}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${
                tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {t === 'performance' ? '⭐ Performance'
                : t === 'requests' ? `📋 Requests${requests.filter(r=>r.request_status==='pending_review').length > 0 ? ` (${requests.filter(r=>r.request_status==='pending_review').length})` : ''}`
                : t === 'leave' ? `🌴 Leave${leaveRequests.filter(r=>r.status==='pending').length > 0 ? ` (${leaveRequests.filter(r=>r.status==='pending').length})` : ''}`
                : t}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Admin Login Card */}
            <div className="glass rounded-xl p-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Today's Login</p>
                  {todayLogin ? (
                    <div>
                      <p className="text-white text-lg font-medium">✓ Logged at {new Date(todayLogin.login_time).toLocaleTimeString()}</p>
                      <p className="text-slate-300 text-sm mt-1">
                        Sign Off: {todayLogin.logout_time ? new Date(todayLogin.logout_time).toLocaleTimeString() : 'Not signed off yet'}
                      </p>
                      {todayLogin.logout_time && (
                        <p className="text-green-400 text-xs mt-1">
                          Worked: {calculateDuration(todayLogin.login_time, todayLogin.logout_time)}
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Tickets', val: tickets.length, color: 'text-white', icon: '📊', bg: 'bg-gradient-to-br from-blue-600/20 to-blue-900/20' },
                { label: 'Opened', val: openedTickets, color: 'text-blue-400', icon: '🔵', bg: 'bg-gradient-to-br from-blue-500/20 to-blue-700/20' },
                { label: 'Pending', val: pendingTickets, color: 'text-yellow-400', icon: '🟡', bg: 'bg-gradient-to-br from-yellow-500/20 to-yellow-700/20' },
                { label: 'Solved', val: solvedTickets, color: 'text-green-400', icon: '✅', bg: 'bg-gradient-to-br from-green-500/20 to-green-700/20' },
                { label: 'Total Users', val: users.length, color: 'text-purple-400', icon: '👥', bg: 'bg-gradient-to-br from-purple-500/20 to-purple-700/20' },
              ].map((s, i) => (
                <div key={s.label} className={`${s.bg} glass rounded-xl p-5 hover-lift animate-fadeIn`} style={{animationDelay: `${i * 0.1}s`}}>
                  <p className="text-xs text-slate-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
                    <span className="text-lg">{s.icon}</span>
                    {s.label}
                  </p>
                  <p className={`text-3xl font-bold ${s.color} mono counter-animate`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* User Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-5 hover-lift animate-fadeIn" style={{animationDelay: '0.5s'}}>
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <span>👥</span> User Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Members</span>
                    <span className="text-white font-medium mono">{memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Employees</span>
                    <span className="text-white font-medium mono">{employeeCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Admins</span>
                    <span className="text-white font-medium mono">{users.filter(u => u.role === 'admin').length}</span>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-5 hover-lift animate-fadeIn" style={{animationDelay: '0.6s'}}>
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <span>📈</span> Ticket Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Resolution Rate</span>
                    <span className="text-green-400 font-medium mono">
                      {tickets.length > 0 ? ((solvedTickets / tickets.length) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Active Tickets</span>
                    <span className="text-yellow-400 font-medium mono">{openedTickets + pendingTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Avg per User</span>
                    <span className="text-white font-medium mono">
                      {users.length > 0 ? (tickets.length / users.length).toFixed(1) : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass rounded-xl p-5 animate-fadeIn" style={{animationDelay: '0.7s'}}>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <span>🕐</span> Recent Tickets
              </h3>
              <div className="space-y-2">
                {tickets.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors animate-slideIn" style={{animationDelay: `${i * 0.1}s`}}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <StatusBadge status={t.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{t.title}</p>
                        <p className="text-slate-400 text-xs">
                          Assigned to {t.assigned_to_profile?.full_name || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs mono whitespace-nowrap ml-3">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-medium">Attendance</h2>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Name</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Email</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Role</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Login Time</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Sign Off</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Worked</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Date</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loginTimes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500 py-8">
                        No attendance recorded for {new Date(selectedDate).toLocaleDateString()}
                      </td>
                    </tr>
                  )}
                  {loginTimes.map((lt, i) => (
                    <tr key={lt.id} className="border-b border-white/5 hover:bg-white/2 transition-colors" style={{animationDelay: `${i * 0.05}s`}}>
                      <td className="px-4 py-3 text-white font-medium">{lt.full_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{lt.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                          lt.role === 'admin' ? 'bg-purple-900/30 text-purple-400' :
                          lt.role === 'employee' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-slate-900/30 text-slate-400'
                        }`}>
                          {lt.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-mono">
                        {new Date(lt.login_time).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">
                        {lt.logout_time ? new Date(lt.logout_time).toLocaleTimeString() : 'Still working'}
                      </td>
                      <td className="px-4 py-3 text-green-400 text-xs font-medium">
                        {lt.logout_time ? calculateDuration(lt.login_time, lt.logout_time) : 'In progress'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(lt.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteAttendance(lt.id)}
                          disabled={loading}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Total Logins</p>
                <p className="text-2xl font-semibold text-white">{loginTimes.length}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Signed Off</p>
                <p className="text-2xl font-semibold text-amber-400">
                  {loginTimes.filter(lt => lt.logout_time).length}
                </p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Still Working</p>
                <p className="text-2xl font-semibold text-green-400">
                  {loginTimes.filter(lt => !lt.logout_time).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab - MEMBER EVALUATION SYSTEM */}
        {tab === 'performance' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="glass rounded-xl p-6 animate-scaleIn">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-3xl">⭐</span>
                  Member Performance Leaderboard
                </h2>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Evaluating</p>
                  <p className="text-2xl font-bold text-blue-400 mono">{memberPerformance.length}</p>
                  <p className="text-xs text-slate-400">Members</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm">
                Rankings based on resolution speed (35%), completion rate (30%), volume (20%), and response time (15%)
              </p>
            </div>

            {/* Top 3 Podium */}
            {memberPerformance.length >= 3 && (
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {/* 2nd Place */}
                <div className="glass rounded-xl p-6 hover-lift animate-fadeIn order-2 md:order-1" style={{animationDelay: '0.1s'}}>
                  <div className="text-center">
                    <div className="text-5xl mb-3">🥈</div>
                    <h3 className="text-white font-bold text-lg mb-1">{memberPerformance[1].member.full_name}</h3>
                    <p className="text-slate-400 text-xs mb-4">{memberPerformance[1].member.email}</p>
                    <div className={`inline-block px-4 py-2 rounded-lg ${getPerformanceGrade(memberPerformance[1].finalScore).bg} mb-3`}>
                      <p className="text-xs text-slate-400 mb-1">Score</p>
                      <p className={`text-3xl font-bold ${getPerformanceGrade(memberPerformance[1].finalScore).color} mono`}>
                        {memberPerformance[1].finalScore.toFixed(1)}
                      </p>
                      <p className={`text-sm font-medium ${getPerformanceGrade(memberPerformance[1].finalScore).color}`}>
                        {getPerformanceGrade(memberPerformance[1].finalScore).grade}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Solved</p>
                        <p className="text-white font-medium mono">{memberPerformance[1].solvedTickets}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Avg Time</p>
                        <p className="text-white font-medium mono">{formatTime(memberPerformance[1].avgResolutionTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1st Place */}
                <div className="glass rounded-xl p-6 hover-lift animate-fadeIn glow-blue order-1 md:order-2 md:scale-105" style={{animationDelay: '0s'}}>
                  <div className="text-center">
                    <div className="text-6xl mb-3 animate-bounce-slow">🥇</div>
                    <h3 className="text-white font-bold text-xl mb-1">{memberPerformance[0].member.full_name}</h3>
                    <p className="text-slate-400 text-xs mb-4">{memberPerformance[0].member.email}</p>
                    <div className={`inline-block px-6 py-3 rounded-xl ${getPerformanceGrade(memberPerformance[0].finalScore).bg} mb-4`}>
                      <p className="text-xs text-slate-400 mb-1">Score</p>
                      <p className={`text-4xl font-bold ${getPerformanceGrade(memberPerformance[0].finalScore).color} mono`}>
                        {memberPerformance[0].finalScore.toFixed(1)}
                      </p>
                      <p className={`text-lg font-medium ${getPerformanceGrade(memberPerformance[0].finalScore).color}`}>
                        {getPerformanceGrade(memberPerformance[0].finalScore).grade}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-slate-500 text-xs">Solved</p>
                        <p className="text-green-400 font-bold mono text-lg">{memberPerformance[0].solvedTickets}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-slate-500 text-xs">Avg Time</p>
                        <p className="text-blue-400 font-bold mono text-lg">{formatTime(memberPerformance[0].avgResolutionTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="glass rounded-xl p-6 hover-lift animate-fadeIn order-3" style={{animationDelay: '0.2s'}}>
                  <div className="text-center">
                    <div className="text-5xl mb-3">🥉</div>
                    <h3 className="text-white font-bold text-lg mb-1">{memberPerformance[2].member.full_name}</h3>
                    <p className="text-slate-400 text-xs mb-4">{memberPerformance[2].member.email}</p>
                    <div className={`inline-block px-4 py-2 rounded-lg ${getPerformanceGrade(memberPerformance[2].finalScore).bg} mb-3`}>
                      <p className="text-xs text-slate-400 mb-1">Score</p>
                      <p className={`text-3xl font-bold ${getPerformanceGrade(memberPerformance[2].finalScore).color} mono`}>
                        {memberPerformance[2].finalScore.toFixed(1)}
                      </p>
                      <p className={`text-sm font-medium ${getPerformanceGrade(memberPerformance[2].finalScore).color}`}>
                        {getPerformanceGrade(memberPerformance[2].finalScore).grade}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Solved</p>
                        <p className="text-white font-medium mono">{memberPerformance[2].solvedTickets}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Avg Time</p>
                        <p className="text-white font-medium mono">{formatTime(memberPerformance[2].avgResolutionTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Leaderboard Table */}
            <div className="glass rounded-xl overflow-hidden animate-fadeIn" style={{animationDelay: '0.3s'}}>
              <div className="p-4 border-b border-white/10">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <span>📊</span> Complete Rankings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/5">
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Rank</th>
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Member</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Score</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Grade</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Solved</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Total</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Rate</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Avg Time</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Response</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberPerformance.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center text-slate-500 py-12">
                          No members to evaluate yet
                        </td>
                      </tr>
                    )}
                    {memberPerformance.map((perf, index) => {
                      const grade = getPerformanceGrade(perf.finalScore)
                      return (
                        <tr key={perf.member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors animate-fadeIn" style={{animationDelay: `${index * 0.05}s`}}>
                          {/* Rank */}
                          <td className="px-4 py-4">
                            <span className="text-2xl">{getRankMedal(index)}</span>
                          </td>
                          
                          {/* Member Info */}
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-white font-medium">{perf.member.full_name}</p>
                              <p className="text-slate-400 text-xs">{perf.member.email}</p>
                            </div>
                          </td>
                          
                          {/* Score */}
                          <td className="px-4 py-4 text-center">
                            <div className={`inline-block px-3 py-1 rounded-lg ${grade.bg}`}>
                              <p className={`text-xl font-bold ${grade.color} mono`}>
                                {perf.finalScore.toFixed(1)}
                              </p>
                            </div>
                          </td>
                          
                          {/* Grade */}
                          <td className="px-4 py-4 text-center">
                            <span className={`text-lg font-bold ${grade.color}`}>
                              {grade.grade}
                            </span>
                          </td>
                          
                          {/* Solved Tickets */}
                          <td className="px-4 py-4 text-center">
                            <span className="text-green-400 font-medium mono text-lg">
                              {perf.solvedTickets}
                            </span>
                          </td>
                          
                          {/* Total Tickets */}
                          <td className="px-4 py-4 text-center">
                            <span className="text-white font-medium mono">
                              {perf.totalTickets}
                            </span>
                          </td>
                          
                          {/* Completion Rate */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-blue-400 font-medium mono">
                                {perf.completionRate.toFixed(0)}%
                              </span>
                              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                                <div 
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{width: `${perf.completionRate}%`}}
                                />
                              </div>
                            </div>
                          </td>
                          
                          {/* Avg Resolution Time */}
                          <td className="px-4 py-4 text-center">
                            <span className={`font-medium mono ${
                              perf.avgResolutionTime < 6 ? 'text-green-400' :
                              perf.avgResolutionTime < 24 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {formatTime(perf.avgResolutionTime)}
                            </span>
                          </td>
                          
                          {/* Avg Response Time */}
                          <td className="px-4 py-4 text-center">
                            <span className={`font-medium mono text-sm ${
                              perf.avgResponseTime < 2 ? 'text-green-400' :
                              perf.avgResponseTime < 6 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {formatTime(perf.avgResponseTime)}
                            </span>
                          </td>
                          
                          {/* Current Load */}
                          <td className="px-4 py-4 text-center">
                            <span className={`font-medium mono ${
                              perf.currentLoad === 0 ? 'text-green-400' :
                              perf.currentLoad < 5 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {perf.currentLoad}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scoring Breakdown */}
            <div className="glass rounded-xl p-6 animate-fadeIn" style={{animationDelay: '0.4s'}}>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <span>📐</span> Scoring Methodology
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">Resolution Speed</p>
                      <p className="text-slate-400 text-xs">How fast tickets are solved</p>
                    </div>
                    <span className="text-blue-400 font-bold text-lg mono">35%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">Completion Rate</p>
                      <p className="text-slate-400 text-xs">% of tickets solved</p>
                    </div>
                    <span className="text-green-400 font-bold text-lg mono">30%</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">Ticket Volume</p>
                      <p className="text-slate-400 text-xs">Total tickets handled</p>
                    </div>
                    <span className="text-yellow-400 font-bold text-lg mono">20%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">Response Time</p>
                      <p className="text-slate-400 text-xs">How fast to start work</p>
                    </div>
                    <span className="text-purple-400 font-bold text-lg mono">15%</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">⚠️ Workload Penalty</p>
                <p className="text-slate-400 text-xs mt-1">
                  High current workload (open/pending tickets) reduces the final score
                </p>
              </div>
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

            {requests.length === 0 && (
              <div className="glass rounded-xl py-12 text-center text-slate-500 animate-fadeIn">No requests yet</div>
            )}

            {requests.map((r, i) => (
              <div key={r.id} className={`glass rounded-xl p-5 animate-fadeIn hover-lift border ${
                r.request_status === 'pending_review' ? 'border-yellow-500/20' :
                r.request_status === 'accepted' ? 'border-green-500/20' :
                'border-red-500/20'
              }`} style={{animationDelay: `${i * 0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        r.request_status === 'pending_review' ? 'bg-yellow-900/30 text-yellow-400' :
                        r.request_status === 'accepted' ? 'bg-green-900/30 text-green-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {r.request_status === 'pending_review' ? '⏳ Pending' : r.request_status === 'accepted' ? '✅ Accepted' : '❌ Refused'}
                      </span>
                      <span className="text-slate-500 text-xs mono">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-white font-medium">{r.title}</h3>
                    {r.description && <p className="text-slate-400 text-sm mt-1">{r.description}</p>}
                    {r.affected_person && <p className="text-slate-500 text-xs mt-1">👤 {r.affected_person}</p>}
                    <p className="text-slate-500 text-xs mt-2">Requested by: <span className="text-slate-300">{r.created_by_profile?.full_name || r.created_by_profile?.email || 'Unknown'}</span></p>
                  </div>

                  <div className="flex flex-col gap-2 min-w-fit">
                    {r.request_status === 'pending_review' && (
                      <>
                        <button onClick={() => { setAcceptingRequest(r); setAssignTo('') }}
                          className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105">
                          Accept
                        </button>
                        <button onClick={() => refuseRequest(r)} disabled={loading}
                          className="bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg transition-all border border-red-500/20">
                          Refuse
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteRequest(r.id)}
                      disabled={loading}
                      className="bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg transition-all border border-red-500/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Accept panel — assign to who */}
                {acceptingRequest?.id === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-scaleIn">
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Assign to</label>
                    <div className="flex gap-2">
                      <select value={assignTo} onChange={e => setAssignTo(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-green-500">
                        <option value="">— Select a member —</option>
                        {users.filter(u => u.role !== 'admin').map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                        ))}
                      </select>
                      <button onClick={() => acceptRequest(r)} disabled={!assignTo || loading}
                        className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                        {loading ? 'Saving...' : 'Confirm'}
                      </button>
                      <button onClick={() => setAcceptingRequest(null)}
                        className="text-slate-400 hover:text-white border border-white/10 text-sm px-3 py-2 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tickets Tab */}
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

            {leaveRequests.length === 0 && (
              <div className="glass rounded-xl py-12 text-center text-slate-500 animate-fadeIn">No leave requests yet</div>
            )}

            {leaveRequests.map((r, i) => (
              <div key={r.id} className={`glass rounded-xl p-5 animate-fadeIn hover-lift border ${
                r.status === 'pending' ? 'border-yellow-500/20' :
                r.status === 'approved' ? 'border-green-500/20' :
                'border-red-500/20'
              }`} style={{animationDelay: `${i * 0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        r.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                        r.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {r.status === 'pending' ? '⏳ Pending' : r.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                      <span className="text-slate-500 text-xs mono">Submitted {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-white font-medium">
                      {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                    </h3>
                    {r.reason && <p className="text-slate-400 text-sm mt-1">{r.reason}</p>}
                    <p className="text-slate-500 text-xs mt-2">
                      Requested by: <span className="text-slate-300">{r.user?.full_name || r.user?.email || 'Unknown'}</span>
                      {r.user?.role && <span className="text-slate-500 ml-1">({r.user.role})</span>}
                    </p>
                    {r.admin_note && (
                      <p className="text-slate-300 text-xs mt-2 bg-white/5 rounded-lg p-2">
                        <span className="text-slate-500">Admin note: </span>{r.admin_note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-fit">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => approveLeaveRequest(r)} disabled={processingLeaveId === r.id}
                          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105">
                          {processingLeaveId === r.id ? '...' : 'Approve'}
                        </button>
                        <button onClick={() => { setRejectingLeaveId(r.id); setRejectionNote('') }} disabled={processingLeaveId === r.id}
                          className="bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg transition-all border border-red-500/20">
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteLeaveRequest(r.id)}
                      className="bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg transition-all border border-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {rejectingLeaveId === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-scaleIn">
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Reason (optional)</label>
                    <div className="flex gap-2">
                      <input type="text" value={rejectionNote} onChange={e => setRejectionNote(e.target.value)}
                        placeholder="Why is this rejected?"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-red-500" />
                      <button onClick={() => rejectLeaveRequest(r)} disabled={processingLeaveId === r.id}
                        className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                        {processingLeaveId === r.id ? 'Saving...' : 'Confirm Reject'}
                      </button>
                      <button onClick={() => { setRejectingLeaveId(null); setRejectionNote('') }}
                        className="text-slate-400 hover:text-white border border-white/10 text-sm px-3 py-2 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'tickets' && !selectedTicket && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-medium">All Tickets</h2>
              <button onClick={() => setShowCreateTicket(v => !v)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                + New Ticket
              </button>
            </div>

            {showCreateTicket && (
              <form onSubmit={createTicket} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Title</label>
                    <input required value={ticketForm.title} onChange={e => setTicketForm(f=>({...f,title:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Issue title" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Affected Person</label>
                    <input value={ticketForm.affected_person} onChange={e => setTicketForm(f=>({...f,affected_person:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Person with issue" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Assign To</label>
                    <select value={ticketForm.assigned_to} onChange={e => setTicketForm(f=>({...f,assigned_to:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                    <select value={ticketForm.status} onChange={e => setTicketForm(f=>({...f,status:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                      <option value="opened">Opened</option>
                      <option value="pending">Pending</option>
                      <option value="solved">Solved</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Description</label>
                  <textarea rows={3} value={ticketForm.description} onChange={e => setTicketForm(f=>({...f,description:e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Describe the issue..." />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                    {loading ? 'Creating...' : 'Create Ticket'}
                  </button>
                  <button type="button" onClick={() => setShowCreateTicket(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Title','Description','Affected','Assigned To','Status','Created','Duration','Actions'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500 py-8">No tickets yet</td></tr>}
                  {tickets.map((t, i) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/2 transition-colors animate-fadeIn" style={{animationDelay: `${i * 0.05}s`}}>
                      <td className="px-4 py-3 text-white font-medium max-w-xs truncate">{t.title}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{t.affected_person || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {t.assigned_to_profile?.full_name || 'Unassigned'}
                        {t.assigned_to_profile?.role && (
                          <span className="text-slate-500 ml-1">({t.assigned_to_profile.role})</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-slate-400 text-xs mono">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs mono">
                        {t.status === 'solved' && t.solved_at
                          ? calculateDuration(t.created_at, t.solved_at)
                          : t.status === 'pending' && t.pending_at
                          ? calculateDuration(t.created_at, t.pending_at)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedTicket(t)} className="text-xs text-blue-400 hover:text-blue-300">View</button>
                          <button onClick={() => deleteTicket(t.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ticket Details */}
        {tab === 'tickets' && selectedTicket && (
          <div className="animate-fadeIn">
            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-all hover:scale-105">
              ← Back to Tickets
            </button>

            <div className="glass rounded-xl p-6 mb-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="text-xl text-white font-medium mb-2">{selectedTicket.title}</h2>
                  <p className="text-slate-400 text-sm mb-3">{selectedTicket.description}</p>
                  {selectedTicket.affected_person && (
                    <p className="text-slate-500 text-sm mb-2">👤 Affected: {selectedTicket.affected_person}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-slate-500">Created: <span className="text-white mono">{new Date(selectedTicket.created_at).toLocaleString()}</span></span>
                    <span className="text-slate-500">By: <span className="text-white">{selectedTicket.created_by_profile?.full_name || 'Unknown'}</span></span>
                    <span className="text-slate-500">Assigned: <span className="text-white">{selectedTicket.assigned_to_profile?.full_name || 'Unassigned'}</span></span>
                  </div>
                </div>
                <StatusBadge status={selectedTicket.status} />
              </div>

              <div className="flex gap-2">
                {['opened','pending','solved'].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedTicket.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      selectedTicket.status === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Show duration if solved */}
              {selectedTicket.status === 'solved' && selectedTicket.solved_at && (
                <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 text-sm font-medium">
                    ✅ Solved in {calculateDuration(selectedTicket.created_at, selectedTicket.solved_at)}
                  </p>
                </div>
              )}
            </div>

            {/* Replies */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
              <div className="space-y-3">
                {replies.map(r => (
                  <div key={r.id} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">{r.profiles?.full_name || 'Unknown'}</span>
                      <span className="text-slate-500 text-xs mono">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-300 text-sm">{r.message}</p>
                    {r.image_url && (
                      <img src={r.image_url} alt="Reply attachment" className="mt-2 max-w-xs rounded-lg" />
                    )}
                  </div>
                ))}
                {replies.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No replies yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && !selectedUser && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-medium">All Users</h2>
              <button onClick={() => setShowCreateUser(v => !v)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                + New User
              </button>
            </div>

            {showCreateUser && (
              <form onSubmit={createUser} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Full Name</label>
                    <input type="text" required placeholder="John Doe" value={userForm.full_name} onChange={e => setUserForm(f => ({...f,full_name:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                    <input type="text" required placeholder="john@company.com" value={userForm.email} onChange={e => setUserForm(f => ({...f,email:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Password</label>
                    <input type="password" required placeholder="••••••••" value={userForm.password} onChange={e => setUserForm(f => ({...f,password:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Role</label>
                    <select value={userForm.role} onChange={e => setUserForm(f => ({...f,role:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                      <option value="member">Member</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={userForm.can_view_attendance}
                    onChange={e => setUserForm(f => ({ ...f, can_view_attendance: e.target.checked }))}
                    className="rounded border-white/10 bg-white/5"
                  />
                  Allow this user to view the attendance table
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-all hover:scale-105">
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                  <button type="button" onClick={() => setShowCreateUser(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {editingUser && (
              <form onSubmit={updateUser} className="glass rounded-xl p-5 mb-4 space-y-4 animate-scaleIn">
                <h3 className="text-white font-medium">Edit User: {editingUser.email}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Full Name</label>
                    <input type="text" required value={userForm.full_name} onChange={e => setUserForm(f => ({...f,full_name:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Role</label>
                    <select value={userForm.role} onChange={e => setUserForm(f => ({...f,role:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                      <option value="member">Member</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={userForm.can_view_attendance}
                    onChange={e => setUserForm(f => ({ ...f, can_view_attendance: e.target.checked }))}
                    className="rounded border-white/10 bg-white/5"
                  />
                  Allow this user to view the attendance table
                </label>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                    {loading ? 'Updating...' : 'Update User'}
                  </button>
                  <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Name','Email','Role','Attendance Access','Joined','Tickets','Actions'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No users yet</td></tr>}
                  {users.map((u, i) => {
                    const count = tickets.filter(t => t.assigned_to === u.id).length
                    return (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition-colors animate-fadeIn" style={{animationDelay: `${i * 0.05}s`}}>
                        <td className="px-4 py-3 text-white font-medium">{u.full_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                            u.role === 'admin' ? 'bg-purple-900/30 text-purple-400' :
                            u.role === 'employee' ? 'bg-blue-900/30 text-blue-400' :
                            'bg-slate-900/30 text-slate-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            u.can_view_attendance ? 'bg-green-900/30 text-green-400' : 'bg-slate-900/30 text-slate-400'
                          }`}>
                            {u.can_view_attendance ? 'Allowed' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs mono">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3"><span className="text-blue-400 font-medium">{count}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => { setEditingUser(u); setUserForm({ full_name: u.full_name, role: u.role, can_view_attendance: !!u.can_view_attendance }) }} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                            <button
                              onClick={() => resetUserPassword(u)}
                              disabled={resettingUserId === u.id}
                              className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
                            >
                              {resettingUserId === u.id ? 'Resetting...' : 'Reset Password'}
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                            <button onClick={() => setSelectedUser(u)} className="text-xs text-slate-400 hover:text-white">Tickets</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User's Tickets */}
        {tab === 'users' && selectedUser && (
          <div className="animate-fadeIn">
            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-all hover:scale-105">
              ← Back to Users
            </button>
            <h2 className="text-white font-medium mb-4">Tickets assigned to {selectedUser.full_name || selectedUser.email}</h2>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Title','Description','Affected','Date','Status'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userTickets.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No tickets assigned</td></tr>}
                  {userTickets.map(t => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white font-medium">{t.title}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{t.affected_person || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs mono">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
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
