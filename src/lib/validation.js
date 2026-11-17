import { parseDate, startOfToday } from './dates.js'

export const MOTHER_STATUSES = ['pregnant', 'postnatal', 'inactive']
export const BABY_SEXES = ['female', 'male', 'unknown']
export const WORKER_ROLES = ['admin', 'chw']
export const LANGUAGES = ['en', 'sw']

const MAX_NAME = 120
const MAX_TEXT = 1000
const MAX_ADDRESS = 240

export function cleanText(value, maxLength = MAX_TEXT) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function cleanMultiline(value, maxLength = MAX_TEXT) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\r\n/g, '\n').trim().slice(0, maxLength)
}

export function normalizeName(value) {
  return cleanText(value, MAX_NAME)
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
}

/** Strip spaces, dashes and brackets; keep an optional leading +. */
export function normalizePhone(value) {
  if (value === null || value === undefined) return ''
  const raw = String(value).trim()
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/\D/g, '')
  return `${plus}${digits}`
}

export function isPhoneValid(value) {
  const phone = normalizePhone(value)
  const digits = phone.startsWith('+') ? phone.slice(1) : phone
  if (!/^\d{9,15}$/.test(digits)) return false
  // Reject obviously invalid numbers such as 0000000000 or 1111111111.
  if (/^(\d)\1+$/.test(digits)) return false
  return true
}

export function isEmailValid(value) {
  const email = normalizeEmail(value)
  if (!email || email.length > 160) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || !domain || local.length > 64) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[a-z0-9._%+-]+$/.test(local)) return false
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return false
  return true
}

export function normalizeEmail(value) {
  return cleanText(value, 160).toLowerCase()
}

function required(value) {
  return cleanText(value).length > 0
}

function validOptionalNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return true
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

export function normalizeMotherInput(input = {}) {
  const today = startOfToday()
  return {
    fullName: cleanText(input.fullName ?? input.label, MAX_NAME),
    age: input.age === '' || input.age === null || input.age === undefined ? '' : Number(input.age),
    phone: normalizePhone(input.phone),
    village: cleanText(input.village, 80),
    address: cleanMultiline(input.address, MAX_ADDRESS),
    expectedDeliveryDate: cleanText(input.expectedDeliveryDate ?? input.date, 10),
    registrationDate: cleanText(input.registrationDate, 10),
    workerId: input.workerId || null,
    status: MOTHER_STATUSES.includes(input.status) ? input.status : 'pregnant',
    actualDeliveryDate: cleanText(input.actualDeliveryDate, 10),
    language: LANGUAGES.includes(input.language ?? input.lang) ? (input.language ?? input.lang) : 'sw',
    consentReminders: Boolean(input.consentReminders),
    notes: cleanMultiline(input.notes),
    today,
  }
}

export function normalizeBabyInput(input = {}) {
  return {
    fullName: cleanText(input.fullName ?? input.label, MAX_NAME),
    motherId: input.motherId || null,
    motherName: cleanText(input.motherName, MAX_NAME),
    dateOfBirth: cleanText(input.dateOfBirth ?? input.date, 10),
    sex: BABY_SEXES.includes(input.sex) ? input.sex : 'unknown',
    birthWeightKg: input.birthWeightKg === '' || input.birthWeightKg === null || input.birthWeightKg === undefined ? '' : Number(input.birthWeightKg),
    currentWeightKg: input.currentWeightKg === '' || input.currentWeightKg === null || input.currentWeightKg === undefined ? '' : Number(input.currentWeightKg),
    village: cleanText(input.village, 80),
    workerId: input.workerId || null,
    notes: cleanMultiline(input.notes),
    immunizations: Array.isArray(input.immunizations) ? input.immunizations.slice(0, 50) : [],
    language: LANGUAGES.includes(input.language ?? input.lang) ? (input.language ?? input.lang) : 'sw',
    consentReminders: Boolean(input.consentReminders),
  }
}

export function validateMother(input, context = {}) {
  const value = normalizeMotherInput(input)
  const errors = {}
  const today = context.today ?? startOfToday()

  if (!required(value.fullName)) errors.fullName = 'validation.required'
  else if (value.fullName.length < 2) errors.fullName = 'validation.name'

  if (value.age === '' || value.age === null) errors.age = 'validation.required'
  else if (!Number.isFinite(value.age) || value.age < 10 || value.age > 60) errors.age = 'validation.age'

  if (!value.phone) errors.phone = 'validation.required'
  else if (!isPhoneValid(value.phone)) errors.phone = 'validation.phone'

  if (!value.village) errors.village = 'validation.required'

  const edd = parseDate(value.expectedDeliveryDate)
  if (!value.expectedDeliveryDate) errors.expectedDeliveryDate = 'validation.required'
  else if (!edd) errors.expectedDeliveryDate = 'validation.date'
  else if (edd.getFullYear() < today.getFullYear() - 2 || edd.getFullYear() > today.getFullYear() + 2) {
    errors.expectedDeliveryDate = 'validation.eddRange'
  }

  const registrationDate = parseDate(value.registrationDate)
  if (!value.registrationDate) errors.registrationDate = 'validation.required'
  else if (!registrationDate) errors.registrationDate = 'validation.date'
  else if (registrationDate > today) errors.registrationDate = 'validation.dateFuture'

  if (value.actualDeliveryDate) {
    const deliveryDate = parseDate(value.actualDeliveryDate)
    if (!deliveryDate) errors.actualDeliveryDate = 'validation.date'
    else if (deliveryDate > today) errors.actualDeliveryDate = 'validation.dateFuture'
  }

  if (value.status === 'postnatal' && value.actualDeliveryDate) {
    const deliveryDate = parseDate(value.actualDeliveryDate)
    const registrationDate = parseDate(value.registrationDate)
    if (deliveryDate && registrationDate && deliveryDate < registrationDate) {
      errors.actualDeliveryDate = 'validation.deliveryBeforeRegistration'
    }
  }

  if (value.notes.length >= MAX_TEXT) errors.notes = 'validation.tooLong'

  if (!context.skipDuplicates && Array.isArray(context.mothers)) {
    const duplicate = findDuplicateMother(context.mothers, value, context.excludeId)
    if (duplicate) errors.duplicate = 'validation.duplicateMother'
  }

  return { valid: Object.keys(errors).length === 0, errors, value }
}

