// Backwards-compatible entry point for the original prototype's helper module.
// New application code imports from src/lib/* directly.
export {
  addDays,
  addMonths,
  addYears,
  diffDays,
  daysSince,
  daysUntil,
  formatDate,
  formatDateTime,
  formatTime,
  isSameDay,
  isValidDate,
  monthKey,
  monthLabel,
  parseDate,
  parseDateOrToday,
  startOfToday,
  toInput,
  todayInput,
} from './src/lib/dates.js'

export {
  cleanText,
  cleanMultiline,
  isEmailValid,
  isPhoneValid,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from './src/lib/validation.js'

export { fillTemplate } from './src/lib/templates.js'

const MS_PER_DAY = 86_400_000

/**
 * Legacy visit builder: base is a baby's date of birth or a mother's expected
 * delivery date. Prefer buildVisitsForClient/buildAllVisits in src/lib/visits.js.
 */
export function buildVisits(base, rules = []) {
  if (!(base instanceof Date) || Number.isNaN(base.getTime())) return []
  return rules.map((rule) => {
    let date
    if (rule.week !== undefined) date = addDaysFrom(base, -(40 - rule.week) * 7)
    else if (rule.months !== undefined) date = addMonthsFrom(base, rule.months)
    else date = addDaysFrom(base, rule.days ?? 0)
    return { ...rule, date }
  })
}

function addDaysFrom(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonthsFrom(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

/** Legacy status labels used by the original prototype screens. */
export function statusOf(date, today = new Date(), attended = false) {
  if (attended) return { label: 'Attended', color: 'green' }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return { label: 'Unknown', color: 'gray' }
  }
  const diff = Math.round((date.getTime() - today.getTime()) / MS_PER_DAY)
  if (diff < 0) return { label: 'Date passed', color: 'orange' }
  if (diff <= 7) return { label: 'Due soon', color: 'yellow' }
  return { label: 'Upcoming', color: 'teal' }
}

/** First visit not marked attended. attended = { [visitIndex]: true }. */
export function nextVisit(visits, attended = {}) {
  if (!Array.isArray(visits)) return null
  const index = visits.findIndex((_, visitIndex) => !attended[visitIndex])
  return index === -1 ? null : { index, visit: visits[index] }
}
