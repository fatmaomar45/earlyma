import { describe, it, expect } from 'vitest'
import { buildDashboardData, buildReport, DEFAULT_REPORT_FILTERS, reportSummaryRows, reportVisitRows } from '../src/lib/reports.js'
import { buildAllVisits } from '../src/lib/visits.js'
import { diffDays } from '../src/lib/dates.js'

const today = new Date(2026, 4, 15)

function makeDb() {
  const db = {
    workers: [
      { id: 'w1', fullName: 'Worker One', village: 'Alpha', active: true },
      { id: 'w2', fullName: 'Worker Two', village: 'Beta', active: false },
    ],
    mothers: [
      {
        id: 'm1',
        type: 'mother',
        code: 'M-0001',
        fullName: 'Amina Test',
        village: 'Alpha',
        workerId: 'w1',
        expectedDeliveryDate: '2026-06-01',
        actualDeliveryDate: '',
        registrationDate: '2026-01-10',
        createdAt: '2026-01-10T08:00:00.000Z',
        language: 'sw',
      },
      {
        id: 'm2',
        type: 'mother',
        code: 'M-0002',
        fullName: 'Zainabu Test',
        village: 'Beta',
        workerId: 'w2',
        expectedDeliveryDate: '2026-08-01',
        actualDeliveryDate: '',
        registrationDate: '2025-12-01',
        createdAt: '2025-12-01T08:00:00.000Z',
        language: 'en',
      },
    ],
    babies: [
      {
        id: 'b1',
        type: 'baby',
        code: 'B-0001',
        fullName: 'Baby Test',
        motherId: 'm1',
        motherName: 'Amina Test',
        village: 'Alpha',
        workerId: 'w1',
        dateOfBirth: '2026-01-01',
        createdAt: '2026-01-05T08:00:00.000Z',
      },
    ],
    visitRecords: {},
    notifications: [
      {
        id: 'n1',
        clientId: 'm1',
        clientType: 'mother',
        workerId: 'w1',
        status: 'sent',
        createdAt: '2026-03-01T09:00:00.000Z',
      },
      {
        id: 'n2',
        clientId: 'b1',
        clientType: 'baby',
        workerId: 'w1',
        status: 'queued',
        createdAt: '2026-03-02T09:00:00.000Z',
      },
    ],
    callLogs: [
      { id: 'c1', clientId: 'm1', clientType: 'mother', workerId: 'w1', outcome: 'confirmed', at: '2026-03-03T09:00:00.000Z' },
      { id: 'c2', clientId: 'm2', clientType: 'mother', workerId: 'w2', outcome: 'no_answer', at: '2026-03-04T09:00:00.000Z' },
    ],
    activities: [
      { id: 'a1', actorId: 'w1', action: 'visit.completed', at: '2026-03-01T09:00:00.000Z' },
      { id: 'a2', actorId: 'w2', action: 'client.created', at: '2026-04-01T09:00:00.000Z' },
    ],
  }

  const visits = buildAllVisits(db, { today })
  const completed = visits.find((visit) => visit.clientId === 'm1')
  db.visitRecords[completed.id] = {
    completedDate: completed.scheduledDateInput,
    cancelled: false,
    notes: 'Attended',
    followUpRequired: false,
    updatedAt: today.toISOString(),
  }
  return db
}

