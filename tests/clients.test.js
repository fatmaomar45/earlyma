import { describe, it, expect } from 'vitest'
import {
  addGrowthRecord,
  babyStatus,
  clientAnchorDate,
  clientName,
  clientPhone,
  clientsForWorker,
  createBaby,
  createMother,
  defaultRegistrationDate,
  deleteBabyFromDb,
  deleteMotherFromDb,
  filterClients,
  matchesQuery,
  motherStatus,
  nextClientCode,
  normalizeSearchQuery,
  paginate,
  sortClients,
  uniqueVillages,
  updateBaby,
  updateMother,
} from '../src/lib/clients.js'
import { toInput } from '../src/lib/dates.js'

const now = new Date(2026, 5, 15, 10, 0, 0)

function mother(overrides = {}) {
  return {
    id: 'm1',
    type: 'mother',
    fullName: 'Amina Test',
    phone: '0712345678',
    village: 'Demo Village',
    expectedDeliveryDate: '2026-09-01',
    registrationDate: '2026-01-01',
    workerId: 'w1',
    status: 'pregnant',
    language: 'sw',
    ...overrides,
  }
}

function baby(overrides = {}) {
  return {
    id: 'b1',
    type: 'baby',
    fullName: 'Baby Test',
    motherName: 'Amina Test',
    motherId: 'm1',
    dateOfBirth: '2026-01-01',
    village: 'Demo Village',
    workerId: 'w1',
    ...overrides,
  }
}

describe('client codes and accessors', () => {
  it('generates the next sequential code', () => {
    expect(nextClientCode([], 'M')).toBe('M-0001')
    expect(nextClientCode([{ code: 'M-0001' }, { code: 'M-0009' }], 'M')).toBe('M-0010')
    expect(nextClientCode([{ code: 'B-0004' }], 'B')).toBe('B-0005')
    expect(nextClientCode([{ code: 'bad' }, {}], 'M')).toBe('M-0001')
  })

  it('reads stable client fields safely', () => {
    expect(clientName({ fullName: '  A  B ' })).toBe('A B')
    expect(clientName({ label: 'Legacy' })).toBe('Legacy')
    expect(clientName(null)).toBe('—')
    expect(clientPhone({ phone: '0712 345 678' })).toBe('0712345678')
    expect(toInput(clientAnchorDate(mother()))).toBe('2026-09-01')
    expect(toInput(clientAnchorDate(baby()))).toBe('2026-01-01')
    expect(clientAnchorDate(null)).toBeNull()
  })

  it('derives mother and baby status', () => {
    expect(motherStatus({ status: 'pregnant' })).toBe('pregnant')
    expect(motherStatus({ status: 'inactive' })).toBe('inactive')
    expect(motherStatus(null)).toBe('unknown')
    expect(babyStatus({})).toBe('active')
    expect(babyStatus({ status: 'inactive' })).toBe('inactive')
    expect(babyStatus(null)).toBe('unknown')
  })

  it('returns the registration date input value', () => {
    expect(defaultRegistrationDate(now)).toBe('2026-06-15')
  })
})

describe('createMother', () => {
  it('creates a normalised mother with generated code and timestamps', () => {
    const created = createMother({
      fullName: '  Amina   Test ',
      age: '24',
      phone: '0712 345 678',
      village: ' Demo Village ',
      expectedDeliveryDate: '2026-09-01',
      language: 'en',
      consentReminders: 1,
    }, { now, existingMothers: [{ code: 'M-0004' }], id: 'm9', demo: true })

    expect(created.id).toBe('m9')
    expect(created.type).toBe('mother')
    expect(created.code).toBe('M-0005')
    expect(created.fullName).toBe('Amina Test')
    expect(created.age).toBe(24)
    expect(created.phone).toBe('0712345678')
    expect(created.registrationDate).toBe('2026-06-15')
    expect(created.language).toBe('en')
    expect(created.consentReminders).toBe(true)
    expect(created.isDemo).toBe(true)
    expect(created.createdAt).toBe(now.toISOString())
  })

  it('updates a mother without losing existing fields', () => {
    const existing = createMother({ fullName: 'Old Name', phone: '0712345678' }, { now, id: 'm1' })
    const updated = updateMother(existing, { fullName: 'New Name', notes: '  hi  ' }, now)
    expect(updated.id).toBe('m1')
    expect(updated.fullName).toBe('New Name')
    expect(updated.notes).toBe('hi')
    expect(updated.createdAt).toBe(existing.createdAt)
    expect(updateMother(null, {}, now)).toBeNull()
  })
})

