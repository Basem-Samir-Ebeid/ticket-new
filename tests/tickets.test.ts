import request from 'supertest'
import app from '../server/app'

describe('Tickets API', () => {
  describe('GET /api/tickets', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/tickets')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/tickets')
        .set('Authorization', 'Bearer bad.token.here')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/tickets', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({ title: 'Test ticket', description: 'desc' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/tickets/:id', () => {
    it('returns 401 or 404 without authentication (auth or not found)', async () => {
      const res = await request(app).get('/api/tickets/00000000-0000-0000-0000-000000000000')
      expect([401, 404]).toContain(res.status)
    })
  })
})
