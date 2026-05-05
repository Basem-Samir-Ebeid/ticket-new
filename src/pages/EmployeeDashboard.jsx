import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { playNotificationSound, showBrowserNotification } from '../lib/sound'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import AttendanceButton from '../components/AttendanceButton'

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isImageFile(url) {
  if (!url) return false
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
}

function getFileIcon(name) {
  if (!name) return '📎'
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx','csv'].includes(ext)) return '📊'
  if (['ppt','pptx'].includes(ext)) return '📋'
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '🗜️'
  if (['mp4','mov','avi','mkv'].includes(ext)) return '🎬'
  if (['mp3','wav','ogg'].includes(ext)) return '🎵'
  if (['txt','md'].includes(ext)) return '📃'
  return '📎'
}

function FileAttachment({ url, name }) {
  if (!url) return null
  if (isImageFile(url)) {
    return (
      <div className="mt-2">
        <img src={url} alt={name || 'Attachment'} className="rounded-lg max-w-xs max-h-64 object-contain border border-white/10 cursor-pointer" onClick={() => window.open(url, '_blank')} />
        {name && <p className="text-slate-500 text-xs mt-1">🖼️ {name}</p>}
      </div>
    )
  }
  const displayName = name || url.split('/').pop()
  const icon = getFileIcon(displayName)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={displayName}
      className="mt-2 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group"
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 truncate max-w-xs">{displayName}</span>
      <span className="text-slate-500 group-hover:text-blue-300 text-xs">↓ Download</span>
    </a>
  )
}

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('assigned')
  const [tickets, setTickets] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyText, setReplyText] = useState('')
  const [replyFile, setReplyFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [filter, setFilter] = useState('all')
  const [myFilter, setMyFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [myTicketSearch, setMyTicketSearch] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', description: '', affected_person: '' })
  const [createMsg, setCreateMsg] = useState('')
  const [creating, setCreating] = useState(false)

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
    if (user) {
      fetchTickets()
      fetchMyRequests()
      checkTodayLogin()
      fetchLeaveRequests()
    }
  }, [user])

  useEffect(() => {
    const onTicketUpdate = () => {
      playNotificationSound()
      showBrowserNotification('Finest — تحديث التيكت', 'تم تحديث أحد التيكتات')
      fetchTickets(); fetchMyRequests()
    }
    const onTicketReply = (e) => {
      if (selectedTicketRef.current?.id === e.detail?.ticket_id) {
        playNotificationSound()
        showBrowserNotification('Finest — رد جديد', 'رد جديد على التيكت المفتوح')
        fetchReplies(selectedTicketRef.current.id)
      }
    }
    const onAttendanceUpdate = () => checkTodayLogin()
    const onLeaveUpdate = () => {
      playNotificationSound()
      showBrowserNotification('Finest — إجازة', 'تم تحديث طلب الإجازة')
      fetchLeaveRequests()
    }
    window.addEventListener('ws:ticket_update', onTicketUpdate)
    window.addEventListener('ws:ticket_reply', onTicketReply)
    window.addEventListener('ws:attendance_update', onAttendanceUpdate)
    window.addEventListener('ws:leave_update', onLeaveUpdate)
    return () => {
      window.removeEventListener('ws:ticket_update', onTicketUpdate)
      window.removeEventListener('ws:ticket_reply', onTicketReply)
      window.removeEventListener('ws:attendance_update', onAttendanceUpdate)
      window.removeEventListener('ws:leave_update', onLeaveUpdate)
    }
  }, [])

  useEffect(() => {
    if (profile?.can_view_attendance) fetchAttendanceRecords()
  }, [profile?.can_view_attendance, attendanceDate])

  useEffect(() => {
    if (selectedTicket) fetchReplies(selectedTicket.id)
  }, [selectedTicket])

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

  function formatWorkDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    const diff = new Date(endTime) - new Date(startTime)
    return `${Math.floor(diff/(1000*60*60))}h ${Math.floor((diff%(1000*60*60))/(1000*60))}m`
  }

  async function fetchTickets() {
    try { setTickets(await api.getTickets()) } catch {}
  }

  async function fetchMyRequests() {
    try { setMyRequests(await api.getRequests()) } catch {}
  }

  async function fetchLeaveRequests() {
    try { setLeaveRequests(await api.getLeaves()) } catch {}
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

  async function fetchReplies(ticketId) {
    try { setReplies(await api.getReplies(ticketId)) } catch {}
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!replyText.trim() && !replyFile) return
    setUploading(true)
    setReplyError('')
    let file_url = null
    let file_name = null
    if (replyFile) {
      try {
        const result = await api.uploadFile(replyFile)
        file_url = result.url
        file_name = result.name
      } catch (err) {
        setReplyError('File upload failed: ' + (err.message || 'Unknown error'))
        setUploading(false)
        return
      }
    }
    try {
      await api.createReply(selectedTicket.id, { message: replyText, image_url: file_url, attachment_name: file_name })
      setReplyText('')
      setReplyFile(null)
      fetchReplies(selectedTicket.id)
    } catch (err) {
      setReplyError('Failed to send reply: ' + (err.message || 'Unknown error'))
    }
    setUploading(false)
  }

  async function updateStatus(id, status) {
    try {
      await api.updateTicket(id, { status })
      fetchTickets()
      if (selectedTicket?.id === id) setSelectedTicket(p => ({...p, status}))
    } catch {}
  }

  async function submitCreateTicket(e) {
    e.preventDefault(); setCreateMsg('')
    if (!createForm.title.trim()) return
    setCreating(true)
    try {
      await api.createTicket({
        title: createForm.title,
        description: createForm.description,
        affected_person: createForm.affected_person,
        is_request: true,
      })
      setCreateMsg('✓ Ticket submitted to admin for review!')
      setCreateForm({ title: '', description: '', affected_person: '' })
      setShowCreateForm(false)
      fetchMyRequests()
    } catch (err) { setCreateMsg('Error: ' + err.message) }
    setCreating(false)
  }

  const isMyTicket = (t) => t.created_by === user?.id
  const assignedTickets = tickets.filter(t => !isMyTicket(t) || t.assigned_to === user?.id)
  const myOwnTickets = tickets.filter(t => isMyTicket(t))

  const filteredAssigned = assignedTickets.filter(t => {
    const q = ticketSearch.toLowerCase().trim()
    const matchesSearch = !q || (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q) || (t.affected_person||'').toLowerCase().includes(q)
    return matchesSearch && (filter === 'all' || t.status === filter)
  })
  const filteredMy = myOwnTickets.filter(t => {
    const q = myTicketSearch.toLowerCase().trim()
    const matchesSearch = !q || (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q)
    return matchesSearch && (myFilter === 'all' || t.status === myFilter)
  })

  const requestStatusInfo = (s) => {
    if (s === 'accepted') return { label: '✅ Accepted', cls: 'bg-green-900/30 text-green-400 border border-green-500/20' }
    if (s === 'refused') return { label: '❌ Refused', cls: 'bg-red-900/30 text-red-400 border border-red-500/20' }
    return { label: '⏳ Pending Review', cls: 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/20' }
  }

  if (selectedTicket) {
    const canChangeStatus = isMyTicket(selectedTicket) || selectedTicket.assigned_to === user?.id
    const statuses = ['opened', 'pending', 'solved']
    return (
      <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
        <Navbar title="Finest" />
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={()=>setSelectedTicket(null)} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>

          <div className="glass rounded-xl p-5 mb-5">
            <div className="flex items-start justify-between mb-3 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="text-slate-500 text-xs">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                  {isMyTicket(selectedTicket) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20">My Ticket</span>
                  )}
                </div>
                <h2 className="text-white text-xl font-semibold">{selectedTicket.title}</h2>
                {selectedTicket.description && <p className="text-slate-400 mt-2">{selectedTicket.description}</p>}
                {selectedTicket.affected_person && <p className="text-slate-500 text-sm mt-2">👤 {selectedTicket.affected_person}</p>}
              </div>
            </div>

            {canChangeStatus && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Change Status</p>
                <div className="flex gap-2 flex-wrap">
                  {statuses.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedTicket.id, s)}
                      disabled={selectedTicket.status === s}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all border ${
                        selectedTicket.status === s
                          ? s === 'opened' ? 'bg-blue-600/30 text-blue-400 border-blue-500/40 cursor-default'
                            : s === 'pending' ? 'bg-yellow-600/30 text-yellow-400 border-yellow-500/40 cursor-default'
                            : 'bg-green-600/30 text-green-400 border-green-500/40 cursor-default'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s === 'opened' ? '🔵 Opened' : s === 'pending' ? '🟡 Pending' : '✅ Solved'}
                      {selectedTicket.status === s && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
            <div className="space-y-3 mb-5 max-h-96 overflow-y-auto pr-1">
              {replies.length === 0 && <p className="text-slate-500 text-sm">No replies yet</p>}
              {replies.map(r => (
                <div key={r.id} className={`rounded-lg p-3 ${r.user_id === user?.id ? 'bg-blue-900/20 border border-blue-500/15 ml-4' : 'bg-white/5 border border-white/5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{r.profiles?.full_name || 'User'}</span>
                    {r.user_id === user?.id && <span className="text-xs text-blue-400">(You)</span>}
                    <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.message && <p className="text-slate-300 text-sm">{r.message}</p>}
                  <FileAttachment url={r.image_url} name={r.attachment_name} />
                </div>
              ))}
            </div>

            <form onSubmit={submitReply} className="space-y-3 border-t border-white/10 pt-4">
              {replyError && (
                <div className="bg-red-900/30 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2">{replyError}</div>
              )}
              <textarea
                value={replyText}
                onChange={e=>{ setReplyText(e.target.value); setReplyError('') }}
                placeholder="Type your reply..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                  📎 {replyFile ? replyFile.name : 'Attach File or Image'}
                  <input type="file" accept="*/*" className="hidden" onChange={e=>{ setReplyFile(e.target.files[0]); setReplyError('') }} />
                </label>
                {replyFile && (
                  <button type="button" onClick={()=>setReplyFile(null)} className="text-slate-500 hover:text-red-400 text-xs">✕ Remove</button>
                )}
                <button
                  type="submit"
                  disabled={uploading || (!replyText.trim() && !replyFile)}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg font-medium"
                >
                  {uploading ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const tabs = ['assigned', 'myTickets', 'leave', ...(profile?.can_view_attendance ? ['attendance'] : [])]
  const tabLabels = { assigned: 'Assigned Tickets', myTickets: 'My Tickets', leave: 'Leave', attendance: 'Attendance' }

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 70% 0%, #0d1a3a 0%, #0a0a0f 50%)'}}>
      <Navbar title="Finest" />
      <div className="max-w-4xl mx-auto p-6">

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

        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-white/10">
          {tabs.map(t => (
            <button
              key={t}
              onClick={()=>setActiveTab(t)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeTab===t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {tabLabels[t]}
              {t === 'myTickets' && myRequests.length > 0 && (
                <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">{myRequests.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'assigned' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total', val: assignedTickets.length, color: 'text-white', icon: '📊' },
                { label: 'Opened', val: assignedTickets.filter(t=>t.status==='opened').length, color: 'text-blue-400', icon: '🔵' },
                { label: 'Pending', val: assignedTickets.filter(t=>t.status==='pending').length, color: 'text-yellow-400', icon: '🟡' },
                { label: 'Solved', val: assignedTickets.filter(t=>t.status==='solved').length, color: 'text-green-400', icon: '✅' },
              ].map((s, i) => (
                <div key={s.label} className="glass rounded-xl p-4 hover-lift animate-fadeIn" style={{animationDelay:`${i*0.1}s`}}>
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-2"><span>{s.icon}</span>{s.label}</p>
                  <p className={`text-2xl font-semibold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              </div>
              <div className="flex gap-2">
                {['all','opened','pending','solved'].map(f => (
                  <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter===f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'}`}>{f}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredAssigned.length === 0 && <div className="glass rounded-xl py-12 text-center text-slate-500">{assignedTickets.length === 0 ? 'No tickets assigned' : 'No tickets match your search'}</div>}
              {filteredAssigned.map((t, i) => (
                <div key={t.id} className="glass rounded-xl p-4 hover:border-white/15 transition-all cursor-pointer" onClick={()=>setSelectedTicket(t)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={t.status} />
                        <span className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-white font-medium">{t.title}</h3>
                      {t.description && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{t.description}</p>}
                      {t.affected_person && <p className="text-slate-500 text-xs mt-2">👤 {t.affected_person}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'myTickets' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-lg">My Tickets</h2>
                <p className="text-slate-500 text-sm">Create and track your own tickets</p>
              </div>
              <button
                onClick={()=>{setShowCreateForm(v=>!v); setCreateMsg('')}}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {showCreateForm ? 'Close' : '+ New Ticket'}
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={submitCreateTicket} className="glass rounded-xl p-5 mb-6 space-y-4 border border-blue-500/20">
                <h3 className="text-white font-medium">Send Ticket to Admin</h3>
                {createMsg && (
                  <div className={`text-sm rounded-lg p-3 ${createMsg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                    {createMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of the issue..."
                    value={createForm.title}
                    onChange={e=>setCreateForm(f=>({...f,title:e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Description</label>
                  <textarea
                    placeholder="Explain the issue in detail..."
                    rows={3}
                    value={createForm.description}
                    onChange={e=>setCreateForm(f=>({...f,description:e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Affected Person</label>
                  <input
                    type="text"
                    placeholder="Who is affected? (optional)"
                    value={createForm.affected_person}
                    onChange={e=>setCreateForm(f=>({...f,affected_person:e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg font-medium">
                    {creating ? 'Submitting...' : 'Send to Admin'}
                  </button>
                  <button type="button" onClick={()=>setShowCreateForm(false)} className="text-slate-400 hover:text-white border border-white/10 text-sm px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {myRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3">Pending Requests</h3>
                <div className="space-y-3">
                  {myRequests.map(r => {
                    const info = requestStatusInfo(r.request_status)
                    return (
                      <div key={r.id} className="glass rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${info.cls}`}>{info.label}</span>
                              <span className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 className="text-white font-medium">{r.title}</h3>
                            {r.description && <p className="text-slate-400 text-sm mt-1">{r.description}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {myOwnTickets.length > 0 && (
              <div>
                <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-3">Accepted Tickets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Total', val: myOwnTickets.length, color: 'text-white', icon: '📊' },
                    { label: 'Opened', val: myOwnTickets.filter(t=>t.status==='opened').length, color: 'text-blue-400', icon: '🔵' },
                    { label: 'Pending', val: myOwnTickets.filter(t=>t.status==='pending').length, color: 'text-yellow-400', icon: '🟡' },
                    { label: 'Solved', val: myOwnTickets.filter(t=>t.status==='solved').length, color: 'text-green-400', icon: '✅' },
                  ].map(s => (
                    <div key={s.label} className="glass rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><span>{s.icon}</span>{s.label}</p>
                      <p className={`text-xl font-semibold ${s.color}`}>{s.val}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 mb-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      value={myTicketSearch}
                      onChange={e => setMyTicketSearch(e.target.value)}
                      placeholder="Search my tickets..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['all','opened','pending','solved'].map(f => (
                      <button key={f} onClick={()=>setMyFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${myFilter===f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white border border-white/10'}`}>{f}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredMy.map(t => (
                    <div key={t.id} className="glass rounded-xl p-4 hover:border-white/15 transition-all cursor-pointer" onClick={()=>setSelectedTicket(t)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <StatusBadge status={t.status} />
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20">My Ticket</span>
                            <span className="text-slate-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                          <h3 className="text-white font-medium">{t.title}</h3>
                          {t.description && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{t.description}</p>}
                        </div>
                        <div className="text-slate-500 text-xs">→</div>
                      </div>
                    </div>
                  ))}
                  {filteredMy.length === 0 && <div className="glass rounded-xl py-8 text-center text-slate-500 text-sm">No tickets with this status</div>}
                </div>
              </div>
            )}

            {myRequests.length === 0 && myOwnTickets.length === 0 && !showCreateForm && (
              <div className="glass rounded-xl py-16 text-center">
                <p className="text-slate-400 text-4xl mb-4">🎫</p>
                <p className="text-white font-medium mb-2">No tickets yet</p>
                <p className="text-slate-500 text-sm mb-5">Create a ticket and send it to admin for review</p>
                <button onClick={()=>setShowCreateForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2 rounded-lg font-medium">
                  + Create First Ticket
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'leave' && (
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium">🌴 Leave Requests</h2>
              <button onClick={()=>{setShowLeaveForm(v=>!v);setLeaveMsg('')}} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">
                {showLeaveForm ? 'Close' : '+ Request Leave'}
              </button>
            </div>

            {showLeaveForm && (
              <form onSubmit={submitLeaveRequest} className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
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
          </div>
        )}

        {activeTab === 'attendance' && profile?.can_view_attendance && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium">Attendance Table</h2>
              <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      {['Name','Email','Role','Login Time','Sign Off','Worked','Date'].map(h => (
                        <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No attendance recorded for {new Date(attendanceDate).toLocaleDateString()}</td></tr>}
                    {attendanceRecords.map(record => (
                      <tr key={record.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{record.full_name||'—'}</td>
                        <td className="px-4 py-3 text-slate-300">{record.email}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${record.role==='admin' ? 'bg-purple-900/30 text-purple-400' : record.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{record.role}</span></td>
                        <td className="px-4 py-3 text-white font-mono">{new Date(record.login_time).toLocaleTimeString()}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono">{record.logout_time ? new Date(record.logout_time).toLocaleTimeString() : 'Still working'}</td>
                        <td className="px-4 py-3 text-green-400 text-xs">{record.logout_time ? formatWorkDuration(record.login_time, record.logout_time) : 'In progress'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(record.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
