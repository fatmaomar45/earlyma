import { describe, it, expect } from 'vitest'
import { buildDashboardData } from '../src/lib/reports.js'

const today = new Date(2026, 4, 15) // 15 May 2026

function makeDb() {
  return {
    workers: [{ id: 'w1', fullName: 'Worker One', village: 'Alpha', active: true }],
    mothers: [
      {
        id: 'm-overdue',
        type: 'mother',
        code: 'M-0001',
        fullName: 'Past Due Mother',
        village: 'Alpha',
        workerId: 'w1',
        expectedDeliveryDate: '2026-01-01',
        actualDeliveryDate: '',
        registrationDate: '2025-11-01',
        createdAt: '2025-11-01T08:00:00.000Z',
        language: 'sw',
      },
      {
        id: 'm-future',
        type: 'mother',
        code: 'M-0002',
        fullName: 'Future Mother',
        village: 'Alpha',
        workerId: 'w1',
        expectedDeliveryDate: '2027-06-01',
        actualDeliveryDate: '',
        registrationDate: '2026-04-01',
        createdAt: '2026-04-01T08:00:00.000Z',
        language: 'sw',
      },
    ],
    babies: [
      {
        id: 'b-overdue',
        type: 'baby',
        code: 'B-0001',
        fullName: 'Past Due Baby',
        motherId: 'm-overdue',
        motherName: 'Past Due Mother',
        village: 'Alpha',
        workerId: 'w1',
        dateOfBirth: '2025-12-01',
        createdAt: '2025-12-05T08:00:00.000Z',
        language: 'sw',
      },
    ],
    visitRecords: {},
    notifications: [],
    callLogs: [],
    activities: [],
  }
}

describe('buildDashboardData follow-up and upcoming stats', () => {
  it('counts mothers and babies requiring follow-up', () => {
    const data = buildDashboardData(makeDb(), { today })
    expect(data.stats.mothersFollowUp).toBe(1)
    expect(data.stats.babiesFollowUp).toBe(1)
    expect(data.stats.followUpTotal).toBe(2)
    expect(data.followUpVisits.length).toBeGreaterThan(0)
  })

  it('counts upcoming future appointments separately from today', () => {
    const data = buildDashboardData(makeDb(), { today })
    expect(data.stats.upcoming).toBeGreaterThan(0)
    expect(data.stats.dueToday).toBeGreaterThanOrEqual(0)
    expect(data.upcomingVisits.every((visit) => visit.status !== 'completed' && visit.status !== 'cancelled')).toBe(true)
  })

  it('scopes follow-up counts to the selected worker', () => {
    const db = makeDb()
    db.mothers.push({ ...db.mothers[0], id: 'm-other', workerId: 'w2', code: 'M-0003' })
    const data = buildDashboardData(db, { today, workerId: 'w1' })
    expect(data.stats.mothersFollowUp).toBe(1)
    expect(data.mothers.every((mother) => mother.workerId === 'w1')).toBe(true)
  })
})