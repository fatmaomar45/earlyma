import { describe, it, expect } from 'vitest'
import {
  cleanMultiline,
  cleanText,
  findDuplicateBaby,
  findDuplicateMother,
  isEmailValid,
  isPhoneValid,
  normalizeBabyInput,
  normalizeEmail,
  normalizeMotherInput,
  normalizeName,
  normalizePhone,
  validateBaby,
  validateMother,
  validateNotificationDraft,
  validateWorker,
} from '../src/lib/validation.js'

const today = new Date(2026, 5, 1)

function validMother(overrides = {}) {
  return {
    fullName: 'Amina Test',
    age: 24,
    phone: '0712 345 678',
    village: 'Demo Village',
    expectedDeliveryDate: '2026-12-01',
    registrationDate: '2026-01-01',
    status: 'pregnant',
    ...overrides,
  }
}

function validBaby(overrides = {}) {
  return {
    fullName: 'Baby Test',
    motherName: 'Amina Test',
    dateOfBirth: '2026-01-01',
    village: 'Demo Village',
    birthWeightKg: 3.2,
    currentWeightKg: 4.1,
    ...overrides,
  }
}

describe('text normalisation', () => {
  it('collapses whitespace and enforces a maximum length', () => {
    expect(cleanText('  Amina   Test  ')).toBe('Amina Test')
    expect(cleanText(null)).toBe('')
    expect(cleanText('abcdef', 3)).toBe('abc')
  })

  it('preserves line breaks in multiline text', () => {
    expect(cleanMultiline('  first\r\nsecond  ')).toBe('first\nsecond')
    expect(cleanMultiline(undefined)).toBe('')
  })

  it('normalises names for duplicate detection', () => {
    expect(normalizeName('  Ámïna   O’Brien ')).toBe('amina obrien')
    expect(normalizeName(null)).toBe('')
  })

  it('normalises email addresses', () => {
    expect(normalizeEmail('  Demo@Example.COM ')).toBe('demo@example.com')
    expect(isEmailValid('demo@example.com')).toBe(true)
    expect(isEmailValid('demo@example')).toBe(false)
    expect(isEmailValid('not-an-email')).toBe(false)
  })
})

describe('phone normalisation', () => {
  it('strips spaces, dashes and brackets but keeps a leading plus', () => {
    expect(normalizePhone('0712 345 678')).toBe('0712345678')
    expect(normalizePhone('+255 (712) 345-678')).toBe('+255712345678')
    expect(normalizePhone(null)).toBe('')
  })

  it('validates 9 to 15 digits', () => {
    expect(isPhoneValid('0712 345 678')).toBe(true)
    expect(isPhoneValid('+255712345678')).toBe(true)
    expect(isPhoneValid('123')).toBe(false)
    expect(isPhoneValid('')).toBe(false)
    expect(isPhoneValid('+')).toBe(false)
  })
})

describe('mother input', () => {
  it('applies safe defaults', () => {
    const value = normalizeMotherInput({ label: 'Mama', date: '2026-03-01' })
    expect(value.fullName).toBe('Mama')
    expect(value.expectedDeliveryDate).toBe('2026-03-01')
    expect(value.language).toBe('sw')
    expect(value.status).toBe('pregnant')
    expect(value.phone).toBe('')
  })

  it('accepts a valid mother', () => {
    const result = validateMother(validMother(), { today })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.value.phone).toBe('0712345678')
  })

  it('reports required and range errors', () => {
    const result = validateMother({}, { today })
    expect(result.valid).toBe(false)
    expect(result.errors.fullName).toBe('validation.required')
    expect(result.errors.age).toBe('validation.required')
    expect(result.errors.phone).toBe('validation.required')
    expect(result.errors.village).toBe('validation.required')
    expect(result.errors.expectedDeliveryDate).toBe('validation.required')
    expect(result.errors.registrationDate).toBe('validation.required')
  })

  it('rejects implausible ages and invalid phones', () => {
    const result = validateMother(validMother({ age: 5, phone: '123' }), { today })
    expect(result.errors.age).toBe('validation.age')
    expect(result.errors.phone).toBe('validation.phone')
  })

  it('rejects dates outside the allowed ranges', () => {
    expect(validateMother(validMother({ expectedDeliveryDate: '2029-01-01' }), { today }).errors.expectedDeliveryDate)
      .toBe('validation.eddRange')
    expect(validateMother(validMother({ registrationDate: '2026-06-02' }), { today }).errors.registrationDate)
      .toBe('validation.dateFuture')
    expect(validateMother(validMother({ expectedDeliveryDate: '2026-02-30' }), { today }).errors.expectedDeliveryDate)
      .toBe('validation.date')
  })

  it('rejects a delivery before registration', () => {
    const result = validateMother(validMother({
      status: 'postnatal',
      registrationDate: '2026-03-01',
      actualDeliveryDate: '2026-02-01',
    }), { today })
    expect(result.errors.actualDeliveryDate).toBe('validation.deliveryBeforeRegistration')
  })

  it('detects duplicates by phone and by name plus village', () => {
    const mothers = [validMother({ id: 'm1' })]
    expect(validateMother(validMother({ fullName: 'Someone Else' }), { today, mothers }).errors.duplicate)
      .toBe('validation.duplicateMother')
    expect(validateMother(validMother({ phone: '0700000000' }), { today, mothers }).errors.duplicate)
      .toBe('validation.duplicateMother')
    expect(validateMother(validMother(), { today, mothers, excludeId: 'm1' }).valid).toBe(true)
    expect(validateMother(validMother(), { today, mothers, skipDuplicates: true }).valid).toBe(true)
  })

  it('finds duplicates with an exclusion list', () => {
    const mothers = [
      { id: 'm1', fullName: 'Amina Test', phone: '0712345678', village: 'Demo Village' },
      { id: 'm2', fullName: 'Other', phone: '0799999999', village: 'Other' },
    ]
    expect(findDuplicateMother(mothers, { fullName: 'Amina Test' }, 'm1')).toBeNull()
    expect(findDuplicateMother(mothers, { fullName: 'Amina Test', village: 'Demo Village' })).toBe(mothers[0])
    expect(findDuplicateMother([], {})).toBeNull()
  })
})

