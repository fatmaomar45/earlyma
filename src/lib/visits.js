import { SCHEDULES, VISIT_CATEGORIES } from '../data/schedules.js'
import { addDays, addMonths, diffDays, formatDate, isValidDate, parseDate, startOfToday, toInput } from './dates.js'
import { clientName } from './clients.js'

export const VISIT_STATUSES = ['completed', 'cancelled', 'overdue', 'due_today', 'due_soon', 'upcoming']

export const VISIT_STATUS_META = {
  completed: { color: 'green', icon: '✓', order: 0 },
  cancelled: { color: 'gray', icon: '—', order: 5 },
  overdue: { color: 'red', icon: '!', order: 1 },
  due_today: { color: 'orange', icon: '•', order: 2 },
  due_soon: { color: 'yellow', icon: '•', order: 3 },
  upcoming: { color: 'blue', icon: '→', order: 4 },
}

export function visitKey(client, scheduleId, scheduleVisitId) {
  return `${client.type}:${client.id}::${scheduleId}::${scheduleVisitId}`
}

export function scheduleAnchorDate(client, schedule) {
  if (!client) return null
  if (schedule.anchor === 'deliveryDate') {
    return parseDate(client.actualDeliveryDate) || parseDate(client.expectedDeliveryDate)
  }
  if (schedule.anchor === 'dateOfBirth') return parseDate(client.dateOfBirth)
  return parseDate(client.expectedDeliveryDate)
}

export function applyOffset(baseDate, offset = {}) {
  if (!isValidDate(baseDate)) return null
  let result = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  if (offset.months) result = addMonths(result, offset.months)
  if (offset.weeks) result = addDays(result, offset.weeks * 7)
  if (offset.days) result = addDays(result, offset.days)
  return result
}

export function visitStatusFor(scheduledDate, today = startOfToday(), record = {}) {
  if (record?.cancelled) return 'cancelled'
  if (record?.completedDate && parseDate(record.completedDate)) return 'completed'
  if (!isValidDate(scheduledDate)) return 'upcoming'
  const delta = diffDays(today, scheduledDate)
  if (delta < 0) return 'overdue'
  if (delta === 0) return 'due_today'
  if (delta <= 7) return 'due_soon'
  return 'upcoming'
}

export function schedulesForClient(client) {
  if (!client) return []
  if (client.type === 'baby') return [SCHEDULES.babyImmunization, SCHEDULES.babyGrowth]
  if (client.type === 'mother') return [SCHEDULES.anc, SCHEDULES.pnc]
  return []
}

export function buildVisitsForClient(client, options = {}) {
  if (!client || !client.type) return []
  const today = options.today ?? startOfToday()
  const visitRecords = options.visitRecords ?? {}
  const visits = []

  for (const schedule of schedulesForClient(client)) {
    const anchor = scheduleAnchorDate(client, schedule)
    if (!anchor) continue

    for (const template of schedule.visits) {
      const scheduledDate = applyOffset(anchor, template.offset)
      if (!scheduledDate) continue
      const id = visitKey(client, schedule.id, template.id)
      const record = visitRecords[id] ?? {}
      const status = visitStatusFor(scheduledDate, today, record)
      const category = template.category ?? schedule.category
      visits.push({
        id,
        clientId: client.id,
        clientType: client.type,
        clientName: clientName(client),
        clientCode: client.code ?? '',
        workerId: client.workerId ?? null,
        village: client.village ?? '',
        scheduleId: schedule.id,
        scheduleVisitId: template.id,
        name: template.name,
        category,
        categoryMeta: VISIT_CATEGORIES[category] ?? VISIT_CATEGORIES.child_health,
        scheduledDate,
        scheduledDateInput: toInput(scheduledDate),
        status,
        statusMeta: VISIT_STATUS_META[status],
        completedDate: record.completedDate ?? null,
        cancelled: Boolean(record.cancelled),
        notes: record.notes ?? '',
        followUpRequired: Boolean(record.followUpRequired ?? template.followUpRequired),
        source: schedule.source,
        language: client.language ?? 'sw',
      })
    }
  }

  return visits.sort((a, b) => {
    const delta = a.scheduledDate - b.scheduledDate
    if (delta !== 0) return delta
    return a.name.en.localeCompare(b.name.en)
  })
}

export function buildAllVisits(db, options = {}) {
  const today = options.today ?? startOfToday()
  const visitRecords = db?.visitRecords ?? {}
  const mothers = (db?.mothers ?? []).map((client) => ({ ...client, type: 'mother' }))
  const babies = (db?.babies ?? []).map((client) => ({ ...client, type: 'baby' }))
  return [...mothers, ...babies].flatMap((client) => buildVisitsForClient(client, { today, visitRecords }))
}

