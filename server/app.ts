import express from 'express'
import cors from 'cors'
import path from 'path'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import ticketRoutes from './routes/tickets'
import attendanceRoutes from './routes/attendance'
import leaveRoutes from './routes/leaves'
import notificationRoutes from './routes/notifications'
import uploadRoutes from './routes/uploads'
import pushRoutes from './routes/push'
import settingsRoutes from './routes/settings'
import githubSyncRoutes from './routes/github-sync'
import githubSyncStatusRoutes from './routes/github-sync-status'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/leaves', leaveRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/internal/github-sync', githubSyncRoutes)
app.use('/api/github-sync-status', githubSyncStatusRoutes)

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(process.cwd(), 'public')))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
  })
}

export default app