export function validateBaby(input, context = {}) {
  const value = normalizeBabyInput(input)
  const errors = {}
  const today = context.today ?? startOfToday()

  if (!required(value.fullName)) errors.fullName = 'validation.required'
  else if (value.fullName.length < 2) errors.fullName = 'validation.name'

  if (!value.motherName) errors.motherName = 'validation.required'

  const dob = parseDate(value.dateOfBirth)
  if (!value.dateOfBirth) errors.dateOfBirth = 'validation.required'
  else if (!dob) errors.dateOfBirth = 'validation.date'
  else if (dob > today) errors.dateOfBirth = 'validation.dateFuture'
  else if (dob.getFullYear() < today.getFullYear() - 18) errors.dateOfBirth = 'validation.dobRange'

  if (!value.village) errors.village = 'validation.required'
  if (!validOptionalNumber(value.birthWeightKg, 0.3, 8)) errors.birthWeightKg = 'validation.weight'
  if (!validOptionalNumber(value.currentWeightKg, 0.3, 50)) errors.currentWeightKg = 'validation.weightCurrent'

  if (value.notes.length >= MAX_TEXT) errors.notes = 'validation.tooLong'

  if (!context.skipDuplicates && Array.isArray(context.babies)) {
    const duplicate = findDuplicateBaby(context.babies, value, context.excludeId)
    if (duplicate) errors.duplicate = 'validation.duplicateBaby'
  }

  return { valid: Object.keys(errors).length === 0, errors, value }
}

export function validateWorker(input, context = {}) {
  const value = {
    fullName: cleanText(input.fullName ?? input.name, MAX_NAME),
    phone: normalizePhone(input.phone),
    village: cleanText(input.village, 80),
    facility: cleanText(input.facility, 120),
    email: normalizeEmail(input.email),
    role: WORKER_ROLES.includes(input.role) ? input.role : 'chw',
    active: input.active === undefined ? true : Boolean(input.active),
    notes: cleanMultiline(input.notes),
  }

  const errors = {}
  if (!value.fullName) errors.fullName = 'validation.required'
  else if (value.fullName.length < 2) errors.fullName = 'validation.name'
  if (!value.phone) errors.phone = 'validation.required'
  else if (!isPhoneValid(value.phone)) errors.phone = 'validation.phone'
  if (!value.village) errors.village = 'validation.required'
  if (!value.email) errors.email = 'validation.required'
  else if (!isEmailValid(value.email)) errors.email = 'validation.email'

  if (Array.isArray(context.workers)) {
    const duplicate = context.workers.find((worker) => (
      worker.id !== context.excludeId &&
      normalizeEmail(worker.email) === value.email
    ))
    if (duplicate) errors.email = 'validation.duplicateEmail'

    const duplicatePhone = context.workers.find((worker) => (
      worker.id !== context.excludeId &&
      value.phone &&
      normalizePhone(worker.phone) === value.phone
    ))
    if (duplicatePhone) errors.phone = 'validation.duplicatePhone'
  }

  return { valid: Object.keys(errors).length === 0, errors, value }
}

export function findDuplicateMother(mothers = [], candidate = {}, excludeId = null) {
  const name = normalizeName(candidate.fullName)
  const phone = normalizePhone(candidate.phone)
  const village = normalizeName(candidate.village)
  if (!name && !phone) return null

  return mothers.find((mother) => {
    if (!mother || mother.id === excludeId) return false
    const otherName = normalizeName(mother.fullName)
    const otherPhone = normalizePhone(mother.phone)
    const otherVillage = normalizeName(mother.village)
    if (phone && otherPhone && phone === otherPhone) return true
    return Boolean(name && otherName && name === otherName && village && otherVillage && village === otherVillage)
  }) ?? null
}

export function findDuplicateBaby(babies = [], candidate = {}, excludeId = null) {
  const name = normalizeName(candidate.fullName)
  const dob = cleanText(candidate.dateOfBirth, 10)
  const motherId = candidate.motherId || null
  const motherName = normalizeName(candidate.motherName)
  if (!name || !dob) return null

  return babies.find((baby) => {
    if (!baby || baby.id === excludeId) return false
    if (normalizeName(baby.fullName) !== name) return false
    if (cleanText(baby.dateOfBirth, 10) !== dob) return false
    if (motherId && baby.motherId) return motherId === baby.motherId
    return normalizeName(baby.motherName) === motherName
  }) ?? null
}

export function validateNotificationDraft({ phone, message } = {}) {
  const errors = {}
  const text = typeof message === 'string' ? message.replace(/\r\n/g, '\n').trim() : ''
  if (!isPhoneValid(phone)) errors.phone = 'validation.phone'
  if (!text) errors.message = 'validation.required'
  else if (text.length > 1000) errors.message = 'validation.tooLong'
  return { valid: Object.keys(errors).length === 0, errors }
}
