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
