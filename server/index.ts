import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './ws'
import app from './app'

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

setupWebSocket(wss)

const PORT = parseInt(process.env.PORT || '3000')
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
