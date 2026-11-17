import { CALL_SCRIPTS, SMS } from '../data/schedules.js'
import { formatDate } from './dates.js'
import { clientName } from './clients.js'

export function fillTemplate(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, key) => (
    vars[key] === undefined || vars[key] === null ? match : String(vars[key])
  ))
}

export function notificationMode(client) {
  if (!client) return 'preg'
  return client.type === 'baby' ? 'baby' : 'preg'
}

export function buildNotificationMessage(client, type = 'remind', visit = null, language) {
  if (!client) return ''
  const lang = ['en', 'sw'].includes(language) ? language : (client.language ?? 'sw')
  const mode = notificationMode(client)
  const templates = SMS[lang]?.[mode] ?? SMS.en[mode]
  const template = templates[type] ?? templates.remind
  const vars = {
    date: visit?.scheduledDate ? formatDate(visit.scheduledDate, lang === 'sw' ? 'sw-KE' : 'en-GB') : '',
    name: clientName(client),
    village: client.village ?? '',
    visit: visit?.name?.[lang] ?? visit?.name?.en ?? '',
  }
  return fillTemplate(template, vars).replace(/\s+/g, ' ').trim()
}

export function buildCallScript(client, type = 'reminder', visit = null, language) {
  if (!client) return ''
  const lang = ['en', 'sw'].includes(language) ? language : (client.language ?? 'sw')
  const scriptType = type === 'missed' ? 'missed' : 'reminder'
  const template = CALL_SCRIPTS[lang]?.[scriptType] ?? CALL_SCRIPTS.en[scriptType]
  return fillTemplate(template, {
    date: visit?.scheduledDate ? formatDate(visit.scheduledDate, lang === 'sw' ? 'sw-KE' : 'en-GB') : '',
    name: clientName(client),
    visit: visit?.name?.[lang] ?? visit?.name?.en ?? '',
  }).replace(/\s+/g, ' ').trim()
}

export function buildDedupeKey(client, type, visit = null) {
  if (!client) return null
  const anchor = visit?.scheduledDateInput ?? visit?.id ?? 'general'
  return `${client.type}:${client.id}:${type}:${anchor}`
}
