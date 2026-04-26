import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './ws'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import ticketRoutes from './routes/tickets'
import attendanceRoutes from './routes/attendance'
import leaveRoutes from './routes/leaves'
import notificationRoutes from './routes/notifications'
import uploadRoutes from './routes/uploads'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

setupWebSocket(wss)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/upload', uploadRoutes)

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'))
  })
}

const PORT = parseInt(process.env.PORT || '3000')
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
