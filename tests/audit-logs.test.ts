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