describe('baby input', () => {
  it('applies safe defaults', () => {
    const value = normalizeBabyInput({})
    expect(value.sex).toBe('unknown')
    expect(value.language).toBe('sw')
    expect(value.immunizations).toEqual([])
  })

  it('accepts a valid baby', () => {
    const result = validateBaby(validBaby(), { today })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('reports required, date and weight errors', () => {
    const result = validateBaby({}, { today })
    expect(result.errors.fullName).toBe('validation.required')
    expect(result.errors.motherName).toBe('validation.required')
    expect(result.errors.dateOfBirth).toBe('validation.required')
    expect(result.errors.village).toBe('validation.required')

    expect(validateBaby(validBaby({ dateOfBirth: '2026-06-02' }), { today }).errors.dateOfBirth)
      .toBe('validation.dateFuture')
    expect(validateBaby(validBaby({ dateOfBirth: '2000-01-01' }), { today }).errors.dateOfBirth)
      .toBe('validation.dobRange')
    expect(validateBaby(validBaby({ birthWeightKg: 0.1 }), { today }).errors.birthWeightKg)
      .toBe('validation.weight')
    expect(validateBaby(validBaby({ currentWeightKg: 60 }), { today }).errors.currentWeightKg)
      .toBe('validation.weightCurrent')
  })

  it('detects duplicate babies by name, date and mother', () => {
    const babies = [{ id: 'b1', fullName: 'Baby Test', dateOfBirth: '2026-01-01', motherName: 'Amina Test' }]
    expect(validateBaby(validBaby(), { today, babies }).errors.duplicate).toBe('validation.duplicateBaby')
    expect(validateBaby(validBaby(), { today, babies, excludeId: 'b1' }).valid).toBe(true)
    expect(findDuplicateBaby(babies, { fullName: 'Baby Test', dateOfBirth: '2026-01-01', motherName: 'Amina Test' }))
      .toBe(babies[0])
    expect(findDuplicateBaby(babies, { fullName: 'Baby Test' })).toBeNull()
  })
})

describe('worker validation', () => {
  it('accepts a valid worker and normalises fields', () => {
    const result = validateWorker({
      fullName: '  Worker One ',
      phone: '+255 700 111 222',
      village: 'Demo Village',
      email: ' WORKER@Example.com ',
      role: 'chw',
    })
    expect(result.valid).toBe(true)
    expect(result.value.email).toBe('worker@example.com')
    expect(result.value.phone).toBe('+255700111222')
    expect(result.value.role).toBe('chw')
    expect(result.value.active).toBe(true)
  })

  it('reports invalid and duplicate emails', () => {
    const result = validateWorker({ fullName: 'W', phone: '1', village: '', email: 'bad' })
    expect(result.errors.fullName).toBe('validation.name')
    expect(result.errors.phone).toBe('validation.phone')
    expect(result.errors.village).toBe('validation.required')
    expect(result.errors.email).toBe('validation.email')

    const duplicate = validateWorker(
      { fullName: 'Worker Two', phone: '0712345678', village: 'V', email: 'worker@example.com' },
      { workers: [{ id: 'w1', email: 'worker@example.com' }] },
    )
    expect(duplicate.errors.email).toBe('validation.duplicateEmail')
  })
})

describe('notification drafts', () => {
  it('validates phone and message content', () => {
    expect(validateNotificationDraft({ phone: '0712345678', message: 'Hello' }).valid).toBe(true)
    expect(validateNotificationDraft({ phone: '1', message: '' }).errors)
      .toEqual({ phone: 'validation.phone', message: 'validation.required' })
    expect(validateNotificationDraft({ phone: '0712345678', message: 'x'.repeat(1001) }).errors.message)
      .toBe('validation.tooLong')
  })
})
