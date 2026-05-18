import request from 'supertest'
import app from '../server/app'

describe('Reports API', () => {
  describe('GET /api/reports/analytics', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/reports/analytics')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/reports/analytics?range=month')
        .set('Authorization', 'Bearer invalid.token')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/reports/tickets', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/reports/tickets')
      expect(res.status).toBe(401)
    })
  })
})
