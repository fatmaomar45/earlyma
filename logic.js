export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

export const startOfToday = () => {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

export const parseDate = (s) => {
  if (typeof s !== 'string' || s.trim() === '') return null

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export const parseDateOrToday = (s) => parseDate(s) ?? startOfToday()

export const toInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const formatDate = (d) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d)

// base = baby's date of birth (baby mode) or expected delivery date (pregnancy mode)
export function buildVisits(base, rules) {
  if (!(base instanceof Date) || Number.isNaN(base.getTime())) return []
  return rules.map((r) => {
    let date
    if (r.week !== undefined) date = addDays(base, -(40 - r.week) * 7)
    else if (r.months !== undefined) date = addMonths(base, r.months)
    else date = addDays(base, r.days ?? 0)
    return { ...r, date }
  })
}

export function statusOf(date, today, attended = false) {
  if (attended) return { label: 'Attended', color: 'green' }

  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: 'Date passed', color: 'orange' }
  if (diff <= 7) return { label: 'Due soon', color: 'yellow' }
  return { label: 'Upcoming', color: 'teal' }
}

export const fillTemplate = (text, vars) =>
  text.replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? ''))

// First visit not yet marked attended. attended = { [visitIndex]: true }
export function nextVisit(visits, attended = {}) {
  if (!Array.isArray(visits)) return null
  const index = visits.findIndex((_, i) => !attended[i])
  return index === -1 ? null : { index, visit: visits[index] }
}

export const isPhoneValid = (value) => {
  const cleaned = String(value ?? '').replace(/\s+/g, '')
  return /^(\+?\d{9,15})$/.test(cleaned)
}