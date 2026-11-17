import { describe, it, expect } from 'vitest'
import {
  attachFollowUpNotification,
  buildCallFollowUp,
  createCallLog,
  filterCalls,
  markCallFollowUpDone,
  outcomeForSimulation,
  summarizeCalls,
} from '../src/lib/calls.js'

const now = new Date('2026-06-01T12:00:00.000Z')

function client(overrides = {}) {
  return {
    id: 'm1',
    type: 'mother',
    fullName: 'Amina Test',
    phone: '0712 345 678',
    workerId: 'w1',
    language: 'sw',
    ...overrides,
  }
}

describe('createCallLog', () => {
  it('normalises a complete call log', () => {
    const log = createCallLog({
      client: client(),
      type: 'missed',
      outcome: 'no_answer',
      message: '  Hello  ',
      notes: '  try again ',
      language: 'en',
    }, now)

    expect(log).toMatchObject({
      clientId: 'm1',
      clientType: 'mother',
      clientName: 'Amina Test',
      phone: '0712345678',
      workerId: 'w1',
      type: 'missed',
      outcome: 'no_answer',
      language: 'en',
      message: 'Hello',
      notes: 'try again',
      simulated: true,
      at: now.toISOString(),
      createdAt: now.toISOString(),
    })
    expect(log.id).toMatch(/^call_/)
  })

  it('falls back to safe defaults', () => {
    const log = createCallLog({ outcome: 'invalid', type: 'invalid', simulated: false, clientName: '  ' }, now)
    expect(log.outcome).toBe('completed')
    expect(log.type).toBe('reminder')
    expect(log.clientName).toBe('Unknown client')
    expect(log.simulated).toBe(false)
    expect(log.language).toBe('sw')
  })
})

describe('call outcomes and summaries', () => {
  it('maps simulation buttons to outcomes', () => {
    expect(outcomeForSimulation('confirmed')).toBe('confirmed')
    expect(outcomeForSimulation('no_answer')).toBe('no_answer')
    expect(outcomeForSimulation('failed')).toBe('failed')
    expect(outcomeForSimulation('anything')).toBe('completed')
  })

  it('summarises outcomes and open follow-ups', () => {
    const logs = [
      { outcome: 'confirmed' },
      { outcome: 'no_answer', followUp: { completedAt: null } },
      { outcome: 'failed', followUp: { completedAt: '2026-01-01' } },
      { outcome: 'completed' },
      { outcome: 'rescheduled' },
    ]
    expect(summarizeCalls(logs)).toEqual({
      total: 5,
      confirmed: 1,
      no_answer: 1,
      failed: 1,
      completed: 1,
      rescheduled: 1,
      followUpOpen: 1,
    })
    expect(summarizeCalls(null).total).toBe(0)
  })
})

describe('filterCalls', () => {
  const logs = [
    { clientName: 'Amina Test', phone: '0712345678', type: 'reminder', outcome: 'confirmed', workerId: 'w1' },
    { clientName: 'Zainabu Test', phone: '0723456789', type: 'missed', outcome: 'no_answer', workerId: 'w2' },
  ]

  it('filters by worker, outcome and free text', () => {
    expect(filterCalls(logs, { workerId: 'w1' })).toHaveLength(1)
    expect(filterCalls(logs, { outcome: 'no_answer' })[0].clientName).toBe('Zainabu Test')
    expect(filterCalls(logs, { outcome: 'all' })).toHaveLength(2)
    expect(filterCalls(logs, { query: 'amina' })).toHaveLength(1)
    expect(filterCalls(logs, { query: 'missed' })).toHaveLength(1)
    expect(filterCalls(logs, { query: 'nothing' })).toHaveLength(0)
    expect(filterCalls(null)).toHaveLength(0)
  })
})

describe('follow-up handling', () => {
  it('creates, completes and links follow-ups', () => {
    const log = { id: 'c1', notes: '  call back ' }
    const followUp = buildCallFollowUp(log, now)
    expect(followUp).toEqual({
      queuedAt: now.toISOString(),
      completedAt: null,
      notificationId: null,
      note: 'call back',
    })

    const linked = attachFollowUpNotification({ ...log, followUp }, 'n1', now)
    expect(linked.followUp.notificationId).toBe('n1')
    expect(linked.followUp.queuedAt).toBe(now.toISOString())

    const done = markCallFollowUpDone(linked, now)
    expect(done.followUp.completedAt).toBe(now.toISOString())
    expect(done.followUp.notificationId).toBe('n1')

    expect(markCallFollowUpDone(null)).toBeNull()
    expect(attachFollowUpNotification(null)).toBeNull()
  })
})
