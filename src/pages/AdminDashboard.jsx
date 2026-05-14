import { useState, useEffect, useRef } from 'react'
import { api, exportCsv } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import AttendanceButton from '../components/AttendanceButton'
import FileAttachment from '../components/FileAttachment'
import DraggableOfficeMap from '../components/DraggableOfficeMap'
import { playNotificationSound, showBrowserNotification } from '../lib/sound'
import AssetsPage from './AssetsPage'
import PenaltiesPage from './PenaltiesPage'
import ComplaintsPage from './ComplaintsPage'
import SLABadge from '../components/SLABadge'
import EmployeeProfilePage from './EmployeeProfilePage'

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AdminDashboard({ isSuperAdmin = false }) {
  const { user } = useAuth()
  const btnPrimary = isSuperAdmin ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
  const bgGrad = isSuperAdmin
    ? 'radial-gradient(ellipse at 60% -10%, rgba(120,53,15,0.5) 0%, transparent 55%), radial-gradient(ellipse at 90% 60%, rgba(80,30,5,0.25) 0%, transparent 45%), #05050a'
    : 'radial-gradient(ellipse at 60% -10%, rgba(49,46,129,0.5) 0%, transparent 55%), radial-gradient(ellipse at 10% 80%, rgba(30,15,80,0.25) 0%, transparent 45%), #05050a'
  const focusBorder = isSuperAdmin ? 'focus:border-amber-500' : 'focus:border-indigo-500'
  const [tab, setTab] = useState('dashboard')
  const [tickets, setTickets] = useState([])
  const [users, setUsers] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false, can_view_assets: false, can_view_whatsapp_contacts: false, profile_picture_url: '', leave_balance: 21, sick_leave_balance: 14, emergency_leave_balance: 7, department: '', job_title: '', phone: '', national_id: '', hire_date: '', birth_date: '', gender: '', address: '', employment_type: 'full_time', employee_code: '', direct_manager: '', notes: '', whatsapp_phone: '' })
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened', priority: 'medium', category: '', due_date: '', asset_id: '' })
  const [ticketAssets, setTicketAssets] = useState([])
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
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '', leave_type: 'annual' })
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [resetPwdTarget, setResetPwdTarget] = useState(null)
  const [resetPwdValue, setResetPwdValue] = useState('')
  const [resetPwdShow, setResetPwdShow] = useState(false)
  const [resetPwdError, setResetPwdError] = useState('')
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [uploadingPic, setUploadingPic] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all')
  const [ticketSortByPriority, setTicketSortByPriority] = useState(false)
  const [templates, setTemplates] = useState([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', title: '', description: '', priority: 'medium' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateMsg, setTemplateMsg] = useState('')
  const [officeForm, setOfficeForm] = useState({ latitude: '', longitude: '', radius_meters: '' })
  const [officeMsg, setOfficeMsg] = useState('')
  const [savingOffice, setSavingOffice] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle')
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [settingsLog, setSettingsLog] = useState([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyFile, setReplyFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [githubSyncStatus, setGithubSyncStatus] = useState(null)
  const [githubSyncForm, setGithubSyncForm] = useState({ repo_url: '', branch: 'main', token: '' })
  const [githubSyncHasToken, setGithubSyncHasToken] = useState(false)
  const [githubSyncMsg, setGithubSyncMsg] = useState('')
  const [savingGithubSync, setSavingGithubSync] = useState(false)
  const [testingGithubSync, setTestingGithubSync] = useState(false)
  const [githubSyncTestResult, setGithubSyncTestResult] = useState(null)
  const [githubSyncLoaded, setGithubSyncLoaded] = useState(false)
  const [triggeringGithubSync, setTriggeringGithubSync] = useState(false)
  const [githubSyncTriggerResult, setGithubSyncTriggerResult] = useState(null)
  const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, secure: false, user: '', password: '', from_name: 'Finest IT', from_email: '', enabled: false })
  const [smtpMsg, setSmtpMsg] = useState('')
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState(null)
  const [smtpLoaded, setSmtpLoaded] = useState(false)
  const [waForm, setWaForm] = useState({ enabled: false, greenapi_instance_id: '', greenapi_token: '', phone: '' })
  const [waMsg, setWaMsg] = useState('')
  const [savingWa, setSavingWa] = useState(false)
  const [testingWa, setTestingWa] = useState(false)
  const [waTestResult, setWaTestResult] = useState(null)
  const [waLoaded, setWaLoaded] = useState(false)
  const [waUserEdits, setWaUserEdits] = useState({})
  const [waUserSaving, setWaUserSaving] = useState({})
  const [waUserTestResults, setWaUserTestResults] = useState({})
  const [waUserTestingId, setWaUserTestingId] = useState(null)
  const [waUserSearch, setWaUserSearch] = useState('')
  const [monthlyReport, setMonthlyReport] = useState(null)
  const [monthlyReportYear, setMonthlyReportYear] = useState(new Date().getFullYear())
  const [monthlyReportMonth, setMonthlyReportMonth] = useState(new Date().getMonth() + 1)
  const [loadingMonthlyReport, setLoadingMonthlyReport] = useState(false)
  const [lateOTReport, setLateOTReport] = useState(null)
  const [lateOTYear, setLateOTYear] = useState(new Date().getFullYear())
  const [lateOTMonth, setLateOTMonth] = useState(new Date().getMonth() + 1)
  const [loadingLateOT, setLoadingLateOT] = useState(false)
  const [lateOTExpanded, setLateOTExpanded] = useState(null)
  const [lateOTSort, setLateOTSort] = useState('late_total')
  const TICKETS_PER_PAGE = 20
  const USERS_PER_PAGE = 20
  const [ticketPage, setTicketPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [ticketHistoryMap, setTicketHistoryMap] = useState({})
  const [liveAttendance, setLiveAttendance] = useState(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [attendanceCorrections, setAttendanceCorrections] = useState([])
  const [loadingCorrections, setLoadingCorrections] = useState(false)
  const [remoteRequests, setRemoteRequests] = useState([])
  const [loadingRemoteRequests, setLoadingRemoteRequests] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [editAttendanceForm, setEditAttendanceForm] = useState({ login_time: '', logout_time: '', attendance_type: 'office' })
  const [savingAttendanceEdit, setSavingAttendanceEdit] = useState(false)
  const [editAttendanceMsg, setEditAttendanceMsg] = useState('')
  const [leaveCalendar, setLeaveCalendar] = useState([])
  const [leaveCalendarMonth, setLeaveCalendarMonth] = useState(new Date().getMonth())
  const [leaveCalendarYear, setLeaveCalendarYear] = useState(new Date().getFullYear())
  const [leaveReport, setLeaveReport] = useState(null)
  const [leaveReportYear, setLeaveReportYear] = useState(new Date().getFullYear())
  const [leaveReportMonth, setLeaveReportMonth] = useState(new Date().getMonth() + 1)
  const [loadingLeaveReport, setLoadingLeaveReport] = useState(false)
  const [penaltiesRefreshKey, setPenaltiesRefreshKey] = useState(0)
  const [complaintsRefreshKey, setComplaintsRefreshKey] = useState(0)
  const [showBulkReset, setShowBulkReset] = useState(false)
  const [bulkResetForm, setBulkResetForm] = useState({ leave_balance: 21, sick_leave_balance: 14, emergency_leave_balance: 7, roles: [] })
  const [bulkResetMsg, setBulkResetMsg] = useState('')
  const [bulkResetting, setBulkResetting] = useState(false)
  const [bulkResetConfirm, setBulkResetConfirm] = useState(false)
  const [employeeProfileId, setEmployeeProfileId] = useState(null)
  const [autoAssignRules, setAutoAssignRules] = useState([])
  const [savingAutoAssign, setSavingAutoAssign] = useState(false)
  const [autoAssignMsg, setAutoAssignMsg] = useState('')
  const [autoAssignNewCategory, setAutoAssignNewCategory] = useState('')
  const [autoAssignNewUserId, setAutoAssignNewUserId] = useState('')
  const [githubSyncAlert, setGithubSyncAlert] = useState(null)

  const selectedTicketRef = useRef(null)
  const selectedDateRef = useRef(selectedDate)
  const autoSaveTimerRef = useRef(null)
  const officeSettingsLoadedRef = useRef(false)
  useEffect(() => { selectedTicketRef.current = selectedTicket }, [selectedTicket])
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  useEffect(() => {
    fetchTickets()
    fetchUsers()
    fetchRequests()
    fetchLoginTimes()
    checkTodayLogin()
    fetchLeaveRequests()
    fetchTemplates()
    if (isSuperAdmin) fetchGithubSyncStatus()
  }, [])

  useEffect(() => {
    const onTicketUpdate = (e) => {
      playNotificationSound()
      showBrowserNotification('Finest — تيكت جديد', 'تم استلام تيكت جديد يحتاج مراجعة')
      fetchTickets(); fetchRequests()
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
      showBrowserNotification('Finest — طلب إجازة', 'تم استلام طلب إجازة جديد')
      fetchLeaveRequests()
    }
    const onAttendanceUpdate = async () => {
      checkTodayLogin()
      try { const res = await api.getAttendance(selectedDateRef.current); setLoginTimes(Array.isArray(res) ? res : []) } catch { setLoginTimes([]) }
    }
    const onRemoteRequestUpdate = () => { fetchRemoteRequests(); fetchLiveAttendance() }
    const onNotification = (e) => {
      const notifMessage = e.detail?.message || ''
      const isGithubSyncFailure = isSuperAdmin && notifMessage.includes('GitHub sync failed')
      if (isGithubSyncFailure) {
        setGithubSyncAlert({ message: notifMessage, time: new Date().toLocaleTimeString() })
        showBrowserNotification('Finest — GitHub Sync Failed', notifMessage)
        fetchGithubSyncStatus()
      } else {
        playNotificationSound()
        showBrowserNotification('Finest — إشعار جديد', 'لديك إشعار جديد')
      }
      fetchTickets(); fetchRequests(); fetchLeaveRequests()
    }
    const onPenaltyUpdate = () => {
      setPenaltiesRefreshKey(k => k + 1)
    }
    const onComplaintUpdate = () => {
      setComplaintsRefreshKey(k => k + 1)
    }
    window.addEventListener('ws:ticket_update', onTicketUpdate)
    window.addEventListener('ws:ticket_reply', onTicketReply)
    window.addEventListener('ws:leave_update', onLeaveUpdate)
    window.addEventListener('ws:attendance_update', onAttendanceUpdate)
    window.addEventListener('ws:remote_request_update', onRemoteRequestUpdate)
    window.addEventListener('ws:notification', onNotification)
    window.addEventListener('ws:penalty_update', onPenaltyUpdate)
    window.addEventListener('ws:complaint_update', onComplaintUpdate)
    return () => {
      window.removeEventListener('ws:ticket_update', onTicketUpdate)
      window.removeEventListener('ws:ticket_reply', onTicketReply)
      window.removeEventListener('ws:leave_update', onLeaveUpdate)
      window.removeEventListener('ws:attendance_update', onAttendanceUpdate)
      window.removeEventListener('ws:remote_request_update', onRemoteRequestUpdate)
      window.removeEventListener('ws:notification', onNotification)
      window.removeEventListener('ws:penalty_update', onPenaltyUpdate)
      window.removeEventListener('ws:complaint_update', onComplaintUpdate)
    }
  }, [])

  useEffect(() => { if (selectedTicket) fetchReplies(selectedTicket.id) }, [selectedTicket])
  useEffect(() => { if (selectedDate) fetchLoginTimes() }, [selectedDate])

  useEffect(() => {
    if (!isSuperAdmin) return
    const interval = setInterval(fetchGithubSyncStatus, 60000)
    return () => clearInterval(interval)
  }, [isSuperAdmin])

  useEffect(() => {
    if (!officeSettingsLoadedRef.current) return
    const lat = parseFloat(officeForm.latitude)
    const lng = parseFloat(officeForm.longitude)
    const radius = parseFloat(officeForm.radius_meters)
    if (!isFinite(lat) || !isFinite(lng) || !isFinite(radius) || radius <= 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setAutoSaveStatus('idle')
    autoSaveTimerRef.current = setTimeout(() => {
      performSaveOffice(lat, lng, radius)
    }, 1500)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [officeForm])

  async function fetchOfficeSettings() {
    officeSettingsLoadedRef.current = false
    setLoadingSettings(true)
    setAutoSaveStatus('idle')
    setOfficeMsg('')
    try {
      const data = await api.getOfficeLocation()
      setOfficeForm({ latitude: String(data.latitude), longitude: String(data.longitude), radius_meters: String(data.radius_meters) })
    } catch {}
    setLoadingSettings(false)
    officeSettingsLoadedRef.current = true
  }

  async function fetchSettingsLog() {
    setLoadingLog(true)
    try { setSettingsLog(await api.getSettingsLog()) } catch {}
    setLoadingLog(false)
  }

  async function performSaveOffice(lat, lng, radius) {
    setSavingOffice(true)
    setAutoSaveStatus('saving')
    setOfficeMsg('')
    try {
      await api.saveOfficeLocation({ latitude: lat, longitude: lng, radius_meters: radius })
      setAutoSaveStatus('saved')
      fetchSettingsLog()
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    } catch (err) {
      setAutoSaveStatus('error')
      setOfficeMsg('Error: ' + err.message)
    }
    setSavingOffice(false)
  }

  async function handleSaveOffice(e) {
    e.preventDefault()
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null }
    const lat = parseFloat(officeForm.latitude)
    const lng = parseFloat(officeForm.longitude)
    const radius = parseFloat(officeForm.radius_meters)
    await performSaveOffice(lat, lng, radius)
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setDetectError('المتصفح لا يدعم تحديد الموقع')
      return
    }
    setDetectingLocation(true)
    setDetectError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeForm(f => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }))
        setDetectingLocation(false)
      },
      (err) => {
        setDetectError('تعذر تحديد الموقع: ' + err.message)
        setDetectingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function fetchTickets() {
    try { setTickets(await api.getTickets()) } catch {}
  }
  async function fetchUsers() {
    try { setUsers(await api.getUsers()) } catch {}
  }
  async function fetchTicketAssets() {
    try { setTicketAssets(await api.getAssets()) } catch {}
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
  async function fetchGithubSyncStatus() {
    try { setGithubSyncStatus(await api.getGithubSyncStatus()) } catch { setGithubSyncStatus({ result: null, timestamp: null, message: 'Unable to fetch sync status' }) }
  }

  async function fetchTemplates() {
    try { setTemplates(await api.getTemplates()) } catch {}
  }

  async function fetchLiveAttendance() {
    setLoadingLive(true)
    try { setLiveAttendance(await api.getLiveAttendance()) } catch {}
    setLoadingLive(false)
  }

  async function fetchAttendanceCorrections() {
    setLoadingCorrections(true)
    try { setAttendanceCorrections(await api.getAttendanceCorrections()) } catch {}
    setLoadingCorrections(false)
  }

  async function reviewCorrection(id, status, note) {
    try {
      await api.reviewAttendanceCorrection(id, status, note)
      fetchAttendanceCorrections()
    } catch (err) { setMsg('Error: ' + err.message) }
  }

  async function fetchLeaveCalendar() {
    try { setLeaveCalendar(await api.getLeaveCalendar()) } catch {}
  }

  async function fetchLeaveReport() {
    setLoadingLeaveReport(true)
    try { setLeaveReport(await api.getLeaveMonthlyReport(leaveReportYear, leaveReportMonth)) } catch {}
    setLoadingLeaveReport(false)
  }

  async function createTemplate(e) {
    e.preventDefault()
    if (!templateForm.name.trim() || !templateForm.title.trim()) return
    setSavingTemplate(true); setTemplateMsg('')
    try {
      await api.createTemplate(templateForm)
      setTemplateMsg('✓ Template created!')
      setTemplateForm({ name: '', title: '', description: '', priority: 'medium' })
      setShowTemplateForm(false)
      fetchTemplates()
    } catch (err) { setTemplateMsg('Error: ' + err.message) }
    setSavingTemplate(false)
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return
    try { await api.deleteTemplate(id); fetchTemplates() } catch {}
  }

  async function fetchGithubSyncSettings() {
    if (!isSuperAdmin) return
    try {
      const data = await api.getGithubSyncSettings()
      setGithubSyncForm({ repo_url: data.repo_url || '', branch: data.branch || 'main', token: '' })
      setGithubSyncHasToken(data.has_token)
    } catch (err) {
      setGithubSyncMsg('Error loading GitHub sync settings: ' + (err.message || 'Unknown error'))
    } finally {
      setGithubSyncLoaded(true)
    }
  }

  async function fetchSmtpSettings() {
    try {
      const data = await api.getSmtpSettings()
      setSmtpForm({ host: data.host||'', port: data.port||587, secure: data.secure||false, user: data.user||'', password: '', from_name: data.from_name||'Finest IT', from_email: data.from_email||'', enabled: data.enabled||false })
    } catch {}
    setSmtpLoaded(true)
  }

  async function fetchAutoAssignRules() {
    try { const d = await api.getAutoAssignRules(); setAutoAssignRules(d.rules || []) } catch {}
  }

  async function handleSaveAutoAssign() {
    setSavingAutoAssign(true); setAutoAssignMsg('')
    try {
      await api.saveAutoAssignRules({ rules: autoAssignRules })
      setAutoAssignMsg('✓ تم حفظ قواعد الإسناد التلقائي!')
    } catch (err) { setAutoAssignMsg('Error: ' + err.message) }
    setSavingAutoAssign(false)
  }

  function addAutoAssignRule() {
    if (!autoAssignNewCategory.trim() || !autoAssignNewUserId) return
    const user = users.find(u => u.id === autoAssignNewUserId)
    setAutoAssignRules(r => [...r, { category: autoAssignNewCategory.trim(), user_id: autoAssignNewUserId, user_name: user?.full_name || user?.email || '' }])
    setAutoAssignNewCategory('')
    setAutoAssignNewUserId('')
  }

  function removeAutoAssignRule(idx) {
    setAutoAssignRules(r => r.filter((_, i) => i !== idx))
  }

  async function handleSaveSmtp(e) {
    e.preventDefault()
    setSavingSmtp(true); setSmtpMsg(''); setSmtpTestResult(null)
    try {
      const payload = { ...smtpForm }
      if (!smtpForm.password) delete payload.password
      await api.saveSmtpSettings(payload)
      setSmtpMsg('✓ SMTP settings saved!')
      setSmtpForm(f => ({ ...f, password: '' }))
    } catch (err) { setSmtpMsg('Error: ' + err.message) }
    setSavingSmtp(false)
  }

  async function handleTestSmtp() {
    setTestingSmtp(true); setSmtpTestResult(null); setSmtpMsg('')
    try {
      const data = await api.testSmtpSettings({ test_email: smtpForm.from_email || smtpForm.user || '' })
      setSmtpTestResult({ ok: true, message: data.message })
    } catch (err) { setSmtpTestResult({ ok: false, message: err.message }) }
    setTestingSmtp(false)
  }

  async function fetchWhatsAppSettings() {
    try {
      const data = await api.getWhatsAppSettings()
      setWaForm({
        enabled: data.enabled || false,
        greenapi_instance_id: data.greenapi_instance_id || '',
        greenapi_token: data.greenapi_token || '',
        phone: data.phone || '',
      })
    } catch {}
    setWaLoaded(true)
  }

  async function handleSaveWhatsApp(e) {
    e.preventDefault()
    setSavingWa(true); setWaMsg(''); setWaTestResult(null)
    try {
      const saved = await api.saveWhatsAppSettings(waForm)
      setWaMsg('✓ تم حفظ إعدادات واتساب!')
      setWaForm(f => ({ ...f, greenapi_token: saved.greenapi_token || '' }))
    } catch (err) { setWaMsg('Error: ' + err.message) }
    setSavingWa(false)
  }

  async function handleTestWhatsApp() {
    setTestingWa(true); setWaTestResult(null); setWaMsg('')
    try {
      const data = await api.testWhatsAppSettings({})
      setWaTestResult({ ok: true, message: data.message })
    } catch (err) { setWaTestResult({ ok: false, message: err.message }) }
    setTestingWa(false)
  }

  async function saveUserWhatsApp(userId) {
    const edits = waUserEdits[userId] || {}
    setWaUserSaving(s => ({ ...s, [userId]: true }))
    try {
      const phone = edits.whatsapp_phone?.trim() ?? ''
      await api.updateUser(userId, { whatsapp_phone: phone })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, whatsapp_phone: phone } : u))
      setWaUserEdits(e => { const n = { ...e }; delete n[userId]; return n })
      setWaUserTestResults(r => ({ ...r, [userId]: { ok: true, message: '✓ تم الحفظ' } }))
      setTimeout(() => setWaUserTestResults(r => { const n = { ...r }; delete n[userId]; return n }), 2500)
    } catch (err) {
      setWaUserTestResults(r => ({ ...r, [userId]: { ok: false, message: err.message } }))
    }
    setWaUserSaving(s => ({ ...s, [userId]: false }))
  }

  async function testUserWhatsAppMsg(userId) {
    setWaUserTestingId(userId)
    setWaUserTestResults(r => ({ ...r, [userId]: null }))
    try {
      const edits = waUserEdits[userId]
      if (edits?.whatsapp_phone !== undefined) {
        const phone = edits.whatsapp_phone?.trim() ?? ''
        if (!phone) {
          setWaUserTestResults(r => ({ ...r, [userId]: { ok: false, message: 'أدخل رقم الواتساب أولاً' } }))
          setWaUserTestingId(null)
          return
        }
        await api.updateUser(userId, { whatsapp_phone: phone })
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, whatsapp_phone: phone } : u))
        setWaUserEdits(e => { const n = { ...e }; delete n[userId]; return n })
      }
      const data = await api.testUserWhatsApp(userId)
      setWaUserTestResults(r => ({ ...r, [userId]: { ok: true, message: data.message || '✅ تم الإرسال بنجاح' } }))
    } catch (err) {
      setWaUserTestResults(r => ({ ...r, [userId]: { ok: false, message: err.message } }))
    }
    setWaUserTestingId(null)
  }

  async function fetchMonthlyReport() {
    setLoadingMonthlyReport(true); setMonthlyReport(null)
    try {
      const data = await api.getMonthlyAttendanceReport(monthlyReportYear, monthlyReportMonth)
      setMonthlyReport(data)
    } catch (err) { setMonthlyReport({ error: err.message }) }
    setLoadingMonthlyReport(false)
  }

  async function fetchLateOTReport() {
    setLoadingLateOT(true); setLateOTReport(null); setLateOTExpanded(null)
    try {
      const data = await api.getLateOvertimeDetail(lateOTYear, lateOTMonth)
      setLateOTReport(data)
    } catch (err) { setLateOTReport({ error: err.message }) }
    setLoadingLateOT(false)
  }

  async function handleSaveGithubSync(e) {
    e.preventDefault()
    setSavingGithubSync(true)
    setGithubSyncMsg('')
    setGithubSyncTestResult(null)
    try {
      const payload = { repo_url: githubSyncForm.repo_url, branch: githubSyncForm.branch }
      if (githubSyncForm.token) payload.token = githubSyncForm.token
      const data = await api.saveGithubSyncSettings(payload)
      setGithubSyncHasToken(data.has_token)
      setGithubSyncForm(f => ({ ...f, token: '' }))
      if (data.warning) {
        setGithubSyncMsg('Warning: ' + data.warning)
      } else {
        setGithubSyncMsg('GitHub sync settings saved successfully.')
      }
    } catch (err) {
      setGithubSyncMsg('Error: ' + err.message)
    }
    setSavingGithubSync(false)
  }

  async function handleTriggerGithubSync() {
    setTriggeringGithubSync(true)
    setGithubSyncTriggerResult(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/settings/github-sync/trigger', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const label = data.result ? `[${data.result}] ` : ''
      if (res.ok) {
        setGithubSyncTriggerResult({ ok: true, message: label + (data.message || 'Sync completed successfully.') })
      } else {
        setGithubSyncTriggerResult({ ok: false, message: label + (data.message || data.error || 'Sync failed.') })
      }
      await fetchGithubSyncStatus()
    } catch (err) {
      setGithubSyncTriggerResult({ ok: false, message: err.message || 'Sync trigger failed.' })
    }
    setTriggeringGithubSync(false)
  }

  async function handleTestGithubSync() {
    setTestingGithubSync(true)
    setGithubSyncTestResult(null)
    setGithubSyncMsg('')
    try {
      const payload = { repo_url: githubSyncForm.repo_url }
      if (githubSyncForm.token) payload.token = githubSyncForm.token
      const data = await api.testGithubSyncConnection(payload)
      setGithubSyncTestResult({ ok: true, message: data.message })
    } catch (err) {
      setGithubSyncTestResult({ ok: false, message: err.message })
    }
    setTestingGithubSync(false)
  }
  async function fetchLoginTimes() {
    try { const res = await api.getAttendance(selectedDate); setLoginTimes(Array.isArray(res) ? res : []) } catch (e) {
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

  async function submitOwnLeave(e) {
    e.preventDefault()
    if (!leaveForm.start_date || !leaveForm.end_date) return
    setSubmittingLeave(true)
    try {
      await api.createLeave(leaveForm)
      setMsg('✓ Leave request submitted')
      setShowLeaveForm(false)
      setLeaveForm({ start_date: '', end_date: '', reason: '', leave_type: 'annual' })
      fetchLeaveRequests()
    } catch (err) { setMsg('Error: ' + err.message) }
    setSubmittingLeave(false)
  }

  async function registerLogin(type = 'office') {
    setLoggingIn(type)
    setMsg('')

    if (type === 'remote') {
      try {
        await api.registerLogin(null, null, 'remote')
        await checkTodayLogin()
        if (selectedDate === getLocalDateString()) await fetchLoginTimes()
      } catch (e) { setMsg('Error: ' + e.message) }
      setLoggingIn(false)
      return
    }

    if (!navigator.geolocation) {
      setMsg('Error: الموقع الجغرافي غير مدعوم في هذا المتصفح')
      setLoggingIn(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          await api.registerLogin(latitude, longitude, 'office')
          await checkTodayLogin()
          if (selectedDate === getLocalDateString()) await fetchLoginTimes()
        } catch (e) { setMsg('Error: ' + e.message) }
        setLoggingIn(false)
      },
      () => { setMsg('Error: يجب منح إذن الموقع لتسجيل الحضور. تأكد من تفعيل GPS والسماح للمتصفح بالوصول إليه.'); setLoggingIn(false) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function registerLogout() {
    if (!todayLogin || todayLogin.logout_time) return
    setLoggingOut(true)
    setMsg('')
    if (!navigator.geolocation) {
      setMsg('Error: الموقع الجغرافي غير مدعوم في هذا المتصفح')
      setLoggingOut(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          await api.registerLogout(latitude, longitude)
          await checkTodayLogin()
          if (selectedDate === getLocalDateString()) await fetchLoginTimes()
        } catch (e) { setMsg('Error: ' + e.message) }
        setLoggingOut(false)
      },
      () => { setMsg('Error: يجب منح إذن الموقع لتسجيل الانصراف. تأكد من تفعيل GPS والسماح للمتصفح بالوصول إليه.'); setLoggingOut(false) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
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
        try { const r = await api.uploadFile(profilePicFile); profile_picture_url = r.url } catch {}
        setUploadingPic(false)
      }
      await api.updateUser(editingUser.id, {
        full_name: userForm.full_name,
        role: userForm.role,
        can_view_attendance: userForm.can_view_attendance,
        can_view_assets: userForm.can_view_assets,
        can_view_whatsapp_contacts: userForm.can_view_whatsapp_contacts,
        profile_picture_url,
        leave_balance: Number(userForm.leave_balance),
        sick_leave_balance: Number(userForm.sick_leave_balance),
        emergency_leave_balance: Number(userForm.emergency_leave_balance),
        work_start_hour: Number(userForm.work_start_hour ?? 9),
        department: userForm.department,
        job_title: userForm.job_title,
        phone: userForm.phone,
        national_id: userForm.national_id,
        hire_date: userForm.hire_date || null,
        birth_date: userForm.birth_date || null,
        gender: userForm.gender,
        address: userForm.address,
        employment_type: userForm.employment_type,
        employee_code: userForm.employee_code,
        direct_manager: userForm.direct_manager,
        notes: userForm.notes,
        whatsapp_phone: userForm.whatsapp_phone,
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

  async function handleBulkResetLeave(e) {
    e.preventDefault()
    if (!bulkResetConfirm) { setBulkResetMsg('⚠ يرجى تأكيد العملية أولاً'); return }
    setBulkResetting(true); setBulkResetMsg('')
    try {
      const payload = {
        leave_balance: Number(bulkResetForm.leave_balance),
        sick_leave_balance: Number(bulkResetForm.sick_leave_balance),
        emergency_leave_balance: Number(bulkResetForm.emergency_leave_balance),
      }
      if (bulkResetForm.roles.length > 0) payload.roles = bulkResetForm.roles
      const result = await api.bulkResetLeave(payload)
      setBulkResetMsg(`✓ تم تحديث أرصدة ${result.updated} موظف بنجاح`)
      setBulkResetConfirm(false)
      fetchUsers()
    } catch (err) { setBulkResetMsg('خطأ: ' + err.message) }
    setBulkResetting(false)
  }

  async function createUser(e) {
    e.preventDefault(); setLoading(true); setMsg('')
    try {
      let profile_picture_url = null
      if (profilePicFile) {
        setUploadingPic(true)
        try { const r = await api.uploadFile(profilePicFile); profile_picture_url = r.url } catch {}
        setUploadingPic(false)
      }
      await api.createUser({ ...userForm, profile_picture_url })
      setMsg('✓ User created!')
      setUserForm({ email: '', password: '', full_name: '', role: 'member', can_view_attendance: false, can_view_assets: false, can_view_whatsapp_contacts: false, profile_picture_url: '', leave_balance: 21, sick_leave_balance: 14, emergency_leave_balance: 7, department: '', job_title: '', phone: '', national_id: '', hire_date: '', birth_date: '', gender: '', address: '', employment_type: 'full_time', employee_code: '', direct_manager: '', notes: '', whatsapp_phone: '' })
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
        priority: ticketForm.priority || 'medium',
        category: ticketForm.category || null,
        due_date: ticketForm.due_date || null,
        asset_id: ticketForm.asset_id || null,
      })
      setMsg('✓ Ticket created!')
      setTicketForm({ title: '', description: '', affected_person: '', assigned_to: '', status: 'opened', priority: 'medium', category: '', due_date: '', asset_id: '' })
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

  async function fetchRemoteRequests() {
    setLoadingRemoteRequests(true)
    try { setRemoteRequests(await api.getRemoteRequests()) } catch {}
    setLoadingRemoteRequests(false)
  }

  async function approveRemoteRequest(id) {
    try {
      await api.approveRemoteRequest(id)
      fetchRemoteRequests(); fetchLiveAttendance()
    } catch (e) { setMsg('Error: ' + e.message) }
  }

  async function rejectRemoteRequest(id) {
    try {
      await api.rejectRemoteRequest(id)
      fetchRemoteRequests()
    } catch (e) { setMsg('Error: ' + e.message) }
  }

  function openEditAttendance(lt) {
    const toLocalInput = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      const pad = n => String(n).padStart(2,'0')
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setEditingAttendance(lt)
    setEditAttendanceForm({
      login_time: toLocalInput(lt.login_time),
      logout_time: toLocalInput(lt.logout_time),
      attendance_type: lt.attendance_type || 'office',
    })
    setEditAttendanceMsg('')
  }

  async function saveAttendanceEdit(e) {
    e.preventDefault()
    setSavingAttendanceEdit(true)
    setEditAttendanceMsg('')
    try {
      const payload = {
        login_time: editAttendanceForm.login_time ? new Date(editAttendanceForm.login_time).toISOString() : null,
        logout_time: editAttendanceForm.logout_time ? new Date(editAttendanceForm.logout_time).toISOString() : null,
        attendance_type: editAttendanceForm.attendance_type,
      }
      await api.updateAttendance(editingAttendance.id, payload)
      setEditAttendanceMsg('✓ تم الحفظ')
      fetchLoginTimes()
      setTimeout(() => setEditingAttendance(null), 800)
    } catch (err) { setEditAttendanceMsg('خطأ: ' + err.message) }
    setSavingAttendanceEdit(false)
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

  function getPriorityBadge(priority) {
    switch (priority) {
      case 'urgent': return { label: 'Urgent',  cls: 'bg-red-900/40 text-red-400 border-red-500/30' }
      case 'high':   return { label: 'High',    cls: 'bg-orange-900/40 text-orange-400 border-orange-500/30' }
      case 'low':    return { label: 'Low',     cls: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' }
      default:       return { label: 'Medium',  cls: 'bg-blue-900/40 text-blue-400 border-blue-500/30' }
    }
  }

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }

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

  const filteredTickets = tickets.filter(t => {
    const q = ticketSearch.toLowerCase().trim()
    const matchesSearch = !q || (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q) || (t.affected_person||'').toLowerCase().includes(q)
    const matchesStatus = ticketStatusFilter === 'all' || t.status === ticketStatusFilter
    const matchesPriority = ticketPriorityFilter === 'all' || t.priority === ticketPriorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  }).sort((a, b) => {
    if (!ticketSortByPriority) return 0
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  })

  const adminTabs = [
    { key: 'dashboard',   label: 'Dashboard',   icon: 'dashboard' },
    { key: 'tickets',     label: 'Tickets',     icon: 'tickets' },
    { key: 'requests',    label: 'Requests',    icon: 'requests',    badge: requests.filter(r=>r.request_status==='pending_review').length },
    { key: 'leave',       label: 'Leave',       icon: 'leave',       badge: leaveRequests.filter(r=>r.status==='pending').length },
    { key: 'assets',      label: 'Assets',      icon: 'assets' },
    { key: 'penalties',   label: 'Penalties',   icon: 'performance' },
    { key: 'complaints',  label: 'Complaints',  icon: 'requests' },
    { key: 'users',       label: 'Users',       icon: 'users' },
    { key: 'whatsapp',    label: 'WhatsApp',    icon: 'whatsapp' },
    { key: 'attendance',  label: 'Attendance',  icon: 'attendance', badge: remoteRequests.filter(r=>r.status==='pending').length || 0 },
    { key: 'performance', label: 'Performance', icon: 'performance' },
    { key: 'settings',    label: 'Settings',    icon: 'settings' },
  ]
  function handleAdminTabChange(t) {
    setTab(t); setSelectedTicket(null)
    if (t === 'settings') { fetchOfficeSettings(); fetchSettingsLog(); fetchGithubSyncSettings(); fetchSmtpSettings(); fetchWhatsAppSettings(); fetchAutoAssignRules() }
    if (t === 'whatsapp') { fetchWhatsAppSettings(); fetchUsers() }
    if (t === 'attendance') { fetchLiveAttendance(); fetchAttendanceCorrections(); fetchRemoteRequests() }
    if (t === 'leave') { fetchLeaveCalendar(); fetchLeaveReport() }
  }

  // ── Employee profile overlay ──
  if (employeeProfileId) {
    return (
      <EmployeeProfilePage
        userId={employeeProfileId}
        onClose={() => setEmployeeProfileId(null)}
      />
    )
  }

  // ── Ticket detail view ──
  if (selectedTicket) {
    return (
      <div className="min-h-screen" style={{background: bgGrad}}>
        <Sidebar tabs={adminTabs} activeTab={tab} onTabChange={handleAdminTabChange} isSuperAdmin={isSuperAdmin} />
        <div className="lg:ml-64">
        <div className="max-w-4xl mx-auto p-4 pt-16 lg:pt-16 lg:p-6 pb-6">
          <button onClick={() => setSelectedTicket(null)} className="group flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Tickets
          </button>

          <div className="glass rounded-xl p-5 mb-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <StatusBadge status={selectedTicket.status} />
                  {(() => { const pb = getPriorityBadge(selectedTicket.priority); return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pb.cls}`}>{pb.label}</span> })()}
                  <span className="text-slate-500 text-xs">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                </div>
                <h2 className="text-white text-xl font-semibold">{selectedTicket.title}</h2>
                {selectedTicket.description && <p className="text-slate-400 mt-2">{selectedTicket.description}</p>}
                {selectedTicket.affected_person && <p className="text-slate-500 text-sm mt-2">👤 {selectedTicket.affected_person}</p>}
                {selectedTicket.asset && (
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',color:'#818cf8'}}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V5.25m19.5 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 7.409A2.25 2.25 0 012.25 5.493V5.25" />
                    </svg>
                    {selectedTicket.asset.name}{selectedTicket.asset.serial_number ? ` · ${selectedTicket.asset.serial_number}` : ''}
                  </div>
                )}
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
                      style={{background: isMe ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)'}}>
                      {initials}
                    </div>
                    <div className={`flex-1 min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-white text-xs font-semibold">{r.profiles?.full_name || 'User'}</span>
                        {isMe && <span className="text-amber-400 text-[10px]">You</span>}
                        <span className="text-slate-600 text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={{background: isMe ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.06)', border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)'}}>
                        {r.message && <p className="text-slate-200 text-sm leading-relaxed">{r.message}</p>}
                        <FileAttachment url={r.image_url} name={r.attachment_name} />
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
                onChange={e => { setReplyText(e.target.value); setReplyError('') }}
                placeholder="Type your reply..."
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none transition-all border"
                style={{background:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.08)'}}
                onFocus={e=>{e.target.style.borderColor='rgba(251,146,60,0.4)';e.target.style.boxShadow='0 0 0 3px rgba(251,146,60,0.08)'}}
                onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.08)';e.target.style.boxShadow='none'}}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all" style={{background:'rgba(255,255,255,0.04)'}}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                  {replyFile ? <span className="text-amber-400 max-w-[120px] truncate">{replyFile.name}</span> : 'Attach File'}
                  <input type="file" accept="*/*" className="hidden" onChange={e => { setReplyFile(e.target.files[0]); setReplyError('') }} />
                </label>
                {replyFile && (
                  <button type="button" onClick={() => setReplyFile(null)} className="text-slate-500 hover:text-red-400 text-xs transition-colors">✕ Remove</button>
                )}
                <button
                  type="submit"
                  disabled={uploading || (!replyText.trim() && !replyFile)}
                  className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{background: isSuperAdmin ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: isSuperAdmin ? '0 4px 14px rgba(217,119,6,0.3)' : '0 4px 14px rgba(37,99,235,0.3)'}}
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
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{background: bgGrad}}>
      <Sidebar tabs={adminTabs} activeTab={tab} onTabChange={handleAdminTabChange} isSuperAdmin={isSuperAdmin} />
      <div className="lg:ml-64">
      <div className="max-w-7xl mx-auto p-4 pt-16 lg:pt-16 lg:p-6 pb-6">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg animate-fadeIn ${msg.startsWith('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {msg}
          </div>
        )}

        {isSuperAdmin && githubSyncAlert && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl animate-fadeIn"
            style={{background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)'}}>
            <span className="mt-0.5 flex-shrink-0">
              <svg className="w-5 h-5 text-red-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-red-400 font-semibold text-sm">GitHub Sync Failed</p>
              <p className="text-red-300/80 text-xs mt-0.5 break-words">{githubSyncAlert.message}</p>
              <p className="text-red-400/50 text-xs mt-1">{githubSyncAlert.time} · <button className="underline hover:text-red-300 transition-colors" onClick={() => setTab('settings')}>Go to Settings → GitHub Sync</button></p>
            </div>
            <button onClick={() => setGithubSyncAlert(null)} className="flex-shrink-0 text-red-400/60 hover:text-red-300 transition-colors" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

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

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Total Tickets', val: tickets.length,  color: '#94a3b8', glow: 'stat-glow-blue',   acc: 'rgba(99,102,241,0.06)',  bd: 'rgba(99,102,241,0.14)', bar: 'rgba(99,102,241,0.5)' },
                { label: 'Opened',        val: openedTickets,   color: '#60a5fa', glow: 'stat-glow-blue',   acc: 'rgba(59,130,246,0.07)',  bd: 'rgba(59,130,246,0.16)', bar: '#3b82f6' },
                { label: 'Pending',       val: pendingTickets,  color: '#fbbf24', glow: 'stat-glow-amber',  acc: 'rgba(245,158,11,0.07)',  bd: 'rgba(245,158,11,0.16)', bar: '#f59e0b' },
                { label: 'Solved',        val: solvedTickets,   color: '#34d399', glow: 'stat-glow-green',  acc: 'rgba(16,185,129,0.07)',  bd: 'rgba(16,185,129,0.16)', bar: '#10b981' },
                { label: 'Total Users',   val: users.length,    color: '#c084fc', glow: 'stat-glow-purple', acc: 'rgba(168,85,247,0.07)',  bd: 'rgba(168,85,247,0.16)', bar: '#a855f7' },
              ].map((s, i) => (
                <div key={s.label} className={`relative rounded-2xl p-4 hover-lift animate-fadeIn overflow-hidden glass-card ${s.glow}`}
                  style={{border:`1px solid ${s.bd}`, background:s.acc, animationDelay:`${i*0.07}s`}}>
                  <div className="absolute top-0 left-0 w-0.5 h-full rounded-l-2xl" style={{background:s.bar}} />
                  <p className="text-[11px] text-slate-500 mb-2.5 uppercase tracking-widest font-semibold pl-2">{s.label}</p>
                  <p className="text-3xl font-black pl-2 counter-animate" style={{color:s.color}}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(168,85,247,0.15)',border:'1px solid rgba(168,85,247,0.2)'}}>👥</span>
                  User Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    ['Members', memberCount, '#a78bfa'],
                    ['Employees', employeeCount, '#60a5fa'],
                    ['Admins', users.filter(u=>u.role==='admin').length, '#f59e0b'],
                  ].map(([l,v,c]) => (
                    <div key={l} className="flex items-center justify-between py-1">
                      <span className="text-slate-400 text-sm">{l}</span>
                      <span className="text-sm font-bold" style={{color:c}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.2)'}}>📈</span>
                  Ticket Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 text-sm">Resolution Rate</span>
                    <span className="text-emerald-400 font-bold text-sm">{tickets.length > 0 ? ((solvedTickets/tickets.length)*100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 text-sm">Active Tickets</span>
                    <span className="text-amber-400 font-bold text-sm">{openedTickets + pendingTickets}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 text-sm">Avg per User</span>
                    <span className="text-white font-bold text-sm">{users.length > 0 ? (tickets.length/users.length).toFixed(1) : 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="glass rounded-xl p-5 animate-fadeIn">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <span>🔗</span> GitHub Sync Status
                  </h3>
                  <button onClick={fetchGithubSyncStatus} className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">↻ Refresh</button>
                </div>
                {githubSyncStatus === null ? (
                  <p className="text-slate-500 text-sm">Loading...</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        githubSyncStatus.result === 'SUCCESS' ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                        : githubSyncStatus.result === 'FAILED' ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                        : githubSyncStatus.result === 'SKIPPED' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30'
                        : 'bg-white/10 text-slate-400 border border-white/10'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          githubSyncStatus.result === 'SUCCESS' ? 'bg-green-400'
                          : githubSyncStatus.result === 'FAILED' ? 'bg-red-400 animate-pulse'
                          : githubSyncStatus.result === 'SKIPPED' ? 'bg-yellow-400'
                          : 'bg-slate-400'
                        }`} />
                        {githubSyncStatus.result || 'Unknown'}
                      </span>
                      {githubSyncStatus.timestamp && (
                        <span className="text-slate-400 text-xs">{githubSyncStatus.timestamp}</span>
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed ${githubSyncStatus.result === 'FAILED' ? 'text-red-300' : 'text-slate-400'}`}>
                      {githubSyncStatus.message}
                    </p>
                    {githubSyncStatus.result === 'FAILED' && (
                      <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        Go to Settings → GitHub Sync to update your token or repository URL.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.2)'}}>🎫</span>
                <h3 className="text-white font-semibold text-sm">Recent Tickets</h3>
                <span className="ml-auto text-[11px] text-slate-600">{tickets.length} total</span>
              </div>
              <div className="space-y-1">
                {tickets.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-all cursor-default row-hover"
                    style={{animationDelay:`${i*0.08}s`}}>
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{t.title}</p>
                      <p className="text-slate-500 text-xs truncate">{t.assigned_to_profile?.full_name || 'Unassigned'}</p>
                    </div>
                    <span className="text-slate-600 text-[11px] flex-shrink-0">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {tickets.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-sm">No tickets yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {tab === 'tickets' && (
          <div>
            <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-sm">All Tickets</h2>
              <div className="flex gap-2">
                <button onClick={() => exportCsv('tickets.csv', tickets, [
                    { label: 'Title', value: r => r.title },
                    { label: 'Status', value: r => r.status },
                    { label: 'Priority', value: r => r.priority },
                    { label: 'Category', value: r => r.category || '' },
                    { label: 'Assigned To', value: r => r.assigned_to_profile?.full_name || r.assigned_to_profile?.email || '' },
                    { label: 'Created By', value: r => r.created_by_profile?.full_name || r.created_by_profile?.email || '' },
                    { label: 'Affected Person', value: r => r.affected_person || '' },
                    { label: 'Due Date', value: r => r.due_date || '' },
                    { label: 'Created At', value: r => r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : '' },
                  ])} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export CSV
                </button>
                <button onClick={() => setShowCreateTicket(v=>!v)} className="btn-primary text-sm px-4 py-2">+ New Ticket</button>
              </div>
            </div>

            {showCreateTicket && (
              <form onSubmit={createTicket} className="glass-card rounded-2xl p-5 mb-4 space-y-4 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Title</label>
                    <input required value={ticketForm.title} onChange={e=>setTicketForm(f=>({...f,title:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="Issue title" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Affected Person</label>
                    <input value={ticketForm.affected_person} onChange={e=>setTicketForm(f=>({...f,affected_person:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="Person with issue" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Assign To</label>
                    <select value={ticketForm.assigned_to} onChange={e=>setTicketForm(f=>({...f,assigned_to:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name||u.email} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Related Asset</label>
                    <select value={ticketForm.asset_id} onChange={e=>{if(!ticketAssets.length)fetchTicketAssets();setTicketForm(f=>({...f,asset_id:e.target.value}))}} onFocus={()=>{if(!ticketAssets.length)fetchTicketAssets()}} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="">No linked asset</option>
                      {ticketAssets.map(a => <option key={a.id} value={a.id}>{a.name}{a.serial_number ? ` (${a.serial_number})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Priority</label>
                    <select value={ticketForm.priority||'medium'} onChange={e=>setTicketForm(f=>({...f,priority:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Status</label>
                    <select value={ticketForm.status} onChange={e=>setTicketForm(f=>({...f,status:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                      <option value="opened">Opened</option>
                      <option value="pending">Pending</option>
                      <option value="solved">Solved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Category</label>
                    <input value={ticketForm.category} onChange={e=>setTicketForm(f=>({...f,category:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="e.g. Hardware, Network" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Due Date</label>
                    <input type="date" value={ticketForm.due_date} onChange={e=>setTicketForm(f=>({...f,due_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Description</label>
                  <textarea rows={3} value={ticketForm.description} onChange={e=>setTicketForm(f=>({...f,description:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none transition-all" placeholder="Describe the issue..." />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">{loading ? 'Creating...' : 'Create Ticket'}</button>
                  <button type="button" onClick={()=>setShowCreateTicket(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-2.5 mb-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-slate-600 text-xs self-center mr-1">Status:</span>
                {['all','opened','pending','solved'].map(f => (
                  <button key={f} onClick={() => setTicketStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${ticketStatusFilter === f ? (isSuperAdmin ? 'tab-active-amber' : 'tab-active-indigo') : 'tab-inactive border border-white/8'}`}>
                    {f}
                  </button>
                ))}
                <span className="text-slate-600 text-xs self-center ml-3 mr-1">Priority:</span>
                {['all','low','medium','high','urgent'].map(f => (
                  <button key={f} onClick={() => setTicketPriorityFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${ticketPriorityFilter === f ? (isSuperAdmin ? 'tab-active-amber' : 'tab-active-indigo') : 'tab-inactive border border-white/8'}`}>
                    {f}
                  </button>
                ))}
                <span className="text-slate-600 text-xs self-center ml-3 mr-1">Sort:</span>
                <button onClick={() => setTicketSortByPriority(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${ticketSortByPriority ? (isSuperAdmin ? 'tab-active-amber' : 'tab-active-indigo') : 'tab-inactive border border-white/8'}`}>
                  Priority ↑
                </button>
              </div>
            </div>

            {(ticketSearch || ticketStatusFilter !== 'all' || ticketPriorityFilter !== 'all') && (
              <p className="text-slate-600 text-xs mb-3">
                Showing {filteredTickets.length} of {tickets.length} tickets
                {ticketSearch && <> matching "<span className="text-slate-400">{ticketSearch}</span>"</>}
              </p>
            )}

            <div className="space-y-2">
              {filteredTickets.length === 0 && (
                <div className="glass-card rounded-2xl py-12" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                      </svg>
                    </div>
                    <p className="text-slate-500 text-sm">{tickets.length === 0 ? 'No tickets yet' : 'No tickets match your search'}</p>
                  </div>
                </div>
              )}
              {filteredTickets.slice((ticketPage-1)*TICKETS_PER_PAGE, ticketPage*TICKETS_PER_PAGE).map((t, i) => (
                <div key={t.id}
                  className="group rounded-2xl p-4 transition-all animate-fadeIn glass-card"
                  style={{border:'1px solid rgba(255,255,255,0.06)', animationDelay:`${i*0.04}s`}}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=''; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>setSelectedTicket(t)}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={t.status} />
                        {(() => { const pb = getPriorityBadge(t.priority); return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pb.cls}`}>{pb.label}</span> })()}
                        <SLABadge ticket={t} />
                        <span className="text-slate-600 text-[11px]">{new Date(t.created_at).toLocaleDateString()}</span>
                        {t.rating && <span className="text-amber-400 text-[10px]">{'★'.repeat(t.rating)}{'☆'.repeat(5-t.rating)}</span>}
                      </div>
                      <h3 className="text-slate-100 text-sm font-semibold group-hover:text-white transition-colors leading-snug">{t.title}</h3>
                      {t.description && <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{t.description}</p>}
                      {t.affected_person && <p className="text-slate-600 text-xs mt-1.5 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>{t.affected_person}</p>}
                      <p className="text-slate-600 text-[11px] mt-1">→ <span className="text-slate-400">{t.assigned_to_profile?.full_name || 'Unassigned'}</span></p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <select value={t.status} onChange={e=>updateStatus(t.id, e.target.value)}
                        className="rounded-xl px-2.5 py-1.5 text-slate-300 text-xs outline-none border border-white/10 transition-colors hover:border-white/20 cursor-pointer"
                        style={{background:'rgba(255,255,255,0.06)'}}>
                        <option value="opened">Opened</option>
                        <option value="pending">Pending</option>
                        <option value="solved">Solved</option>
                      </select>
                      <button onClick={()=>deleteTicket(t.id)} disabled={loading}
                        className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/10 hover:border-red-500/25 rounded-xl px-2.5 py-1.5 transition-all"
                        style={{background:'rgba(239,68,68,0.04)'}}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredTickets.length > TICKETS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-slate-500 text-xs">Showing {Math.min((ticketPage-1)*TICKETS_PER_PAGE+1, filteredTickets.length)}–{Math.min(ticketPage*TICKETS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length}</p>
                <div className="flex gap-2">
                  <button onClick={()=>setTicketPage(p=>Math.max(1,p-1))} disabled={ticketPage===1} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
                  <button onClick={()=>setTicketPage(p=>Math.min(Math.ceil(filteredTickets.length/TICKETS_PER_PAGE),p+1))} disabled={ticketPage>=Math.ceil(filteredTickets.length/TICKETS_PER_PAGE)} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
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
              <div className="glass-card rounded-2xl py-12" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="empty-state"><p className="text-slate-500 text-sm">No requests yet</p></div>
              </div>
            )}

            {requests.map((r, i) => (
              <div key={r.id} className="glass-card rounded-2xl p-5 animate-fadeIn"
                style={{border: r.request_status==='pending_review' ? '1px solid rgba(245,158,11,0.2)' : r.request_status==='accepted' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)', animationDelay:`${i*0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.request_status==='pending_review' ? 'bg-amber-900/30 text-amber-400' : r.request_status==='accepted' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                        {r.request_status==='pending_review' ? 'Pending' : r.request_status==='accepted' ? 'Accepted' : 'Refused'}
                      </span>
                      <span className="text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-slate-100 font-semibold text-sm">{r.title}</h3>
                    {r.description && <p className="text-slate-500 text-xs mt-1">{r.description}</p>}
                    {r.affected_person && <p className="text-slate-600 text-xs mt-1">👤 {r.affected_person}</p>}
                    <p className="text-slate-600 text-xs mt-1.5">By: <span className="text-slate-400">{r.created_by_profile?.full_name || r.created_by_profile?.email || 'Unknown'}</span></p>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-fit">
                    {r.request_status === 'pending_review' && (
                      <>
                        <button onClick={()=>{setAcceptingRequest(r);setAssignTo('')}} className="bg-emerald-800/60 hover:bg-emerald-700/70 text-emerald-300 text-xs px-3 py-1.5 rounded-xl border border-emerald-600/20 transition-all">Accept</button>
                        <button onClick={()=>refuseRequest(r)} disabled={loading} className="bg-red-900/30 hover:bg-red-800/50 text-red-400 text-xs px-3 py-1.5 rounded-xl border border-red-500/20 transition-all">Refuse</button>
                      </>
                    )}
                    <button onClick={()=>deleteRequest(r.id)} disabled={loading} className="bg-red-950/30 hover:bg-red-900/50 text-red-400/70 text-xs px-3 py-1.5 rounded-xl border border-red-500/15 disabled:opacity-50 transition-all">Delete</button>
                  </div>
                </div>

                {acceptingRequest?.id === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/8 animate-scaleIn">
                    <label className="block text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">Assign to</label>
                    <div className="flex gap-2">
                      <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500/50 transition-all">
                        <option value="">— Select a member —</option>
                        {users.filter(u=>u.role!=='admin').map(u => <option key={u.id} value={u.id}>{u.full_name||u.email} ({u.role})</option>)}
                      </select>
                      <button onClick={()=>acceptRequest(r)} disabled={!assignTo||loading} className="bg-emerald-800/60 hover:bg-emerald-700/70 disabled:opacity-40 text-emerald-300 text-sm px-4 py-2 rounded-xl border border-emerald-600/20 transition-all">{loading ? 'Saving...' : 'Confirm'}</button>
                      <button onClick={()=>setAcceptingRequest(null)} className="btn-ghost text-sm px-3 py-2">Cancel</button>
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
            <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
              <h2 className="text-white font-medium">Leave Requests</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-3 text-xs text-slate-400">
                  <span>Pending: <span className="text-yellow-400 font-medium">{leaveRequests.filter(r=>r.status==='pending').length}</span></span>
                  <span>Approved: <span className="text-green-400 font-medium">{leaveRequests.filter(r=>r.status==='approved').length}</span></span>
                  <span>Rejected: <span className="text-red-400 font-medium">{leaveRequests.filter(r=>r.status==='rejected').length}</span></span>
                </div>
                <button onClick={() => exportCsv('leaves.csv', leaveRequests, [
                    { label: 'Employee', value: r => r.user?.full_name || r.user?.email || '' },
                    { label: 'Leave Type', value: r => ({ annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }[r.leave_type] || r.leave_type) },
                    { label: 'Start Date', value: r => r.start_date },
                    { label: 'End Date', value: r => r.end_date },
                    { label: 'Days', value: r => r.days_count },
                    { label: 'Status', value: r => r.status },
                    { label: 'Reason', value: r => r.reason || '' },
                    { label: 'Admin Note', value: r => r.admin_note || '' },
                    { label: 'Submitted At', value: r => r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : '' },
                  ])} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export CSV
                </button>
                <button onClick={()=>setShowLeaveForm(v=>!v)} className="bg-green-700 hover:bg-green-600 text-white text-xs px-4 py-2 rounded-lg transition-all">
                  🌴 {showLeaveForm ? 'Cancel' : 'Request Leave'}
                </button>
              </div>
            </div>

            {showLeaveForm && (
              <form onSubmit={submitOwnLeave} className="glass rounded-xl p-5 space-y-4 animate-scaleIn border border-green-500/20">
                <h3 className="text-white font-medium text-sm">🌴 Request Leave for Yourself</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Start Date</label>
                    <input required type="date" value={leaveForm.start_date}
                      onChange={e=>setLeaveForm(f=>({...f,start_date:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">End Date</label>
                    <input required type="date" value={leaveForm.end_date}
                      onChange={e=>setLeaveForm(f=>({...f,end_date:e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Leave Type</label>
                  <select value={leaveForm.leave_type||'annual'} onChange={e=>setLeaveForm(f=>({...f,leave_type:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-green-500">
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="emergency">Emergency Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Reason (optional)</label>
                  <input type="text" value={leaveForm.reason}
                    onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))}
                    placeholder="e.g. Annual leave, Medical..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                </div>
                <button type="submit" disabled={submittingLeave}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-all">
                  {submittingLeave ? 'Submitting...' : '✅ Submit Request'}
                </button>
              </form>
            )}

            {/* Leave Calendar */}
            {leaveCalendar.length > 0 && (
              <div className="glass-card rounded-2xl p-5 mb-4" style={{border:'1px solid rgba(16,185,129,0.15)'}}>
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">📅 تقويم الإجازات المعتمدة</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto" style={{scrollbarWidth:'none'}}>
                  {leaveCalendar.map(l => {
                    const typeColors = { annual: 'text-emerald-400', sick: 'text-blue-400', emergency: 'text-orange-400', unpaid: 'text-red-400' }
                    const typeLabels = { annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة', unpaid: 'بدون راتب' }
                    return (
                      <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" style={{boxShadow:'0 0 5px rgba(52,211,153,0.5)'}} />
                        <span className="text-slate-200 text-sm flex-1">{l.user?.full_name || l.user?.email}</span>
                        <span className={`text-xs ${typeColors[l.leave_type] || 'text-slate-400'}`}>{typeLabels[l.leave_type] || l.leave_type}</span>
                        <span className="text-slate-500 text-xs">{l.start_date} → {l.end_date}</span>
                        <span className="text-slate-400 text-xs">{l.days_count} يوم</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Monthly Leave Report */}
            <div className="glass-card rounded-2xl p-5 mb-4" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-white font-semibold text-sm">📊 التقرير الشهري للإجازات</h3>
                <div className="flex gap-2 flex-wrap items-center">
                  <select value={leaveReportYear} onChange={e=>setLeaveReportYear(Number(e.target.value))} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                    {Array.from({length:3},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={leaveReportMonth} onChange={e=>setLeaveReportMonth(Number(e.target.value))} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                    {['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <button onClick={fetchLeaveReport} disabled={loadingLeaveReport} className="text-xs text-indigo-300 bg-indigo-900/30 hover:bg-indigo-800/50 px-3 py-1.5 rounded-xl border border-indigo-500/20 transition-all disabled:opacity-50">
                    {loadingLeaveReport ? '...' : 'عرض التقرير'}
                  </button>
                </div>
              </div>
              {leaveReport && (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'الإجمالي', val: leaveReport.stats.total, color: 'text-slate-300' },
                      { label: 'معتمدة', val: leaveReport.stats.approved, color: 'text-emerald-400' },
                      { label: 'معلقة', val: leaveReport.stats.pending, color: 'text-yellow-400' },
                      { label: 'مرفوضة', val: leaveReport.stats.rejected, color: 'text-red-400' },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 rounded-xl" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)'}}>
                        <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                        <p className="text-slate-500 text-[11px]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {leaveReport.stats.topUsers.length > 0 && (
                    <div>
                      <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-2">الأكثر إجازة</p>
                      {leaveReport.stats.topUsers.slice(0,5).map((u,i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5">
                          <span className="text-slate-300 text-sm">{u.user?.full_name || u.user?.email || '—'}</span>
                          <span className="text-yellow-400 text-xs font-semibold">{u.days} أيام</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!leaveReport && !loadingLeaveReport && <p className="text-slate-500 text-sm text-center py-3">اختر الشهر ثم اضغط عرض التقرير</p>}
            </div>

            {leaveRequests.length === 0 && (
              <div className="glass-card rounded-2xl py-12" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="empty-state"><p className="text-slate-500 text-sm">No leave requests yet</p></div>
              </div>
            )}

            {leaveRequests.map((r, i) => (
              <div key={r.id} className="glass-card rounded-2xl p-5 animate-fadeIn"
                style={{border: r.status==='pending' ? '1px solid rgba(245,158,11,0.18)' : r.status==='approved' ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(239,68,68,0.18)', animationDelay:`${i*0.05}s`}}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.status==='pending' ? 'bg-amber-900/30 text-amber-400' : r.status==='approved' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                        {r.status==='pending' ? 'Pending' : r.status==='approved' ? 'Approved' : 'Rejected'}
                      </span>
                      <span className="text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-slate-100 font-semibold text-sm">{new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}</h3>
                    {r.reason && <p className="text-slate-500 text-xs mt-1">{r.reason}</p>}
                    <p className="text-slate-600 text-xs mt-1.5">By: <span className="text-slate-400">{r.user?.full_name || r.user?.email || 'Unknown'}</span>{r.user?.role && <span className="text-slate-600 ml-1">({r.user.role})</span>}</p>
                    {r.admin_note && <p className="text-slate-400 text-xs mt-2 rounded-xl px-3 py-2" style={{background:'rgba(255,255,255,0.04)'}}><span className="text-slate-500">Note: </span>{r.admin_note}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-fit">
                    {r.status === 'pending' && (
                      <>
                        <button onClick={()=>approveLeaveRequest(r)} disabled={processingLeaveId===r.id} className="bg-emerald-800/60 hover:bg-emerald-700/70 disabled:opacity-50 text-emerald-300 text-xs px-3 py-1.5 rounded-xl border border-emerald-600/20 transition-all">{processingLeaveId===r.id ? '...' : 'Approve'}</button>
                        <button onClick={()=>{setRejectingLeaveId(r.id);setRejectionNote('')}} disabled={processingLeaveId===r.id} className="bg-red-900/30 hover:bg-red-800/50 text-red-400 text-xs px-3 py-1.5 rounded-xl border border-red-500/20 transition-all">Reject</button>
                      </>
                    )}
                    <button onClick={()=>deleteLeaveRequest(r.id)} className="bg-red-950/30 hover:bg-red-900/50 text-red-400/70 text-xs px-3 py-1.5 rounded-xl border border-red-500/15 transition-all">Delete</button>
                  </div>
                </div>

                {rejectingLeaveId === r.id && (
                  <div className="mt-4 pt-4 border-t border-white/8 animate-scaleIn">
                    <label className="block text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">Reason (optional)</label>
                    <div className="flex gap-2">
                      <input type="text" value={rejectionNote} onChange={e=>setRejectionNote(e.target.value)} placeholder="Why is this rejected?" className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-red-500/50 transition-all" />
                      <button onClick={()=>rejectLeaveRequest(r)} disabled={processingLeaveId===r.id} className="bg-red-800/60 hover:bg-red-700/70 disabled:opacity-40 text-red-300 text-sm px-4 py-2 rounded-xl border border-red-500/20 transition-all">{processingLeaveId===r.id ? 'Saving...' : 'Confirm'}</button>
                      <button onClick={()=>{setRejectingLeaveId(null);setRejectionNote('')}} className="btn-ghost text-sm px-3 py-2">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Assets Tab */}
        {tab === 'assets' && (
          <AssetsPage isSuperAdmin={isSuperAdmin} />
        )}

        {/* Penalties Tab */}
        {tab === 'penalties' && (
          <PenaltiesPage isSuperAdmin={isSuperAdmin} />
        )}

        {/* Complaints Tab */}
        {tab === 'complaints' && (
          <ComplaintsPage isSuperAdmin={isSuperAdmin} />
        )}

        {/* WhatsApp Tab */}
        {tab === 'whatsapp' && (
          <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(37,211,102,0.15)', border:'1px solid rgba(37,211,102,0.3)'}}>
                <svg className="w-5 h-5" style={{color:'#25d366'}} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-base">إشعارات واتساب</h2>
                <p className="text-slate-500 text-xs">إعدادات الـ API وأرقام الموظفين في مكان واحد</p>
              </div>
              <div className="ml-auto">
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${waForm.enabled ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/25' : 'text-slate-500 bg-white/5 border-white/10'}`}>
                  {waForm.enabled ? '🟢 مفعّل' : '⚪ معطّل'}
                </span>
              </div>
            </div>

            {/* ── Card 1: Green API Settings ── */}
            <div className="glass-card rounded-2xl p-5 animate-fadeIn" style={{border:'1px solid rgba(37,211,102,0.18)'}}>
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">⚙️ إعدادات Green API</h3>

              <div className="mb-4 p-3 rounded-xl text-xs space-y-1.5" style={{background:'rgba(37,211,102,0.06)', border:'1px solid rgba(37,211,102,0.14)'}}>
                <p className="text-emerald-400 font-semibold">خطوات التفعيل (مجاناً — 3000 رسالة/شهر):</p>
                <p className="text-slate-400">١. سجّل في <a href="https://green-api.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline">green-api.com</a> وأنشئ Instance جديد</p>
                <p className="text-slate-400">٢. امسح الـ QR Code بواتساب رقم الشركة</p>
                <p className="text-slate-400">٣. انسخ <span className="text-white font-mono">idInstance</span> و <span className="text-white font-mono">apiTokenInstance</span> في الحقول أدناه</p>
              </div>

              <form onSubmit={handleSaveWhatsApp} className="space-y-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="wa-enabled" checked={waForm.enabled} onChange={e=>setWaForm(f=>({...f,enabled:e.target.checked}))} className="w-4 h-4 rounded" style={{accentColor:'#25d366'}} />
                  <label htmlFor="wa-enabled" className="text-slate-300 text-sm cursor-pointer">تفعيل إشعارات واتساب</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Instance ID</label>
                    <input value={waForm.greenapi_instance_id} onChange={e=>setWaForm(f=>({...f,greenapi_instance_id:e.target.value}))} placeholder="مثال: 1101234567" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" style={{direction:'ltr'}} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">API Token Instance</label>
                    <input value={waForm.greenapi_token} onChange={e=>setWaForm(f=>({...f,greenapi_token:e.target.value}))} placeholder="الصق الـ token هنا" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" style={{direction:'ltr'}} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">رقم الاختبار</label>
                  <input value={waForm.phone} onChange={e=>setWaForm(f=>({...f,phone:e.target.value}))} placeholder="+201012345678" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" style={{direction:'ltr'}} />
                </div>
                {waMsg && <p className={`text-sm rounded-xl px-3 py-2 ${waMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{waMsg}</p>}
                {waTestResult && <p className={`text-sm rounded-xl px-3 py-2 ${waTestResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{waTestResult.ok ? '✓ ' : '✗ '}{waTestResult.message}</p>}
                <div className="flex gap-2 flex-wrap">
                  <button type="submit" disabled={savingWa} className="text-sm px-4 py-2 rounded-xl font-medium text-white disabled:opacity-50 transition-all" style={{background:'rgba(37,211,102,0.2)', border:'1px solid rgba(37,211,102,0.3)'}}>
                    {savingWa ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                  </button>
                  <button type="button" onClick={handleTestWhatsApp} disabled={testingWa||!waForm.greenapi_instance_id} className="btn-ghost disabled:opacity-50 text-sm px-4 py-2">
                    {testingWa ? 'جاري الإرسال...' : '📱 إرسال رسالة تجريبية للرقم أعلاه'}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Card 2: Per-User Numbers ── */}
            <div className="glass-card rounded-2xl p-5 animate-fadeIn" style={{border:'1px solid rgba(37,211,102,0.12)'}}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">👥 أرقام الموظفين</h3>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
                  <input value={waUserSearch} onChange={e=>setWaUserSearch(e.target.value)} placeholder="ابحث عن موظف..." className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/30 placeholder-slate-600 w-52 transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                {users
                  .filter(u => !waUserSearch || (u.full_name||u.email||'').toLowerCase().includes(waUserSearch.toLowerCase()) || (u.email||'').toLowerCase().includes(waUserSearch.toLowerCase()))
                  .map(u => {
                    const isEditing = u.id in waUserEdits
                    const editVal = waUserEdits[u.id] || { whatsapp_phone: u.whatsapp_phone || '' }
                    const isSaving = waUserSaving[u.id]
                    const isTesting = waUserTestingId === u.id
                    const testResult = waUserTestResults[u.id]
                    const hasPhone = !!(isEditing ? editVal.whatsapp_phone?.trim() : u.whatsapp_phone?.trim())

                    return (
                      <div key={u.id} className="rounded-xl p-3 transition-colors" style={{background: isEditing ? 'rgba(37,211,102,0.05)' : 'rgba(255,255,255,0.02)', border: isEditing ? '1px solid rgba(37,211,102,0.2)' : '1px solid rgba(255,255,255,0.06)'}}>
                        {/* Row: User info + controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{background: u.role==='super_admin' ? 'linear-gradient(135deg,#d97706,#92400e)' : u.role==='admin' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'linear-gradient(135deg,#0e7490,#0891b2)'}}>
                            {(u.full_name||u.email||'?')[0].toUpperCase()}
                          </div>

                          {/* Name + email */}
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium leading-tight truncate">{u.full_name || u.email}</p>
                            <p className="text-slate-500 text-xs truncate">{u.email}</p>
                          </div>

                          {/* Role badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 hidden sm:block ${u.role==='super_admin' ? 'text-amber-400 bg-amber-900/20 border-amber-500/20' : u.role==='admin' ? 'text-purple-400 bg-purple-900/20 border-purple-500/20' : u.role==='employee' ? 'text-blue-400 bg-blue-900/20 border-blue-500/20' : 'text-slate-400 bg-slate-800/40 border-slate-600/20'}`}>
                            {u.role==='super_admin' ? '👑 Super Admin' : u.role}
                          </span>

                          {/* WhatsApp phone input */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{color:'#25d366'}}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </span>
                              <input
                                dir="ltr"
                                value={isEditing ? editVal.whatsapp_phone : (u.whatsapp_phone || '')}
                                onChange={e => setWaUserEdits(ed => ({ ...ed, [u.id]: { ...editVal, whatsapp_phone: e.target.value } }))}
                                onFocus={() => { if (!isEditing) setWaUserEdits(ed => ({ ...ed, [u.id]: { whatsapp_phone: u.whatsapp_phone || '' } })) }}
                                placeholder="+201xxxxxxxxx"
                                className="bg-white/5 border rounded-xl pl-8 pr-3 py-1.5 text-white text-sm focus:outline-none placeholder-slate-600 transition-all w-40"
                                style={{borderColor: isEditing ? 'rgba(37,211,102,0.4)' : 'rgba(255,255,255,0.08)', direction:'ltr'}}
                              />
                            </div>

                            {/* Save / Cancel */}
                            {isEditing && (
                              <>
                                <button onClick={() => saveUserWhatsApp(u.id)} disabled={isSaving} className="text-xs text-white px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-all" style={{background:'rgba(37,211,102,0.25)', border:'1px solid rgba(37,211,102,0.35)'}}>
                                  {isSaving ? '...' : 'حفظ'}
                                </button>
                                <button onClick={() => setWaUserEdits(e => { const n={...e}; delete n[u.id]; return n })} className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg transition-colors">
                                  إلغاء
                                </button>
                              </>
                            )}

                            {/* Test button */}
                            <button
                              onClick={() => testUserWhatsAppMsg(u.id)}
                              disabled={!hasPhone || isTesting || isSaving}
                              title={!hasPhone ? 'أضف رقم واتساب أولاً' : 'إرسال رسالة تجريبية'}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: hasPhone ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.03)',
                                borderColor: hasPhone ? 'rgba(37,211,102,0.25)' : 'rgba(255,255,255,0.06)',
                                color: hasPhone ? '#4ade80' : '#475569'
                              }}
                            >
                              {isTesting ? (
                                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              )}
                              {isTesting ? 'إرسال...' : 'اختبار'}
                            </button>

                            {/* Status indicator */}
                            {!isEditing && (
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasPhone ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                style={hasPhone ? {boxShadow:'0 0 6px rgba(52,211,153,0.7)'} : {}}
                                title={hasPhone ? 'رقم محفوظ' : 'لا يوجد رقم'}
                              />
                            )}
                          </div>
                        </div>

                        {/* Test result */}
                        {testResult && (
                          <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${testResult.ok ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/20 text-red-400 border border-red-500/20'}`}>
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    )
                  })}
                {users.filter(u => !waUserSearch || (u.full_name||u.email||'').toLowerCase().includes(waUserSearch.toLowerCase()) || (u.email||'').toLowerCase().includes(waUserSearch.toLowerCase())).length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-6">لا توجد نتائج</p>
                )}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-white/6 flex items-center gap-4 text-xs text-slate-500">
                <span>إجمالي الموظفين: <span className="text-white font-medium">{users.length}</span></span>
                <span>لديهم رقم واتساب: <span className="text-emerald-400 font-medium">{users.filter(u=>u.whatsapp_phone).length}</span></span>
                <span>بدون رقم: <span className="text-slate-400 font-medium">{users.filter(u=>!u.whatsapp_phone).length}</span></span>
              </div>
            </div>

          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>

            <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
              <h2 className="text-white font-semibold text-sm">Users <span className="text-slate-500 font-normal">({users.length})</span></h2>
              <div className="flex gap-2 flex-1 justify-end flex-wrap">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 w-52 placeholder-slate-600 transition-all"
                />
                <button onClick={() => exportCsv('users.csv', users, [
                    { label: 'Full Name', value: r => r.full_name || '' },
                    { label: 'Email', value: r => r.email },
                    { label: 'Role', value: r => r.role },
                    { label: 'Department', value: r => r.department || '' },
                    { label: 'Job Title', value: r => r.job_title || '' },
                    { label: 'Employee Code', value: r => r.employee_code || '' },
                    { label: 'Employment Type', value: r => ({ full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد مؤقت', intern: 'تدريب' }[r.employment_type] || r.employment_type || '') },
                    { label: 'Phone', value: r => r.phone || '' },
                    { label: 'National ID', value: r => r.national_id || '' },
                    { label: 'Gender', value: r => r.gender === 'male' ? 'ذكر' : r.gender === 'female' ? 'أنثى' : '' },
                    { label: 'Hire Date', value: r => r.hire_date || '' },
                    { label: 'Birth Date', value: r => r.birth_date || '' },
                    { label: 'Direct Manager', value: r => r.direct_manager || '' },
                    { label: 'Address', value: r => r.address || '' },
                    { label: 'Annual Leave Balance', value: r => r.leave_balance ?? '' },
                    { label: 'Sick Leave Balance', value: r => r.sick_leave_balance ?? '' },
                    { label: 'Emergency Leave Balance', value: r => r.emergency_leave_balance ?? '' },
                    { label: 'Created At', value: r => r.created_at ? new Date(r.created_at).toLocaleString('ar-EG') : '' },
                  ])} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export CSV
                </button>
                <button onClick={()=>{setShowBulkReset(v=>!v); setBulkResetMsg(''); setBulkResetConfirm(false)}} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-amber-400 border border-amber-500/30 hover:bg-amber-500/10">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  إعادة تعيين الأرصدة
                </button>
                <button onClick={()=>setShowCreateUser(v=>!v)} className="btn-primary text-sm px-4 py-2 whitespace-nowrap">+ New User</button>
              </div>
            </div>

            {showBulkReset && (
              <form onSubmit={handleBulkResetLeave} className="glass-card rounded-2xl p-5 mb-4 space-y-4 animate-scaleIn" style={{border:'1px solid rgba(245,158,11,0.25)'}}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  <h3 className="text-amber-300 font-semibold text-sm">إعادة تعيين أرصدة الإجازات — بداية سنة جديدة</h3>
                </div>
                <p className="text-slate-500 text-xs">سيتم تحديث أرصدة الإجازات لجميع الموظفين المحددين دفعةً واحدة. العملية لا يمكن التراجع عنها.</p>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">إجازة سنوية (أيام)</label>
                    <input type="number" min="0" max="365" value={bulkResetForm.leave_balance}
                      onChange={e=>setBulkResetForm(f=>({...f,leave_balance:e.target.value}))}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">إجازة مرضية (أيام)</label>
                    <input type="number" min="0" max="365" value={bulkResetForm.sick_leave_balance}
                      onChange={e=>setBulkResetForm(f=>({...f,sick_leave_balance:e.target.value}))}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">إجازة طارئة (أيام)</label>
                    <input type="number" min="0" max="365" value={bulkResetForm.emergency_leave_balance}
                      onChange={e=>setBulkResetForm(f=>({...f,emergency_leave_balance:e.target.value}))}
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">تطبيق على (اتركه فارغاً للكل)</label>
                  <div className="flex flex-wrap gap-3">
                    {['employee','member','admin'].map(r => (
                      <label key={r} className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox"
                          checked={bulkResetForm.roles.includes(r)}
                          onChange={e => setBulkResetForm(f => ({
                            ...f,
                            roles: e.target.checked ? [...f.roles, r] : f.roles.filter(x => x !== r)
                          }))}
                          className="w-4 h-4 rounded accent-amber-500" />
                        <span className="text-slate-300 text-sm capitalize">{r}</span>
                      </label>
                    ))}
                  </div>
                  {bulkResetForm.roles.length === 0 && (
                    <p className="text-amber-500/70 text-xs mt-1.5">سيشمل التحديث جميع المستخدمين بدون استثناء</p>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <input type="checkbox" checked={bulkResetConfirm} onChange={e=>setBulkResetConfirm(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                  <span className="text-amber-300 text-sm">أؤكد أنني أريد إعادة تعيين أرصدة الإجازات لجميع الموظفين المحددين</span>
                </label>

                {bulkResetMsg && (
                  <p className={`text-sm ${bulkResetMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{bulkResetMsg}</p>
                )}

                <div className="flex gap-2">
                  <button type="submit" disabled={bulkResetting || !bulkResetConfirm}
                    className="text-sm px-5 py-2 rounded-xl font-medium bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-colors">
                    {bulkResetting ? 'جارٍ التحديث...' : 'تطبيق إعادة التعيين'}
                  </button>
                  <button type="button" onClick={()=>{setShowBulkReset(false); setBulkResetMsg(''); setBulkResetConfirm(false)}} className="btn-ghost text-sm px-4 py-2">إلغاء</button>
                </div>
              </form>
            )}

            {showCreateUser && (
              <form onSubmit={createUser} className="glass-card rounded-2xl p-5 mb-4 space-y-5 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.2)'}}>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">➕ إنشاء موظف جديد</h3>

                {/* ── بيانات الحساب ── */}
                <div>
                  <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-indigo-500/40 inline-block"/>بيانات الحساب</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">البريد الإلكتروني</label>
                      <input required type="email" value={userForm.email} onChange={e=>setUserForm(f=>({...f,email:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="user@company.com" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">كلمة المرور</label>
                      <input required type="password" value={userForm.password} onChange={e=>setUserForm(f=>({...f,password:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="••••••••" autoComplete="new-password" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الاسم الكامل</label>
                      <input value={userForm.full_name} onChange={e=>setUserForm(f=>({...f,full_name:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" placeholder="الاسم الرباعي" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الصلاحية</label>
                      <select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                        <option value="member">Member</option>
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">👑 Super Admin</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input type="checkbox" checked={userForm.can_view_attendance} onChange={e=>setUserForm(f=>({...f,can_view_attendance:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                    <span className="text-slate-400 text-sm">يمكنه عرض سجلات الحضور</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input type="checkbox" checked={userForm.can_view_assets} onChange={e=>setUserForm(f=>({...f,can_view_assets:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                    <span className="text-slate-400 text-sm">يمكنه عرض الأصول (Assets)</span>
                  </label>
                  {profile?.role === 'super_admin' && (
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input type="checkbox" checked={userForm.can_view_whatsapp_contacts} onChange={e=>setUserForm(f=>({...f,can_view_whatsapp_contacts:e.target.checked}))} className="w-4 h-4 rounded accent-emerald-500" />
                      <span className="text-slate-400 text-sm">📋 مسؤول جهات واتساب (يرى أصحاب التيكتات)</span>
                    </label>
                  )}
                </div>

                {/* ── البيانات الوظيفية ── */}
                <div>
                  <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-amber-500/40 inline-block"/>البيانات الوظيفية</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">القسم / الإدارة</label>
                      <input value={userForm.department} onChange={e=>setUserForm(f=>({...f,department:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="تقنية المعلومات" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">المسمى الوظيفي</label>
                      <input value={userForm.job_title} onChange={e=>setUserForm(f=>({...f,job_title:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="مهندس برمجيات" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الكود الوظيفي</label>
                      <input value={userForm.employee_code} onChange={e=>setUserForm(f=>({...f,employee_code:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="EMP-001" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">نوع التعاقد</label>
                      <select value={userForm.employment_type} onChange={e=>setUserForm(f=>({...f,employment_type:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-amber-500/40 transition-all">
                        <option value="full_time">دوام كامل</option>
                        <option value="part_time">دوام جزئي</option>
                        <option value="contract">عقد مؤقت</option>
                        <option value="intern">تدريب</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">تاريخ التعيين</label>
                      <input type="date" value={userForm.hire_date} onChange={e=>setUserForm(f=>({...f,hire_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">المدير المباشر</label>
                      <input value={userForm.direct_manager} onChange={e=>setUserForm(f=>({...f,direct_manager:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="اسم المدير" />
                    </div>
                  </div>
                </div>

                {/* ── البيانات الشخصية ── */}
                <div>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-emerald-500/40 inline-block"/>البيانات الشخصية</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">رقم الهاتف</label>
                      <input value={userForm.phone} onChange={e=>setUserForm(f=>({...f,phone:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="01xxxxxxxxx" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الرقم القومي</label>
                      <input value={userForm.national_id} onChange={e=>setUserForm(f=>({...f,national_id:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="29xxxxxxxxxxxxxxx" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الجنس</label>
                      <select value={userForm.gender} onChange={e=>setUserForm(f=>({...f,gender:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500/40 transition-all">
                        <option value="">— اختر —</option>
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">تاريخ الميلاد</label>
                      <input type="date" value={userForm.birth_date} onChange={e=>setUserForm(f=>({...f,birth_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 transition-all" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">العنوان</label>
                      <input value={userForm.address} onChange={e=>setUserForm(f=>({...f,address:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="المدينة، الحي، الشارع" />
                    </div>
                  </div>
                </div>

                {/* ── الصورة والملاحظات ── */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الصورة الشخصية</label>
                    <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 hover:bg-white/8 transition-all">
                      <span className="text-slate-500 text-sm">📷 {profilePicFile ? profilePicFile.name : 'اختر من الجهاز...'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e=>setProfilePicFile(e.target.files[0])} />
                    </label>
                    {profilePicFile && <p className="text-xs text-emerald-400 mt-1">✓ {profilePicFile.name}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">ملاحظات</label>
                    <textarea value={userForm.notes} onChange={e=>setUserForm(f=>({...f,notes:e.target.value}))} rows={2} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/40 placeholder-slate-600 transition-all resize-none" placeholder="أي ملاحظات إضافية..." />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">📱 رقم واتساب</label>
                    <input value={userForm.whatsapp_phone} onChange={e=>setUserForm(f=>({...f,whatsapp_phone:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="+201023588751" dir="ltr" />
                    <p className="text-[10px] text-slate-600 mt-1">أدخل الرقم مع كود الدولة — ستصله الإشعارات تلقائياً بعد تفعيل Green API</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={loading || uploadingPic} className="btn-primary disabled:opacity-50 text-sm px-5 py-2">{uploadingPic ? 'جاري الرفع...' : loading ? 'جاري الإنشاء...' : 'إنشاء الموظف'}</button>
                  <button type="button" onClick={()=>{setShowCreateUser(false);setProfilePicFile(null)}} className="btn-ghost text-sm px-4 py-2">إلغاء</button>
                </div>
              </form>
            )}

            {editingUser && (
              <form onSubmit={updateUser} className="glass-card rounded-2xl p-5 mb-4 space-y-5 animate-scaleIn" style={{border:'1px solid rgba(99,102,241,0.25)'}}>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">✏️ تعديل بيانات: <span className="text-indigo-400 font-normal">{editingUser.full_name || editingUser.email}</span></h3>

                {/* ── بيانات الحساب ── */}
                <div>
                  <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-indigo-500/40 inline-block"/>بيانات الحساب</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الاسم الكامل</label>
                      <input value={userForm.full_name} onChange={e=>setUserForm(f=>({...f,full_name:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الصلاحية</label>
                      <select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                        <option value="member">Member</option>
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">👑 Super Admin</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input type="checkbox" checked={userForm.can_view_attendance} onChange={e=>setUserForm(f=>({...f,can_view_attendance:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                    <span className="text-slate-400 text-sm">يمكنه عرض سجلات الحضور</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input type="checkbox" checked={userForm.can_view_assets} onChange={e=>setUserForm(f=>({...f,can_view_assets:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                    <span className="text-slate-400 text-sm">يمكنه عرض الأصول (Assets)</span>
                  </label>
                  {profile?.role === 'super_admin' && (
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input type="checkbox" checked={userForm.can_view_whatsapp_contacts} onChange={e=>setUserForm(f=>({...f,can_view_whatsapp_contacts:e.target.checked}))} className="w-4 h-4 rounded accent-emerald-500" />
                      <span className="text-slate-400 text-sm">📋 مسؤول جهات واتساب (يرى أصحاب التيكتات)</span>
                    </label>
                  )}
                </div>

                {/* ── أرصدة الإجازات ── */}
                <div>
                  <p className="text-[10px] text-sky-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-sky-500/40 inline-block"/>أرصدة الإجازات</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">إجازة سنوية</label>
                      <input type="number" min="0" max="365" value={userForm.leave_balance} onChange={e=>setUserForm(f=>({...f,leave_balance:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">إجازة مرضية</label>
                      <input type="number" min="0" max="365" value={userForm.sick_leave_balance} onChange={e=>setUserForm(f=>({...f,sick_leave_balance:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">طوارئ</label>
                      <input type="number" min="0" max="365" value={userForm.emergency_leave_balance} onChange={e=>setUserForm(f=>({...f,emergency_leave_balance:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">ساعة بداية العمل</label>
                      <select value={userForm.work_start_hour ?? 9} onChange={e=>setUserForm(f=>({...f,work_start_hour:Number(e.target.value)}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-sky-500/40 transition-all">
                        {Array.from({length:12},(_,i)=>i+6).map(h=><option key={h} value={h}>{h}:00</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── البيانات الوظيفية ── */}
                <div>
                  <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-amber-500/40 inline-block"/>البيانات الوظيفية</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">القسم / الإدارة</label>
                      <input value={userForm.department} onChange={e=>setUserForm(f=>({...f,department:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="تقنية المعلومات" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">المسمى الوظيفي</label>
                      <input value={userForm.job_title} onChange={e=>setUserForm(f=>({...f,job_title:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="مهندس برمجيات" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الكود الوظيفي</label>
                      <input value={userForm.employee_code} onChange={e=>setUserForm(f=>({...f,employee_code:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="EMP-001" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">نوع التعاقد</label>
                      <select value={userForm.employment_type} onChange={e=>setUserForm(f=>({...f,employment_type:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-amber-500/40 transition-all">
                        <option value="full_time">دوام كامل</option>
                        <option value="part_time">دوام جزئي</option>
                        <option value="contract">عقد مؤقت</option>
                        <option value="intern">تدريب</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">تاريخ التعيين</label>
                      <input type="date" value={userForm.hire_date} onChange={e=>setUserForm(f=>({...f,hire_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">المدير المباشر</label>
                      <input value={userForm.direct_manager} onChange={e=>setUserForm(f=>({...f,direct_manager:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 placeholder-slate-600 transition-all" placeholder="اسم المدير" />
                    </div>
                  </div>
                </div>

                {/* ── البيانات الشخصية ── */}
                <div>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5"><span className="w-4 h-px bg-emerald-500/40 inline-block"/>البيانات الشخصية</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">رقم الهاتف</label>
                      <input value={userForm.phone} onChange={e=>setUserForm(f=>({...f,phone:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="01xxxxxxxxx" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الرقم القومي</label>
                      <input value={userForm.national_id} onChange={e=>setUserForm(f=>({...f,national_id:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="29xxxxxxxxxxxxxxx" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الجنس</label>
                      <select value={userForm.gender} onChange={e=>setUserForm(f=>({...f,gender:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-emerald-500/40 transition-all">
                        <option value="">— اختر —</option>
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">تاريخ الميلاد</label>
                      <input type="date" value={userForm.birth_date} onChange={e=>setUserForm(f=>({...f,birth_date:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 transition-all" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">العنوان</label>
                      <input value={userForm.address} onChange={e=>setUserForm(f=>({...f,address:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="المدينة، الحي، الشارع" />
                    </div>
                  </div>
                </div>

                {/* ── الصورة والملاحظات ── */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">الصورة الشخصية</label>
                    <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 hover:bg-white/8 transition-all">
                      <span className="text-slate-500 text-sm">📷 {profilePicFile ? profilePicFile.name : 'اختر من الجهاز...'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e=>setProfilePicFile(e.target.files[0])} />
                    </label>
                    {profilePicFile && <p className="text-xs text-emerald-400 mt-1">✓ {profilePicFile.name}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">ملاحظات</label>
                    <textarea value={userForm.notes} onChange={e=>setUserForm(f=>({...f,notes:e.target.value}))} rows={2} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/40 placeholder-slate-600 transition-all resize-none" placeholder="أي ملاحظات إضافية..." />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">📱 رقم واتساب</label>
                    <input value={userForm.whatsapp_phone} onChange={e=>setUserForm(f=>({...f,whatsapp_phone:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/40 placeholder-slate-600 transition-all" placeholder="+201023588751" dir="ltr" />
                    <p className="text-[10px] text-slate-600 mt-1">أدخل الرقم مع كود الدولة — ستصله الإشعارات تلقائياً عبر Green API</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 flex-wrap">
                  <button type="submit" disabled={loading || uploadingPic} className="btn-primary disabled:opacity-50 text-sm px-5 py-2">{uploadingPic ? 'جاري الرفع...' : loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button>
                  <button type="button" onClick={async()=>{
                    if(!editingUser?.id){return}
                    try{
                      setMsg('جاري الإرسال...')
                      const r=await api.testUserWhatsApp(editingUser.id)
                      setMsg('✅ '+r.message)
                    }catch(e){setMsg('❌ '+e.message)}
                  }} className="text-sm px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all">📱 اختبار واتساب</button>
                  <button type="button" onClick={()=>{setEditingUser(null);setProfilePicFile(null)}} className="btn-ghost text-sm px-4 py-2">إلغاء</button>
                </div>
              </form>
            )}

            <div className="glass-card rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['الاسم', 'البريد', 'القسم', 'المسمى الوظيفي', 'الدور', ...(isSuperAdmin ? ['الباسورد', 'الحالة'] : ['الحضور']), 'الإجراءات'].map(h => (
                      <th key={h} className="text-right text-[11px] text-slate-500 uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && <tr><td colSpan={isSuperAdmin ? 8 : 7} className="text-center text-slate-500 py-8">لا يوجد موظفون بعد</td></tr>}
                  {users.filter(u => {
                    const q = userSearch.toLowerCase()
                    return !q || (u.full_name||'').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
                  }).slice((userPage-1)*USERS_PER_PAGE, userPage*USERS_PER_PAGE).map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {u.profile_picture_url ? (
                            <img src={u.profile_picture_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-indigo-900/50 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-300 text-[11px] font-bold">{(u.full_name||u.email||'?')[0].toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-white font-semibold text-sm leading-tight">{u.full_name || '—'}</p>
                            {u.employee_code && <p className="text-slate-600 text-[10px]">{u.employee_code}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{u.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.department ? (
                          <span className="text-xs text-amber-300 bg-amber-900/20 border border-amber-500/20 px-2 py-0.5 rounded-lg">{u.department}</span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-slate-300 text-xs">{u.job_title || <span className="text-slate-600">—</span>}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${u.role==='super_admin' ? 'bg-amber-900/30 text-amber-400' : u.role==='admin' ? 'bg-purple-900/30 text-purple-400' : u.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-800/60 text-slate-400'}`}>{u.role==='super_admin' ? '👑 Super Admin' : u.role}</span>
                      </td>
                      {isSuperAdmin ? (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {u.plain_password ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-200 bg-white/5 px-2 py-1 rounded-lg">
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
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400">لم يغير الباسورد</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">✓ نشط</span>
                            }
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {u.can_view_attendance ? <span className="text-emerald-400 block">✓ Attendance</span> : null}
                          {u.can_view_assets ? <span className="text-blue-400 block">✓ Assets</span> : null}
                          {u.can_view_whatsapp_contacts ? <span className="text-green-400 block">✓ WhatsApp</span> : null}
                          {!u.can_view_attendance && !u.can_view_assets && !u.can_view_whatsapp_contacts ? '—' : null}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={()=>setEmployeeProfileId(u.id)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">ملف</button>
                          <button onClick={()=>{setEditingUser(u);setUserForm({full_name:u.full_name||'',role:u.role,can_view_attendance:u.can_view_attendance,can_view_assets:u.can_view_assets,can_view_whatsapp_contacts:u.can_view_whatsapp_contacts||false,email:'',password:'',leave_balance:u.leave_balance??21,sick_leave_balance:u.sick_leave_balance??14,emergency_leave_balance:u.emergency_leave_balance??7,work_start_hour:u.work_start_hour??9,department:u.department||'',job_title:u.job_title||'',phone:u.phone||'',national_id:u.national_id||'',hire_date:u.hire_date||'',birth_date:u.birth_date||'',gender:u.gender||'',address:u.address||'',employment_type:u.employment_type||'full_time',employee_code:u.employee_code||'',direct_manager:u.direct_manager||'',notes:u.notes||'',whatsapp_phone:u.whatsapp_phone||''})}} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Edit</button>
                          <button onClick={()=>openResetPwd(u)} disabled={resettingUserId===u.id} className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors">{resettingUserId===u.id ? '...' : 'Reset Pwd'}</button>
                          <button onClick={()=>deleteUser(u.id)} disabled={loading} className="text-xs text-red-400/70 hover:text-red-400 disabled:opacity-50 transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            {users.filter(u => { const q = userSearch.toLowerCase(); return !q || (u.full_name||'').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) }).length > USERS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-slate-500 text-xs">
                  Page {userPage} of {Math.ceil(users.filter(u => { const q = userSearch.toLowerCase(); return !q || (u.full_name||'').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) }).length / USERS_PER_PAGE)}
                </p>
                <div className="flex gap-2">
                  <button onClick={()=>setUserPage(p=>Math.max(1,p-1))} disabled={userPage===1} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
                  <button onClick={()=>setUserPage(p=>p+1)} disabled={userPage>=Math.ceil(users.filter(u => { const q = userSearch.toLowerCase(); return !q || (u.full_name||'').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) }).length/USERS_PER_PAGE)} className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div>
            {/* Live Board */}
            <div className="glass-card rounded-2xl p-5 mb-5" style={{border:'1px solid rgba(16,185,129,0.18)'}}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">🟢 لوحة الحضور اللحظية</h3>
                <button onClick={fetchLiveAttendance} disabled={loadingLive} className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all disabled:opacity-50">
                  {loadingLive ? 'جاري التحديث...' : '↻ تحديث'}
                </button>
              </div>
              {liveAttendance?.error && (
                <p className="text-red-400 text-sm text-center py-4">{liveAttendance.error}</p>
              )}
              {liveAttendance && !liveAttendance.error ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'في المكتب', val: liveAttendance.summary?.in ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/20' },
                      { label: 'غادر', val: liveAttendance.summary?.out ?? 0, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/20' },
                      { label: 'غائب', val: liveAttendance.summary?.absent ?? 0, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/20' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg} border ${s.border}`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {(liveAttendance.employees || []).map(emp => (
                      <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${emp.status === 'in' ? 'bg-emerald-400' : emp.status === 'out' ? 'bg-blue-400' : 'bg-red-400'}`} style={emp.status === 'in' ? {boxShadow:'0 0 6px rgba(52,211,153,0.7)'} : {}} />
                        <span className="text-slate-200 text-sm flex-1">{emp.full_name || emp.email}</span>
                        {emp.attendance_type === 'remote' && emp.status !== 'absent' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-500/20">🏠 عن بُعد</span>
                        )}
                        {emp.status === 'in' && emp.login_time && <span className="text-emerald-400 text-xs">دخل {new Date(emp.login_time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</span>}
                        {emp.status === 'out' && emp.logout_time && <span className="text-blue-400 text-xs">خرج {new Date(emp.logout_time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</span>}
                        {emp.status === 'absent' && <span className="text-red-400 text-xs">غائب</span>}
                        {emp.late_minutes > 5 && <span className="text-yellow-400 text-xs bg-yellow-900/20 px-2 py-0.5 rounded-full border border-yellow-500/20">تأخر {emp.late_minutes}د</span>}
                        {emp.overtime_minutes > 0 && <span className="text-purple-400 text-xs bg-purple-900/20 px-2 py-0.5 rounded-full border border-purple-500/20">ov {emp.overtime_minutes}د</span>}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm mb-3">اضغط تحديث لعرض من في المكتب الآن</p>
                  <button onClick={fetchLiveAttendance} className="bg-emerald-800/50 hover:bg-emerald-700/60 text-emerald-300 text-sm px-4 py-2 rounded-xl border border-emerald-600/20 transition-all">عرض اللوحة الحية</button>
                </div>
              )}
            </div>

            {/* Remote Attendance Requests */}
            {isSuperAdmin && (
              <div className="glass-card rounded-2xl p-5 mb-5" style={{border:'1px solid rgba(34,197,94,0.2)'}}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    🏠 طلبات الحضور عن بُعد
                    {remoteRequests.filter(r=>r.status==='pending').length > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-500/20">
                        {remoteRequests.filter(r=>r.status==='pending').length} معلق
                      </span>
                    )}
                  </h3>
                  <button onClick={fetchRemoteRequests} disabled={loadingRemoteRequests} className="text-xs text-green-400 hover:text-green-300 bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-500/20 transition-all disabled:opacity-50">
                    {loadingRemoteRequests ? '...' : '↻ تحديث'}
                  </button>
                </div>
                {remoteRequests.filter(r => r.status === 'pending').length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">لا توجد طلبات حضور عن بُعد معلقة</p>
                ) : (
                  <div className="space-y-3">
                    {remoteRequests.filter(r => r.status === 'pending').map(r => (
                      <div key={r.id} className="p-4 rounded-xl border border-green-500/20 bg-green-900/10">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-white font-medium text-sm">{r.user?.full_name || r.user?.email}</p>
                            <p className="text-slate-400 text-xs mt-0.5">التاريخ: {r.date}</p>
                            <p className="text-slate-400 text-xs">وقت الطلب: {new Date(r.requested_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => approveRemoteRequest(r.id)} className="text-xs text-emerald-300 bg-emerald-900/30 hover:bg-emerald-800/50 px-3 py-1.5 rounded-lg border border-emerald-600/20 transition-all">✓ موافقة</button>
                            <button onClick={() => rejectRemoteRequest(r.id)} className="text-xs text-red-300 bg-red-900/30 hover:bg-red-800/50 px-3 py-1.5 rounded-lg border border-red-600/20 transition-all">✕ رفض</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Correction Requests */}
            <div className="glass-card rounded-2xl p-5 mb-5" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">🔧 طلبات تصحيح الحضور</h3>
                <button onClick={fetchAttendanceCorrections} disabled={loadingCorrections} className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all disabled:opacity-50">
                  {loadingCorrections ? '...' : '↻ تحديث'}
                </button>
              </div>
              {attendanceCorrections.filter(c => c.status === 'pending').length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">لا توجد طلبات تصحيح معلقة</p>
              ) : (
                <div className="space-y-3">
                  {attendanceCorrections.filter(c => c.status === 'pending').map(c => (
                    <div key={c.id} className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-900/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium text-sm">{c.user?.full_name || c.user?.email}</p>
                          <p className="text-slate-400 text-xs mt-0.5">تاريخ: {c.date}</p>
                          {c.requested_login && <p className="text-slate-400 text-xs">وقت الدخول المطلوب: {c.requested_login}</p>}
                          {c.requested_logout && <p className="text-slate-400 text-xs">وقت الخروج المطلوب: {c.requested_logout}</p>}
                          <p className="text-slate-300 text-xs mt-1">السبب: {c.reason}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => reviewCorrection(c.id, 'approved', '')} className="text-xs text-emerald-300 bg-emerald-900/30 hover:bg-emerald-800/50 px-3 py-1.5 rounded-lg border border-emerald-600/20 transition-all">قبول</button>
                          <button onClick={() => reviewCorrection(c.id, 'rejected', '')} className="text-xs text-red-300 bg-red-900/30 hover:bg-red-800/50 px-3 py-1.5 rounded-lg border border-red-600/20 transition-all">رفض</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h2 className="text-white font-semibold text-sm">Attendance</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 transition-all" />
                <button onClick={() => exportCsv(`attendance_${selectedDate}.csv`, loginTimes, [
                    { label: 'Name', value: r => r.full_name || '' },
                    { label: 'Email', value: r => r.email || '' },
                    { label: 'Role', value: r => r.role || '' },
                    { label: 'Date', value: r => r.date },
                    { label: 'Login Time', value: r => r.login_time ? new Date(r.login_time).toLocaleTimeString('ar-EG') : '' },
                    { label: 'Logout Time', value: r => r.logout_time ? new Date(r.logout_time).toLocaleTimeString('ar-EG') : '' },
                    { label: 'Worked Hours', value: r => r.login_time && r.logout_time ? ((new Date(r.logout_time) - new Date(r.login_time)) / 3600000).toFixed(2) : '' },
                  ])} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Name','Email','Role','Type','Login Time','Sign Off','Worked','Date','Actions'].map(h => (
                      <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loginTimes.length === 0 && <tr><td colSpan={9} className="text-center text-slate-500 py-8">No attendance recorded for {new Date(selectedDate).toLocaleDateString()}</td></tr>}
                  {loginTimes.map(lt => (
                    <tr key={lt.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{lt.full_name||'—'}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{lt.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${lt.role==='super_admin' ? 'bg-amber-900/30 text-amber-400' : lt.role==='admin' ? 'bg-purple-900/30 text-purple-400' : lt.role==='employee' ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-900/30 text-slate-400'}`}>{lt.role==='super_admin' ? '👑 Super Admin' : lt.role}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lt.attendance_type === 'remote'
                          ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-500/20">🏠 عن بُعد</span>
                          : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-400 border border-indigo-500/20">🏢 مكتب</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-white font-mono whitespace-nowrap">{new Date(lt.login_time).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono whitespace-nowrap">{lt.logout_time ? new Date(lt.logout_time).toLocaleTimeString() : 'Still working'}</td>
                      <td className="px-4 py-3 text-green-400 text-xs font-medium whitespace-nowrap">{lt.logout_time ? calculateDuration(lt.login_time, lt.logout_time) : 'In progress'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(lt.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={()=>openEditAttendance(lt)} className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 transition-all">✏️ تعديل</button>
                          <button onClick={()=>deleteAttendance(lt.id)} disabled={loading} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { label:'Total Logins', val:loginTimes.length, color:'#94a3b8', bar:'rgba(99,102,241,0.5)', acc:'rgba(99,102,241,0.06)', bd:'rgba(99,102,241,0.14)' },
                { label:'Signed Off', val:loginTimes.filter(lt=>lt.logout_time).length, color:'#fbbf24', bar:'#f59e0b', acc:'rgba(245,158,11,0.07)', bd:'rgba(245,158,11,0.16)' },
                { label:'Still Working', val:loginTimes.filter(lt=>!lt.logout_time).length, color:'#34d399', bar:'#10b981', acc:'rgba(16,185,129,0.07)', bd:'rgba(16,185,129,0.16)' },
              ].map(s => (
                <div key={s.label} className="relative rounded-2xl p-4 overflow-hidden glass-card" style={{border:`1px solid ${s.bd}`, background:s.acc}}>
                  <div className="absolute top-0 left-0 w-0.5 h-full" style={{background:s.bar}} />
                  <p className="text-[11px] text-slate-500 mb-2 uppercase tracking-widest font-semibold pl-2">{s.label}</p>
                  <p className="text-2xl font-black pl-2" style={{color:s.color}}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Monthly Attendance Report */}
            <div className="glass-card rounded-2xl p-5 mt-6" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">📊 Monthly Report</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={monthlyReportYear} onChange={e=>setMonthlyReportYear(Number(e.target.value))} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                    {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={monthlyReportMonth} onChange={e=>setMonthlyReportMonth(Number(e.target.value))} className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <button onClick={fetchMonthlyReport} disabled={loadingMonthlyReport} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {loadingMonthlyReport ? 'Loading...' : 'Generate'}
                  </button>
                  {monthlyReport && !monthlyReport.error && (
                    <button onClick={() => exportCsv(`attendance_${monthlyReportYear}_${monthlyReportMonth}.csv`, monthlyReport.employees || [], [
                        { label: 'Name', value: r => r.full_name || '' },
                        { label: 'Email', value: r => r.email || '' },
                        { label: 'Days Present', value: r => r.days_present },
                        { label: 'Days Absent', value: r => r.days_absent ?? '' },
                        { label: 'Attendance Rate %', value: r => r.attendance_rate ?? '' },
                        { label: 'Avg Hours/Day', value: r => r.avg_minutes_per_day ? (r.avg_minutes_per_day / 60).toFixed(1) : '' },
                        { label: 'Total Hours', value: r => r.total_minutes ? (r.total_minutes / 60).toFixed(1) : '' },
                        { label: 'Late Count', value: r => r.late_count ?? 0 },
                        { label: 'Late Total Minutes', value: r => r.late_total_minutes ?? 0 },
                      ])} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      Export
                    </button>
                  )}
                </div>
              </div>
              {monthlyReport?.error && <p className="text-red-400 text-sm">{monthlyReport.error}</p>}
              {monthlyReport && !monthlyReport.error && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        {['Name','Days Present','Days Absent','Avg Hours/Day','Total Hours'].map(h=>(
                          <th key={h} className="text-left text-[11px] text-slate-500 uppercase tracking-widest px-4 py-2 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyReport.employees||[]).map(emp=>(
                        <tr key={emp.user_id} className="border-b border-white/5 hover:bg-white/3">
                          <td className="px-4 py-2.5 text-white font-medium text-sm">{emp.full_name}</td>
                          <td className="px-4 py-2.5 text-emerald-400 font-semibold">{emp.days_present}</td>
                          <td className="px-4 py-2.5 text-red-400">{emp.days_absent ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-300">{emp.avg_minutes_per_day ? (emp.avg_minutes_per_day / 60).toFixed(1)+'h' : '—'}</td>
                          <td className="px-4 py-2.5 text-slate-300">{emp.total_minutes ? (emp.total_minutes / 60).toFixed(1)+'h' : '—'}</td>
                        </tr>
                      ))}
                      {(monthlyReport.employees||[]).length === 0 && (
                        <tr><td colSpan={5} className="text-center text-slate-500 py-6">No data for this period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {!monthlyReport && !loadingMonthlyReport && (
                <p className="text-slate-500 text-sm text-center py-4">Select a month and click Generate to view the report</p>
              )}
            </div>

            {/* ── Late Arrivals & Overtime Report ── */}
            {(() => {
              const fmtMin = (m) => {
                if (!m || m <= 0) return '—'
                const h = Math.floor(m / 60), r = m % 60
                return h > 0 ? `${h}س ${r}د` : `${r}د`
              }
              const lateColor = (min) =>
                min <= 0 ? 'text-slate-500' : min <= 15 ? 'text-yellow-400' : min <= 45 ? 'text-orange-400' : 'text-red-400'
              const otColor = (min) =>
                min <= 0 ? 'text-slate-500' : min <= 60 ? 'text-sky-400' : min <= 120 ? 'text-blue-400' : 'text-purple-400'

              const sorted = lateOTReport?.employees ? [...lateOTReport.employees].sort((a, b) => {
                if (lateOTSort === 'late_total') return b.late_total_minutes - a.late_total_minutes
                if (lateOTSort === 'late_days')  return b.late_days - a.late_days
                if (lateOTSort === 'ot_total')   return b.overtime_total_minutes - a.overtime_total_minutes
                if (lateOTSort === 'ot_days')    return b.overtime_days - a.overtime_days
                return 0
              }) : []

              const totalLateMin  = sorted.reduce((s, e) => s + e.late_total_minutes, 0)
              const totalOTMin    = sorted.reduce((s, e) => s + e.overtime_total_minutes, 0)
              const latePeople    = sorted.filter(e => e.late_days > 0).length
              const otPeople      = sorted.filter(e => e.overtime_days > 0).length

              return (
                <div className="glass-card rounded-2xl p-5 mt-6" style={{border:'1px solid rgba(251,191,36,0.18)'}}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">⏱️ تقرير التأخيرات والأوفر تايم</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={lateOTYear} onChange={e => setLateOTYear(Number(e.target.value))}
                        className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                        {Array.from({length:5},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={lateOTMonth} onChange={e => setLateOTMonth(Number(e.target.value))}
                        className="bg-white/5 border border-white/8 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none">
                        {['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'].map((m,i)=>
                          <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                      <button onClick={fetchLateOTReport} disabled={loadingLateOT}
                        className="bg-amber-700/50 hover:bg-amber-600/60 disabled:opacity-50 text-amber-300 text-xs font-semibold px-4 py-1.5 rounded-xl border border-amber-500/25 transition-all">
                        {loadingLateOT ? 'جاري التحميل...' : 'عرض التقرير'}
                      </button>
                    </div>
                  </div>

                  {lateOTReport?.error && (
                    <p className="text-red-400 text-sm text-center py-4">{lateOTReport.error}</p>
                  )}

                  {!lateOTReport && !loadingLateOT && (
                    <p className="text-slate-500 text-sm text-center py-6">اختر الشهر واضغط "عرض التقرير" لعرض تفاصيل التأخيرات والأوفر تايم</p>
                  )}

                  {lateOTReport && !lateOTReport.error && (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: 'موظفين متأخرين', val: latePeople, icon: '⏰', color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-500/20' },
                          { label: 'إجمالي دقائق التأخير', val: fmtMin(totalLateMin), icon: '🕐', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/20' },
                          { label: 'موظفين أوفر تايم', val: otPeople, icon: '💪', color: 'text-sky-400', bg: 'bg-sky-900/20', border: 'border-sky-500/20' },
                          { label: 'إجمالي ساعات الأوفر', val: fmtMin(totalOTMin), icon: '⚡', color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/20' },
                        ].map(s => (
                          <div key={s.label} className={`rounded-2xl p-3 text-center ${s.bg} border ${s.border}`}>
                            <p className="text-xl mb-0.5">{s.icon}</p>
                            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5 leading-tight">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Sort Controls */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-slate-500 text-xs">ترتيب حسب:</span>
                        {[
                          {v:'late_total', l:'أعلى تأخير'},
                          {v:'late_days',  l:'أكثر أيام تأخر'},
                          {v:'ot_total',   l:'أعلى أوفر تايم'},
                          {v:'ot_days',    l:'أكثر أيام أوفر'},
                        ].map(opt => (
                          <button key={opt.v} onClick={() => setLateOTSort(opt.v)}
                            className={`text-xs px-3 py-1 rounded-lg border transition-all ${lateOTSort === opt.v ? 'bg-amber-700/50 border-amber-500/30 text-amber-300' : 'bg-white/4 border-white/8 text-slate-400 hover:text-white'}`}>
                            {opt.l}
                          </button>
                        ))}
                      </div>

                      {/* Employee Rows */}
                      {sorted.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">لا توجد بيانات حضور لهذا الشهر</div>
                      ) : (
                        <div className="space-y-2">
                          {sorted.map(emp => {
                            const isExpanded = lateOTExpanded === emp.id
                            const lateAvg = emp.late_days > 0 ? Math.round(emp.late_total_minutes / emp.late_days) : 0
                            const otAvg   = emp.overtime_days > 0 ? Math.round(emp.overtime_total_minutes / emp.overtime_days) : 0
                            return (
                              <div key={emp.id} className="rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
                                {/* Row Header */}
                                <button
                                  onClick={() => setLateOTExpanded(isExpanded ? null : emp.id)}
                                  className="w-full flex items-center gap-3 p-3 text-right hover:bg-white/3 transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-xl bg-indigo-900/40 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-indigo-300 text-xs font-bold">{(emp.full_name||emp.email||'?')[0]}</span>
                                  </div>
                                  <div className="flex-1 min-w-0 text-right">
                                    <p className="text-white text-sm font-medium truncate">{emp.full_name || emp.email}</p>
                                    <p className="text-slate-500 text-[11px]">وقت البداية: {emp.work_start_hour}:00 | حضر {emp.days_present} يوم</p>
                                  </div>
                                  {/* Late Summary */}
                                  <div className="flex items-center gap-4 flex-shrink-0">
                                    <div className="text-center min-w-[70px]">
                                      <p className={`text-sm font-bold ${lateColor(emp.late_total_minutes)}`}>{fmtMin(emp.late_total_minutes)}</p>
                                      <p className="text-slate-600 text-[10px]">⏰ {emp.late_days} يوم تأخر</p>
                                    </div>
                                    <div className="text-center min-w-[70px]">
                                      <p className={`text-sm font-bold ${otColor(emp.overtime_total_minutes)}`}>{fmtMin(emp.overtime_total_minutes)}</p>
                                      <p className="text-slate-600 text-[10px]">⚡ {emp.overtime_days} يوم أوفر</p>
                                    </div>
                                    <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                  </div>
                                </button>

                                {/* Expanded Per-Day Detail */}
                                {isExpanded && (
                                  <div className="border-t border-white/6 px-3 pb-3">
                                    {/* Avg stats */}
                                    <div className="flex gap-4 py-2.5 border-b border-white/5 mb-2">
                                      <span className="text-slate-500 text-xs">متوسط التأخير/يوم: <span className={`font-semibold ${lateColor(lateAvg)}`}>{fmtMin(lateAvg)}</span></span>
                                      <span className="text-slate-500 text-xs">متوسط الأوفر/يوم: <span className={`font-semibold ${otColor(otAvg)}`}>{fmtMin(otAvg)}</span></span>
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {(emp.day_records || []).map(day => (
                                        <div key={day.date} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/3 transition-colors">
                                          <span className="text-slate-400 text-xs w-24 flex-shrink-0">{new Date(day.date + 'T12:00:00').toLocaleDateString('ar-EG', {weekday:'short', day:'numeric', month:'short'})}</span>
                                          <span className="text-slate-300 text-xs w-14 flex-shrink-0">{day.login_time ? new Date(day.login_time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                                          <span className="text-slate-500 text-xs">←</span>
                                          <span className="text-slate-300 text-xs w-14 flex-shrink-0">{day.logout_time ? new Date(day.logout_time).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : 'لم يغادر'}</span>
                                          <div className="flex items-center gap-2 flex-1 justify-end">
                                            {day.late_minutes > 5 ? (
                                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${day.late_minutes > 45 ? 'bg-red-900/30 text-red-400 border border-red-500/20' : day.late_minutes > 15 ? 'bg-orange-900/30 text-orange-400 border border-orange-500/20' : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/20'}`}>
                                                ⏰ تأخر {fmtMin(day.late_minutes)}
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-emerald-400/70 px-2 py-0.5 rounded-full bg-emerald-900/10 border border-emerald-500/15">✓ بالوقت</span>
                                            )}
                                            {day.overtime_minutes > 0 && (
                                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${day.overtime_minutes > 120 ? 'bg-purple-900/30 text-purple-400 border border-purple-500/20' : 'bg-sky-900/30 text-sky-400 border border-sky-500/20'}`}>
                                                ⚡ أوفر {fmtMin(day.overtime_minutes)}
                                              </span>
                                            )}
                                            {day.worked_minutes > 0 && (
                                              <span className="text-[11px] text-slate-500 px-1">({fmtMin(day.worked_minutes)})</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}

          </div>
        )}

        {/* Performance Tab */}
        {tab === 'performance' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 animate-scaleIn" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-3"><span className="text-2xl">⭐</span>Member Performance Leaderboard</h2>
                <div className="text-right"><p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Evaluating</p><p className="text-2xl font-black text-indigo-400">{memberPerformance.length}</p><p className="text-[11px] text-slate-500">Members</p></div>
              </div>
              <p className="text-slate-500 text-sm">Rankings based on resolution speed (35%), completion rate (30%), volume (20%), and response time (15%)</p>
            </div>

            {memberPerformance.length >= 3 && (
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 0, 2].map((rankIdx, colIdx) => {
                  const perf = memberPerformance[rankIdx]
                  const grade = getPerformanceGrade(perf.finalScore)
                  const medals = ['🥇','🥈','🥉']
                  return (
                    <div key={perf.member.id} className={`glass-card rounded-2xl p-6 animate-fadeIn ${rankIdx===0 ? 'md:order-2 md:scale-105' : rankIdx===1 ? 'md:order-1' : 'md:order-3'}`} style={{border:`1px solid ${rankIdx===0?'rgba(99,102,241,0.3)':'rgba(255,255,255,0.08)'}`, animationDelay:`${colIdx*0.1}s`}}>
                      <div className="text-center">
                        <div className={`text-5xl mb-3 ${rankIdx===0 ? 'text-6xl animate-bounce-slow' : ''}`}>{medals[rankIdx]}</div>
                        <h3 className="text-white font-bold text-base mb-1">{perf.member.full_name}</h3>
                        <p className="text-slate-500 text-xs mb-4">{perf.member.email}</p>
                        <div className={`inline-block px-4 py-2 rounded-xl ${grade.bg} mb-3`}>
                          <p className="text-[11px] text-slate-500 mb-1">Score</p>
                          <p className={`text-3xl font-black ${grade.color}`}>{perf.finalScore.toFixed(1)}</p>
                          <p className={`text-sm font-semibold ${grade.color}`}>{grade.grade}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><p className="text-slate-500">Solved</p><p className="text-white font-semibold">{perf.solvedTickets}</p></div>
                          <div><p className="text-slate-500">Avg Time</p><p className="text-white font-semibold">{formatTime(perf.avgResolutionTime)}</p></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="glass-card rounded-2xl overflow-hidden animate-fadeIn" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="p-4 border-b border-white/8"><h3 className="text-white font-semibold text-sm flex items-center gap-2">📊 Complete Rankings</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      {['Rank','Member','Score','Grade','Solved','Total','Rate','Avg Time','Response','Load'].map(h => (
                        <th key={h} className="text-center text-[11px] text-slate-500 uppercase tracking-widest px-4 py-3 font-semibold first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberPerformance.length === 0 && <tr><td colSpan={10} className="text-center text-slate-500 py-12">No members to evaluate yet</td></tr>}
                    {memberPerformance.map((perf, index) => {
                      const grade = getPerformanceGrade(perf.finalScore)
                      return (
                        <tr key={perf.member.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3"><span className="text-xl">{getRankMedal(index)}</span></td>
                          <td className="px-4 py-3"><p className="text-white font-semibold text-sm">{perf.member.full_name}</p><p className="text-slate-500 text-xs">{perf.member.email}</p></td>
                          <td className="px-4 py-3 text-center"><div className={`inline-block px-3 py-1 rounded-xl ${grade.bg}`}><p className={`text-lg font-black ${grade.color}`}>{perf.finalScore.toFixed(1)}</p></div></td>
                          <td className="px-4 py-3 text-center"><span className={`text-base font-bold ${grade.color}`}>{grade.grade}</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-emerald-400 font-semibold">{perf.solvedTickets}</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-slate-300 font-medium">{perf.totalTickets}</span></td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-indigo-400 font-semibold text-xs">{perf.completionRate.toFixed(0)}%</span>
                              <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden mt-1"><div className="h-full bg-indigo-500 rounded-full" style={{width:`${perf.completionRate}%`}} /></div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center"><span className={`font-semibold text-xs ${perf.avgResolutionTime < 6 ? 'text-emerald-400' : perf.avgResolutionTime < 24 ? 'text-amber-400' : 'text-red-400'}`}>{formatTime(perf.avgResolutionTime)}</span></td>
                          <td className="px-4 py-3 text-center"><span className={`font-semibold text-xs ${perf.avgResponseTime < 2 ? 'text-emerald-400' : perf.avgResponseTime < 6 ? 'text-amber-400' : 'text-red-400'}`}>{formatTime(perf.avgResponseTime)}</span></td>
                          <td className="px-4 py-3 text-center"><span className={`font-semibold text-xs ${perf.currentLoad === 0 ? 'text-emerald-400' : perf.currentLoad < 5 ? 'text-amber-400' : 'text-red-400'}`}>{perf.currentLoad}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden animate-fadeIn" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="p-4 border-b border-white/8"><h3 className="text-white font-semibold text-sm flex items-center gap-2">⭐ Member Ratings</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      {['Member','Tickets Rated','Avg Rating','Distribution'].map(h => (
                        <th key={h} className="text-left text-[11px] text-slate-500 uppercase tracking-widest px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === 'member').map(member => {
                      const memberTickets = tickets.filter(t => t.assigned_to === member.id && t.rating != null)
                      const avgRating = memberTickets.length > 0 ? memberTickets.reduce((a, t) => a + t.rating, 0) / memberTickets.length : null
                      return (
                        <tr key={member.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3"><p className="text-white font-semibold text-sm">{member.full_name}</p><p className="text-slate-500 text-xs">{member.email}</p></td>
                          <td className="px-4 py-3 text-slate-300">{memberTickets.length}</td>
                          <td className="px-4 py-3">
                            {avgRating != null ? (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-bold">{avgRating.toFixed(1)}</span>
                                <span className="text-amber-400">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}</span>
                              </div>
                            ) : <span className="text-slate-600 text-xs">No ratings</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(star => {
                                const count = memberTickets.filter(t => t.rating === star).length
                                return <span key={star} className="text-[10px] text-slate-500">{star}★:{count}</span>
                              })}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 animate-fadeIn" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">📐 Scoring Methodology</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[['Resolution Speed','How fast tickets are solved','35%','text-indigo-400'],['Completion Rate','% of tickets solved','30%','text-emerald-400'],['Ticket Volume','Total tickets handled','20%','text-amber-400'],['Response Time','How fast to start work','15%','text-violet-400']].map(([t,d,p,c]) => (
                  <div key={t} className="flex items-center justify-between p-3 rounded-xl" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div><p className="text-white font-semibold text-sm">{t}</p><p className="text-slate-500 text-xs">{d}</p></div>
                    <span className={`${c} font-black text-lg`}>{p}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-xl" style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)'}}>
                <p className="text-red-400 text-sm font-semibold">⚠️ Workload Penalty</p>
                <p className="text-slate-500 text-xs mt-1">High current workload (open/pending tickets) reduces the final score</p>
              </div>
            </div>
          </div>
        )}
        {/* Settings Tab */}
        {tab === 'settings' && !smtpLoaded && (() => { fetchSmtpSettings(); return null })()}
        {tab === 'settings' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)'}}>
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold">Office Geofence</h2>
                  <p className="text-slate-500 text-xs">Only employees within the radius can check in or check out</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
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

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">أدخل الإحداثيات يدوياً أو اضغط لتحديدها تلقائياً</p>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={detectingLocation}
                      className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 hover:border-blue-400/50 text-blue-300 hover:text-blue-200 text-xs font-medium px-3 py-2 rounded-lg transition-all disabled:opacity-60"
                    >
                      {detectingLocation ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          جاري التحديد...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          تحديد موقعي تلقائياً
                        </>
                      )}
                    </button>
                  </div>

                  {detectError && (
                    <div className="px-4 py-2.5 rounded-lg text-xs bg-red-900/30 text-red-400 border border-red-500/20">
                      {detectError}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Latitude</label>
                      <input
                        type="number" step="any" required
                        value={officeForm.latitude}
                        onChange={e => setOfficeForm(f => ({ ...f, latitude: e.target.value }))}
                        placeholder="e.g. 30.0726"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Longitude</label>
                      <input
                        type="number" step="any" required
                        value={officeForm.longitude}
                        onChange={e => setOfficeForm(f => ({ ...f, longitude: e.target.value }))}
                        placeholder="e.g. 31.3211"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                      />
                    </div>
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Allowed Radius (meters)</label>
                    <input
                      type="number" step="1" min="1" required
                      value={officeForm.radius_meters}
                      onChange={e => setOfficeForm(f => ({ ...f, radius_meters: e.target.value }))}
                      placeholder="e.g. 30"
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
                    />
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/8" style={{background:'rgba(255,255,255,0.03)'}}>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        <span>انقر على الخريطة أو اسحب الدبوس لتحديد موقع المكتب</span>
                      </div>
                      {officeForm.latitude && officeForm.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${officeForm.latitude},${officeForm.longitude}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Google Maps
                        </a>
                      )}
                    </div>
                    <DraggableOfficeMap
                      lat={officeForm.latitude}
                      lng={officeForm.longitude}
                      radius={officeForm.radius_meters}
                      onChange={(newLat, newLng) => {
                        setOfficeForm(f => ({ ...f, latitude: newLat, longitude: newLng }))
                      }}
                    />
                    <div className="px-3 py-1.5 bg-white/5 flex items-center gap-2 text-xs text-slate-500">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {officeForm.latitude && officeForm.longitude
                        ? <>{parseFloat(officeForm.latitude).toFixed(6)}, {parseFloat(officeForm.longitude).toFixed(6)}</>
                        : <span className="text-slate-600">لم يتم تحديد موقع بعد</span>
                      }
                      {officeForm.radius_meters && <span className="ml-auto text-blue-400/80">نطاق: {officeForm.radius_meters} متر</span>}
                    </div>
                  </div>

                  {officeMsg && (
                    <div className={`px-4 py-3 rounded-xl text-sm ${officeMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {officeMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    <button type="submit" disabled={savingOffice}
                      className="btn-primary px-5 py-2.5 disabled:opacity-60 flex items-center gap-2 text-sm">
                      {savingOffice ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          جاري الحفظ…
                        </>
                      ) : 'حفظ الإعدادات'}
                    </button>
                    <button type="button" onClick={fetchOfficeSettings}
                      className="btn-ghost px-4 py-2.5 text-sm">
                      إعادة تحميل
                    </button>
                    <div className="flex items-center gap-1.5 text-xs ml-auto">
                      {autoSaveStatus === 'saving' && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          جاري الحفظ التلقائي…
                        </span>
                      )}
                      {autoSaveStatus === 'saved' && (
                        <span className="flex items-center gap-1.5 text-green-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          تم الحفظ التلقائي
                        </span>
                      )}
                      {autoSaveStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-red-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          فشل الحفظ
                        </span>
                      )}
                      {autoSaveStatus === 'idle' && officeSettingsLoadedRef.current && (
                        <span className="text-slate-600">يتم الحفظ تلقائياً عند التغيير</span>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="glass-card rounded-2xl p-5" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">How it works</p>
              <div className="space-y-2">
                {[
                  ['🗺️', 'انقر على الخريطة أو اسحب الدبوس الأحمر لتحديد موقع المكتب مباشرةً — تُحدَّث الإحداثيات تلقائياً'],
                  ['📏', 'حدد النطاق المسموح به بالأمتار — الدائرة الزرقاء تمثل منطقة الحضور المسموح بها'],
                  ['📡', 'يمكنك أيضاً استخدام زر "تحديد موقعي تلقائياً" لتعيين موقعك الحالي فوراً'],
                  ['🔒', 'جميع عمليات التحقق تتم على الخادم — لا يمكن للموظفين تجاوز الجيوفنس من التطبيق'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-start gap-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}>
                    <span className="text-base leading-none mt-0.5">{icon}</span>
                    <p className="text-slate-400 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Assign Rules */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn" style={{border:'1px solid rgba(16,185,129,0.15)'}}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.25)'}}>
                  <span className="text-lg">🎯</span>
                </div>
                <div>
                  <h2 className="text-white font-semibold">الإسناد التلقائي للتذاكر</h2>
                  <p className="text-slate-500 text-xs">عند إنشاء تذكرة بفئة معينة بدون مسند — يُسند تلقائياً لعضو الفريق المحدد</p>
                </div>
              </div>

              {/* Add rule form */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <input
                  type="text"
                  value={autoAssignNewCategory}
                  onChange={e => setAutoAssignNewCategory(e.target.value)}
                  placeholder="الفئة (مثلاً: Hardware, Network)"
                  className="flex-1 min-w-[180px] bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder-slate-600 transition-all"
                />
                <select
                  value={autoAssignNewUserId}
                  onChange={e => setAutoAssignNewUserId(e.target.value)}
                  className="flex-1 min-w-[160px] bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                >
                  <option value="">— اختر العضو —</option>
                  {users.filter(u => u.role === 'member' || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                  ))}
                </select>
                <button
                  onClick={addAutoAssignRule}
                  disabled={!autoAssignNewCategory.trim() || !autoAssignNewUserId}
                  className="bg-emerald-700/60 hover:bg-emerald-600/70 disabled:opacity-40 text-emerald-300 text-sm px-4 py-2 rounded-xl border border-emerald-500/20 transition-all"
                >
                  + إضافة
                </button>
              </div>

              {/* Rules list */}
              {autoAssignRules.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">لا توجد قواعد إسناد. أضف قاعدة لتبدأ.</div>
              ) : (
                <div className="space-y-2 mb-4">
                  {autoAssignRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">{rule.category}</span>
                        <span className="text-slate-500 text-xs">→</span>
                        <span className="text-slate-300 text-sm truncate">{rule.user_name || rule.user_id}</span>
                      </div>
                      <button onClick={() => removeAutoAssignRule(idx)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0">حذف</button>
                    </div>
                  ))}
                </div>
              )}

              {autoAssignMsg && (
                <div className={`text-sm rounded-xl px-3 py-2 mb-3 ${autoAssignMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {autoAssignMsg}
                </div>
              )}
              <button onClick={handleSaveAutoAssign} disabled={savingAutoAssign} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">
                {savingAutoAssign ? 'جاري الحفظ...' : 'حفظ القواعد'}
              </button>
            </div>

            {/* Ticket Templates */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)'}}>
                    <span className="text-lg">📋</span>
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Ticket Templates</h2>
                    <p className="text-slate-500 text-xs">Pre-fill ticket forms for common issues</p>
                  </div>
                </div>
                <button onClick={()=>{setShowTemplateForm(v=>!v);setTemplateMsg('')}} className="btn-primary text-sm px-4 py-2">
                  {showTemplateForm ? 'Close' : '+ Add Template'}
                </button>
              </div>

              {showTemplateForm && (
                <form onSubmit={createTemplate} className="rounded-2xl p-4 mb-5 space-y-3 animate-scaleIn" style={{background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.2)'}}>
                  {templateMsg && <div className={`text-sm rounded-xl p-3 ${templateMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{templateMsg}</div>}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Template Name *</label>
                      <input required value={templateForm.name} onChange={e=>setTemplateForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Password Reset" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Priority</label>
                      <select value={templateForm.priority} onChange={e=>setTemplateForm(f=>({...f,priority:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-all">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Ticket Title *</label>
                    <input required value={templateForm.title} onChange={e=>setTemplateForm(f=>({...f,title:e.target.value}))} placeholder="e.g. [User] needs password reset" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Description Template</label>
                    <textarea rows={2} value={templateForm.description} onChange={e=>setTemplateForm(f=>({...f,description:e.target.value}))} placeholder="Pre-filled description..." className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 resize-none transition-all" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingTemplate} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">{savingTemplate ? 'Saving...' : 'Save Template'}</button>
                    <button type="button" onClick={()=>setShowTemplateForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                  </div>
                </form>
              )}

              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No templates yet. Add one to help employees fill tickets faster.</div>
              ) : (
                <div className="space-y-2">
                  {templates.map(tmpl => {
                    const pb = getPriorityBadge(tmpl.priority)
                    return (
                      <div key={tmpl.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-semibold text-sm">{tmpl.name}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pb.cls}`}>{pb.label}</span>
                          </div>
                          <p className="text-slate-400 text-xs truncate">{tmpl.title}</p>
                          {tmpl.description && <p className="text-slate-600 text-xs truncate mt-0.5">{tmpl.description}</p>}
                        </div>
                        <button onClick={()=>deleteTemplate(tmpl.id)} className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/10 hover:border-red-500/25 rounded-xl px-2.5 py-1.5 transition-all flex-shrink-0" style={{background:'rgba(239,68,68,0.04)'}}>Delete</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* SMTP Email Settings */}
            <div className="glass-card rounded-2xl p-6 animate-fadeIn" style={{border:'1px solid rgba(99,102,241,0.15)'}}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)'}}>
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold">SMTP Email Settings</h2>
                  <p className="text-slate-500 text-xs">Configure outgoing email for notifications</p>
                </div>
                <label className="ml-auto flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={smtpForm.enabled} onChange={e=>setSmtpForm(f=>({...f,enabled:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                  <span className="text-slate-400 text-xs">Enabled</span>
                </label>
              </div>
              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">SMTP Host</label>
                    <input value={smtpForm.host} onChange={e=>setSmtpForm(f=>({...f,host:e.target.value}))} placeholder="smtp.gmail.com" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Port</label>
                    <input type="number" value={smtpForm.port} onChange={e=>setSmtpForm(f=>({...f,port:Number(e.target.value)}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Username</label>
                    <input value={smtpForm.user} onChange={e=>setSmtpForm(f=>({...f,user:e.target.value}))} placeholder="you@example.com" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Password {smtpForm.user && <span className="text-slate-600 normal-case font-normal">(leave blank to keep)</span>}</label>
                    <input type="password" value={smtpForm.password} onChange={e=>setSmtpForm(f=>({...f,password:e.target.value}))} placeholder="App password or SMTP password" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" autoComplete="new-password" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">From Name</label>
                    <input value={smtpForm.from_name} onChange={e=>setSmtpForm(f=>({...f,from_name:e.target.value}))} className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">From Email</label>
                    <input type="email" value={smtpForm.from_email} onChange={e=>setSmtpForm(f=>({...f,from_email:e.target.value}))} placeholder="noreply@company.com" className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={smtpForm.secure} onChange={e=>setSmtpForm(f=>({...f,secure:e.target.checked}))} className="w-4 h-4 rounded accent-indigo-500" />
                  <span className="text-slate-400 text-sm">Use TLS/SSL (secure)</span>
                </label>
                {smtpMsg && <p className={`text-sm rounded-xl px-3 py-2 ${smtpMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{smtpMsg}</p>}
                {smtpTestResult && <p className={`text-sm rounded-xl px-3 py-2 ${smtpTestResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{smtpTestResult.ok ? '✓ ' : '✗ '}{smtpTestResult.message}</p>}
                <div className="flex gap-2 flex-wrap">
                  <button type="submit" disabled={savingSmtp} className="btn-primary disabled:opacity-50 text-sm px-4 py-2">{savingSmtp ? 'Saving...' : 'Save Settings'}</button>
                  <button type="button" onClick={handleTestSmtp} disabled={testingSmtp||!smtpForm.host} className="btn-ghost disabled:opacity-50 text-sm px-4 py-2">{testingSmtp ? 'Testing...' : 'Test Connection'}</button>
                </div>
              </form>
            </div>

            {/* WhatsApp — redirect to dedicated tab */}
            <div className="glass-card rounded-2xl p-5 animate-fadeIn flex items-center gap-4" style={{border:'1px solid rgba(37,211,102,0.18)'}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(37,211,102,0.15)', border:'1px solid rgba(37,211,102,0.3)'}}>
                <svg className="w-5 h-5" style={{color:'#25d366'}} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">إشعارات واتساب</p>
                <p className="text-slate-400 text-xs mt-0.5">تم نقل إعدادات واتساب لتاب مستقل يشمل إعدادات الـ API وأرقام جميع الموظفين</p>
              </div>
              <button onClick={() => handleAdminTabChange('whatsapp')} className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all flex-shrink-0" style={{background:'rgba(37,211,102,0.2)', border:'1px solid rgba(37,211,102,0.3)'}}>
                فتح تاب واتساب ←
              </button>
            </div>

            {/* GitHub Sync Settings — super admin only */}
            {isSuperAdmin && (
              <div className="glass-card rounded-2xl p-6 animate-fadeIn" style={{border:'1px solid rgba(245,158,11,0.15)'}}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.25)'}}>
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">GitHub Sync</h2>
                    <p className="text-slate-400 text-xs">Configure the GitHub repository and token used for automatic code sync</p>
                  </div>
                </div>

                {/* Last Sync Status */}
                <div className="mb-5 p-4 rounded-xl" style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)'}}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Last Sync Result</span>
                    <button onClick={fetchGithubSyncStatus} className="text-slate-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                      Refresh
                    </button>
                  </div>
                  {!githubSyncStatus ? (
                    <p className="text-slate-600 text-xs">Loading…</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          githubSyncStatus.result === 'SUCCESS' ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                          : githubSyncStatus.result === 'FAILED' ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                          : githubSyncStatus.result === 'SKIPPED' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30'
                          : 'bg-white/8 text-slate-400 border border-white/10'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            githubSyncStatus.result === 'SUCCESS' ? 'bg-green-400'
                            : githubSyncStatus.result === 'FAILED' ? 'bg-red-400 animate-pulse'
                            : githubSyncStatus.result === 'SKIPPED' ? 'bg-yellow-400'
                            : 'bg-slate-400'
                          }`} />
                          {githubSyncStatus.result || 'Unknown'}
                        </span>
                        {githubSyncStatus.timestamp && (
                          <span className="text-slate-500 text-xs">{githubSyncStatus.timestamp}</span>
                        )}
                      </div>
                      <p className={`text-xs ${githubSyncStatus.result === 'FAILED' ? 'text-red-300' : 'text-slate-400'}`}>
                        {githubSyncStatus.message}
                      </p>
                      {githubSyncStatus.result === 'FAILED' && (
                        <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5 mt-1">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                          Check your token and repository URL below, then save to retry on the next commit.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {!githubSyncLoaded ? (
                  <div className="flex items-center gap-3 py-4">
                    <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    <span className="text-slate-400 text-sm">Loading settings…</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveGithubSync} className="space-y-4">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Repository URL</label>
                      <input
                        type="url"
                        required
                        value={githubSyncForm.repo_url}
                        onChange={e => setGithubSyncForm(f => ({ ...f, repo_url: e.target.value }))}
                        placeholder="https://github.com/your-org/your-repo.git"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-slate-600 transition-all"
                      />
                      <p className="text-slate-600 text-xs mt-1">HTTPS format recommended (e.g. https://github.com/owner/repo.git)</p>
                    </div>

                    <div className="max-w-xs">
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">Branch to sync</label>
                      <input
                        type="text"
                        required
                        value={githubSyncForm.branch}
                        onChange={e => setGithubSyncForm(f => ({ ...f, branch: e.target.value }))}
                        placeholder="main"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-slate-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">
                        GitHub Personal Access Token
                        {githubSyncHasToken && <span className="ml-2 text-emerald-400 normal-case tracking-normal font-normal">(token saved — leave blank to keep existing)</span>}
                      </label>
                      <input
                        type="password"
                        value={githubSyncForm.token}
                        onChange={e => setGithubSyncForm(f => ({ ...f, token: e.target.value }))}
                        placeholder={githubSyncHasToken ? '••••••••••••••••••••••••••••••••••••••••' : 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                        autoComplete="new-password"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-slate-600 font-mono transition-all"
                      />
                      <p className="text-slate-600 text-xs mt-1">Needs <code className="bg-white/8 px-1 rounded">repo</code> scope. Create at GitHub → Settings → Developer settings → Personal access tokens.</p>
                    </div>

                    {githubSyncTestResult && (
                      <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${githubSyncTestResult.ok ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/20 text-red-400 border border-red-500/20'}`}>
                        <span>{githubSyncTestResult.ok ? '✓' : '✗'}</span>
                        <span>{githubSyncTestResult.message}</span>
                      </div>
                    )}

                    {githubSyncTriggerResult && (
                      <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${githubSyncTriggerResult.ok ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/20 text-red-400 border border-red-500/20'}`}>
                        <span>{githubSyncTriggerResult.ok ? '✓' : '✗'}</span>
                        <span>{githubSyncTriggerResult.message}</span>
                      </div>
                    )}

                    {githubSyncMsg && (
                      <div className={`px-4 py-3 rounded-xl text-sm ${githubSyncMsg.startsWith('Error') ? 'bg-red-900/20 text-red-400 border border-red-500/20' : 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20'}`}>
                        {githubSyncMsg}
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap pt-1">
                      <button
                        type="submit"
                        disabled={savingGithubSync}
                        className="bg-amber-900/50 hover:bg-amber-800/70 border border-amber-500/25 disabled:opacity-60 px-5 py-2.5 rounded-xl text-amber-300 text-sm font-semibold transition-all flex items-center gap-2"
                      >
                        {savingGithubSync ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Saving…
                          </>
                        ) : 'Save Settings'}
                      </button>
                      <button
                        type="button"
                        onClick={handleTestGithubSync}
                        disabled={testingGithubSync || !githubSyncForm.repo_url}
                        className="border border-amber-500/20 hover:border-amber-400/40 bg-amber-900/20 hover:bg-amber-900/40 disabled:opacity-50 text-amber-400 hover:text-amber-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                      >
                        {testingGithubSync ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Testing…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Test Connection
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerGithubSync}
                        disabled={triggeringGithubSync}
                        className="border border-blue-500/20 hover:border-blue-400/40 bg-blue-900/20 hover:bg-blue-900/40 disabled:opacity-50 text-blue-400 hover:text-blue-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                      >
                        {triggeringGithubSync ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Syncing…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Sync Now
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Audit Log */}
            <div className="glass-card rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  <h3 className="text-white font-semibold text-sm">Change History</h3>
                </div>
                <button onClick={fetchSettingsLog} className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1">
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
      </div>

      {/* ── Reset Password Modal ── */}
      {resetPwdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.75)', backdropFilter:'blur(12px)'}}>
          <div className="w-full max-w-sm glass-card rounded-2xl p-6 animate-scaleIn shadow-2xl" style={{border:'1px solid rgba(245,158,11,0.2)'}}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.25)'}}>
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
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">New Password</label>
                <div className="relative">
                  <input
                    type={resetPwdShow ? 'text' : 'password'}
                    value={resetPwdValue}
                    onChange={e => { setResetPwdValue(e.target.value); setResetPwdError('') }}
                    autoFocus
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-slate-600 pr-10 transition-all"
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
                  className="flex-1 bg-amber-900/50 hover:bg-amber-800/70 border border-amber-500/25 disabled:opacity-40 text-amber-300 text-sm font-semibold py-2.5 rounded-xl transition-all">
                  {resettingUserId === resetPwdTarget.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Resetting...
                    </span>
                  ) : 'Reset Password'}
                </button>
                <button type="button" onClick={() => setResetPwdTarget(null)}
                  className="btn-ghost px-4 py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Attendance Modal ────────────────────────────── */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)'}}>
          <div className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{background:'linear-gradient(135deg,#1e1b2e,#16132a)', border:'1px solid rgba(99,102,241,0.3)'}}>
            <button onClick={()=>setEditingAttendance(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base" dir="rtl">تعديل سجل الحضور</h3>
                <p className="text-slate-400 text-xs mt-0.5">{editingAttendance.full_name || editingAttendance.email} — {editingAttendance.date}</p>
              </div>
            </div>

            <form onSubmit={saveAttendanceEdit} className="space-y-4" dir="rtl">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">وقت الحضور</label>
                <input
                  type="datetime-local"
                  value={editAttendanceForm.login_time}
                  onChange={e=>setEditAttendanceForm(f=>({...f, login_time: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                  style={{colorScheme:'dark'}}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">وقت الانصراف</label>
                <input
                  type="datetime-local"
                  value={editAttendanceForm.logout_time}
                  onChange={e=>setEditAttendanceForm(f=>({...f, logout_time: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                  style={{colorScheme:'dark'}}
                />
                <p className="text-slate-600 text-[10px] mt-1">اتركه فارغاً إذا لم ينصرف بعد</p>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5 uppercase tracking-widest font-semibold">نوع الحضور</label>
                <select
                  value={editAttendanceForm.attendance_type}
                  onChange={e=>setEditAttendanceForm(f=>({...f, attendance_type: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                >
                  <option value="office">🏢 مكتب</option>
                  <option value="remote">🏠 عن بُعد</option>
                </select>
              </div>

              {editAttendanceMsg && (
                <p className={`text-sm text-center font-medium ${editAttendanceMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{editAttendanceMsg}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingAttendanceEdit}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                  style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}
                >
                  {savingAttendanceEdit ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={()=>setEditingAttendance(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
