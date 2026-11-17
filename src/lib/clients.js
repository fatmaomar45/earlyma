import { randomId } from './crypto.js'
import { parseDate, startOfToday, toInput } from './dates.js'
import { cleanMultiline, cleanText, normalizeBabyInput, normalizeMotherInput, normalizeName, normalizePhone } from './validation.js'

export const PAGE_SIZE_DEFAULT = 10

export function clientName(client) {
  return cleanText(client?.fullName ?? client?.label ?? '', 120) || '—'
}

export function clientPhone(client) {
  return normalizePhone(client?.phone)
}

export function clientAnchorDate(client) {
  if (!client) return null
  return parseDate(client.type === 'baby' ? client.dateOfBirth : client.expectedDeliveryDate)
}

export function nextClientCode(existing = [], prefix = 'M') {
  const pattern = new RegExp(`^${prefix}-(\\d{4})$`)
  const highest = existing.reduce((max, client) => {
    const match = pattern.exec(client?.code ?? '')
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}

export function createMother(input = {}, options = {}) {
  const now = options.now ?? new Date()
  const value = normalizeMotherInput(input)
  const mothers = options.existingMothers ?? []
  return {
    id: options.id ?? randomId('mom'),
    type: 'mother',
    code: cleanText(input.code, 20) || nextClientCode(mothers, 'M'),
    fullName: value.fullName,
    age: value.age,
    phone: value.phone,
    village: value.village,
    address: value.address,
    expectedDeliveryDate: value.expectedDeliveryDate,
    registrationDate: value.registrationDate || toInput(now),
    actualDeliveryDate: value.actualDeliveryDate,
    workerId: value.workerId,
    status: value.status,
    language: value.language,
    consentReminders: value.consentReminders,
    notes: value.notes,
    isDemo: Boolean(options.demo ?? input.isDemo),
    createdAt: (now instanceof Date ? now : new Date()).toISOString(),
    updatedAt: (now instanceof Date ? now : new Date()).toISOString(),
  }
}

export function updateMother(existing, patch = {}, now = new Date()) {
  if (!existing) return null
  const merged = { ...existing, ...patch }
  const value = normalizeMotherInput(merged)
  return {
    ...existing,
    age: value.age,
    expectedDeliveryDate: value.expectedDeliveryDate,
    fullName: value.fullName,
    phone: value.phone,
    village: value.village,
    address: value.address,
    registrationDate: value.registrationDate,
    actualDeliveryDate: value.actualDeliveryDate,
    status: value.status,
    language: value.language,
    consentReminders: value.consentReminders,
    notes: value.notes,
    workerId: value.workerId,
    updatedAt: now.toISOString(),
  }
}

export function createBaby(input = {}, options = {}) {
  const now = options.now ?? new Date()
  const value = normalizeBabyInput(input)
  const babies = options.existingBabies ?? []
  return {
    id: options.id ?? randomId('baby'),
    type: 'baby',
    code: cleanText(input.code, 20) || nextClientCode(babies, 'B'),
    fullName: value.fullName,
    motherId: value.motherId,
    motherName: value.motherName,
    dateOfBirth: value.dateOfBirth,
    sex: value.sex,
    birthWeightKg: value.birthWeightKg,
    currentWeightKg: value.currentWeightKg,
    village: value.village,
    workerId: value.workerId,
    notes: value.notes,
    language: value.language,
    consentReminders: value.consentReminders,
    immunizations: Array.isArray(input.immunizations) ? input.immunizations : [],
    growthRecords: Array.isArray(input.growthRecords) ? input.growthRecords : [],
    isDemo: Boolean(options.demo ?? input.isDemo),
    createdAt: (now instanceof Date ? now : new Date()).toISOString(),
    updatedAt: (now instanceof Date ? now : new Date()).toISOString(),
  }
}

export function updateBaby(existing, patch = {}, now = new Date()) {
  if (!existing) return null
  const merged = { ...existing, ...patch }
  const value = normalizeBabyInput(merged)
  return {
    ...existing,
    ...value,
    birthWeightKg: value.birthWeightKg,
    currentWeightKg: value.currentWeightKg,
    fullName: value.fullName,
    motherId: value.motherId,
    motherName: value.motherName,
    dateOfBirth: value.dateOfBirth,
    sex: value.sex,
    village: value.village,
    workerId: value.workerId,
    notes: value.notes,
    immunizations: Array.isArray(merged.immunizations) ? merged.immunizations : [],
    growthRecords: Array.isArray(merged.growthRecords) ? merged.growthRecords : [],
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  }
}

export function addGrowthRecord(baby, record = {}, now = new Date()) {
  if (!baby) return null
  const weight = Number(record.weightKg)
  const height = Number(record.heightCm)
  const entry = {
    id: randomId('growth'),
    date: cleanText(record.date, 10) || toInput(now),
    weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    heightCm: Number.isFinite(height) && height > 0 ? height : null,
    notes: cleanMultiline(record.notes, 500),
    createdAt: now.toISOString(),
  }
  return {
    ...baby,
    currentWeightKg: entry.weightKg ?? baby.currentWeightKg,
    growthRecords: [entry, ...(Array.isArray(baby.growthRecords) ? baby.growthRecords : [])],
    updatedAt: now.toISOString(),
  }
}

export function normalizeSearchQuery(value) {
  return cleanText(value, 80).toLocaleLowerCase()
}

export function matchesQuery(client, query) {
  const needle = normalizeSearchQuery(query)
  if (!needle) return true
  const haystack = [
    client?.fullName,
    client?.label,
    client?.code,
    client?.phone,
    normalizePhone(client?.phone),
    client?.village,
    client?.motherName,
    client?.address,
    client?.notes,
  ].filter(Boolean).join(' ').toLocaleLowerCase()
  return needle.split(/\s+/).every((part) => haystack.includes(part))
}

export function filterClients(list = [], filters = {}) {
  const { query = '', village = '', status = '', workerId = '', category = 'all' } = filters
  return (Array.isArray(list) ? list : []).filter((client) => {
    if (category && category !== 'all' && client.type !== category) return false
    if (workerId && client.workerId !== workerId) return false
    if (village && client.village !== village) return false
    if (status) {
      const clientStatus = client.type === 'baby' ? babyStatus(client) : motherStatus(client)
      if (clientStatus !== status) return false
    }
    if (!matchesQuery(client, query)) return false
    return true
  })
}

export function motherStatus(mother) {
  if (!mother) return 'unknown'
  if (mother.status === 'inactive') return 'inactive'
  if (mother.status === 'postnatal' || mother.actualDeliveryDate) {
    return new Date(mother.actualDeliveryDate || mother.expectedDeliveryDate) <= new Date() ? 'postnatal' : 'pregnant'
  }
  return 'pregnant'
}

export function babyStatus(baby) {
  if (!baby) return 'unknown'
  if (baby.status === 'inactive') return 'inactive'
  return 'active'
}

export function sortClients(list = [], sortKey = 'name', direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1
  const copy = [...(Array.isArray(list) ? list : [])]
  const valueFor = (client) => {
    switch (sortKey) {
      case 'village': return normalizeName(client.village)
      case 'date': return clientAnchorDate(client)?.getTime() ?? 0
      case 'created': return new Date(client.createdAt || 0).getTime()
      case 'phone': return normalizePhone(client.phone)
      case 'status': return client.type === 'baby' ? babyStatus(client) : motherStatus(client)
      case 'name':
      default: return normalizeName(clientName(client))
    }
  }
  return copy.sort((a, b) => {
    const left = valueFor(a)
    const right = valueFor(b)
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left).localeCompare(String(right)) * factor
  })
}

export function paginate(list = [], page = 1, pageSize = PAGE_SIZE_DEFAULT) {
  const total = Array.isArray(list) ? list.length : 0
  const size = Math.max(1, Math.trunc(Number(pageSize) || PAGE_SIZE_DEFAULT))
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, Math.trunc(Number(page) || 1)), totalPages)
  const start = (currentPage - 1) * size
  return {
    items: (list ?? []).slice(start, start + size),
    page: currentPage,
    pageSize: size,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  }
}

