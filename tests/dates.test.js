import { describe, it, expect } from 'vitest'
import {
  addDays,
  addMonths,
  addYears,
  ageInDays,
  ageInMonths,
  ageParts,
  daysSince,
  daysUntil,
  diffDays,
  formatDate,
  formatDateTime,
  formatTime,
  isBefore,
  isSameDay,
  isValidDate,
  lastMonthKeys,
  monthKey,
  monthLabel,
  parseDate,
  parseDateOrToday,
  startOfToday,
  toInput,
  todayInput,
  validateDateRange,
} from '../src/lib/dates.js'

describe('parseDate', () => {
  it('parses strict ISO calendar dates', () => {
    const date = parseDate('2026-02-14')
    expect(date).toBeInstanceOf(Date)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBe(14)
  })

  it('accepts single-digit months and days', () => {
    expect(toInput(parseDate('2026-1-5'))).toBe('2026-01-05')
  })

  it('rejects impossible and malformed dates', () => {
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('2026-00-10')).toBeNull()
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('   ')).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate(42)).toBeNull()
  })

  it('rejects years outside the supported range', () => {
    expect(parseDate('1899-12-31')).toBeNull()
    expect(parseDate('2201-01-01')).toBeNull()
    expect(parseDate('1900-01-01')).not.toBeNull()
    expect(parseDate('2200-12-31')).not.toBeNull()
  })

  it('accepts a Date and strips the time component', () => {
    const date = parseDate(new Date(2026, 1, 14, 18, 45, 12))
    expect(date.getHours()).toBe(0)
    expect(toInput(date)).toBe('2026-02-14')
  })

  it('rejects invalid Date instances', () => {
    expect(parseDate(new Date('nope'))).toBeNull()
  })

  it('falls back to today for invalid values', () => {
    const today = new Date(2026, 5, 1)
    expect(toInput(parseDateOrToday('bad', today))).toBe('2026-06-01')
    expect(toInput(parseDateOrToday('2026-01-09', today))).toBe('2026-01-09')
  })
})

describe('date formatting and helpers', () => {
  it('formats an input value and today', () => {
    const date = new Date(2026, 0, 2)
    expect(toInput(date)).toBe('2026-01-02')
    expect(todayInput(date)).toBe('2026-01-02')
  })

  it('returns empty strings for invalid values', () => {
    expect(toInput(null)).toBe('')
    expect(toInput(new Date('nope'))).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDateTime('nope')).toBe('')
    expect(formatTime('nope')).toBe('')
  })

  it('formats valid dates with Intl', () => {
    const date = new Date(2026, 0, 2)
    expect(formatDate(date, 'en-GB')).toMatch(/2026/)
    expect(formatDateTime(date, 'en-GB')).toMatch(/2026/)
    expect(formatTime(date, 'en-GB')).toMatch(/\d{2}:\d{2}/)
  })

  it('produces stable month keys and labels', () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01')
    expect(monthKey('invalid')).toBe('')
    expect(monthLabel('2026-01', 'en-GB')).toMatch(/Jan/)
    expect(monthLabel('bad')).toBe('bad')
    expect(lastMonthKeys(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(lastMonthKeys(0, new Date(2026, 0, 15))).toEqual(['2026-01'])
  })
})

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(toInput(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(toInput(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01')
    expect(toInput(addDays(new Date(2026, 0, 2), -2))).toBe('2025-12-31')
    expect(addDays(null, 1)).toBeNull()
    expect(addDays(new Date(2026, 0, 1), 'x')).toBeNull()
  })

  it('clamps month arithmetic to the last day', () => {
    expect(toInput(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(toInput(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29')
    expect(toInput(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-15')
    expect(toInput(addYears(new Date(2024, 1, 29), 1))).toBe('2025-02-28')
  })

  it('computes calendar-day differences independent of time', () => {
    expect(diffDays(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toBe(1)
    expect(diffDays(new Date(2026, 0, 2), new Date(2026, 0, 1))).toBe(-1)
    expect(diffDays(null, new Date())).toBeNull()
    expect(daysSince(new Date(2026, 0, 1), new Date(2026, 0, 8))).toBe(7)
    expect(daysUntil(new Date(2026, 0, 8), new Date(2026, 0, 1))).toBe(7)
    expect(isBefore(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(true)
    expect(isBefore(new Date(2026, 0, 2), new Date(2026, 0, 1))).toBe(false)
    expect(isSameDay(new Date(2026, 0, 2, 1), new Date(2026, 0, 2, 22))).toBe(true)
  })

  it('normalises today to midnight', () => {
    const today = startOfToday(new Date(2026, 0, 2, 16, 30))
    expect(today.getHours()).toBe(0)
    expect(toInput(today)).toBe('2026-01-02')
    expect(isValidDate(new Date('nope'))).toBe(false)
  })
})

describe('ages', () => {
  it('counts completed months and days', () => {
    expect(ageInMonths(new Date(2025, 0, 15), new Date(2026, 0, 14))).toBe(11)
    expect(ageInMonths(new Date(2025, 0, 15), new Date(2026, 0, 15))).toBe(12)
    expect(ageInMonths(null, new Date())).toBeNull()
    expect(ageInDays(new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(30)
    expect(ageInDays(new Date(2026, 0, 31), new Date(2026, 0, 1))).toBe(0)
  })

  it('splits an age into years, months and days', () => {
    expect(ageParts(new Date(2024, 0, 10), new Date(2025, 2, 15))).toEqual({ years: 1, months: 2, days: 5 })
    expect(ageParts(new Date(2026, 5, 1), new Date(2026, 0, 1))).toBeNull()
    expect(ageParts(null)).toBeNull()
  })
})

describe('date range validation', () => {
  it('returns translation keys instead of throwing', () => {
    expect(validateDateRange('', '')).toBeNull()
    expect(validateDateRange('2026-01-01', '2026-01-31')).toBeNull()
    expect(validateDateRange('2026-02-30', '')).toBe('validation.date')
    expect(validateDateRange('2026-01-01', 'bad')).toBe('validation.date')
    expect(validateDateRange('2026-02-01', '2026-01-01')).toBe('validation.dateRange')
  })
})
