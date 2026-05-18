import request from 'supertest'
import app from '../server/app'

describe('AI Ticket Suggestions API', () => {
  describe('POST /api/tickets/ai/suggest', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/tickets/ai/suggest')
        .send({ title: 'My printer is broken', description: 'It makes a grinding noise' })
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/tickets/ai/suggest')
        .send({ title: 'Network down' })
        .set('Authorization', 'Bearer bad.token')
      expect(res.status).toBe(401)
    })
  })
})
