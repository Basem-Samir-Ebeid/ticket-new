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
