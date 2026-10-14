import { describe, it, expect } from 'vitest'
import {
  addDays,
  buildVisits,
  fillTemplate,
  parseDate,
  parseDateOrToday,
  statusOf,
  toInput,
  nextVisit,
  isPhoneValid,
} from '../logic.js'
import { RULES } from '../data.js'

describe('date parsing', () => {
  it('parses valid ISO dates', () => {
    const date = parseDate('2026-02-14')
    expect(date).toBeInstanceOf(Date)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBe(14)
  })

  it('rejects impossible dates', () => {
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('falls back to today on invalid input', () => {
    expect(parseDateOrToday('bad')).toBeInstanceOf(Date)
  })
})

describe('visit generation', () => {
  it('builds baby visits in chronological order', () => {
    const base = parseDate('2026-01-01')
    const visits = buildVisits(base, RULES.baby)
    expect(visits).toHaveLength(RULES.baby.length)
    expect(visits[0].en).toBe('Birth visit')
    expect(visits[1].days).toBe(42)
  })

  it('formats dates', () => {
    expect(toInput(addDays(parseDate('2026-01-01'), 1))).toBe('2026-01-02')
  })
})

describe('status and next visit', () => {
  it('marks attended visits green', () => {
    const date = parseDate('2026-01-01')
    const today = parseDate('2026-01-01')
    expect(statusOf(date, today, true).label).toBe('Attended')
    expect(statusOf(addDays(date, -1), today).label).toBe('Date passed')
    expect(statusOf(addDays(date, 3), today).label).toBe('Due soon')
    expect(statusOf(addDays(date, 10), today).label).toBe('Upcoming')
  })

  it('finds first unattended visit', () => {
    const visits = [{ en: 'A' }, { en: 'B' }, { en: 'C' }]
    expect(nextVisit(visits, { 0: true }).index).toBe(1)
    expect(nextVisit(visits, { 0: true, 1: true, 2: true })).toBeNull()
  })
})

describe('templates and validation', () => {
  it('fills placeholders', () => {
    expect(fillTemplate('Hello {name}, date {date}', { name: 'Mama', date: '2026-01-01' })).toBe('Hello Mama, date 2026-01-01')
  })

  it('validates phone numbers', () => {
    expect(isPhoneValid('0712 345 678')).toBe(true)
    expect(isPhoneValid('123')).toBe(false)
  })
})