describe('createBaby', () => {
  it('creates and updates a baby', () => {
    const created = createBaby({
      fullName: 'Baby Test',
      motherName: 'Amina Test',
      dateOfBirth: '2026-01-01',
      sex: 'female',
      birthWeightKg: '3.1',
      immunizations: ['BCG'],
      growthRecords: [],
    }, { now, existingBabies: [{ code: 'B-0002' }], id: 'b9' })

    expect(created.code).toBe('B-0003')
    expect(created.sex).toBe('female')
    expect(created.birthWeightKg).toBe(3.1)
    expect(created.immunizations).toEqual(['BCG'])

    const updated = updateBaby(created, { currentWeightKg: '4.5', fullName: 'Baby Renamed' }, now)
    expect(updated.currentWeightKg).toBe(4.5)
    expect(updated.fullName).toBe('Baby Renamed')
    expect(updated.code).toBe('B-0003')
    expect(updateBaby(null, {}, now)).toBeNull()
  })

  it('adds growth records and updates the current weight', () => {
    const entry = addGrowthRecord(baby(), { weightKg: '4.2', heightCm: '55', notes: '  good ' }, now)
    expect(entry.growthRecords).toHaveLength(1)
    expect(entry.growthRecords[0].date).toBe('2026-06-15')
    expect(entry.growthRecords[0].weightKg).toBe(4.2)
    expect(entry.currentWeightKg).toBe(4.2)
    expect(entry.growthRecords[0].notes).toBe('good')
    expect(addGrowthRecord(null)).toBeNull()
  })
})

describe('search, filtering and sorting', () => {
  const clients = [
    mother({ id: 'm1', fullName: 'Amina Test', village: 'Alpha', phone: '0711111111', workerId: 'w1' }),
    mother({ id: 'm2', fullName: 'Zainabu Test', village: 'Beta', phone: '0722222222', workerId: 'w2', status: 'inactive' }),
    baby({ id: 'b1', fullName: 'Baby One', village: 'Alpha', workerId: 'w1' }),
  ]

  it('matches every word of a query', () => {
    expect(normalizeSearchQuery('  AMINA ')).toBe('amina')
    expect(matchesQuery(clients[0], 'amina alpha')).toBe(true)
    expect(matchesQuery(clients[0], 'amina beta')).toBe(false)
    expect(matchesQuery(clients[0], '0711')).toBe(true)
    expect(matchesQuery(clients[0], '')).toBe(true)
  })

  it('filters by category, status, worker, village and query', () => {
    expect(filterClients(clients, { category: 'baby' }).map((client) => client.id)).toEqual(['b1'])
    expect(filterClients(clients, { status: 'inactive' }).map((client) => client.id)).toEqual(['m2'])
    expect(filterClients(clients, { workerId: 'w1' }).map((client) => client.id)).toEqual(['m1', 'b1'])
    expect(filterClients(clients, { village: 'Alpha' }).map((client) => client.id)).toEqual(['m1', 'b1'])
    expect(filterClients(clients, { query: 'zainabu' }).map((client) => client.id)).toEqual(['m2'])
  })

  it('sorts clients by name, village, date and direction', () => {
    expect(sortClients(clients, 'name').map((client) => client.id)).toEqual(['m1', 'b1', 'm2'])
    expect(sortClients(clients, 'name', 'desc').map((client) => client.id)).toEqual(['m2', 'b1', 'm1'])
    expect(sortClients(clients, 'village').map((client) => client.village)).toEqual(['Alpha', 'Alpha', 'Beta'])
    expect(sortClients(clients, 'date').map((client) => client.id)).toEqual(['b1', 'm1', 'm2'])
  })

  it('paginates and clamps out-of-range pages', () => {
    const list = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }))
    const page = paginate(list, 3, 10)
    expect(page.items.map((item) => item.id)).toEqual([21, 22, 23, 24, 25])
    expect(page).toMatchObject({ page: 3, total: 25, totalPages: 3, from: 21, to: 25 })
    expect(paginate(list, 99, 10).page).toBe(3)
    expect(paginate(list, 1, 0).pageSize).toBe(10)
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0 })
  })

  it('collects unique sorted villages and worker clients', () => {
    expect(uniqueVillages(clients)).toEqual(['Alpha', 'Beta'])
    expect(uniqueVillages([{}, { village: '  ' }])).toEqual([])
    const assigned = clientsForWorker({
      mothers: clients.filter((client) => client.type === 'mother'),
      babies: clients.filter((client) => client.type === 'baby'),
    }, 'w1')
    expect(assigned.mothers.map((client) => client.id)).toEqual(['m1'])
    expect(assigned.babies.map((client) => client.id)).toEqual(['b1'])
  })
})

describe('deletion', () => {
  it('removes a mother, unlinks babies and forgets visit records', () => {
    const db = {
      mothers: [mother()],
      babies: [baby(), baby({ id: 'b2', motherId: null })],
      visitRecords: {
        'mother:m1::anc::anc-12': { completedDate: '2026-01-01' },
        'baby:b1::babyImmunization::epi-birth': { completedDate: '2026-01-01' },
      },
    }
    const next = deleteMotherFromDb(db, 'm1')
    expect(next.mothers).toHaveLength(0)
    expect(next.babies[0].motherId).toBeNull()
    expect(next.babies[1].motherId).toBeNull()
    expect(Object.keys(next.visitRecords)).toEqual(['baby:b1::babyImmunization::epi-birth'])
  })

  it('removes a baby and its visit records only', () => {
    const db = {
      babies: [baby()],
      visitRecords: {
        'baby:b1::babyImmunization::epi-birth': { completedDate: '2026-01-01' },
        'mother:m1::anc::anc-12': { completedDate: '2026-01-01' },
      },
    }
    const next = deleteBabyFromDb(db, 'b1')
    expect(next.babies).toHaveLength(0)
    expect(Object.keys(next.visitRecords)).toEqual(['mother:m1::anc::anc-12'])
  })
})
