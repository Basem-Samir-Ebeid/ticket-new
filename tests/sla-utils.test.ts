describe('SLA Utility Logic', () => {
  function getSlaDeadline(createdAt: Date, priority: string, slaHours: Record<string, number>): Date {
    const hours = slaHours[priority] ?? 72
    return new Date(createdAt.getTime() + hours * 3600000)
  }

  const slaHours = { urgent: 4, high: 24, medium: 72, low: 120 }

  it('calculates urgent SLA deadline as 4 hours from creation', () => {
    const created = new Date('2026-01-01T10:00:00Z')
    const deadline = getSlaDeadline(created, 'urgent', slaHours)
    expect(deadline.getTime()).toBe(new Date('2026-01-01T14:00:00Z').getTime())
  })

  it('calculates high SLA deadline as 24 hours from creation', () => {
    const created = new Date('2026-01-01T10:00:00Z')
    const deadline = getSlaDeadline(created, 'high', slaHours)
    expect(deadline.getTime()).toBe(new Date('2026-01-02T10:00:00Z').getTime())
  })

  it('calculates medium SLA deadline as 72 hours from creation', () => {
    const created = new Date('2026-01-01T10:00:00Z')
    const deadline = getSlaDeadline(created, 'medium', slaHours)
    expect(deadline.getTime()).toBe(new Date('2026-01-04T10:00:00Z').getTime())
  })

  it('falls back to 72h for unknown priority', () => {
    const created = new Date('2026-01-01T10:00:00Z')
    const deadline = getSlaDeadline(created, 'unknown', slaHours)
    expect(deadline.getTime()).toBe(new Date('2026-01-04T10:00:00Z').getTime())
  })

  it('detects ticket within 2-hour warning window', () => {
    const now = new Date()
    const deadline = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const isAtRisk = deadline > now && deadline <= twoHoursFromNow
    expect(isAtRisk).toBe(true)
  })

  it('does not flag ticket with deadline more than 2 hours away', () => {
    const now = new Date()
    const deadline = new Date(now.getTime() + 5 * 60 * 60 * 1000) // 5 hours from now
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const isAtRisk = deadline > now && deadline <= twoHoursFromNow
    expect(isAtRisk).toBe(false)
  })

  it('detects SLA compliance when ticket solved before deadline', () => {
    const deadline = new Date('2026-01-01T18:00:00Z')
    const solvedAt = new Date('2026-01-01T16:00:00Z')
    const isCompliant = solvedAt <= deadline
    expect(isCompliant).toBe(true)
  })

  it('detects SLA breach when ticket solved after deadline', () => {
    const deadline = new Date('2026-01-01T14:00:00Z')
    const solvedAt = new Date('2026-01-01T18:00:00Z')
    const isCompliant = solvedAt <= deadline
    expect(isCompliant).toBe(false)
  })
})
