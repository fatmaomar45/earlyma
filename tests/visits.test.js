import { describe, it, expect } from 'vitest'
import {
  buildAllVisits,
  buildVisitsForClient,
  filterVisits,
  getVisitById,
  groupVisitsByMonth,
  isVisitActionable,
  nextActionableVisit,
  scheduleAnchorDate,
  sortVisits,
  summarizeVisits,
  summarizeVisitsForToday,
  visitCategoryLabel,
  visitClientPath,
  visitDisplayDate,
  visitKey,
  visitStatusFor,
  applyOffset,
  VISIT_STATUSES,
} from '../src/lib/visits.js'
import { SCHEDULES } from '../src/data/schedules.js'
import { diffDays, toInput } from '../src/lib/dates.js'

const today = new Date(2026, 4, 15)

function mother(overrides = {}) {
  return {
    id: 'm1',
    type: 'mother',
    fullName: 'Amina Test',
    code: 'M-0001',
    village: 'Demo Village',
    workerId: 'w1',
    language: 'sw',
    expectedDeliveryDate: '2026-06-01',
    actualDeliveryDate: '',
    ...overrides,
  }
}

function baby(overrides = {}) {
  return {
    id: 'b1',
    type: 'baby',
    fullName: 'Baby Test',
    code: 'B-0001',
    village: 'Demo Village',
    workerId: 'w1',
    language: 'en',
    dateOfBirth: '2026-01-01',
    ...overrides,
  }
}

describe('schedule helpers', () => {
  it('applies day, week and month offsets', () => {
    const base = new Date(2026, 0, 1)
    expect(toInput(applyOffset(base, { days: 10 }))).toBe('2026-01-11')
    expect(toInput(applyOffset(base, { weeks: 2 }))).toBe('2026-01-15')
    expect(toInput(applyOffset(base, { months: 1 }))).toBe('2026-02-01')
    expect(applyOffset(null)).toBeNull()
  })

  it('selects the correct anchor date for each schedule', () => {
    expect(toInput(scheduleAnchorDate(mother(), SCHEDULES.anc))).toBe('2026-06-01')
    expect(toInput(scheduleAnchorDate(mother({ actualDeliveryDate: '2026-05-20' }), SCHEDULES.pnc))).toBe('2026-05-20')
    expect(toInput(scheduleAnchorDate(baby(), SCHEDULES.babyImmunization))).toBe('2026-01-01')
    expect(scheduleAnchorDate(null, SCHEDULES.anc)).toBeNull()
  })

  it('builds stable visit keys containing the client and schedule ids', () => {
    expect(visitKey({ type: 'mother', id: 'm1' }, 'anc', 'anc-12')).toBe('mother:m1::anc::anc-12')
  })
})

describe('visit status', () => {
  it('covers every required status', () => {
    expect(VISIT_STATUSES).toEqual(['completed', 'cancelled', 'overdue', 'due_today', 'due_soon', 'upcoming'])
    expect(visitStatusFor(today, today)).toBe('due_today')
    expect(visitStatusFor(new Date(2026, 4, 16), today)).toBe('due_soon')
    expect(visitStatusFor(new Date(2026, 4, 22), today)).toBe('due_soon')
    expect(visitStatusFor(new Date(2026, 4, 23), today)).toBe('upcoming')
    expect(visitStatusFor(new Date(2026, 4, 14), today)).toBe('overdue')
  })

  it('gives explicit records priority over calendar status', () => {
    expect(visitStatusFor(today, today, { completedDate: '2026-05-15' })).toBe('completed')
    expect(visitStatusFor(today, today, { cancelled: true })).toBe('cancelled')
    expect(visitStatusFor(null, today)).toBe('upcoming')
  })
})

