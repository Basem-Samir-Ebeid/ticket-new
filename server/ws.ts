import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { verifyToken } from './auth'

const clients = new Map<string, Set<WebSocket>>()

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')
    let userId: string | null = null

    if (token) {
      try {
        const payload = verifyToken(token)
        userId = payload.userId
        if (!clients.has(userId)) clients.set(userId, new Set())
        clients.get(userId)!.add(ws)
      } catch {}
    }

    ws.on('close', () => {
      if (userId) {
        clients.get(userId)?.delete(ws)
        if (clients.get(userId)?.size === 0) clients.delete(userId)
      }
    })
  })
}

export function broadcast(userId: string, event: string, data: any) {
  const userClients = clients.get(userId)
  if (!userClients) return
  const msg = JSON.stringify({ event, data })
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  })
}

export function broadcastAll(event: string, data: any) {
  const msg = JSON.stringify({ event, data })
  clients.forEach(userClients => {
    userClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    })
  })
}
