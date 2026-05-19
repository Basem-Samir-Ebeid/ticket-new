import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { playNotificationSound, showBrowserNotification } from '../lib/sound'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import AttendanceButton from '../components/AttendanceButton'
import FileAttachment from '../components/FileAttachment'
import AssetsPage from './AssetsPage'
import KnowledgeSuggest from '../components/KnowledgeSuggest'
import FactoryRotationPage from './FactoryRotationPage'
import OvertimeRotationPage from './OvertimeRotationPage'

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
  const [replyText, setReplyText] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestForm, setRequestForm] = useState({ title: '', description: '', affected_person: '', priority: 'medium', category: '', subcategory: '' })
  const [subcatMap, setSubcatMap] = useState({})
  const [templates, setTemplates] = useState([])
  const [ratingTicketId, setRatingTicketId] = useState(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [filter, setFilter] = useState('all')
  const [myFilter, setMyFilter] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [myTicketSearch, setMyTicketSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [review, setReview] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [activeTab, setActiveTab] = useState('tickets')
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone: '' })
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [changePasswordForm, setChangePasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [changePasswordMsg, setChangePasswordMsg] = useState('')
  const [todayLogin, setTodayLogin] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceDate, setAttendanceDate] = useState(getLocalDateString())
  const [leaveRequests, setLeaveRequests] = useState([])
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '', leave_type: 'annual' })
  const [leaveMsg, setLeaveMsg] = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [whatsappContacts, setWhatsappContacts] = useState([])
  const [waSearch, setWaSearch] = useState('')

  const selectedTicketRef = useRef(null)
  useEffect(() => { selectedTicketRef.current = selectedTicket }, [selectedTicket])

  useEffect(() => {
    if (!user) return
    fetchTickets()
    fetchMyRequests()
    fetchNotifications()
    checkTodayLogin()
    fetchLeaveRequests()
    fetchTemplates()
    api.getSubcategories().then(m => setSubcatMap(m || {})).catch(() => {})
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
    const onLeaveUpdate = () => {
      playNotificationSound()
      showBrowserNotification('Finest — إجازة', 'تم تحديث طلب الإجازة')
      fetchLeaveRequests()
    }
    const onAttendanceUpdate = () => checkTodayLogin()
    const onNotification = () => {
      playNotificationSound()
      showBrowserNotification('Finest — إشعار جديد', 'لديك إشعار جديد')
      fetchNotifications()
    }
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

  useEffect(() => {
    if (profile?.can_view_whatsapp_contacts) fetchWhatsappContacts()
  }, [profile?.can_view_whatsapp_contacts])

  async function checkTodayLogin() {
    try { setTodayLogin(await api.getTodayAttendance()) } catch {}
  }

  function validateCoords(lat, lng) {
    const latN = Number(lat)
    const lngN = Number(lng)
    if (!isFinite(latN) || !isFinite(lngN) || isNaN(latN) || isNaN(lngN)) return false
    if (latN === 0 && lngN === 0) return false
    if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return false
    return true
  }

  async function registerLogin() {
    setLoggingIn(true)
    setAttendanceError('')
    if (!navigator.geolocation) {
      setAttendanceError('الموقع الجغرافي غير مدعوم في هذا المتصفح.')
      setLoggingIn(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        console.log(`[GPS][check-in] lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`)
        if (!validateCoords(latitude, longitude)) {
          setAttendanceError('تعذّر الحصول على إحداثيات صالحة. تأكد من تفعيل GPS وأعد المحاولة.')
          setLoggingIn(false)
          return
        }
        try {
          await api.registerLogin(latitude, longitude)
          await checkTodayLogin()
          setAttendanceError('')
        } catch (e) {
          setAttendanceError(e.message)
        }
        setLoggingIn(false)
      },
      (err) => {
        console.error('[GPS][check-in] خطأ في الموقع:', err)
        setAttendanceError('يجب منح إذن الموقع لتسجيل الحضور. تأكد من تفعيل GPS والسماح للمتصفح بالوصول إليه.')
        setLoggingIn(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function registerLogout() {
    if (!todayLogin || todayLogin.logout_time) return
    setLoggingOut(true)
    setAttendanceError('')

    const nowCairo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
    const isAfterSixPM = nowCairo.getHours() >= 18

    if (isAfterSixPM) {
      // بعد 6 مساءً: نحاول نجيب الموقع بس مش مطلوب
      const tryGPS = () => new Promise((resolve) => {
        if (!navigator.geolocation) { resolve({ lat: null, lng: null }); return }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: null, lng: null }),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        )
      })
      const { lat, lng } = await tryGPS()
      try {
        await api.registerLogout(lat, lng)
        await checkTodayLogin()
        setAttendanceError('')
      } catch (e) {
        setAttendanceError(e.message)
      }
      setLoggingOut(false)
      return
    }

    // قبل 6 مساءً: الموقع مطلوب وبيتحقق من النطاق
    if (!navigator.geolocation) {
      setAttendanceError('الموقع الجغرافي غير مدعوم في هذا المتصفح.')
      setLoggingOut(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        console.log(`[GPS][check-out] lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`)
        if (!validateCoords(latitude, longitude)) {
          setAttendanceError('تعذّر الحصول على إحداثيات صالحة. تأكد من تفعيل GPS وأعد المحاولة.')
          setLoggingOut(false)
          return
        }
        try {
          await api.registerLogout(latitude, longitude)
          await checkTodayLogin()
          setAttendanceError('')
        } catch (e) {
          setAttendanceError(e.message)
        }
        setLoggingOut(false)
      },
      (err) => {
        console.error('[GPS][check-out] خطأ في الموقع:', err)
        setAttendanceError('يجب منح إذن الموقع لتسجيل الانصراف. تأكد من تفعيل GPS والسماح للمتصفح بالوصول إليه.')
        setLoggingOut(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
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

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name || '', email: profile.email || '', phone: profile.phone || '' })
    }
  }, [profile])

  async function handleUpdateProfile(e) {
    e.preventDefault(); setUpdatingProfile(true); setProfileMsg('')
    try {
      await api.updateProfile({ full_name: profileForm.full_name, phone: profileForm.phone })
      setProfileMsg('✓ Profile updated!')
    } catch (err) { setProfileMsg('Error: ' + err.message) }
    setUpdatingProfile(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (changePasswordForm.new_password !== changePasswordForm.confirm_password) {
      setChangePasswordMsg('Error: Passwords do not match'); return
    }
    if (changePasswordForm.new_password.length < 6) {
      setChangePasswordMsg('Error: Password must be at least 6 characters'); return
    }
    setChangingPassword(true); setChangePasswordMsg('')
    try {
      await api.changePassword(changePasswordForm.current_password, changePasswordForm.new_password)
      setChangePasswordMsg('✓ Password changed successfully!')
      setChangePasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) { setChangePasswordMsg('Error: ' + err.message) }
    setChangingPassword(false)
  }
  async function fetchTemplates() {
    try { setTemplates(await api.getTemplates()) } catch {}
  }
  async function fetchWhatsappContacts() {
    try { setWhatsappContacts(await api.getWhatsappContacts()) } catch {}
  }
  async function fetchReplies(ticketId) {
    try { setReplies(await api.getReplies(ticketId)) } catch {}
  }

  function applyTemplate(tmpl) {
    setRequestForm(f => ({ ...f, title: tmpl.title, description: tmpl.description || '', priority: tmpl.priority || 'medium' }))
  }

  async function submitRating(ticketId) {
    if (!ratingValue) return
    setSubmittingRating(true)
    try {
      await api.rateTicket(ticketId, ratingValue, ratingComment)
      setRatingTicketId(null); setRatingValue(0); setRatingComment('')
      fetchTickets()
      if (selectedTicket?.id === ticketId) setSelectedTicket(p => ({...p, rating: ratingValue, rating_comment: ratingComment || null}))
    } catch {}
    setSubmittingRating(false)
  }

  const getPriorityBadge = (p) => {
    if (p === 'low') return { label: 'Low', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' }
    if (p === 'high') return { label: 'High', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/25' }
    if (p === 'urgent') return { label: 'Urgent', cls: 'bg-red-500/10 text-red-400 border-red-500/25' }
    return { label: 'Medium', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/25' }
  }

  async function submitLeaveRequest(e) {
    e.preventDefault(); setLeaveMsg('')
    if (!leaveForm.start_date || !leaveForm.end_date) { setLeaveMsg('Error: Please pick start and end dates'); return }
    if (leaveForm.end_date < leaveForm.start_date) { setLeaveMsg('Error: End date must be after start date'); return }
    setSubmittingLeave(true)
    try {
      await api.createLeave(leaveForm)
      setLeaveMsg('✓ Leave request submitted!')
      setLeaveForm({ start_date: '', end_date: '', reason: '', leave_type: 'annual' })
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
        priority: requestForm.priority || 'medium',
        category: requestForm.category || null,
        subcategory: requestForm.subcategory || null,
        is_request: true,
      })
      setRequestMsg('✓ Request submitted!')
      setRequestForm({ title: '', description: '', affected_person: '', priority: 'medium', category: '', subcategory: '' })
      setShowRequestForm(false)
      fetchMyRequests()
    } catch (e) { setRequestMsg('Error: ' + e.message) }
    setLoading(false)
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!replyText.trim() && replyFiles.length === 0) return
    setUploading(true)
    setReplyError('')
    let attachments = []
    let file_url = null
    let file_name = null
    if (replyFiles.length > 0) {
      try {
        const uploads = await Promise.all(replyFiles.map(f => api.uploadFile(f)))
        attachments = uploads.map(r => r.url)
        file_url = uploads[0]?.url
        file_name = uploads[0]?.name
      } catch (err) {
        const msg = err.message || ''
        if (msg.includes('not allowed') || msg.includes('نوع الملف')) {
          setReplyError('❌ File type not allowed. Allowed types: images, PDF, Word, Excel, ZIP (max 5MB each)')
        } else if (msg.includes('5MB') || msg.includes('LIMIT_FILE_SIZE') || msg.includes('حجم')) {
          setReplyError('❌ File is too large. Maximum size is 5MB per file.')
        } else {
          setReplyError('❌ Upload failed. Please check your connection and try again.')
        }
        setUploading(false)
        return
      }
    }
    try {
      await api.createReply(selectedTicket.id, { message: replyText, image_url: file_url, attachment_name: file_name, attachments })
      setReplyText('')
      setReplyFiles([])
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

  const isMyTicket = (t) => t.created_by === user?.id
  const assignedTickets = tickets.filter(t => !isMyTicket(t))
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

  const memberTabs = [
    { key: 'tickets',     label: 'Assigned',    icon: 'assigned' },
    { key: 'myTickets',   label: 'My Tickets',  icon: 'myTickets' },
    { key: 'requests',    label: 'Requests',    icon: 'requests' },
    { key: 'leave',       label: 'Leave',       icon: 'leave' },
    ...(profile?.can_view_attendance ? [{ key: 'attendance', label: 'Attendance', icon: 'attendance' }] : []),
    ...(profile?.can_view_assets ? [{ key: 'assets', label: 'Assets', icon: 'assets' }] : []),
    ...(profile?.can_view_whatsapp_contacts ? [{ key: 'whatsappContacts', label: 'WhatsApp', icon: 'whatsapp' }] : []),
    { key: 'factory-rotation',  label: 'Factory Rotation', icon: 'factory' },
    { key: 'overtime-rotation', label: 'Overtime Rotation', icon: 'overtime' },
    { key: 'profile',           label: 'Profile',           icon: 'profile' },
  ]

  if (selectedTicket) {
    const isAssignee = selectedTicket.assigned_to === user?.id
    const canChangeStatus = (isMyTicket(selectedTicket) || isAssignee) && selectedTicket.status !== 'solved'
    const statuses = ['opened', 'pending', 'solved']
    return (
      <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 60% -10%, rgba(49,46,129,0.45) 0%, transparent 55%), #05050a'}}>
        <Sidebar tabs={memberTabs} activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); setSelectedTicket(null) }} />
        <div className="lg:ml-64">
        <div className="max-w-4xl mx-auto p-4 pt-16 lg:pt-16 lg:p-6 pb-6">
          <button onClick={()=>setSelectedTicket(null)} className="group flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Tickets
          </button>

          <div className="glass rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <StatusBadge status={selectedTicket.status} />
              {isMyTicket(selectedTicket) && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20">My Ticket</span>
              )}
              <span className="text-slate-500 text-xs">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">{selectedTicket.title}</h2>
            {selectedTicket.description && <p className="text-slate-400">{selectedTicket.description}</p>}
            {selectedTicket.affected_person && <p className="text-slate-500 text-sm mt-2">👤 {selectedTicket.affected_person}</p>}

            {(isMyTicket(selectedTicket) || isAssignee) && (
              <div className="mt-4 pt-4 border-t border-white/10">
                {selectedTicket.status === 'solved' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-900/20 border border-green-500/20 w-fit">
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <span className="text-green-400 text-sm font-medium">✅ تم حل التيكت — الحالة مُقفلة</span>
                    </div>
                    {isMyTicket(selectedTicket) && (
                      selectedTicket.rating ? (
                        <div className="p-3 rounded-xl" style={{background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)'}}>
                          <p className="text-amber-400 text-xs font-semibold mb-1">Your Rating</p>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 text-lg">{'★'.repeat(selectedTicket.rating)}{'☆'.repeat(5-selectedTicket.rating)}</span>
                            <span className="text-amber-300 font-bold">{selectedTicket.rating}/5</span>
                          </div>
                          {selectedTicket.rating_comment && <p className="text-slate-400 text-xs mt-1">{selectedTicket.rating_comment}</p>}
                        </div>
                      ) : (
                        ratingTicketId === selectedTicket.id ? (
                          <div className="p-4 rounded-xl space-y-3" style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)'}}>
                            <p className="text-amber-400 text-sm font-semibold">Rate this ticket</p>
                            <div className="flex gap-2">
                              {[1,2,3,4,5].map(star => (
                                <button key={star} type="button" onClick={()=>setRatingValue(star)}
                                  className={`text-2xl transition-all ${ratingValue >= star ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}`}>★</button>
                              ))}
                            </div>
                            <textarea value={ratingComment} onChange={e=>setRatingComment(e.target.value)} placeholder="Comment (optional)..." rows={2} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-slate-600 resize-none transition-all" />
                            <div className="flex gap-2">
                              <button onClick={()=>submitRating(selectedTicket.id)} disabled={!ratingValue||submittingRating} className="bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/30 text-amber-300 text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50">{submittingRating ? 'Submitting...' : 'Submit Rating'}</button>
                              <button onClick={()=>{setRatingTicketId(null);setRatingValue(0);setRatingComment('')}} className="btn-ghost text-sm px-3 py-2">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={()=>setRatingTicketId(selectedTicket.id)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 border border-white/8 hover:border-amber-500/30 px-4 py-2 rounded-xl transition-all" style={{background:'rgba(255,255,255,0.03)'}}>
                            <span>⭐</span> Rate this ticket
                          </button>
                        )
                      )
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-5 mb-5">
            <h3 className="text-white font-medium mb-4">Replies ({replies.length})</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto mb-5 pr-1" style={{scrollbarWidth:'thin',scrollbarColor:'rgba(255,255,255,0.08) transparent'}}>
              {replies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">No replies yet</p>
                </div>
              )}
              {replies.map(r => {
                const isMe = r.user_id === user?.id
                const initials = (r.profiles?.full_name || 'U')[0].toUpperCase()
                return (
                  <div key={r.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{background: isMe ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)'}}>
                      {initials}
                    </div>
                    <div className={`flex-1 min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-white text-xs font-semibold">{r.profiles?.full_name || 'User'}</span>
                        {isMe && <span className="text-indigo-400 text-[10px]">You</span>}
                        <span className="text-slate-600 text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={{background: isMe ? 'rgba(79,70,229,0.18)' : 'rgba(255,255,255,0.06)', border: isMe ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.06)'}}>
                        {r.message && <p className="text-slate-200 text-sm leading-relaxed">{r.message}</p>}
                        {r.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {r.attachments.map((url, i) => {
                              const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
                              return isImg ? (
                                <img key={i} src={url} alt="" className="max-w-[180px] max-h-[180px] rounded-lg object-cover cursor-pointer border border-white/10" onClick={() => window.open(url, '_blank')} />
                              ) : (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">📎 {url.split('/').pop()}</a>
                              )
                            })}
                          </div>
                        )}
                        {!r.attachments?.length && <FileAttachment url={r.image_url} name={r.attachment_name} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={submitReply} className="border-t border-white/8 pt-4 space-y-3">
              {replyError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  {replyError}
                </div>
              )}
              <textarea
                value={replyText}
                onChange={e=>{ setReplyText(e.target.value); setReplyError('') }}
                placeholder="Type your reply..."
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none transition-all border"
                style={{background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.08)'}}
                onFocus={e=>{e.target.style.borderColor='rgba(99,102,241,0.5)';e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.08)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}
              />
              {replyFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {replyFiles.map((file, i) => {
                    const isImg = file.type.startsWith('image/')
                    return (
                      <div key={i} className="relative group">
                        {isImg ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                        ) : (
                          <div className="w-16 h-16 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 text-center px-1">
                            <span className="text-lg">📎</span>
                            <span className="text-[9px] text-slate-400 truncate w-full text-center mt-0.5">{file.name.split('.').pop().toUpperCase()}</span>
                          </div>
                        )}
                        <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_,j)=>j!==i))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all" style={{background:'rgba(255,255,255,0.04)'}}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                  {replyFiles.length > 0 ? `${replyFiles.length} file(s)` : 'Attach Files'}
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip" multiple className="hidden" onChange={e => {
                    const files = Array.from(e.target.files)
                    const MAX_SIZE = 5 * 1024 * 1024
                    const oversized = files.filter(f => f.size > MAX_SIZE)
                    if (oversized.length > 0) {
                      setReplyError(`❌ These files exceed the 5MB limit: ${oversized.map(f => f.name).join(', ')}`)
                      return
                    }
                    setReplyFiles(prev => [...prev, ...files].slice(0, 5))
                    setReplyError('')
                    e.target.value = ''
                  }} />
                </label>
                <button
                  type="submit"
                  disabled={uploading || (!replyText.trim() && replyFiles.length === 0)}
                  className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow:'0 4px 14px rgba(79,70,229,0.3)'}}
                >
                  {uploading ? (
                    <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>Send Reply</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {selectedTicket.status === 'solved' && !selectedTicket.review && !isMyTicket(selectedTicket) && (
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
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at 60% -10%, rgba(49,46,129,0.45) 0%, transparent 55%), #05050a'}}>
      <Sidebar tabs={memberTabs} activeTab={activeTab} onTabChange={(t) => setActiveTab(t)} />
      <div className="lg:ml-64">
      <div className="max-w-4xl mx-auto p-4 pt-16 lg:pt-16 lg:p-6 pb-6">

        {/* Attendance */}
        <div className="glass-card rounded-2xl p-5 mb-6" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">Today's Attendance</p>
              {todayLogin ? (
                <div className="space-y-1">
                  <p className="text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse-slow"></span>
                    Check-in: {new Date(todayLogin.login_time).toLocaleTimeString()}
                  </p>
                  <p className="text-slate-300 text-sm">
                    Check-out: {todayLogin.logout_time ? new Date(todayLogin.logout_time).toLocaleTimeString() : <span className="text-amber-400">Pending</span>}
                  </p>
                  {todayLogin.logout_time && <p className="text-emerald-400 text-xs font-medium">⏱ Worked: {formatWorkDuration(todayLogin.login_time, todayLogin.logout_time)}</p>}
                  {todayLogin.latitude && <p className="text-slate-500 text-xs">📍 {todayLogin.latitude.toFixed(4)}, {todayLogin.longitude.toFixed(4)}</p>}
                </div>
              ) : <p className="text-slate-500 text-sm">No check-in recorded today</p>}
            </div>
            <AttendanceButton todayLogin={todayLogin} loggingIn={loggingIn} loggingOut={loggingOut} onLogin={registerLogin} onLogout={registerLogout} />
          </div>
          {attendanceError && (
            <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span dir="rtl">{attendanceError}</span>
            </div>
          )}
        </div>



        {/* Assigned Tickets Tab */}
        {activeTab === 'tickets' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total',   val: assignedTickets.length,                                 color: '#94a3b8', acc: 'rgba(99,102,241,0.06)',  bd: 'rgba(99,102,241,0.14)',  bar: 'rgba(99,102,241,0.5)' },
                { label: 'Opened',  val: assignedTickets.filter(t=>t.status==='opened').length,  color: '#60a5fa', acc: 'rgba(59,130,246,0.07)',  bd: 'rgba(59,130,246,0.16)',  bar: '#3b82f6' },
                { label: 'Pending', val: assignedTickets.filter(t=>t.status==='pending').length, color: '#fbbf24', acc: 'rgba(245,158,11,0.07)',  bd: 'rgba(245,158,11,0.16)',  bar: '#f59e0b' },
                { label: 'Solved',  val: assignedTickets.filter(t=>t.status==='solved').length,  color: '#34d399', acc: 'rgba(16,185,129,0.07)',  bd: 'rgba(16,185,129,0.16)',  bar: '#10b981' },
              ].map((s, i) => (
                <div key={s.label} className="relative rounded-2xl p-4 overflow-hidden glass-card animate-fadeIn"
                  style={{border:`1px solid ${s.bd}`, background:s.acc, animationDelay:`${i*0.07}s`}}>
                  <div className="absolute top-0 left-0 w-0.5 h-full" style={{background:s.bar}} />
                  <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold pl-2">{s.label}</p>
                  <p className="text-2xl font-black pl-2" style={{color:s.color}}>{s.val}</p>
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
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                />
              </div>
              <div className="flex gap-1.5">
                {['all','opened','pending','solved'].map(f => (
                  <button key={f} onClick={()=>setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter===f ? 'tab-active-indigo' : 'tab-inactive border border-white/8'}`}>{f}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2.5">
              {filteredAssigned.length === 0 && (
                <div className="glass-card rounded-2xl py-12 text-center" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-sm">{assignedTickets.length === 0 ? 'No tickets assigned' : 'No tickets match your search'}</p>
                  </div>
                </div>
              )}
              {filteredAssigned.map((t, i) => (
                <div key={t.id}
                  className="group rounded-2xl p-4 cursor-pointer transition-all animate-fadeIn glass-card"
                  style={{border:'1px solid rgba(255,255,255,0.06)', animationDelay:`${i*0.05}s`}}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}
                  onClick={()=>setSelectedTicket(t)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={t.status} />
                        <span className="text-slate-600 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-white text-sm font-medium group-hover:text-blue-200 transition-colors leading-snug">{t.title}</h3>
                      {t.description && <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{t.description}</p>}
                      {t.created_by_profile?.full_name && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={e => e.stopPropagation()}>
                          <span className="text-slate-500 text-xs">👤 From: <span className="text-slate-300 font-medium">{t.created_by_profile.full_name}</span></span>
                          {t.created_by_profile?.whatsapp_phone && (
                            <a
                              href={`https://wa.me/${t.created_by_profile.whatsapp_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, regarding ticket: ${t.title}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-75"
                              style={{background:'rgba(37,211,102,0.12)', color:'#25d366', border:'1px solid rgba(37,211,102,0.2)'}}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* My Tickets Tab */}
        {activeTab === 'myTickets' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-lg">My Tickets</h2>
                <p className="text-slate-500 text-sm">Create and track your own tickets</p>
              </div>
              <button
                onClick={()=>{setShowRequestForm(v=>!v); setRequestMsg('')}}
                className="btn-primary text-sm px-4 py-2"
              >
                {showRequestForm ? 'Close' : '+ New Ticket'}
              </button>
            </div>

            {showRequestForm && (
              <form onSubmit={submitRequest} className="glass-card rounded-2xl p-5 mb-6 space-y-4" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">Send Ticket to Admin</h3>
                  {templates.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs">Template:</span>
                      <select onChange={e => { if(e.target.value) { const t = templates.find(t=>t.id===e.target.value); if(t) applyTemplate(t) } }} defaultValue="" className="bg-white/5 border border-white/8 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50 transition-all">
                        <option value="">— Use Template —</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {requestMsg && <div className={`text-sm rounded-xl p-3 ${requestMsg.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{requestMsg}</div>}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Title *</label>
                  <input type="text" required placeholder="Brief description..." value={requestForm.title} onChange={e=>setRequestForm(f=>({...f,title:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  <KnowledgeSuggest query={requestForm.title} />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Description</label>
                  <textarea placeholder="Explain the issue..." rows={3} value={requestForm.description} onChange={e=>setRequestForm(f=>({...f,description:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none transition-all" />
                </div>
                {Object.keys(subcatMap).length > 0 && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Category</label>
                    <select value={requestForm.category} onChange={e=>setRequestForm(f=>({...f,category:e.target.value,subcategory:''}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="">-- Select category --</option>
                      {Object.keys(subcatMap).map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    {requestForm.category && subcatMap[requestForm.category]?.length > 0 && (
                      <select value={requestForm.subcategory} onChange={e=>setRequestForm(f=>({...f,subcategory:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all mt-2">
                        <option value="">-- Select subcategory --</option>
                        {subcatMap[requestForm.category].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Affected Person</label>
                    <input type="text" placeholder="Who is affected? (optional)" value={requestForm.affected_person} onChange={e=>setRequestForm(f=>({...f,affected_person:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Priority</label>
                    <select value={requestForm.priority} onChange={e=>setRequestForm(f=>({...f,priority:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 text-sm px-5 py-2">{loading ? 'Submitting...' : 'Send to Admin'}</button>
                  <button type="button" onClick={()=>setShowRequestForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                </div>
              </form>
            )}

            {myRequests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Pending Requests</h3>
                <div className="space-y-2">
                  {myRequests.map(r => {
                    const info = requestStatusInfo(r.request_status)
                    return (
                      <div key={r.id} className="glass-card rounded-2xl p-4" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info.cls}`}>{info.label}</span>
                          <span className="text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-slate-100 font-semibold text-sm">{r.title}</h3>
                        {r.description && <p className="text-slate-500 text-xs mt-1">{r.description}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {myOwnTickets.length > 0 && (
              <div>
                <h3 className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Accepted Tickets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total',   val: myOwnTickets.length,                                color: '#94a3b8', bar: 'rgba(99,102,241,0.5)',  acc: 'rgba(99,102,241,0.06)',  bd: 'rgba(99,102,241,0.14)' },
                    { label: 'Opened',  val: myOwnTickets.filter(t=>t.status==='opened').length,  color: '#60a5fa', bar: '#3b82f6',               acc: 'rgba(59,130,246,0.07)',  bd: 'rgba(59,130,246,0.16)' },
                    { label: 'Pending', val: myOwnTickets.filter(t=>t.status==='pending').length, color: '#fbbf24', bar: '#f59e0b',               acc: 'rgba(245,158,11,0.07)',  bd: 'rgba(245,158,11,0.16)' },
                    { label: 'Solved',  val: myOwnTickets.filter(t=>t.status==='solved').length,  color: '#34d399', bar: '#10b981',               acc: 'rgba(16,185,129,0.07)',  bd: 'rgba(16,185,129,0.16)' },
                  ].map((s, i) => (
                    <div key={s.label} className="relative rounded-2xl p-4 overflow-hidden glass-card animate-fadeIn"
                      style={{border:`1px solid ${s.bd}`, background:s.acc, animationDelay:`${i*0.07}s`}}>
                      <div className="absolute top-0 left-0 w-0.5 h-full" style={{background:s.bar}} />
                      <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold pl-2">{s.label}</p>
                      <p className="text-2xl font-black pl-2" style={{color:s.color}}>{s.val}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      value={myTicketSearch}
                      onChange={e => setMyTicketSearch(e.target.value)}
                      placeholder="Search my tickets..."
                      className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {['all','opened','pending','solved'].map(f => (
                      <button key={f} onClick={()=>setMyFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${myFilter===f ? 'tab-active-indigo' : 'tab-inactive border border-white/8'}`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredMy.map((t, i) => (
                    <div key={t.id}
                      className="group rounded-2xl p-4 cursor-pointer transition-all animate-fadeIn glass-card"
                      style={{border:'1px solid rgba(255,255,255,0.06)', animationDelay:`${i*0.05}s`}}
                      onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}
                      onClick={()=>setSelectedTicket(t)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <StatusBadge status={t.status} />
                            {(() => { const pb = getPriorityBadge(t.priority); return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pb.cls}`}>{pb.label}</span> })()}
                            <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{background:'rgba(99,102,241,0.1)',color:'#a5b4fc',borderColor:'rgba(99,102,241,0.2)'}}>My Ticket</span>
                            <span className="text-slate-600 text-[11px]">{new Date(t.created_at).toLocaleDateString()}</span>
                            {t.rating && <span className="text-amber-400 text-[10px]">{'★'.repeat(t.rating)}{'☆'.repeat(5-t.rating)}</span>}
                          </div>
                          <h3 className="text-slate-100 text-sm font-semibold group-hover:text-white transition-colors leading-snug">{t.title}</h3>
                          {t.description && <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{t.description}</p>}
                        </div>
                        <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  ))}
                  {filteredMy.length === 0 && (
                    <div className="glass-card rounded-2xl py-8 text-center" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                      <p className="text-slate-500 text-sm">No tickets with this status</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {myRequests.length === 0 && myOwnTickets.length === 0 && !showRequestForm && (
              <div className="glass-card rounded-2xl py-16" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-1">No tickets yet</p>
                  <p className="text-slate-500 text-sm mb-5">Create a ticket and send it to admin for review</p>
                  <button onClick={()=>setShowRequestForm(true)} className="btn-primary text-sm px-5 py-2">+ Create First Ticket</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Requests tab */}
        {activeTab === 'requests' && (
          <>
            <div className="space-y-2">
              {myRequests.length === 0 && (
                <div className="glass-card rounded-2xl py-12" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="empty-state"><p className="text-slate-500 text-sm">No requests yet</p></div>
                </div>
              )}
              {myRequests.map(r => {
                const info = requestStatusInfo(r.request_status)
                return (
                  <div key={r.id} className="glass-card rounded-2xl p-4" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
                      <span className="text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-slate-100 font-semibold text-sm">{r.title}</h3>
                    {r.description && <p className="text-slate-500 text-xs mt-1">{r.description}</p>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {activeTab === 'leave' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <button onClick={()=>{setShowLeaveForm(v=>!v);setLeaveMsg('')}} className="btn-primary text-sm px-4 py-2">
                {showLeaveForm ? 'Close' : '+ Request Leave'}
              </button>
              <div className="text-xs text-slate-500 flex gap-3">
                <span>Pending: <span className="text-amber-400 font-semibold">{leaveRequests.filter(r=>r.status==='pending').length}</span></span>
                <span>Approved: <span className="text-emerald-400 font-semibold">{leaveRequests.filter(r=>r.status==='approved').length}</span></span>
              </div>
            </div>
            {showLeaveForm && (
              <form onSubmit={submitLeaveRequest} className="rounded-2xl p-5 mb-4 space-y-3" style={{background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.2)'}}>
                {leaveMsg && <div className={`text-sm rounded-xl p-3 ${leaveMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{leaveMsg}</div>}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Leave Type</label>
                  <select value={leaveForm.leave_type} onChange={e=>setLeaveForm(f=>({...f,leave_type:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Start Date</label>
                    <input type="date" required value={leaveForm.start_date} onChange={e=>setLeaveForm(f=>({...f,start_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">End Date</label>
                    <input type="date" required value={leaveForm.end_date} onChange={e=>setLeaveForm(f=>({...f,end_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                </div>
                <textarea placeholder="Reason (optional)" rows={2} value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none transition-all" />
                <div className="flex gap-2">
                  <button type="submit" disabled={submittingLeave} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">{submittingLeave ? 'Submitting...' : 'Submit'}</button>
                  <button type="button" onClick={()=>setShowLeaveForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {leaveRequests.length === 0 && (
                <div className="empty-state py-10">
                  <p className="text-slate-500 text-sm">No leave requests yet</p>
                </div>
              )}
              {leaveRequests.map(r => (
                <div key={r.id} className="rounded-2xl p-3.5 glass-card" style={{border: r.status==='pending' ? '1px solid rgba(245,158,11,0.2)' : r.status==='approved' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)'}}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.status==='approved' ? 'bg-emerald-900/30 text-emerald-400' : r.status==='rejected' ? 'bg-red-900/30 text-red-400' : 'bg-amber-900/30 text-amber-400'}`}>
                      {r.status==='pending' ? 'Pending' : r.status==='approved' ? 'Approved' : 'Rejected'}
                    </span>
                    <span className="text-slate-400 text-sm">{new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}</span>
                  </div>
                  {r.reason && <p className="text-slate-500 text-xs mt-1">{r.reason}</p>}
                  {r.admin_note && <p className="text-slate-400 text-xs mt-2 rounded-xl px-3 py-2" style={{background:'rgba(255,255,255,0.04)'}}><span className="text-slate-500">Note: </span>{r.admin_note}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'assets' && profile?.can_view_assets && (
          <AssetsPage />
        )}

        {activeTab === 'attendance' && profile?.can_view_attendance && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm">Attendance Table</h2>
              <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 transition-all" />
            </div>
            <div className="glass-card rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
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
                    {attendanceRecords.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">No attendance recorded</td></tr>}
                    {attendanceRecords.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{r.full_name||'—'}</td>
                        <td className="px-4 py-3 text-slate-300">{r.email}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${r.role==='admin' ? 'bg-purple-900/30 text-purple-400' : r.role==='member' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{r.role}</span></td>
                        <td className="px-4 py-3 text-white font-mono">{new Date(r.login_time).toLocaleTimeString()}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono">{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : 'Still working'}</td>
                        <td className="px-4 py-3 text-green-400 text-xs">{r.logout_time ? formatWorkDuration(r.login_time, r.logout_time) : 'In progress'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'factory-rotation' && (
          <FactoryRotationPage />
        )}

        {activeTab === 'overtime-rotation' && (
          <OvertimeRotationPage />
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.2)'}}>👤</span>
                Edit Profile
              </h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Full Name</label>
                  <input value={profileForm.full_name} onChange={e=>setProfileForm(f=>({...f,full_name:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Email</label>
                  <input value={profileForm.email} disabled className="w-full bg-white/3 border border-white/5 rounded-xl px-3 py-2.5 text-slate-500 text-sm cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">رقم الواتساب</label>
                  <input value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" placeholder="مثال: 01012345678" dir="ltr" />
                </div>
                {profileMsg && <p className={`text-sm rounded-xl px-3 py-2 ${profileMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{profileMsg}</p>}
                <button type="submit" disabled={updatingProfile} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">{updatingProfile ? 'Saving...' : 'Save Changes'}</button>
              </form>
            </div>

            <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(245,158,11,0.15)'}}>
              <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.2)'}}>🔐</span>
                Change Password
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Current Password</label>
                  <input type="password" value={changePasswordForm.current_password} onChange={e=>setChangePasswordForm(f=>({...f,current_password:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" autoComplete="current-password" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">New Password</label>
                  <input type="password" value={changePasswordForm.new_password} onChange={e=>setChangePasswordForm(f=>({...f,new_password:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" autoComplete="new-password" placeholder="Min. 6 characters" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Confirm New Password</label>
                  <input type="password" value={changePasswordForm.confirm_password} onChange={e=>setChangePasswordForm(f=>({...f,confirm_password:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" autoComplete="new-password" />
                </div>
                {changePasswordMsg && <p className={`text-sm rounded-xl px-3 py-2 ${changePasswordMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{changePasswordMsg}</p>}
                <button type="submit" disabled={changingPassword} className="bg-amber-900/50 hover:bg-amber-800/70 border border-amber-500/25 disabled:opacity-40 text-amber-300 text-sm font-semibold py-2 px-4 rounded-xl transition-all">{changingPassword ? 'Updating...' : 'Update Password'}</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'whatsappContacts' && profile?.can_view_whatsapp_contacts && (
          <>
            <div className="mb-5">
              <h2 className="text-white font-semibold text-lg">WhatsApp Contacts</h2>
              <p className="text-slate-500 text-sm">أصحاب التيكتات — تواصل معهم مباشرةً عبر واتساب</p>
            </div>
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={waSearch}
                onChange={e => setWaSearch(e.target.value)}
                placeholder="ابحث باسم أو قسم أو مسمى..."
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-600 transition-all"
              />
            </div>
            {whatsappContacts.length === 0 ? (
              <div className="glass-card rounded-2xl py-12 text-center" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <p className="text-slate-500 text-sm">لا توجد جهات بعد — ستظهر هنا عند إنشاء تيكتات</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {whatsappContacts
                  .filter(c => {
                    const q = waSearch.toLowerCase()
                    return !q || (c.full_name||'').toLowerCase().includes(q) || (c.department||'').toLowerCase().includes(q) || (c.job_title||'').toLowerCase().includes(q)
                  })
                  .map(c => {
                    const initials = (c.full_name || c.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    const phone = c.whatsapp_phone?.replace(/\D/g, '')
                    return (
                      <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-fadeIn" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                        <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                          style={{background:'linear-gradient(135deg,#0e7490,#0891b2)'}}>
                          {c.profile_picture_url
                            ? <img src={c.profile_picture_url} alt="" className="w-full h-full object-cover" />
                            : initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{c.full_name || c.email}</p>
                          {(c.job_title || c.department) && (
                            <p className="text-slate-500 text-xs truncate">{[c.job_title, c.department].filter(Boolean).join(' — ')}</p>
                          )}
                        </div>
                        {phone ? (
                          <a
                            href={`https://wa.me/${phone}?text=${encodeURIComponent('مرحباً، أتواصل معك بخصوص تيكت في نظام Finest.')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-75"
                            style={{background:'rgba(37,211,102,0.15)', color:'#25d366', border:'1px solid rgba(37,211,102,0.25)'}}
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            واتساب
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs flex-shrink-0">لا يوجد رقم</span>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  )
}