describe('building visits', () => {
  it('builds ANC and PNC visits for a mother', () => {
    const visits = buildVisitsForClient(mother(), { today })
    expect(visits).toHaveLength(SCHEDULES.anc.visits.length + SCHEDULES.pnc.visits.length)
    expect(visits.every((visit) => visit.clientType === 'mother')).toBe(true)
    expect(visits.map((visit) => visit.scheduledDate.getTime()))
      .toEqual([...visits].map((visit) => visit.scheduledDate.getTime()).sort((a, b) => a - b))

    const anc12 = visits.find((visit) => visit.scheduleVisitId === 'anc-12')
    expect(diffDays(new Date(2026, 5, 1), anc12.scheduledDate)).toBe(-196)
    const pnc42 = visits.find((visit) => visit.scheduleVisitId === 'pnc-42')
    expect(diffDays(new Date(2026, 5, 1), pnc42.scheduledDate)).toBe(42)
  })

  it('builds immunization and growth visits for a baby', () => {
    const visits = buildVisitsForClient(baby(), { today })
    expect(visits).toHaveLength(SCHEDULES.babyImmunization.visits.length + SCHEDULES.babyGrowth.visits.length)
    expect(visits.filter((visit) => visit.category === 'immunization')).toHaveLength(6)
    expect(visits.filter((visit) => visit.category === 'growth')).toHaveLength(7)
    expect(visits[0].scheduledDateInput).toBe('2026-01-01')
  })

  it('applies completion, cancellation and notes from records', () => {
    const base = buildVisitsForClient(mother(), { today })
    const completed = base[0]
    const cancelled = base[1]
    const visitRecords = {
      [completed.id]: { completedDate: '2026-01-01', notes: 'Attended', followUpRequired: true },
      [cancelled.id]: { cancelled: true, notes: 'Moved' },
    }
    const visits = buildVisitsForClient(mother(), { today, visitRecords })
    expect(visits.find((visit) => visit.id === completed.id)).toMatchObject({
      status: 'completed',
      completedDate: '2026-01-01',
      notes: 'Attended',
      followUpRequired: true,
    })
    expect(visits.find((visit) => visit.id === cancelled.id)).toMatchObject({
      status: 'cancelled',
      notes: 'Moved',
      cancelled: true,
    })
  })

  it('returns no visits for invalid clients or missing anchors', () => {
    expect(buildVisitsForClient(null)).toEqual([])
    expect(buildVisitsForClient({ id: 'x' })).toEqual([])
    expect(buildVisitsForClient(mother({ expectedDeliveryDate: '', actualDeliveryDate: '' }))).toEqual([])
  })

  it('builds visits across a whole database', () => {
    const db = { mothers: [mother()], babies: [baby()], visitRecords: {} }
    const visits = buildAllVisits(db, { today })
    expect(visits).toHaveLength(12 + 13)
    expect(buildAllVisits({}, { today })).toEqual([])
  })
})

describe('actionable visits and summaries', () => {
  const base = buildVisitsForClient(baby({ dateOfBirth: '2026-01-01' }), { today })

  it('identifies actionable visits', () => {
    expect(isVisitActionable({ status: 'completed' })).toBe(false)
    expect(isVisitActionable({ status: 'cancelled' })).toBe(false)
    expect(isVisitActionable({ status: 'overdue' })).toBe(true)
    expect(isVisitActionable(null)).toBe(false)
  })

  it('prefers the next future visit and falls back to the earliest overdue visit', () => {
    const visit = (id, date, status = 'upcoming') => ({ id, scheduledDate: date, status })
    const overdue = visit('a', new Date(2026, 3, 1), 'overdue')
    const due = visit('b', today, 'due_today')
    const future = visit('c', new Date(2026, 5, 1))
    expect(nextActionableVisit([overdue, due, future], today).id).toBe('b')
    expect(nextActionableVisit([overdue], today).id).toBe('a')
    expect(nextActionableVisit([], today)).toBeNull()
  })

  it('summarises statuses and completion rate', () => {
    const visits = [
      { ...base[0], status: 'completed' },
      { ...base[1], status: 'cancelled' },
      { ...base[2], status: 'overdue', scheduledDate: new Date(2026, 4, 1) },
      { ...base[3], status: 'due_today', scheduledDate: today },
      { ...base[4], status: 'due_soon', scheduledDate: new Date(2026, 4, 18) },
      { ...base[5], status: 'upcoming', scheduledDate: new Date(2026, 6, 1) },
    ]
    const summary = summarizeVisits(visits, today)
    expect(summary.total).toBe(6)
    expect(summary.completed).toBe(1)
    expect(summary.cancelled).toBe(1)
    expect(summary.completionRate).toBe(20)
    expect(summary.dueNext7Days).toBe(2)
  })

  it('summarises today-specific counts', () => {
    const visits = [
      { status: 'completed', scheduledDate: today },
      { status: 'cancelled', scheduledDate: today },
      { status: 'overdue', scheduledDate: new Date(2026, 4, 1) },
      { status: 'due_today', scheduledDate: today },
      { status: 'due_soon', scheduledDate: new Date(2026, 4, 20) },
      { status: 'upcoming', scheduledDate: new Date(2026, 6, 1) },
    ]
    expect(summarizeVisitsForToday(visits, today)).toEqual({
      dueToday: 1,
      dueSoon: 2,
      overdue: 1,
      upcoming: 1,
      completed: 1,
      cancelled: 1,
    })
  })
})

