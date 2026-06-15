const BASE = "/api"

async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file
  return new Promise((resolve) => {
    const MAX_PX = 1200
    const QUALITY = 0.75
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_PX || height > MAX_PX) {
        if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
        else { width = Math.round(width * MAX_PX / height); height = MAX_PX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function getToken() {
  return localStorage.getItem('auth_token')
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function request(method, path, body) {
  const opts = { method, headers: headers() }
  if (body !== undefined) opts.body = JSON.stringify(body)
  let res
  try {
    res = await fetch(BASE + path, opts)
  } catch (networkErr) {
    throw new Error('تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.')
  }
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const text = await res.text()
  let data = {}
  if (isJson) {
    try { data = JSON.parse(text) } catch {}
  }
  if (!res.ok) {
    let msg
    if (data.error) {
      msg = data.error
    } else if (!isJson) {
      const STATUS_MSGS = {
        404: 'تعذر تحميل البيانات: المسار غير موجود (404).',
        403: 'غير مصرح لك بهذا الإجراء (403).',
        401: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجددًا (401).',
        500: 'خطأ داخلي في الخادم (500).',
      }
      msg = STATUS_MSGS[res.status] || `خطأ من الخادم (${res.status}).`
    } else {
      msg = `خطأ (${res.status}).`
    }
    throw Object.assign(new Error(msg), { data, status: res.status })
  }
  return data
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  changePassword: (currentPassword, newPassword) => request('POST', '/auth/change-password', { currentPassword, newPassword }),
  forceChangePassword: (newPassword) => request('POST', '/auth/force-change-password', { newPassword }),
  updateProfile: (data) => request('PATCH', '/auth/profile', data),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  resetPassword: (id, newPassword) => request('POST', `/users/${id}/reset-password`, { newPassword }),
  revokeSession: (id, reason) => request('POST', `/users/${id}/revoke-session`, { reason }),
  bulkResetLeave: (data) => request('POST', '/users/bulk-reset-leave', data),

  // Tickets
  getTickets: () => request('GET', '/tickets'),
  getRequests: () => request('GET', '/tickets/requests'),
  getWhatsappContacts: () => request('GET', '/tickets/whatsapp-contacts'),
  createTicket: (data) => request('POST', '/tickets', data),
  updateTicket: (id, data) => request('PATCH', `/tickets/${id}`, data),
  updateTicketAssignees: (id, userIds) => request('PATCH', `/tickets/${id}/assignees`, { user_ids: userIds }),
  deleteTicket: (id) => request('DELETE', `/tickets/${id}`),
  acceptRequest: (id, assignedToIds) => request('POST', `/tickets/${id}/accept`, {
    assigned_to: assignedToIds[0] || null,
    assigned_to_ids: assignedToIds,
  }),
  refuseRequest: (id) => request('POST', `/tickets/${id}/refuse`),
  getReplies: (ticketId) => request('GET', `/tickets/${ticketId}/replies`),
  createReply: (ticketId, data) => request('POST', `/tickets/${ticketId}/replies`, data),
  rateTicket: (id, rating, rating_comment) => request('POST', `/tickets/${id}/rate`, { rating, rating_comment }),
  getTicketHistory: (id) => request('GET', `/tickets/${id}/history`),

  // Templates
  getTemplates: () => request('GET', '/tickets/templates'),
  createTemplate: (data) => request('POST', '/tickets/templates', data),
  deleteTemplate: (id) => request('DELETE', `/tickets/templates/${id}`),

  // Attendance
  getAttendance: (date) => request('GET', `/attendance?date=${date}`),
  getTodayAttendance: () => request('GET', '/attendance/today'),
  registerLogin: (latitude, longitude, attendance_type = 'office') => request('POST', '/attendance/login', { latitude, longitude, attendance_type }),
  registerLogout: (latitude, longitude) => request('POST', '/attendance/logout', { latitude, longitude }),
  updateAttendance: (id, data) => request('PATCH', `/attendance/${id}`, data),
  deleteAttendance: (id) => request('DELETE', `/attendance/${id}`),
  createRemoteRequest: () => request('POST', '/attendance/remote-request', {}),
  getRemoteRequests: () => request('GET', '/attendance/remote-requests'),
  approveRemoteRequest: (id) => request('PATCH', `/attendance/remote-requests/${id}/approve`, {}),
  rejectRemoteRequest: (id) => request('PATCH', `/attendance/remote-requests/${id}/reject`, {}),
  getMonthlyAttendanceReport: (year, month) => request('GET', `/attendance/monthly-report?year=${year}&month=${month}`),
  getLateOvertimeDetail: (year, month, user_id) => request('GET', `/attendance/late-overtime-detail?year=${year}&month=${month}${user_id ? `&user_id=${user_id}` : ''}`),
  getLiveAttendance: () => request('GET', '/attendance/live'),
  getAttendanceCorrections: () => request('GET', '/attendance/corrections'),
  createAttendanceCorrection: (data) => request('POST', '/attendance/corrections', data),
  reviewAttendanceCorrection: (id, status, admin_note) => request('PATCH', `/attendance/corrections/${id}`, { status, admin_note }),

  // Leaves
  getLeaves: () => request('GET', '/leaves'),
  createLeave: (data) => request('POST', '/leaves', data),
  approveLeave: (id) => request('PATCH', `/leaves/${id}/approve`),
  rejectLeave: (id, note) => request('PATCH', `/leaves/${id}/reject`, { note }),
  deleteLeave: (id) => request('DELETE', `/leaves/${id}`),
  getLeaveCalendar: () => request('GET', '/leaves/calendar'),
  getLeaveBalance: (user_id) => request('GET', `/leaves/balance${user_id ? '?user_id=' + user_id : ''}`),
  getLeaveMonthlyReport: (year, month) => request('GET', `/leaves/monthly-report?year=${year}&month=${month}`),

  // Notifications
  getNotifications: () => request('GET', '/notifications'),
  markRead: (id) => request('PATCH', `/notifications/${id}/read`),
  markAllRead: () => request('PATCH', '/notifications/mark-all-read'),

  // Upload
  uploadFile: async (file) => {
    const fileToUpload = file.type.startsWith('image/') ? await compressImage(file) : file
    const form = new FormData()
    form.append('file', fileToUpload, file.name)
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return { url: data.url, name: data.name || file.name }
  },

  // Push notifications
  getPushPublicKey: () => request('GET', '/push/vapid-public-key'),
  subscribePush: (subscription) => request('POST', '/push/subscribe', subscription),
  unsubscribePush: (endpoint) => request('DELETE', '/push/unsubscribe', { endpoint }),

  // Settings
  getOfficeLocation: () => request('GET', '/settings/office-location'),
  saveOfficeLocation: (data) => request('POST', '/settings/office-location', data),
  getSettingsLog: () => request('GET', '/settings/log'),

  // SMTP Settings
  getSmtpSettings: () => request('GET', '/settings/smtp'),
  saveSmtpSettings: (data) => request('POST', '/settings/smtp', data),
  testSmtpSettings: (data) => request('POST', '/settings/smtp/test', data),

  // WhatsApp Settings
  getWhatsAppSettings: () => request('GET', '/settings/whatsapp'),
  saveWhatsAppSettings: (data) => request('POST', '/settings/whatsapp', data),
  testWhatsAppSettings: (data) => request('POST', '/settings/whatsapp/test', data),
  testUserWhatsApp: (userId) => request('POST', `/users/${userId}/test-whatsapp`),

  // GitHub sync status
  getGithubSyncStatus: () => request('GET', '/github-sync-status'),

  // GitHub sync settings (super admin only)
  getGithubSyncSettings: () => request('GET', '/settings/github-sync'),
  saveGithubSyncSettings: (data) => request('POST', '/settings/github-sync', data),
  testGithubSyncConnection: (data) => request('POST', '/settings/github-sync/test', data),

  // Assets
  getAssets: () => request('GET', '/assets'),
  getAssetStats: () => request('GET', '/assets/stats'),
  getAsset: (id) => request('GET', `/assets/${id}`),
  createAsset: (data) => request('POST', '/assets', data),
  updateAsset: (id, data) => request('PATCH', `/assets/${id}`, data),
  deleteAsset: (id) => request('DELETE', `/assets/${id}`),
  getAssetHistory: (id) => request('GET', `/assets/${id}/history`),
  getAssetTickets: (id) => request('GET', `/assets/${id}/tickets`),

  // Penalties
  getPenalties: () => request('GET', '/penalties'),
  createPenalty: (data) => request('POST', '/penalties', data),
  updatePenalty: (id, data) => request('PATCH', `/penalties/${id}`, data),
  deletePenalty: (id) => request('DELETE', `/penalties/${id}`),

  // Complaints
  getComplaints: () => request('GET', '/complaints'),
  createComplaint: (data) => request('POST', '/complaints', data),
  updateComplaint: (id, data) => request('PATCH', `/complaints/${id}`, data),
  deleteComplaint: (id) => request('DELETE', `/complaints/${id}`),

  // Employee profile aggregation
  getEmployeeProfile: (id) => request('GET', `/users/${id}/profile`),

  // Auto-assign rules
  getAutoAssignRules: () => request('GET', '/settings/auto-assign'),
  saveAutoAssignRules: (data) => request('POST', '/settings/auto-assign', data),

  // Reports
  getTicketReports: (range = 'month') => request('GET', `/reports/tickets?range=${range}`),
  getAssetReports: () => request('GET', '/reports/assets'),
  getAttendanceReports: (range = 'month') => request('GET', `/reports/attendance?range=${range}`),
  getAnalytics: (range = 'month') => request('GET', `/reports/analytics?range=${range}`),
  getStaffOverview: () => request('GET', '/reports/staff-overview'),

  // Knowledge Base
  getKnowledgeArticles: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/knowledge${qs ? '?' + qs : ''}`)
  },
  getKnowledgeCategories: () => request('GET', '/knowledge/categories'),
  getKnowledgeArticle: (id) => request('GET', `/knowledge/${id}`),
  createKnowledgeArticle: (data) => request('POST', '/knowledge', data),
  updateKnowledgeArticle: (id, data) => request('PATCH', `/knowledge/${id}`, data),
  deleteKnowledgeArticle: (id) => request('DELETE', `/knowledge/${id}`),
  rateKnowledgeArticle: (id, helpful) => request('POST', `/knowledge/${id}/rate`, { helpful }),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    const qs = new URLSearchParams(filtered).toString()
    return request('GET', `/audit-logs${qs ? '?' + qs : ''}`)
  },

  // AI Ticket Categorization
  aiSuggest: (title, description) => request('POST', '/tickets/ai/suggest', { title, description }),

  // Maintenance Schedules
  getMaintenanceSchedules: () => request('GET', '/maintenance'),
  getAssetMaintenance: (assetId) => request('GET', `/maintenance/asset/${assetId}`),
  createMaintenanceSchedule: (data) => request('POST', '/maintenance', data),
  updateMaintenanceSchedule: (id, data) => request('PATCH', `/maintenance/${id}`, data),
  deleteMaintenanceSchedule: (id) => request('DELETE', `/maintenance/${id}`),

  // Onboarding Tasks
  getOnboardingTasks: (userId) => request('GET', `/onboarding/${userId}`),
  generateOnboardingTasks: (userId, type) => request('POST', `/onboarding/${userId}/generate`, { type }),
  createOnboardingTask: (userId, data) => request('POST', `/onboarding/${userId}`, data),
  updateOnboardingTask: (id, data) => request('PATCH', `/onboarding/${id}`, data),
  deleteOnboardingTask: (id) => request('DELETE', `/onboarding/${id}`),

  // Access Records
  getAccessRecords: () => request('GET', '/access-records'),
  getUserAccessRecords: (userId) => request('GET', `/access-records/user/${userId}`),
  createAccessRecord: (data) => request('POST', '/access-records', data),
  updateAccessRecord: (id, data) => request('PATCH', `/access-records/${id}`, data),
  deleteAccessRecord: (id) => request('DELETE', `/access-records/${id}`),

  // Software Licenses
  getLicenses: () => request('GET', '/licenses'),
  createLicense: (data) => request('POST', '/licenses', data),
  updateLicense: (id, data) => request('PATCH', `/licenses/${id}`, data),
  deleteLicense: (id) => request('DELETE', `/licenses/${id}`),
  getLicenseAssignments: (id) => request('GET', `/licenses/${id}/assignments`),
  assignLicense: (id, userId) => request('POST', `/licenses/${id}/assign`, { user_id: userId }),
  unassignLicense: (id, userId) => request('POST', `/licenses/${id}/unassign`, { user_id: userId }),

  // Global Search
  search: (q) => request('GET', `/search?q=${encodeURIComponent(q)}`),

  // Ticket Tags
  getTicketTags: () => request('GET', '/tickets/tags'),
  patchTicketTags: (id, tags) => request('PATCH', `/tickets/${id}/tags`, { tags }),

  // Ticket Merge
  mergeTicket: (id, merge_into_id) => request('POST', `/tickets/${id}/merge`, { merge_into_id }),

  // Upload multiple files
  uploadMultiple: async (files) => {
    const form = new FormData()
    for (const f of files) {
      const fileToUpload = f.type.startsWith('image/') ? await compressImage(f) : f
      form.append('files', fileToUpload, f.name)
    }
    const res = await fetch(`${BASE}/upload/multiple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data
  },

  // SLA settings
  getSlaSettings: () => request('GET', '/settings/sla'),
  saveSlaSettings: (data) => request('POST', '/settings/sla', data),

  // Subcategories
  getSubcategories: () => request('GET', '/settings/subcategories'),
  saveSubcategories: (data) => request('POST', '/settings/subcategories', data),

  // Onboarding templates
  getOnboardingTemplates: () => request('GET', '/settings/onboarding-templates'),
  saveOnboardingTemplates: (data) => request('POST', '/settings/onboarding-templates', data),

  // Knowledge suggestions (no auth needed)
  suggestKnowledge: (q) => {
    return fetch(`${BASE}/knowledge/suggest?q=${encodeURIComponent(q)}`).then(r => r.json())
  },

  // Factory Rotation
  getFactoryGroups: () => request('GET', '/factory-rotation/groups'),
  createFactoryGroup: (name, members) => request('POST', '/factory-rotation/groups', { name, members }),
  updateFactoryGroup: (id, name, members) => request('PUT', `/factory-rotation/groups/${id}`, { name, members }),
  deleteFactoryGroup: (id) => request('DELETE', `/factory-rotation/groups/${id}`),
  getFactorySchedule: (group_id, from, to) => request('GET', `/factory-rotation/schedule?group_id=${group_id}&from=${from}&to=${to}`),
  generateFactorySchedule: (group_id, from_date, to_date) => request('POST', '/factory-rotation/generate', { group_id, from_date, to_date }),
  getMyNextFactory: () => request('GET', '/factory-rotation/my-next'),
  overrideFactoryEntry: (id, user_id) => request('PUT', `/factory-rotation/schedule/${id}`, { user_id }),
  assignFactoryEntry: (group_id, user_id, scheduled_date) => request('POST', '/factory-rotation/schedule/assign', { group_id, user_id, scheduled_date }),
  getFactoryScheduleForUser: (from, to) => request('GET', `/factory-rotation/schedule?from=${from}&to=${to}`),
  markFactoryAttendance: (id) => request('POST', `/factory-rotation/schedule/${id}/attend`, {}),

  // Overtime Rotation
  getOvertimeGroups: () => request('GET', '/overtime-rotation/groups'),
  createOvertimeGroup: (name, members) => request('POST', '/overtime-rotation/groups', { name, members }),
  updateOvertimeGroup: (id, name, members) => request('PUT', `/overtime-rotation/groups/${id}`, { name, members }),
  deleteOvertimeGroup: (id) => request('DELETE', `/overtime-rotation/groups/${id}`),
  getOvertimeSchedule: (group_id, from, to) => request('GET', `/overtime-rotation/schedule?group_id=${group_id}&from=${from}&to=${to}`),
  generateOvertimeSchedule: (group_id, from_date, to_date) => request('POST', '/overtime-rotation/generate', { group_id, from_date, to_date }),
  getMyNextOvertime: () => request('GET', '/overtime-rotation/my-next'),
  overrideOvertimeEntry: (id, user_id) => request('PUT', `/overtime-rotation/schedule/${id}`, { user_id }),
  assignOvertimeEntry: (group_id, user_id, scheduled_date) => request('POST', '/overtime-rotation/schedule/assign', { group_id, user_id, scheduled_date }),
  markOvertimeAttendance: (id) => request('POST', `/overtime-rotation/schedule/${id}/attend`, {}),

  // Group Members (for swap modal)
  getFactoryGroupMembers: (groupId) => request('GET', `/factory-rotation/groups/${groupId}/members`),
  getOvertimeGroupMembers: (groupId) => request('GET', `/overtime-rotation/groups/${groupId}/members`),

  // Rotation Swap Requests
  createRotationSwap: (data) => request('POST', '/rotation-swaps', data),
  getMyRotationSwaps: () => request('GET', '/rotation-swaps/my'),
  acceptRotationSwap: (id, target_schedule_id) => request('POST', `/rotation-swaps/${id}/accept`, { target_schedule_id }),
  rejectRotationSwap: (id) => request('POST', `/rotation-swaps/${id}/reject`, {}),
  getAdminPendingSwaps: () => request('GET', '/rotation-swaps/admin-pending'),
  adminApproveSwap: (id) => request('POST', `/rotation-swaps/${id}/admin-approve`, {}),
  adminRejectSwap: (id) => request('POST', `/rotation-swaps/${id}/admin-reject`, {}),

  // Missions (ماموريات)
  getMissions: () => request('GET', '/missions'),
  createMission: (data) => request('POST', '/missions', data),
  updateMission: (id, data) => request('PUT', `/missions/${id}`, data),
  updateMissionStatus: (id, status) => request('PATCH', `/missions/${id}/status`, { status }),
  approveMission: (id) => request('POST', `/missions/${id}/approve`, {}),
  adminRejectMission: (id) => request('POST', `/missions/${id}/admin-reject`, {}),
  deleteMission: (id) => request('DELETE', `/missions/${id}`),

  // Announcements
  getAnnouncements: () => request('GET', '/announcements'),
  createAnnouncement: (data) => request('POST', '/announcements', data),
  markAnnouncementRead: (id) => request('PATCH', `/announcements/${id}/read`),
  deleteAnnouncement: (id) => request('DELETE', `/announcements/${id}`),

  // Departments
  getDepartments: () => request('GET', '/departments'),
  createDepartment: (data) => request('POST', '/departments', data),
  updateDepartment: (id, data) => request('PATCH', `/departments/${id}`, data),
  deleteDepartment: (id) => request('DELETE', `/departments/${id}`),
}

// ─── CSV Export helper ───────────────────────────────────────────────────────
export function exportCsv(filename, rows, columns) {
  if (!rows || rows.length === 0) return
  const header = columns.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const val = c.value(row)
      if (val === null || val === undefined) return '""'
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  ).join('\n')
  const csv = header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── WebSocket client with heartbeat & auto-reconnect ───────────────────────
let ws = null
let wsOnEvent = null
let reconnectTimer = null
let heartbeatTimer = null
let reconnectDelay = 2000

function clearTimers() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
}

function startHeartbeat() {
  clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'ping' }))
    } else {
      scheduleReconnect()
    }
  }, 25000)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  const token = getToken()
  if (!token || !wsOnEvent) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWS(token, wsOnEvent)
  }, reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 1.5, 30000)
}

export function connectWS(token, onEvent) {
  clearTimers()
  if (ws) { ws.onclose = null; ws.close(); ws = null }

  wsOnEvent = onEvent
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`)

  ws.onopen = () => {
    reconnectDelay = 2000
    startHeartbeat()
  }

  ws.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data)
      if (event === 'pong' || event === 'ping') return
      onEvent(event, data)
    } catch {}
  }

  ws.onclose = () => {
    clearTimers()
    scheduleReconnect()
  }

  ws.onerror = () => {
    clearTimers()
    scheduleReconnect()
  }
}

export function disconnectWS() {
  clearTimers()
  wsOnEvent = null
  if (ws) { ws.onclose = null; ws.close(); ws = null }
}

export function isWSOpen() {
  return ws && ws.readyState === WebSocket.OPEN
}

// Reconnect when the tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const token = getToken()
    if (token && wsOnEvent && !isWSOpen()) {
      reconnectTimer = null
      connectWS(token, wsOnEvent)
    }
  }
})

// Reconnect on window focus if WS is down
window.addEventListener('focus', () => {
  const token = getToken()
  if (token && wsOnEvent && !isWSOpen()) {
    reconnectTimer = null
    connectWS(token, wsOnEvent)
  }
})
