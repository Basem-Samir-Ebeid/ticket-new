import request from 'supertest'
import app from '../server/app'

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('returns 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'testpass' })
      expect(res.status).toBe(400)
    })

    it('returns 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
      expect(res.status).toBe(400)
    })

    it('returns 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'wrongpass' })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken')
      expect(res.status).toBe(401)
    })
  })
})
