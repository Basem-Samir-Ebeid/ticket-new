const BASE = '/api'

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
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data })
  return data
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  changePassword: (currentPassword, newPassword) => request('POST', '/auth/change-password', { currentPassword, newPassword }),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  resetPassword: (id, newPassword) => request('POST', `/users/${id}/reset-password`, { newPassword }),
  revokeSession: (id, reason) => request('POST', `/users/${id}/revoke-session`, { reason }),

  // Tickets
  getTickets: () => request('GET', '/tickets'),
  getRequests: () => request('GET', '/tickets/requests'),
  createTicket: (data) => request('POST', '/tickets', data),
  updateTicket: (id, data) => request('PATCH', `/tickets/${id}`, data),
  deleteTicket: (id) => request('DELETE', `/tickets/${id}`),
  acceptRequest: (id, assigned_to) => request('POST', `/tickets/${id}/accept`, { assigned_to }),
  refuseRequest: (id) => request('POST', `/tickets/${id}/refuse`),
  getReplies: (ticketId) => request('GET', `/tickets/${ticketId}/replies`),
  createReply: (ticketId, data) => request('POST', `/tickets/${ticketId}/replies`, data),

  // Attendance
  getAttendance: (date) => request('GET', `/attendance?date=${date}`),
  getTodayAttendance: () => request('GET', '/attendance/today'),
  registerLogin: (latitude, longitude) => request('POST', '/attendance/login', { latitude, longitude }),
  registerLogout: (latitude, longitude) => request('POST', '/attendance/logout', { latitude, longitude }),
  deleteAttendance: (id) => request('DELETE', `/attendance/${id}`),

  // Leaves
  getLeaves: () => request('GET', '/leaves'),
  createLeave: (data) => request('POST', '/leaves', data),
  approveLeave: (id) => request('PATCH', `/leaves/${id}/approve`),
  rejectLeave: (id, note) => request('PATCH', `/leaves/${id}/reject`, { note }),
  deleteLeave: (id) => request('DELETE', `/leaves/${id}`),

  // Notifications
  getNotifications: () => request('GET', '/notifications'),
  markRead: (id) => request('PATCH', `/notifications/${id}/read`),

  // Upload
  uploadFile: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data.url
  },
}

// WebSocket client
let ws = null
const listeners = new Map()

export function connectWS(token, onEvent) {
  if (ws) ws.close()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`)
  ws.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data)
      onEvent(event, data)
    } catch {}
  }
  ws.onclose = () => {
    setTimeout(() => {
      const t = getToken()
      if (t) connectWS(t, onEvent)
    }, 3000)
  }
}

export function disconnectWS() {
  if (ws) { ws.close(); ws = null }
}
