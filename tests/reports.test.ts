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
