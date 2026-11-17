import { SCHEDULES } from '../data/schedules.js'
import { createBaby, createMother, deleteBabyFromDb, deleteMotherFromDb } from './clients.js'
import { hashPassword, randomId } from './crypto.js'
import { parseDate, toInput } from './dates.js'
import { createNotification, NOTIFICATION_STATUS } from './notifications.js'
import { cleanMultiline, cleanText, normalizeEmail, normalizeName, normalizePhone } from './validation.js'
import { applyOffset, scheduleAnchorDate, visitKey } from './visits.js'

export const SCHEMA_VERSION = 3
export const APP_NAME = 'Earlyma'
export const STORAGE_KEY = 'earlyma-db'
export const SESSION_KEY = 'earlyma-session'
export const SESSION_HOURS = 12

export const LEGACY_KEYS = {
  workers: 'earlyma-workers',
  clients: 'earlyma-clients',
  history: 'earlyma-history',
  sentReminders: 'earlyma-sent-reminders',
  notifications: 'earlyma-notifications',
  queue: 'earlyma-notification-queue',
  selectedWorker: 'earlyma-selected-worker',
  currentUser: 'earlyma-current-user-id',
}

export class StorageError extends Error {
  constructor(message, code = 'storage', cause) {
    super(message)
    this.name = 'StorageError'
    this.code = code
    this.cause = cause
  }
}

export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
    clear: () => { map.clear() },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() { return map.size },
  }
}

export function getBrowserStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = '__earlyma_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

