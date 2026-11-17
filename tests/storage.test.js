import { describe, it, expect } from 'vitest'
import {
  backupFilename,
  clearAllData,
  clearSession,
  createEmptyDatabase,
  createMemoryStorage,
  databaseCounts,
  exportDatabase,
  importDatabase,
  LEGACY_KEYS,
  loadDatabase,
  loadSession,
  migrateDatabase,
  migrateLegacyData,
  normalizeDatabase,
  pruneActivityLog,
  readLegacyData,
  removeDemoData,
  saveDatabase,
  saveSession,
  SCHEMA_VERSION,
  SESSION_HOURS,
  SESSION_KEY,
  storageBytes,
  STORAGE_KEY,
  StorageError,
} from '../src/lib/storage.js'
import { verifyPassword } from '../src/lib/crypto.js'

const now = new Date('2026-06-01T12:00:00.000Z')

function mother(overrides = {}) {
  return {
    id: 'm1',
    type: 'mother',
    code: 'M-0001',
    fullName: 'Amina Test',
    age: 24,
    phone: '0712345678',
    village: 'Demo Village',
    expectedDeliveryDate: '2026-09-01',
    registrationDate: '2026-01-01',
    status: 'pregnant',
    language: 'sw',
    ...overrides,
  }
}

function baby(overrides = {}) {
  return {
    id: 'b1',
    type: 'baby',
    code: 'B-0001',
    fullName: 'Baby Test',
    motherName: 'Amina Test',
    dateOfBirth: '2026-01-01',
    village: 'Demo Village',
    ...overrides,
  }
}

function worker(overrides = {}) {
  return {
    id: 'w1',
    code: 'CHW-0001',
    fullName: 'Worker One',
    phone: '0711111111',
    village: 'Demo Village',
    email: 'worker@example.com',
    role: 'admin',
    ...overrides,
  }
}

