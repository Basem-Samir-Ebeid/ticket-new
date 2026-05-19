import request from 'supertest'

const mockDb: any = {
  then: (resolve: any) => resolve([]),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
}

jest.mock('../server/db', () => ({ db: mockDb }))
jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(false),
  hash: jest.fn().mockResolvedValue('hashed'),
}))

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