export function deleteMotherFromDb(db, motherId) {
  const babies = (db.babies ?? []).map((baby) => (
    baby.motherId === motherId ? { ...baby, motherId: null, updatedAt: new Date().toISOString() } : baby
  ))
  return {
    ...db,
    mothers: (db.mothers ?? []).filter((mother) => mother.id !== motherId),
    babies,
    visitRecords: Object.fromEntries(
      Object.entries(db.visitRecords ?? {}).filter(([key]) => !key.startsWith(`mother:${motherId}::`)),
    ),
  }
}

export function deleteBabyFromDb(db, babyId) {
  return {
    ...db,
    babies: (db.babies ?? []).filter((baby) => baby.id !== babyId),
    visitRecords: Object.fromEntries(
      Object.entries(db.visitRecords ?? {}).filter(([key]) => !key.startsWith(`baby:${babyId}::`)),
    ),
  }
}

export function uniqueVillages(clients = []) {
  return [...new Set((clients ?? []).map((client) => cleanText(client.village, 80)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}

export function clientsForWorker(db, workerId) {
  return {
    mothers: (db.mothers ?? []).filter((mother) => mother.workerId === workerId),
    babies: (db.babies ?? []).filter((baby) => baby.workerId === workerId),
  }
}

export function defaultRegistrationDate(now = new Date()) {
  return toInput(startOfToday(now))
}
