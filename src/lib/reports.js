import { clientName, motherStatus, babyStatus } from './clients.js'
import { diffDays, lastMonthKeys, monthKey, parseDate, startOfToday, toInput } from './dates.js'
import { summarizeNotifications } from './notifications.js'
import { buildAllVisits, summarizeVisits } from './visits.js'

export const DEFAULT_REPORT_FILTERS = {
  dateFrom: '',
  dateTo: '',
  village: '',
  workerId: '',
  category: 'all',
  status: 'all',
}

function dateOnly(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return toInput(date)
}

function inRange(value, from, to) {
  const day = dateOnly(value)
  if (!from && !to) return true
  if (!day) return false
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

function clientRegistrationDate(client) {
  return client.type === 'baby'
    ? dateOnly(client.createdAt) || dateOnly(client.dateOfBirth)
    : dateOnly(client.registrationDate) || dateOnly(client.createdAt)
}

function matchesClientFilters(client, filters) {
  if (filters.workerId && client.workerId !== filters.workerId) return false
  if (filters.village && client.village !== filters.village) return false
  if (filters.category && filters.category !== 'all' && client.type !== filters.category) return false
  return true
}

function categoryOf(visit) {
  return visit.category ?? 'child_health'
}

export function buildReport(db, filtersInput = {}, options = {}) {
  const today = options.today ?? startOfToday()
  const filters = { ...DEFAULT_REPORT_FILTERS, ...filtersInput }
  const from = parseDate(filters.dateFrom) ? filters.dateFrom : ''
  const to = parseDate(filters.dateTo) ? filters.dateTo : ''

  const allMothers = (db?.mothers ?? []).map((mother) => ({ ...mother, type: 'mother' }))
  const allBabies = (db?.babies ?? []).map((baby) => ({ ...baby, type: 'baby' }))
  const allClients = [...allMothers, ...allBabies]
  const clientById = new Map(allClients.map((client) => [client.id, client]))

  const scopedClients = allClients.filter((client) => matchesClientFilters(client, filters))
  const mothers = scopedClients.filter((client) => client.type === 'mother' && inRange(clientRegistrationDate(client), from, to))
  const babies = scopedClients.filter((client) => client.type === 'baby' && inRange(clientRegistrationDate(client), from, to))

  const allVisits = buildAllVisits(db, { today })
  const workerById = new Map((db?.workers ?? []).map((worker) => [worker.id, worker]))
  const visits = allVisits.filter((visit) => {
    if (filters.workerId && visit.workerId !== filters.workerId) return false
    if (filters.village && visit.village !== filters.village) return false
    if (filters.category && filters.category !== 'all' && visit.clientType !== filters.category) return false
    if (filters.status && filters.status !== 'all' && visit.status !== filters.status) return false
    return inRange(visit.scheduledDateInput, from, to)
  }).map((visit) => ({
    ...visit,
    workerName: visit.workerId ? (workerById.get(visit.workerId)?.fullName ?? '') : '',
  }))

  const visitSummary = summarizeVisits(visits, today)
  const completed = visits.filter((visit) => visit.status === 'completed')
  const overdue = visits.filter((visit) => visit.status === 'overdue')

  const allNotifications = db?.notifications ?? []
  const notifications = allNotifications.filter((entry) => {
    if (filters.workerId && entry.workerId !== filters.workerId) return false
    const client = clientById.get(entry.clientId)
    if (filters.village && (!client || client.village !== filters.village)) return false
    if (filters.category && filters.category !== 'all' && (!client || client.type !== filters.category)) return false
    return inRange(entry.createdAt, from, to)
  })
  const notificationSummary = summarizeNotifications(notifications)

  const allCalls = db?.callLogs ?? []
  const calls = allCalls.filter((log) => {
    if (filters.workerId && log.workerId !== filters.workerId) return false
    const client = clientById.get(log.clientId)
    if (filters.village && (!client || client.village !== filters.village)) return false
    if (filters.category && filters.category !== 'all' && (!client || client.type !== filters.category)) return false
    return inRange(log.at, from, to)
  })

  const registrationsByMonth = [...mothers, ...babies].reduce((groups, client) => {
    const key = monthKey(clientRegistrationDate(client) || new Date())
    groups[key] = groups[key] ?? { key, mothers: 0, babies: 0 }
    if (client.type === 'mother') groups[key].mothers += 1
    else groups[key].babies += 1
    return groups
  }, {})

  const visitsByCategory = Object.values(visits.reduce((groups, visit) => {
    const key = categoryOf(visit)
    groups[key] = groups[key] ?? { category: key, total: 0, completed: 0, overdue: 0 }
    groups[key].total += 1
    if (visit.status === 'completed') groups[key].completed += 1
    if (visit.status === 'overdue') groups[key].overdue += 1
    return groups
  }, {})).sort((a, b) => b.total - a.total)

  const workers = (db?.workers ?? []).filter((worker) => !filters.workerId || worker.id === filters.workerId)
  const workerActivity = workers.map((worker) => {
    const assignedClients = scopedClients.filter((client) => client.workerId === worker.id)
    const workerVisits = visits.filter((visit) => visit.workerId === worker.id)
    return {
      workerId: worker.id,
      name: worker.fullName,
      village: worker.village,
      active: worker.active,
      assignedClients: assignedClients.length,
      completedVisits: workerVisits.filter((visit) => visit.status === 'completed').length,
      overdueVisits: workerVisits.filter((visit) => visit.status === 'overdue').length,
      calls: calls.filter((log) => log.workerId === worker.id).length,
      notifications: notifications.filter((entry) => entry.workerId === worker.id).length,
    }
  })

  const visitsByWorker = Object.values(visits.reduce((groups, visit) => {
    const worker = (db?.workers ?? []).find((entry) => entry.id === visit.workerId)
    const key = visit.workerId || 'unassigned'
    groups[key] = groups[key] ?? {
      workerId: key,
      name: worker?.fullName ?? 'Unassigned',
      total: 0,
      completed: 0,
      overdue: 0,
    }
    groups[key].total += 1
    if (visit.status === 'completed') groups[key].completed += 1
    if (visit.status === 'overdue') groups[key].overdue += 1
    return groups
  }, {})).sort((a, b) => b.total - a.total)

  return {
    filters: { ...filters, dateFrom: from, dateTo: to },
    generatedAt: new Date().toISOString(),
    mothers,
    babies,
    clients: scopedClients,
    visits,
    notifications,
    calls,
    notificationSummary,
    visitSummary,
    visitsByCategory,
    visitsByWorker,
    workerActivity,
    registrationsByMonth: Object.values(registrationsByMonth).sort((a, b) => a.key.localeCompare(b.key)),
    metrics: {
      registeredMothers: mothers.length,
      registeredBabies: babies.length,
      totalClients: scopedClients.length,
      totalVisits: visits.length,
      completedVisits: completed.length,
      overdueVisits: overdue.length,
      ancCompleted: completed.filter((visit) => categoryOf(visit) === 'anc').length,
      pncCompleted: completed.filter((visit) => categoryOf(visit) === 'pnc').length,
      immunizationCompleted: completed.filter((visit) => categoryOf(visit) === 'immunization').length,
      growthCompleted: completed.filter((visit) => categoryOf(visit) === 'growth').length,
      missedAppointments: overdue.length,
      completionRate: visitSummary.completionRate,
      notificationTotal: notificationSummary.total,
      notificationsQueued: notificationSummary.queued + notificationSummary.processing,
      notificationsSent: notificationSummary.sent,
      notificationsDelivered: notificationSummary.delivered,
      notificationsFailed: notificationSummary.failed,
      deliveryRate: notificationSummary.deliveryRate,
      notificationSuccessRate: notificationSummary.successRate,
      calls: calls.length,
    },
  }
}

export function buildDashboardData(db, options = {}) {
  const today = options.today ?? startOfToday()
  const workerId = options.workerId || null

  const allMothers = (db?.mothers ?? []).map((mother) => ({ ...mother, type: 'mother' }))
  const allBabies = (db?.babies ?? []).map((baby) => ({ ...baby, type: 'baby' }))
  const mothers = workerId ? allMothers.filter((mother) => mother.workerId === workerId) : allMothers
  const babies = workerId ? allBabies.filter((baby) => baby.workerId === workerId) : allBabies

  const allVisits = buildAllVisits(db, { today })
    .filter((visit) => !workerId || visit.workerId === workerId)
  const summary = summarizeVisits(allVisits, today)

  const dueToday = allVisits.filter((visit) => (
    visit.status !== 'completed' && visit.status !== 'cancelled' && diffDays(today, visit.scheduledDate) === 0
  ))
  const overdueVisits = allVisits.filter((visit) => visit.status === 'overdue')
  const upcomingVisits = allVisits
    .filter((visit) => !['completed', 'cancelled'].includes(visit.status) && diffDays(today, visit.scheduledDate) >= 0)
    .sort((a, b) => a.scheduledDate - b.scheduledDate)

  // Follow-up lists are derived from the live visit schedule: a client needs a
  // follow-up when any of their visits is overdue or a CHW explicitly flagged
  // the visit record for follow-up. We intentionally ignore the schedule
  // template's default followUpRequired hint, which only marks a visit type as
  // follow-up eligible and would otherwise flag every client.
  const followUpMothers = new Set()
  const followUpBabies = new Set()
  const explicitFollowUp = (visit) => Boolean(db?.visitRecords?.[visit.id]?.followUpRequired)
  for (const visit of allVisits) {
    const needsFollowUp = visit.status === 'overdue' || explicitFollowUp(visit)
    if (!needsFollowUp) continue
    if (visit.clientType === 'mother') followUpMothers.add(visit.clientId)
    else if (visit.clientType === 'baby') followUpBabies.add(visit.clientId)
  }
  // Restrict to clients in scope so an unassigned/unlinked follow-up is not counted.
  const mothersRequiringFollowUp = mothers.filter((mother) => followUpMothers.has(mother.id)).length
  const babiesRequiringFollowUp = babies.filter((baby) => followUpBabies.has(baby.id)).length

  const notifications = (db?.notifications ?? []).filter((entry) => !workerId || entry.workerId === workerId)
  const notificationSummary = summarizeNotifications(notifications)

  const activities = (db?.activities ?? [])
    .filter((activity) => !workerId || activity.actorId === workerId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)

  const months = lastMonthKeys(6, today)
  const registrations = months.map((key) => ({
    key,
    mothers: mothers.filter((mother) => monthKey(mother.registrationDate || mother.createdAt) === key).length,
    babies: babies.filter((baby) => monthKey(baby.createdAt || baby.dateOfBirth) === key).length,
  }))

  const overdueTrend = months.map((key) => ({
    key,
    count: overdueVisits.filter((visit) => monthKey(visit.scheduledDate) === key).length,
  }))

  const activeMothers = mothers.filter((mother) => motherStatus(mother) !== 'inactive')
  const activeBabies = babies.filter((baby) => babyStatus(baby) !== 'inactive')

  return {
    today,
    workerId,
    mothers,
    babies,
    activeClients: activeMothers.length + activeBabies.length,
    visits: allVisits,
    summary,
    dueToday,
    overdueVisits,
    upcomingVisits,
    followUpVisits: allVisits.filter((visit) => (
      !['completed', 'cancelled'].includes(visit.status) &&
      (visit.status === 'overdue' || explicitFollowUp(visit))
    )),
    notifications,
    notificationSummary,
    activities,
    registrations,
    overdueTrend,
    stats: {
      totalMothers: mothers.length,
      totalBabies: babies.length,
      activeClients: activeMothers.length + activeBabies.length,
      dueToday: dueToday.length,
      dueNext7Days: summary.dueNext7Days,
      overdue: summary.overdue,
      completed: summary.completed,
      upcoming: upcomingVisits.filter((visit) => diffDays(today, visit.scheduledDate) > 0).length,
      mothersFollowUp: mothersRequiringFollowUp,
      babiesFollowUp: babiesRequiringFollowUp,
      followUpTotal: mothersRequiringFollowUp + babiesRequiringFollowUp,
      pendingReminders: notificationSummary.pending,
      failedNotifications: notificationSummary.failed,
      completionRate: summary.completionRate,
    },
    visitStatusCounts: {
      completed: summary.completed,
      cancelled: summary.cancelled,
      overdue: summary.overdue,
      due_today: summary.due_today,
      due_soon: summary.due_soon,
      upcoming: summary.upcoming,
    },
  }
}

export function reportVisitRows(report, language = 'en') {
  return (report?.visits ?? []).map((visit) => ({
    client: visit.clientName || clientName(visit),
    clientId: visit.clientCode || visit.clientId,
    clientType: visit.clientType,
    village: visit.village,
    worker: visit.workerName ?? '',
    visit: visit.name?.[language] ?? visit.name?.en ?? '',
    category: visit.category,
    scheduledDate: visit.scheduledDateInput,
    status: visit.status,
    completedDate: visit.completedDate ?? '',
    followUpRequired: visit.followUpRequired ? 'yes' : 'no',
    notes: visit.notes ?? '',
  }))
}

export function reportSummaryRows(report) {
  const metrics = report?.metrics ?? {}
  return Object.entries(metrics).map(([key, value]) => ({ metric: key, value }))
}