describe('memory storage and empty databases', () => {
  it('behaves like a Storage implementation', () => {
    const storage = createMemoryStorage({ a: '1' })
    expect(storage.length).toBe(1)
    expect(storage.getItem('a')).toBe('1')
    expect(storage.key(0)).toBe('a')
    expect(storage.key(9)).toBeNull()
    storage.setItem('b', 2)
    expect(storage.getItem('b')).toBe('2')
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('creates a versioned empty database', () => {
    const db = createEmptyDatabase(now)
    expect(db).toMatchObject({
      app: 'Earlyma',
      schemaVersion: SCHEMA_VERSION,
      revision: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      workers: [],
      mothers: [],
      babies: [],
      notifications: [],
      callLogs: [],
      activities: [],
    })
    expect(db.preferences.pageSize).toBe(10)
  })
})

describe('normalisation and migration', () => {
  it('returns an empty database for invalid input', () => {
    expect(normalizeDatabase(null, { now }).mothers).toEqual([])
    expect(migrateDatabase(null, { now }).schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('normalises collections, preferences and worker roles', () => {
    const db = normalizeDatabase({
      workers: [{ name: 'Admin Person', email: ' ADMIN@Example.com ', password: 'legacy-pass' }, { name: 'CHW Person' }],
      mothers: [{ id: 'm1', label: 'Mama One', date: '2026-09-01', phone: '0712 345 678' }],
      babies: [{ id: 'b1', label: 'Baby One', date: '2026-01-01' }],
      visitRecords: {
        'mother:m1::anc::anc-12': { completedDate: '2026-02-30', notes: '  note  ' },
        ['x'.repeat(301)]: { completedDate: '2026-01-01' },
      },
      notifications: [{ id: 'n1', status: 'sending', phone: '0712 345 678', message: ' hi ' }],
      callLogs: [{ id: 'c1', clientName: 'Mama One', phone: '0712 345 678', at: now.toISOString() }],
      activities: [{ action: ' created ', at: now.toISOString() }],
      preferences: { language: 'sw', pageSize: 20 },
      revision: 4,
    }, { now })

    expect(db.schemaVersion).toBe(SCHEMA_VERSION)
    expect(db.revision).toBe(4)
    expect(db.workers[0]).toMatchObject({ role: 'admin', email: 'admin@example.com', legacyPassword: 'legacy-pass' })
    expect(db.workers[0].password).toBeUndefined()
    expect(db.workers[1].role).toBe('chw')
    expect(db.mothers[0]).toMatchObject({ fullName: 'Mama One', phone: '0712345678', code: 'M-0000' })
    expect(db.babies[0]).toMatchObject({ fullName: 'Baby One', code: 'B-0000' })
    expect(db.visitRecords['mother:m1::anc::anc-12']).toMatchObject({ completedDate: null, notes: 'note' })
    expect(Object.keys(db.visitRecords)).toHaveLength(1)
    expect(db.notifications[0]).toMatchObject({ status: 'processing', phone: '0712345678', message: 'hi' })
    expect(db.callLogs[0]).toMatchObject({ clientName: 'Mama One', phone: '0712345678' })
    expect(db.activities[0].action).toBe('created')
    expect(db.preferences).toEqual({ language: 'sw', defaultNotificationLanguage: 'sw', pageSize: 20 })
  })

  it('falls back to safe preference defaults', () => {
    const db = normalizeDatabase({ preferences: { language: 'xx', pageSize: 999 } }, { now })
    expect(db.preferences).toEqual({ language: 'en', defaultNotificationLanguage: 'sw', pageSize: 10 })
  })
})

describe('loadDatabase', () => {
  it('returns an empty database when storage is unavailable', async () => {
    const db = await loadDatabase(null, now)
    expect(db.mothers).toEqual([])
    expect(db.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('creates and does not persist an empty database', async () => {
    const storage = createMemoryStorage()
    const db = await loadDatabase(storage, now)
    expect(db.mothers).toEqual([])
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('recovers from corrupt JSON without discarding the original text', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{not json' })
    const db = await loadDatabase(storage, now)
    expect(db.mothers).toEqual([])
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    expect(keys.some((key) => key.startsWith(`${STORAGE_KEY}-corrupt-`))).toBe(true)
  })

  it('saves a migrated older schema', async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, mothers: [mother()], babies: [] }),
    })
    const db = await loadDatabase(storage, now)
    expect(db.schemaVersion).toBe(SCHEMA_VERSION)
    const saved = JSON.parse(storage.getItem(STORAGE_KEY))
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION)
    expect(saved.mothers).toHaveLength(1)
  })

  it('imports legacy keys into a new database', async () => {
    const storage = createMemoryStorage({
      [LEGACY_KEYS.workers]: JSON.stringify([{ id: 'w1', name: 'Legacy Worker', email: 'legacy@example.com', password: 'secret123' }]),
      [LEGACY_KEYS.clients]: JSON.stringify([
        { id: 'c1', mode: 'preg', label: 'Legacy Mama', date: '2026-09-01', phone: '0712345678', attended: { 0: true } },
        { id: 'c2', mode: 'baby', label: 'Legacy Baby', date: '2026-01-01', phone: '0723456789' },
      ]),
      [LEGACY_KEYS.sentReminders]: JSON.stringify([
        { id: 'r1', clientId: 'c1', clientLabel: 'Legacy Mama', phone: '0712345678', message: 'Hello', sentAt: now.toISOString() },
      ]),
      [LEGACY_KEYS.history]: JSON.stringify([
        { id: 'h1', workerId: 'w1', clientId: 'c1', action: 'reminder', date: '2026-05-01', summary: 'Called' },
      ]),
    })

    const db = await loadDatabase(storage, now)
    expect(db.mothers).toHaveLength(1)
    expect(db.babies).toHaveLength(1)
    expect(db.mothers[0]).toMatchObject({ fullName: 'Legacy Mama', workerId: 'w1' })
    expect(Object.keys(db.visitRecords)).toHaveLength(1)
    expect(Object.keys(db.visitRecords)[0]).toBe('mother:c1::anc::anc-12')
    expect(db.notifications).toHaveLength(1)
    expect(db.notifications[0]).toMatchObject({ status: 'sent', clientId: 'c1', provider: 'legacy-demo' })
    expect(db.activities).toHaveLength(1)
    expect(db.migrations.legacyImportedAt).toBe(now.toISOString())
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('hashes legacy plaintext passwords during migration', async () => {
    const storage = createMemoryStorage({
      [LEGACY_KEYS.workers]: JSON.stringify([
        { id: 'w1', name: 'Legacy Worker', email: 'legacy@example.com', password: 'secret123' },
      ]),
    })
    const db = await loadDatabase(storage, now)
    expect(db.workers[0].legacyPassword).toBeUndefined()
    expect(db.workers[0].passwordHash).toMatch(/^pbkdf2\$/)
    expect(await verifyPassword('secret123', db.workers[0].passwordHash)).toBe(true)
    expect(await verifyPassword('wrong', db.workers[0].passwordHash)).toBe(false)
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).workers[0].password).toBeUndefined()
  })

  it('reads legacy arrays safely', () => {
    const storage = createMemoryStorage({
      [LEGACY_KEYS.workers]: 'not json',
      [LEGACY_KEYS.clients]: JSON.stringify({ not: 'an array' }),
    })
    expect(readLegacyData(storage)).toEqual({
      workers: [],
      clients: [],
      history: [],
      sentReminders: [],
      notifications: [],
      queue: [],
    })
    expect(readLegacyData(null).workers).toEqual([])
  })
})

describe('saving, export and import', () => {
  it('round-trips a database', () => {
    const storage = createMemoryStorage()
    const db = { ...createEmptyDatabase(now), mothers: [mother()], revision: 2 }
    expect(saveDatabase(db, storage)).toBe(true)
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).mothers).toHaveLength(1)
  })

  it('reports storage failures with stable codes', () => {
    expect(() => saveDatabase(null, createMemoryStorage())).toThrow(StorageError)
    expect(() => saveDatabase(createEmptyDatabase(now), null)).toThrow(/not available/)
    try {
      saveDatabase(createEmptyDatabase(now), null)
    } catch (error) {
      expect(error.code).toBe('unavailable')
    }

    const quotaStorage = {
      getItem: () => null,
      setItem: () => { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error },
      removeItem: () => {},
    }
    try {
      saveDatabase(createEmptyDatabase(now), quotaStorage)
    } catch (error) {
      expect(error.code).toBe('quota')
      expect(error.message).toMatch(/full/i)
    }
  })

  it('exports and imports a backup', () => {
    const db = { ...createEmptyDatabase(now), mothers: [mother()], revision: 3 }
    const text = exportDatabase(db, now)
    const parsed = JSON.parse(text)
    expect(parsed).toMatchObject({ app: 'Earlyma', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString() })
    expect(parsed.data.mothers).toHaveLength(1)

    const imported = importDatabase(text, { now })
    expect(imported.mothers).toHaveLength(1)
    expect(imported.importedAt).toBe(now.toISOString())
    expect(imported.revision).toBeGreaterThanOrEqual(3)
  })

  it('rejects invalid imports', () => {
    expect(() => importDatabase('{not json', { now })).toThrow(/valid JSON/)
    expect(() => importDatabase({ hello: 'world' }, { now })).toThrow(/Earlyma backup/)
    try {
      importDatabase({ hello: 'world' }, { now })
    } catch (error) {
      expect(error.code).toBe('invalid')
    }
  })

  it('builds safe backup filenames', () => {
    expect(backupFilename(new Date(2026, 5, 1, 9, 5))).toBe('earlyma-backup-2026-06-01-0905.json')
  })

  it('measures the stored size as a number', () => {
    expect(storageBytes(createEmptyDatabase(now))).toBeGreaterThan(0)
  })
})

describe('demo data removal and maintenance', () => {
  it('removes only records marked as demo', () => {
    const db = {
      ...createEmptyDatabase(now),
      workers: [worker({ isDemo: true }), worker({ id: 'w2', email: 'real@example.com' })],
      mothers: [mother({ isDemo: true }), mother({ id: 'm2', fullName: 'Real Mama', isDemo: false })],
      babies: [baby({ isDemo: true }), baby({ id: 'b2', fullName: 'Real Baby', isDemo: false })],
      notifications: [
        { id: 'n1', clientId: 'm1' },
        { id: 'n2', clientId: 'm2' },
      ],
      callLogs: [
        { id: 'c1', clientId: 'm1', isDemo: true },
        { id: 'c2', clientId: 'm2', isDemo: false },
      ],
      activities: [
        { id: 'a1', entityId: 'm1', isDemo: true },
        { id: 'a2', entityId: 'm2', isDemo: false },
      ],
      visitRecords: {
        'mother:m1::anc::anc-12': { completedDate: '2026-01-01' },
        'mother:m2::anc::anc-12': { completedDate: '2026-01-01' },
      },
    }
    const next = removeDemoData(db, now)
    expect(next.workers.map((item) => item.id)).toEqual(['w2'])
    expect(next.mothers.map((item) => item.id)).toEqual(['m2'])
    expect(next.babies.map((item) => item.id)).toEqual(['b2'])
    expect(next.notifications.map((item) => item.id)).toEqual(['n2'])
    expect(next.callLogs.map((item) => item.id)).toEqual(['c2'])
    expect(next.activities.map((item) => item.id)).toEqual(['a2'])
    expect(Object.keys(next.visitRecords)).toEqual(['mother:m2::anc::anc-12'])
    expect(next.updatedAt).toBe(now.toISOString())
  })

  it('counts records and prunes the activity log', () => {
    const db = {
      ...createEmptyDatabase(now),
      workers: [worker()],
      mothers: [mother()],
      babies: [baby()],
      visitRecords: { a: {}, b: {} },
      notifications: [{}, {}],
      callLogs: [{}],
      activities: [
        { id: 'a1', at: '2026-01-01T00:00:00.000Z' },
        { id: 'a2', at: '2026-02-01T00:00:00.000Z' },
        { id: 'a3', at: '2026-03-01T00:00:00.000Z' },
      ],
    }
    expect(databaseCounts(db)).toEqual({
      workers: 1,
      mothers: 1,
      babies: 1,
      visits: 2,
      notifications: 2,
      calls: 1,
      activities: 3,
    })
    expect(pruneActivityLog(db, 2).activities.map((item) => item.id)).toEqual(['a3', 'a2'])
  })
})

describe('sessions and clearing data', () => {
  it('saves, restores and expires sessions', () => {
    const storage = createMemoryStorage()
    expect(saveSession('w1', { storage, now })).toBe(true)
    expect(saveSession('', { storage, now })).toBe(false)
    expect(saveSession('w1', { storage: null, now })).toBe(false)

    const payload = loadSession({ storage, now: new Date(now.getTime() + 3_600_000) })
    expect(payload).toMatchObject({ userId: 'w1' })
    expect(payload.expiresAt).toBe(new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString())

    expect(loadSession({ storage, now: new Date(now.getTime() + (SESSION_HOURS + 1) * 3_600_000) })).toBeNull()
    expect(storage.getItem(SESSION_KEY)).toBeNull()
    expect(loadSession({ storage: null, now })).toBeNull()
  })

  it('ignores malformed sessions and clears them explicitly', () => {
    const storage = createMemoryStorage({ [SESSION_KEY]: '{bad' })
    expect(loadSession({ storage, now })).toBeNull()
    saveSession('w1', { storage, now })
    clearSession(storage)
    expect(storage.getItem(SESSION_KEY)).toBeNull()
    clearSession(null)
  })

  it('clears the database, session and legacy keys', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: '{}',
      [SESSION_KEY]: '{}',
      [LEGACY_KEYS.clients]: '[]',
      unrelated: 'keep',
    })
    clearAllData(storage)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storage.getItem(SESSION_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_KEYS.clients)).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
    clearAllData(null)
  })

  it('exposes a deterministic legacy migration helper', () => {
    const db = migrateLegacyData({ clients: [{ id: 'c1', mode: 'preg', label: 'Mama', date: '2026-09-01' }] }, now)
    expect(db.mothers).toHaveLength(1)
    expect(db.migrations.legacyImportedAt).toBe(now.toISOString())
  })
})