describe('lookup, filtering and grouping', () => {
  const db = { mothers: [mother()], babies: [baby()], visitRecords: {} }
  const visits = buildAllVisits(db, { today })

  it('finds a visit by id', () => {
    const first = visits[0]
    expect(getVisitById(db, first.id, today)).toMatchObject({ id: first.id })
    expect(getVisitById(db, 'missing', today)).toBeNull()
  })

  it('builds client profile paths', () => {
    expect(visitClientPath(visits.find((visit) => visit.clientType === 'mother'))).toBe('/mothers/m1')
    expect(visitClientPath(visits.find((visit) => visit.clientType === 'baby'))).toBe('/babies/b1')
    expect(visitClientPath(null)).toBe('/')
  })

  it('formats display dates and category labels', () => {
    expect(visitDisplayDate(null)).toBe('')
    expect(visitDisplayDate(visits[0], 'en-GB')).toMatch(/2025/)
    expect(visitCategoryLabel('anc', 'sw')).toBe('Huduma kabla ya kujifungua')
    expect(visitCategoryLabel('unknown', 'en')).toBe('Child health')
  })

  it('filters by client, worker, village, category, status, dates and query', () => {
    expect(filterVisits(visits, { clientId: 'm1' }).every((visit) => visit.clientId === 'm1')).toBe(true)
    expect(filterVisits(visits, { category: 'anc' }).every((visit) => visit.category === 'anc')).toBe(true)
    expect(filterVisits(visits, { status: 'upcoming' }).every((visit) => visit.status === 'upcoming')).toBe(true)
    expect(filterVisits(visits, { workerId: 'w1' })).toHaveLength(visits.length)
    expect(filterVisits(visits, { workerId: 'w2' })).toHaveLength(0)
    expect(filterVisits(visits, { village: 'Demo Village' })).toHaveLength(visits.length)
    expect(filterVisits(visits, { query: 'amina' }).every((visit) => visit.clientId === 'm1')).toBe(true)
    expect(filterVisits(visits, { query: 'no match at all' })).toHaveLength(0)

    const from = '2026-01-01'
    const to = '2026-01-31'
    const ranged = filterVisits(visits, { dateFrom: from, dateTo: to })
    expect(ranged.length).toBeGreaterThan(0)
    expect(ranged.every((visit) => visit.scheduledDateInput >= from && visit.scheduledDateInput <= to)).toBe(true)
  })

  it('sorts visits without mutating the source', () => {
    const source = [...visits]
    const ascending = sortVisits(source, 'date', 'asc')
    const descending = sortVisits(source, 'date', 'desc')
    expect(ascending[0].scheduledDate <= ascending.at(-1).scheduledDate).toBe(true)
    expect(descending[0].scheduledDate >= descending.at(-1).scheduledDate).toBe(true)
    expect(source).toEqual(visits)
    expect(sortVisits(visits, 'client')[0].clientName <= sortVisits(visits, 'client').at(-1).clientName).toBe(true)
  })

  it('groups visits by scheduled month', () => {
    const grouped = groupVisitsByMonth(visits)
    expect(Object.keys(grouped).length).toBeGreaterThan(0)
    expect(Object.keys(grouped).every((key) => /^\d{4}-\d{2}$/.test(key))).toBe(true)
    expect(Object.values(grouped).flat()).toHaveLength(visits.length)
  })
})