describe('buildReport', () => {
  it('reports unfiltered metrics', () => {
    const report = buildReport(makeDb(), {}, { today })
    expect(report.filters).toEqual(DEFAULT_REPORT_FILTERS)
    expect(report.mothers).toHaveLength(2)
    expect(report.babies).toHaveLength(1)
    expect(report.clients).toHaveLength(3)
    expect(report.visits.length).toBeGreaterThan(20)
    expect(report.metrics).toMatchObject({
      registeredMothers: 2,
      registeredBabies: 1,
      totalClients: 3,
      completedVisits: 1,
      notificationTotal: 2,
      notificationsQueued: 1,
      notificationsSent: 1,
      calls: 2,
    })
    expect(report.visitsByCategory.length).toBeGreaterThan(0)
    expect(report.visitsByWorker.length).toBeGreaterThan(0)
    expect(report.workerActivity).toHaveLength(2)
    expect(report.registrationsByMonth.length).toBeGreaterThan(0)
  })

  it('filters by client category', () => {
    const report = buildReport(makeDb(), { category: 'baby' }, { today })
    expect(report.mothers).toHaveLength(0)
    expect(report.babies).toHaveLength(1)
    expect(report.clients).toHaveLength(1)
    expect(report.visits.every((visit) => visit.clientType === 'baby')).toBe(true)
    expect(report.notifications.map((notification) => notification.id)).toEqual(['n2'])
    expect(report.metrics).toMatchObject({ registeredMothers: 0, registeredBabies: 1, totalClients: 1, calls: 0 })
  })

  it('filters by village and worker', () => {
    const village = buildReport(makeDb(), { village: 'Alpha' }, { today })
    expect(village.clients.map((client) => client.id).sort()).toEqual(['b1', 'm1'])
    expect(village.calls.map((call) => call.id)).toEqual(['c1'])
    expect(village.metrics.totalClients).toBe(2)

    const worker = buildReport(makeDb(), { workerId: 'w1' }, { today })
    expect(worker.visits.every((visit) => visit.workerId === 'w1')).toBe(true)
    expect(worker.notifications.every((notification) => notification.workerId === 'w1')).toBe(true)
    expect(worker.calls.map((call) => call.id)).toEqual(['c1'])
    expect(worker.workerActivity).toHaveLength(1)
  })

  it('filters by date range and ignores invalid dates', () => {
    const report = buildReport(makeDb(), { dateFrom: '2026-01-01', dateTo: '2026-01-31' }, { today })
    expect(report.mothers.map((mother) => mother.id)).toEqual(['m1'])
    expect(report.babies.map((baby) => baby.id)).toEqual(['b1'])
    expect(report.visits.every((visit) => visit.scheduledDateInput >= '2026-01-01' && visit.scheduledDateInput <= '2026-01-31')).toBe(true)
    expect(report.metrics.notificationTotal).toBe(0)

    const invalid = buildReport(makeDb(), { dateFrom: 'bad', dateTo: '2026-02-30' }, { today })
    expect(invalid.filters.dateFrom).toBe('')
    expect(invalid.filters.dateTo).toBe('')
    expect(invalid.mothers).toHaveLength(2)
  })

  it('filters by visit status', () => {
    const report = buildReport(makeDb(), { status: 'completed' }, { today })
    expect(report.visits).toHaveLength(1)
    expect(report.visits[0].status).toBe('completed')
    expect(report.metrics.completionRate).toBe(100)
  })
})

describe('buildDashboardData', () => {
  it('builds scoped dashboard statistics', () => {
    const dashboard = buildDashboardData(makeDb(), { today })
    expect(dashboard.stats).toMatchObject({
      totalMothers: 2,
      totalBabies: 1,
      activeClients: 3,
      completed: 1,
      pendingReminders: 1,
      failedNotifications: 0,
    })
    expect(dashboard.registrations).toHaveLength(6)
    expect(dashboard.overdueTrend).toHaveLength(6)
    expect(dashboard.activities).toHaveLength(2)
    expect(dashboard.visitStatusCounts.completed).toBe(1)
    expect(dashboard.upcomingVisits.every((visit) => diffDays(today, visit.scheduledDate) >= 0)).toBe(true)
  })

  it('scopes dashboard data to a worker', () => {
    const dashboard = buildDashboardData(makeDb(), { today, workerId: 'w1' })
    expect(dashboard.stats.totalMothers).toBe(1)
    expect(dashboard.stats.totalBabies).toBe(1)
    expect(dashboard.activities.map((activity) => activity.id)).toEqual(['a1'])
    expect(dashboard.visits.every((visit) => visit.workerId === 'w1')).toBe(true)
    expect(dashboard.notifications.every((notification) => notification.workerId === 'w1')).toBe(true)
  })
})

describe('report tables', () => {
  it('maps visit rows for export', () => {
    const report = buildReport(makeDb(), {}, { today })
    const rows = reportVisitRows(report, 'sw')
    expect(rows).toHaveLength(report.visits.length)
    expect(rows[0]).toMatchObject({
      client: report.visits[0].clientName,
      clientId: report.visits[0].clientCode,
      clientType: report.visits[0].clientType,
      scheduledDate: report.visits[0].scheduledDateInput,
      status: report.visits[0].status,
    })
    expect(rows[0].visit).toBe(report.visits[0].name.sw)
    expect(rows[0].followUpRequired).toMatch(/^(yes|no)$/)
  })

  it('maps summary rows', () => {
    const report = buildReport(makeDb(), {}, { today })
    const rows = reportSummaryRows(report)
    expect(rows.length).toBe(Object.keys(report.metrics).length)
    expect(rows[0]).toHaveProperty('metric')
    expect(rows[0]).toHaveProperty('value')
  })
})