function safeParse(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function readArray(storage, key) {
  const parsed = safeParse(storage?.getItem(key))
  return Array.isArray(parsed) ? parsed : []
}

export function createEmptyDatabase(now = new Date()) {
  const at = now.toISOString()
  return {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    createdAt: at,
    updatedAt: at,
    workers: [],
    mothers: [],
    babies: [],
    visitRecords: {},
    notifications: [],
    callLogs: [],
    activities: [],
    preferences: {
      language: 'en',
      defaultNotificationLanguage: 'sw',
      pageSize: 10,
    },
    migrations: {},
  }
}

/**
 * Generate the next unique CHW registration code (CHW-0001, CHW-0002, …).
 * Scans existing codes so deleting a worker never causes a duplicate code.
 */
export function nextWorkerCode(workers = []) {
  const max = (Array.isArray(workers) ? workers : []).reduce((highest, worker) => {
    const match = /(\d+)\s*$/.exec(String(worker?.code ?? ''))
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  const next = Number.isFinite(max) && max >= 0 ? max + 1 : 1
  return `CHW-${String(next).padStart(4, '0')}`
}

function normalizePreferences(value = {}) {
  return {
    language: ['en', 'sw'].includes(value.language) ? value.language : 'en',
    defaultNotificationLanguage: ['en', 'sw'].includes(value.defaultNotificationLanguage) ? value.defaultNotificationLanguage : 'sw',
    pageSize: [5, 10, 20, 50].includes(Number(value.pageSize)) ? Number(value.pageSize) : 10,
  }
}

function normalizeWorker(worker = {}, index = 0, now = new Date()) {
  const createdAt = worker.createdAt || (worker.registrationDate ? new Date(worker.registrationDate).toISOString() : now.toISOString())
  const legacyPassword = typeof worker.legacyPassword === 'string'
    ? worker.legacyPassword
    : (typeof worker.password === 'string' && !worker.passwordHash ? worker.password : null)

  return {
    id: worker.id || randomId('chw'),
    type: 'worker',
    code: cleanText(worker.code, 20) || `CHW-${String(index + 1).padStart(4, '0')}`,
    fullName: cleanText(worker.fullName ?? worker.name, 120),
    phone: normalizePhone(worker.phone),
    village: cleanText(worker.village, 80),
    facility: cleanText(worker.facility, 120),
    email: normalizeEmail(worker.email),
    role: ['admin', 'chw'].includes(worker.role) ? worker.role : (index === 0 ? 'admin' : 'chw'),
    active: worker.active === undefined ? true : Boolean(worker.active),
    approvalStatus: ['active', 'pending'].includes(worker.approvalStatus) ? worker.approvalStatus : 'active',
    notes: cleanMultiline(worker.notes, 500),
    passwordHash: typeof worker.passwordHash === 'string' ? worker.passwordHash : null,
    ...(legacyPassword ? { legacyPassword } : {}),
    requiresPasswordReset: Boolean(worker.requiresPasswordReset),
    isDemo: Boolean(worker.isDemo),
    registrationDate: cleanText(worker.registrationDate, 10) || toInput(new Date(createdAt)),
    createdAt,
    updatedAt: worker.updatedAt || createdAt,
  }
}

function normalizeMother(mother = {}, now = new Date()) {
  const createdAt = mother.createdAt || now.toISOString()
  return {
    ...createMother({
      ...mother,
      fullName: mother.fullName ?? mother.label,
      expectedDeliveryDate: cleanText(mother.expectedDeliveryDate ?? mother.date, 10),
      registrationDate: cleanText(mother.registrationDate, 10) || toInput(now),
      language: mother.language ?? mother.lang ?? 'sw',
    }, { id: mother.id, now: new Date(createdAt), existingMothers: [] }),
    code: cleanText(mother.code, 20) || 'M-0000',
    isDemo: Boolean(mother.isDemo),
    createdAt,
    updatedAt: mother.updatedAt || createdAt,
  }
}

function normalizeBaby(baby = {}, now = new Date()) {
  const createdAt = baby.createdAt || now.toISOString()
  return {
    ...createBaby({
      ...baby,
      fullName: baby.fullName ?? baby.label,
      dateOfBirth: cleanText(baby.dateOfBirth ?? baby.date, 10),
      language: baby.language ?? baby.lang ?? 'sw',
    }, { id: baby.id, now: new Date(createdAt), existingBabies: [] }),
    code: cleanText(baby.code, 20) || 'B-0000',
    isDemo: Boolean(baby.isDemo),
    createdAt,
    updatedAt: baby.updatedAt || createdAt,
  }
}

function normalizeVisitRecord(record = {}, now = new Date()) {
  if (!record || typeof record !== 'object') return null
  const completedDate = cleanText(record.completedDate, 10)
  return {
    completedDate: parseDate(completedDate) ? completedDate : null,
    cancelled: Boolean(record.cancelled),
    notes: cleanMultiline(record.notes, 1000),
    followUpRequired: Boolean(record.followUpRequired),
    updatedAt: record.updatedAt || now.toISOString(),
  }
}

function normalizeNotification(entry = {}, now = new Date()) {
  const allowed = Object.values(NOTIFICATION_STATUS)
  const legacyStatus = entry.status === 'sending' ? NOTIFICATION_STATUS.PROCESSING : entry.status
  const status = allowed.includes(legacyStatus) ? legacyStatus : (entry.direction === 'inbound' ? NOTIFICATION_STATUS.RECEIVED : NOTIFICATION_STATUS.QUEUED)
  const createdAt = entry.createdAt || now.toISOString()
  return {
    id: entry.id || randomId('ntf'),
    clientId: entry.clientId ?? null,
    clientType: entry.clientType ?? null,
    clientLabel: cleanText(entry.clientLabel, 120) || 'Unknown client',
    phone: normalizePhone(entry.phone),
    message: cleanMultiline(entry.message, 1000),
    type: cleanText(entry.type, 40) || 'remind',
    workerId: entry.workerId ?? null,
    language: ['en', 'sw'].includes(entry.language) ? entry.language : 'sw',
    direction: entry.direction === 'inbound' ? 'inbound' : 'outbound',
    status,
    attempts: Number(entry.attempts) || 0,
    maxAttempts: Number(entry.maxAttempts) || 3,
    provider: entry.provider ?? null,
    providerMessageId: entry.providerMessageId ?? null,
    providerStatus: entry.providerStatus ?? null,
    error: entry.error ?? null,
    lastError: entry.lastError ?? entry.error ?? null,
    errorHistory: Array.isArray(entry.errorHistory) ? entry.errorHistory.slice(0, 50) : [],
    createdAt,
    updatedAt: entry.updatedAt || createdAt,
    processingAt: entry.processingAt ?? null,
    nextRetryAt: entry.nextRetryAt ?? null,
    sentAt: entry.sentAt ?? null,
    deliveredAt: entry.deliveredAt ?? null,
    deliveryReceipt: entry.deliveryReceipt ?? null,
    dedupeKey: entry.dedupeKey ?? null,
    manualRetries: Number(entry.manualRetries) || 0,
    reply: entry.reply ?? null,
    intent: entry.intent ?? null,
    code: entry.code ?? null,
    relatedId: entry.relatedId ?? null,
    events: Array.isArray(entry.events) ? entry.events.slice(-100) : [{ at: createdAt, status }],
  }
}

function normalizeCallLog(log = {}, now = new Date()) {
  const at = log.at || log.createdAt || now.toISOString()
  return {
    id: log.id || randomId('call'),
    clientId: log.clientId ?? null,
    clientType: log.clientType ?? null,
    clientName: cleanText(log.clientName ?? log.clientLabel, 120) || 'Unknown client',
    phone: normalizePhone(log.phone),
    workerId: log.workerId ?? null,
    type: cleanText(log.type, 40) || 'reminder',
    language: ['en', 'sw'].includes(log.language) ? log.language : 'sw',
    message: cleanMultiline(log.message, 1000),
    outcome: cleanText(log.outcome, 40) || 'completed',
    simulated: log.simulated === false ? false : true,
    notes: cleanMultiline(log.notes, 500),
    followUp: log.followUp ?? null,
    at,
    createdAt: at,
    isDemo: Boolean(log.isDemo),
  }
}

function normalizeActivity(activity = {}, now = new Date()) {
  return {
    id: activity.id || randomId('act'),
    actorId: activity.actorId ?? null,
    action: cleanText(activity.action, 80) || 'activity.unknown',
    entityType: cleanText(activity.entityType, 40) || 'system',
    entityId: activity.entityId ?? null,
    meta: activity.meta && typeof activity.meta === 'object' ? activity.meta : {},
    at: activity.at || now.toISOString(),
    isDemo: Boolean(activity.isDemo),
  }
}

export function normalizeDatabase(raw, options = {}) {
  const now = options.now ?? new Date()
  const base = createEmptyDatabase(now)
  if (!raw || typeof raw !== 'object') return base

  const workers = Array.isArray(raw.workers) ? raw.workers.map((worker, index) => normalizeWorker(worker, index, now)) : []
  const mothers = Array.isArray(raw.mothers) ? raw.mothers.map((mother) => normalizeMother(mother, now)) : []
  const babies = Array.isArray(raw.babies) ? raw.babies.map((baby) => normalizeBaby(baby, now)) : []

  const visitRecords = {}
  if (raw.visitRecords && typeof raw.visitRecords === 'object') {
    for (const [key, record] of Object.entries(raw.visitRecords)) {
      if (typeof key !== 'string' || key.length > 300) continue
      const normalized = normalizeVisitRecord(record, now)
      if (normalized) visitRecords[key] = normalized
    }
  }

  return {
    ...base,
    ...raw,
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    revision: Number(raw.revision) || 0,
    createdAt: raw.createdAt || base.createdAt,
    updatedAt: raw.updatedAt || base.updatedAt,
    workers,
    mothers,
    babies,
    visitRecords,
    notifications: Array.isArray(raw.notifications) ? raw.notifications.map((entry) => normalizeNotification(entry, now)) : [],
    callLogs: Array.isArray(raw.callLogs) ? raw.callLogs.map((log) => normalizeCallLog(log, now)) : [],
    activities: Array.isArray(raw.activities) ? raw.activities.map((entry) => normalizeActivity(entry, now)) : [],
    preferences: normalizePreferences(raw.preferences),
    migrations: raw.migrations && typeof raw.migrations === 'object' ? raw.migrations : {},
  }
}

export function migrateDatabase(raw, options = {}) {
  if (!raw || typeof raw !== 'object') return createEmptyDatabase(options.now)
  // Future migrations switch on raw.schemaVersion here. Version 1 and 2
  // prototypes already use the same core collection names, so normalization
  // plus the legacy-key importer is sufficient.
  return normalizeDatabase(raw, options)
}

function legacyHasData(legacy) {
  return legacy.workers.length > 0 || legacy.clients.length > 0 || legacy.history.length > 0 || legacy.sentReminders.length > 0 || legacy.notifications.length > 0 || legacy.queue.length > 0
}

export function readLegacyData(storage) {
  if (!storage) {
    return { workers: [], clients: [], history: [], sentReminders: [], notifications: [], queue: [] }
  }
  return {
    workers: readArray(storage, LEGACY_KEYS.workers),
    clients: readArray(storage, LEGACY_KEYS.clients),
    history: readArray(storage, LEGACY_KEYS.history),
    sentReminders: readArray(storage, LEGACY_KEYS.sentReminders),
    notifications: readArray(storage, LEGACY_KEYS.notifications),
    queue: readArray(storage, LEGACY_KEYS.queue),
  }
}

function legacyAttendedRecords(client, type) {
  const records = {}
  if (!client?.attended) return records
  const schedule = type === 'mother' ? SCHEDULES.anc : SCHEDULES.babyImmunization
  const anchor = scheduleAnchorDate({ ...client, type, expectedDeliveryDate: client.date, dateOfBirth: client.date }, schedule)
  if (!anchor) return records

  for (const [index, value] of Object.entries(client.attended)) {
    if (!value) continue
    const template = schedule.visits[Number(index)]
    if (!template) continue
    const date = applyOffset(anchor, template.offset)
    records[visitKey({ type, id: client.id }, schedule.id, template.id)] = {
      completedDate: toInput(date),
      cancelled: false,
      notes: 'Imported from the legacy prototype.',
      followUpRequired: false,
      updatedAt: new Date().toISOString(),
    }
  }
  return records
}

export function migrateLegacyData(legacy, now = new Date()) {
  const db = createEmptyDatabase(now)
  db.migrations.legacyImportedAt = now.toISOString()

  db.workers = (legacy.workers ?? []).map((worker, index) => normalizeWorker(worker, index, now))
  const workerId = db.workers[0]?.id ?? null

  for (const client of legacy.clients ?? []) {
    if (!client || typeof client !== 'object') continue
    const type = client.mode === 'preg' ? 'mother' : 'baby'
    const id = client.id || randomId(type === 'mother' ? 'mom' : 'baby')
    if (type === 'mother') {
      const mother = normalizeMother({
        ...client,
        id,
        fullName: client.label,
        expectedDeliveryDate: client.date,
        registrationDate: client.createdAt ? toInput(new Date(client.createdAt)) : toInput(now),
        status: 'pregnant',
        workerId: client.workerId || workerId,
      }, now)
      db.mothers.push(mother)
      Object.assign(db.visitRecords, legacyAttendedRecords({ ...client, id }, 'mother'))
    } else {
      const baby = normalizeBaby({
        ...client,
        id,
        fullName: client.label,
        dateOfBirth: client.date,
        motherName: '',
        workerId: client.workerId || workerId,
      }, now)
      db.babies.push(baby)
      Object.assign(db.visitRecords, legacyAttendedRecords({ ...client, id }, 'baby'))
    }
  }

  for (const reminder of legacy.sentReminders ?? []) {
    const notification = normalizeNotification({
      ...createNotification(
        {
          id: reminder.clientId,
          fullName: reminder.clientLabel,
          phone: reminder.phone,
        },
        reminder.message,
        'remind',
        reminder.workerId,
        new Date(reminder.sentAt || now),
        { id: reminder.id || randomId('ntf'), provider: 'legacy-demo' },
      ),
      status: NOTIFICATION_STATUS.SENT,
      sentAt: reminder.sentAt || now.toISOString(),
      provider: 'legacy-demo',
      clientId: reminder.clientId ?? null,
      clientLabel: reminder.clientLabel,
      phone: reminder.phone,
    }, now)
    db.notifications.push(notification)
  }

  const queues = [...(legacy.notifications ?? []), ...(legacy.queue ?? [])]
  const seen = new Set(db.notifications.map((entry) => entry.id))
  for (const entry of queues) {
    const normalized = normalizeNotification(entry, now)
    if (seen.has(normalized.id)) continue
    seen.add(normalized.id)
    db.notifications.push(normalized)
  }

  for (const entry of legacy.history ?? []) {
    db.activities.push(normalizeActivity({
      id: entry.id,
      actorId: entry.workerId,
      action: `legacy.${entry.action || 'activity'}`,
      entityType: 'client',
      entityId: entry.clientId,
      meta: { summary: entry.summary, clientLabel: entry.clientLabel },
      at: entry.date ? new Date(`${entry.date}T12:00:00`).toISOString() : now.toISOString(),
    }, now))
  }

  db.updatedAt = now.toISOString()
  return db
}

async function finalizeLegacyPasswords(db) {
  let changed = false
  const workers = []
  for (const worker of db.workers) {
    if (worker.legacyPassword && !worker.passwordHash) {
      try {
        const passwordHash = await hashPassword(worker.legacyPassword)
        const { legacyPassword, ...rest } = worker
        workers.push({ ...rest, passwordHash, passwordMigratedAt: new Date().toISOString() })
      } catch {
        const { legacyPassword, ...rest } = worker
        workers.push({ ...rest, requiresPasswordReset: true })
      }
      changed = true
    } else if (worker.legacyPassword) {
      const { legacyPassword, ...rest } = worker
      workers.push(rest)
      changed = true
    } else {
      workers.push(worker)
    }
  }
  return changed ? { ...db, workers } : db
}

export async function loadDatabase(storage = getBrowserStorage(), now = new Date()) {
  if (!storage) return createEmptyDatabase(now)

  const rawText = storage.getItem(STORAGE_KEY)
  let db
  let shouldSave = false

  if (rawText) {
    const parsed = safeParse(rawText)
    if (!parsed) {
      // Never silently discard corrupt data. Preserve it under a recovery key
      // and continue with an empty database so the app remains usable.
      try { storage.setItem(`${STORAGE_KEY}-corrupt-${Date.now()}`, rawText) } catch { /* ignore */ }
      db = createEmptyDatabase(now)
      shouldSave = true
    } else {
      db = migrateDatabase(parsed, { now })
      if (parsed.schemaVersion !== SCHEMA_VERSION) shouldSave = true
    }
  } else {
    const legacy = readLegacyData(storage)
    if (legacyHasData(legacy)) {
      db = migrateLegacyData(legacy, now)
      shouldSave = true
    } else {
      db = createEmptyDatabase(now)
    }
  }

  // Import legacy keys if the current database exists but has no imported
  // marker and no clinical records yet (e.g. a half-finished migration).
  if (!db.migrations?.legacyImportedAt && db.mothers.length === 0 && db.babies.length === 0 && db.workers.length === 0) {
    const legacy = readLegacyData(storage)
    if (legacyHasData(legacy)) {
      db = migrateLegacyData(legacy, now)
      shouldSave = true
    }
  }

  const finalized = await finalizeLegacyPasswords(db)
  if (finalized !== db) shouldSave = true
  db = finalized

  if (shouldSave) saveDatabase(db, storage)
  return db
}

export function saveDatabase(db, storage = getBrowserStorage()) {
  if (!storage) {
    throw new StorageError('Browser storage is not available. Data will not be saved.', 'unavailable')
  }
  if (!db || typeof db !== 'object') {
    throw new StorageError('Refusing to save an invalid database.', 'invalid')
  }
  let text
  try {
    text = JSON.stringify(db)
  } catch (error) {
    throw new StorageError('Could not serialize application data.', 'serialize', error)
  }
  try {
    storage.setItem(STORAGE_KEY, text)
    return true
  } catch (error) {
    const quota = error?.name === 'QuotaExceededError' || error?.code === 22
    throw new StorageError(
      quota ? 'Browser storage is full. Export a backup and remove some records.' : 'Could not save data to browser storage.',
      quota ? 'quota' : 'write',
      error,
    )
  }
}

export function exportDatabase(db, now = new Date()) {
  return JSON.stringify({
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: db,
  }, null, 2)
}

export function importDatabase(input, options = {}) {
  const now = options.now ?? new Date()
  const parsed = typeof input === 'string' ? safeParse(input) : input
  if (!parsed || typeof parsed !== 'object') {
    throw new StorageError('The selected file is not valid JSON.', 'invalid')
  }
  const payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed
  const looksLikeEarlyma = ['workers', 'mothers', 'babies', 'notifications', 'callLogs', 'visitRecords']
    .some((key) => Array.isArray(payload[key]) || (payload[key] && typeof payload[key] === 'object'))
  if (!looksLikeEarlyma) {
    throw new StorageError('This file does not look like an Earlyma backup.', 'invalid')
  }
  const db = migrateDatabase(payload, { now })
  return {
    ...db,
    revision: Math.max(Number(db.revision) || 0, 1),
    importedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

export function backupFilename(now = new Date()) {
  return `earlyma-backup-${toInput(now)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`
}

export function storageBytes(db) {
  try {
    return new Blob([JSON.stringify(db)]).size
  } catch {
    return JSON.stringify(db).length
  }
}

export function saveSession(userId, options = {}) {
  const storage = options.storage ?? getBrowserStorage()
  if (!storage || !userId) return false
  const now = options.now ?? new Date()
  const hours = options.hours ?? SESSION_HOURS
  const payload = {
    userId,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + hours * 3_600_000).toISOString(),
  }
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadSession(options = {}) {
  const storage = options.storage ?? getBrowserStorage()
  const now = options.now ?? new Date()
  if (!storage) return null
  const payload = safeParse(storage.getItem(SESSION_KEY))
  if (!payload?.userId || !payload?.expiresAt) return null
  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    try { storage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    return null
  }
  return payload
}

export function clearSession(storage = getBrowserStorage()) {
  if (!storage) return
  try { storage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

export function clearAllData(storage = getBrowserStorage()) {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
    storage.removeItem(SESSION_KEY)
    for (const key of Object.values(LEGACY_KEYS)) storage.removeItem(key)
  } catch {
    throw new StorageError('Could not clear browser storage.', 'write')
  }
}

export function removeDemoData(db, now = new Date()) {
  const demoClientIds = new Set([
    ...(db.mothers ?? []).filter((client) => client.isDemo).map((client) => client.id),
    ...(db.babies ?? []).filter((client) => client.isDemo).map((client) => client.id),
  ])
  let next = {
    ...db,
    workers: (db.workers ?? []).filter((worker) => !worker.isDemo),
    mothers: (db.mothers ?? []).filter((client) => !client.isDemo),
    babies: (db.babies ?? []).filter((client) => !client.isDemo),
    notifications: (db.notifications ?? []).filter((entry) => !demoClientIds.has(entry.clientId)),
    callLogs: (db.callLogs ?? []).filter((log) => !log.isDemo && !demoClientIds.has(log.clientId)),
    activities: (db.activities ?? []).filter((activity) => !activity.isDemo && !demoClientIds.has(activity.entityId)),
    updatedAt: now.toISOString(),
  }
  next.visitRecords = Object.fromEntries(
    Object.entries(db.visitRecords ?? {}).filter(([key]) => !Array.from(demoClientIds).some((id) => key.includes(id))),
  )
  return next
}

export function databaseCounts(db) {
  return {
    workers: (db?.workers ?? []).length,
    mothers: (db?.mothers ?? []).length,
    babies: (db?.babies ?? []).length,
    visits: Object.keys(db?.visitRecords ?? {}).length,
    notifications: (db?.notifications ?? []).length,
    calls: (db?.callLogs ?? []).length,
    activities: (db?.activities ?? []).length,
  }
}

export function pruneActivityLog(db, limit = 1000) {
  const activities = [...(db.activities ?? [])]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit)
  return { ...db, activities }
}

export { createMother, createBaby, deleteMotherFromDb, deleteBabyFromDb, normalizeName }
