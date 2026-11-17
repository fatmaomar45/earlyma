import { randomId } from './crypto.js'
import { cleanMultiline, cleanText, normalizePhone } from './validation.js'

export const CALL_TYPES = ['reminder', 'missed']
export const CALL_OUTCOME_VALUES = ['confirmed', 'no_answer', 'failed', 'completed', 'rescheduled']

export function createCallLog(input = {}, now = new Date()) {
  const at = now instanceof Date ? now : new Date(now)
  const client = input.client ?? {}
  const outcome = CALL_OUTCOME_VALUES.includes(input.outcome) ? input.outcome : 'completed'
  return {
    id: input.id ?? randomId('call'),
    clientId: client.id ?? input.clientId ?? null,
    clientType: client.type ?? input.clientType ?? null,
    clientName: cleanText(client.fullName ?? client.label ?? input.clientName, 120) || 'Unknown client',
    phone: normalizePhone(client.phone ?? input.phone),
    workerId: input.workerId ?? client.workerId ?? null,
    type: CALL_TYPES.includes(input.type) ? input.type : 'reminder',
    language: ['en', 'sw'].includes(input.language) ? input.language : (client.language ?? 'sw'),
    message: cleanMultiline(input.message, 1000),
    outcome,
    simulated: input.simulated === false ? false : true,
    notes: cleanMultiline(input.notes, 500),
    followUp: input.followUp ?? null,
    at: at.toISOString(),
    createdAt: at.toISOString(),
    isDemo: Boolean(input.isDemo ?? client.isDemo),
  }
}

export function outcomeForSimulation(simulation) {
  if (simulation === 'confirmed') return 'confirmed'
  if (simulation === 'no_answer') return 'no_answer'
  if (simulation === 'failed') return 'failed'
  return 'completed'
}

export function summarizeCalls(logs = []) {
  const summary = {
    total: 0,
    confirmed: 0,
    no_answer: 0,
    failed: 0,
    completed: 0,
    rescheduled: 0,
    followUpOpen: 0,
  }
  for (const log of Array.isArray(logs) ? logs : []) {
    summary.total += 1
    if (summary[log.outcome] !== undefined) summary[log.outcome] += 1
    if (log.outcome === 'no_answer' || log.outcome === 'failed') {
      if (!log.followUp?.completedAt) summary.followUpOpen += 1
    }
  }
  return summary
}

export function filterCalls(logs = [], filters = {}) {
  const { workerId = '', outcome = '', query = '' } = filters
  const needle = String(query ?? '').trim().toLocaleLowerCase()
  return (Array.isArray(logs) ? logs : []).filter((log) => {
    if (workerId && log.workerId !== workerId) return false
    if (outcome && outcome !== 'all' && log.outcome !== outcome) return false
    if (needle) {
      const haystack = `${log.clientName} ${log.phone} ${log.type} ${log.outcome}`.toLocaleLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
}

export function buildCallFollowUp(log = {}, now = new Date()) {
  return {
    queuedAt: now.toISOString(),
    completedAt: null,
    notificationId: null,
    note: cleanMultiline(log.notes, 500),
  }
}

export function markCallFollowUpDone(log, now = new Date()) {
  if (!log) return log
  return {
    ...log,
    followUp: {
      ...(log.followUp ?? {}),
      completedAt: now.toISOString(),
    },
  }
}

export function attachFollowUpNotification(log, notificationId, now = new Date()) {
  if (!log) return log
  return {
    ...log,
    followUp: {
      ...(log.followUp ?? {}),
      queuedAt: log.followUp?.queuedAt ?? now.toISOString(),
      notificationId,
    },
  }
}
