import request from 'supertest'
import app from '../server/app'

describe('Audit Logs API', () => {
  describe('GET /api/audit-logs', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/audit-logs')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/audit-logs?limit=10')
        .set('Authorization', 'Bearer invalid.token.here')
      expect(res.status).toBe(401)
    })
  })
})
