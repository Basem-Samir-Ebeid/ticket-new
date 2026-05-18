const CACHE_NAME = 'finest-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/logo.png',
]

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: Cache-First for static assets, Network-First for API ───────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // API calls: Network-First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request))
    return
  }

  // Static assets: Cache-First
  event.respondWith(cacheFirstWithNetwork(request))
})

async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request.clone(), { signal: AbortSignal.timeout(8000) })
    if (response.ok) cache.put(request, response.clone()).catch(() => {})
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
    })
  }
}

async function cacheFirstWithNetwork(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request.clone())
    if (response.ok) cache.put(request, response.clone()).catch(() => {})
    return response
  } catch {
    // Return cached index.html for navigation requests (SPA fallback)
    if (request.mode === 'navigate') {
      const index = await cache.match('/index.html') || await cache.match('/')
      if (index) return index
    }
    return new Response('Offline', { status: 503 })
  }
}

// ── Background Sync: replay queued offline actions ────────────────────────────
const SYNC_QUEUE_KEY = 'finest-offline-queue'

self.addEventListener('sync', (event) => {
  if (event.tag === 'finest-sync-queue') {
    event.waitUntil(replayQueue())
  }
})

async function replayQueue() {
  const db = await openQueueDb()
  const items = await getAllFromDb(db)
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })
      if (res.ok) await deleteFromDb(db, item.id)
    } catch {
      // Keep in queue for next sync
    }
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finest-queue', 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

function getAllFromDb(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function deleteFromDb(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/'
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