export function isVisitActionable(visit) {
  return Boolean(visit) && !['completed', 'cancelled'].includes(visit.status)
}

export function nextActionableVisit(visits = [], today = startOfToday()) {
  const actionable = (visits ?? []).filter(isVisitActionable)
  if (actionable.length === 0) return null
  const future = actionable.find((visit) => diffDays(today, visit.scheduledDate) >= 0)
  return future ?? actionable[0]
}

export function summarizeVisits(visits = [], today = startOfToday()) {
  const counts = Object.fromEntries(VISIT_STATUSES.map((status) => [status, 0]))
  let dueNext7Days = 0
  for (const visit of visits) {
    if (counts[visit.status] !== undefined) counts[visit.status] += 1
    if (!['completed', 'cancelled'].includes(visit.status)) {
      const delta = diffDays(today, visit.scheduledDate)
      if (delta !== null && delta >= 0 && delta <= 7) dueNext7Days += 1
    }
  }
  const denominator = visits.length - counts.cancelled
  return {
    total: visits.length,
    ...counts,
    dueNext7Days,
    completionRate: denominator > 0 ? Math.round((counts.completed / denominator) * 100) : 0,
  }
}

export function summarizeVisitsForToday(visits = [], today = startOfToday()) {
  const counts = { dueToday: 0, dueSoon: 0, overdue: 0, upcoming: 0, completed: 0, cancelled: 0 }
  for (const visit of visits) {
    const delta = diffDays(today, visit.scheduledDate)
    if (visit.status === 'completed') counts.completed += 1
    if (visit.status === 'cancelled') counts.cancelled += 1
    if (visit.status === 'overdue') counts.overdue += 1
    if (delta === 0 && isVisitActionable(visit)) counts.dueToday += 1
    if (delta !== null && delta >= 0 && delta <= 7 && isVisitActionable(visit)) counts.dueSoon += 1
    if (delta !== null && delta > 7 && isVisitActionable(visit)) counts.upcoming += 1
  }
  return counts
}

export function getVisitById(db, visitId, today = startOfToday()) {
  return buildAllVisits(db, { today }).find((visit) => visit.id === visitId) ?? null
}

export function visitClientPath(visit) {
  if (!visit) return '/'
  return visit.clientType === 'baby' ? `/babies/${visit.clientId}` : `/mothers/${visit.clientId}`
}

export function filterVisits(visits = [], filters = {}) {
  const { clientId, workerId, village, category, status, dateFrom, dateTo, query = '' } = filters
  const from = parseDate(dateFrom)
  const to = parseDate(dateTo)
  const needle = String(query ?? '').trim().toLocaleLowerCase()

  return (visits ?? []).filter((visit) => {
    if (clientId && visit.clientId !== clientId) return false
    if (workerId && visit.workerId !== workerId) return false
    if (village && visit.village !== village) return false
    if (category && category !== 'all' && visit.category !== category) return false
    if (status && status !== 'all' && visit.status !== status) return false
    if (from && diffDays(from, visit.scheduledDate) < 0) return false
    if (to && diffDays(visit.scheduledDate, to) < 0) return false
    if (needle) {
      const haystack = `${visit.clientName} ${visit.clientCode} ${visit.name.en} ${visit.name.sw} ${visit.category}`.toLocaleLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

export function sortVisits(visits = [], sortKey = 'date', direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1
  const valueFor = (visit) => {
    if (sortKey === 'client') return visit.clientName.toLocaleLowerCase()
    if (sortKey === 'status') return visit.statusMeta?.order ?? 9
    if (sortKey === 'category') return visit.category
    return visit.scheduledDate.getTime()
  }
  return [...visits].sort((a, b) => {
    const left = valueFor(a)
    const right = valueFor(b)
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right)) * factor
  })
}

export function visitDisplayDate(visit, locale = 'en-GB') {
  return visit ? formatDate(visit.scheduledDate, locale) : ''
}

export function visitCategoryLabel(category, language = 'en') {
  const meta = VISIT_CATEGORIES[category] ?? VISIT_CATEGORIES.child_health
  return meta[language] ?? meta.en
}

export function groupVisitsByMonth(visits = []) {
  return (visits ?? []).reduce((groups, visit) => {
    const key = `${visit.scheduledDate.getFullYear()}-${String(visit.scheduledDate.getMonth() + 1).padStart(2, '0')}`
    groups[key] = groups[key] ?? []
    groups[key].push(visit)
    return groups
  }, {})
}

export { SCHEDULES, VISIT_CATEGORIES }
