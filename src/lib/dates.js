// Date helpers for Earlyma.
//
// All dates are handled as *local calendar dates* (year, month, day) rather
// than UTC instants. Working with calendar parts avoids the classic bugs where
// a visit scheduled for "today" appears to be yesterday for users east of UTC,
// or where adding a day across a daylight-saving boundary jumps by 23/25 hours.

export const MS_PER_DAY = 86_400_000

export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Parse an HTML date input (`YYYY-MM-DD`) strictly.
 * Returns null for invalid calendar dates such as 2026-02-30.
 */
export function parseDate(input) {
  if (input instanceof Date) {
    if (!isValidDate(input)) return null
    return new Date(input.getFullYear(), input.getMonth(), input.getDate())
  }

  if (typeof input !== 'string') return null
  const text = input.trim()
  if (text === '') return null

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (year < 1900 || year > 2200) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function parseDateOrToday(value, now = new Date()) {
  return parseDate(value) ?? startOfToday(now)
}

export function toInput(date) {
  if (!isValidDate(date)) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayInput(now = new Date()) {
  return toInput(startOfToday(now))
}

/** Add calendar days, preserving the local wall-clock date across DST. */
export function addDays(date, days) {
  if (!isValidDate(date)) return null
  const amount = Number(days)
  if (!Number.isFinite(amount)) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + Math.trunc(amount))
}

/**
 * Add calendar months, clamping to the last day of the target month.
 * 2026-01-31 + 1 month => 2026-02-28 (not 2026-03-03).
 */
export function addMonths(date, months) {
  if (!isValidDate(date)) return null
  const amount = Number(months)
  if (!Number.isFinite(amount)) return null

  const day = date.getDate()
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() + Math.trunc(amount), 1)
  const daysInTarget = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate()
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(day, daysInTarget))
}

export function addYears(date, years) {
  return addMonths(date, Number(years) * 12)
}

/** Calendar-day difference (b - a), immune to DST transitions. */
export function diffDays(a, b) {
  if (!isValidDate(a) || !isValidDate(b)) return null
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / MS_PER_DAY)
}

export function isBefore(a, b) {
  const delta = diffDays(a, b)
  return delta !== null && delta > 0
}

export function isSameDay(a, b) {
  return diffDays(a, b) === 0
}

export function daysSince(date, today = startOfToday()) {
  return diffDays(date, today)
}

export function daysUntil(date, today = startOfToday()) {
  return diffDays(today, date)
}

export function formatDate(date, locale = 'en-GB', options = {}) {
  if (!isValidDate(date)) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...options,
    }).format(date)
  } catch {
    return toInput(date)
  }
}

export function formatDateTime(value, locale = 'en-GB') {
  const date = value instanceof Date ? value : new Date(value)
  if (!isValidDate(date)) return ''
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return date.toISOString()
  }
}

export function formatTime(value, locale = 'en-GB') {
  const date = value instanceof Date ? value : new Date(value)
  if (!isValidDate(date)) return ''
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
  } catch {
    return ''
  }
}

/** Stable YYYY-MM key used for monthly chart grouping. */
export function monthKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!isValidDate(date)) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key, locale = 'en-GB') {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key ?? ''))
  if (!match) return String(key ?? '')
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
  } catch {
    return key
  }
}

export function lastMonthKeys(count, now = new Date()) {
  const safeCount = Math.max(1, Math.trunc(Number(count) || 1))
  return Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (safeCount - 1 - index), 1)
    return monthKey(date)
  })
}

/** Whole months completed between two dates (used for baby age). */
export function ageInMonths(dateOfBirth, today = startOfToday()) {
  if (!isValidDate(dateOfBirth) || !isValidDate(today)) return null
  let months = (today.getFullYear() - dateOfBirth.getFullYear()) * 12 + (today.getMonth() - dateOfBirth.getMonth())
  if (today.getDate() < dateOfBirth.getDate()) months -= 1
  return Math.max(0, months)
}

export function ageParts(dateOfBirth, today = startOfToday()) {
  if (!isValidDate(dateOfBirth) || !isValidDate(today) || dateOfBirth > today) return null
  let years = today.getFullYear() - dateOfBirth.getFullYear()
  let months = today.getMonth() - dateOfBirth.getMonth()
  let days = today.getDate() - dateOfBirth.getDate()

  if (days < 0) {
    months -= 1
    const previousMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
    days += previousMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

export function ageInDays(dateOfBirth, today = startOfToday()) {
  const delta = diffDays(dateOfBirth, today)
  return delta === null ? null : Math.max(0, delta)
}

/** Validate a start/end date range. Returns an i18n error key or null. */
export function validateDateRange(start, end) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (start && !startDate) return 'validation.date'
  if (end && !endDate) return 'validation.date'
  if (startDate && endDate && startDate > endDate) return 'validation.dateRange'
  return null
}

export function isoNow(now = new Date()) {
  return now.toISOString()
}
