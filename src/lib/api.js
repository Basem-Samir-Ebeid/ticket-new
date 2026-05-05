const BASE = "/api"

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
  forceChangePassword: (newPassword) => request('POST', '/auth/force-change-password', { newPassword }),

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
