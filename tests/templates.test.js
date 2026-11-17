import { describe, it, expect } from 'vitest'
import {
  buildCallScript,
  buildDedupeKey,
  buildNotificationMessage,
  fillTemplate,
  notificationMode,
} from '../src/lib/templates.js'

const client = {
  id: 'm1',
  type: 'mother',
  fullName: 'Amina Test',
  village: 'Demo Village',
  language: 'sw',
  expectedDeliveryDate: '2026-06-01',
}

const visit = {
  id: 'mother:m1::anc::anc-40',
  scheduledDate: new Date(2026, 5, 1),
  scheduledDateInput: '2026-06-01',
  name: { en: 'Antenatal contact 8 (week 40)', sw: 'Kliniki ya wajawazito 8 (wiki 40)' },
}

describe('fillTemplate', () => {
  it('replaces known placeholders and preserves unknown ones', () => {
    expect(fillTemplate('Hello {name}, on {date}', { name: 'Mama', date: '2026-01-01' }))
      .toBe('Hello Mama, on 2026-01-01')
    expect(fillTemplate('Hello {missing}', {})).toBe('Hello {missing}')
    expect(fillTemplate(null)).toBe('')
  })
})

describe('notification messages', () => {
  it('selects the correct language and client mode', () => {
    expect(notificationMode({ type: 'baby' })).toBe('baby')
    expect(notificationMode({ type: 'mother' })).toBe('preg')
    expect(notificationMode(null)).toBe('preg')
  })

  it('builds Swahili mother reminders with visit details', () => {
    const message = buildNotificationMessage(client, 'followUp', visit)
    expect(message).toContain('Kliniki ya wajawazito 8')
    expect(message).toContain('2026')
    expect(message).not.toContain('{')
  })

  it('builds English baby reminders with visit details', () => {
    const message = buildNotificationMessage(
      { ...client, type: 'baby', fullName: 'Baby Test', language: 'en' },
      'missed',
      visit,
    )
    expect(message).toContain('missed the clinic visit')
    expect(message).toContain('2026')
  })

  it('honours an explicit language override and empty clients', () => {
    const message = buildNotificationMessage(client, 'remind', visit, 'en')
    expect(message).toContain('antenatal clinic day')
    expect(buildNotificationMessage(null)).toBe('')
  })
})

describe('call scripts and deduplication', () => {
  it('builds reminder and missed-call scripts', () => {
    const reminder = buildCallScript(client, 'reminder', visit)
    expect(reminder).toContain('2026')
    expect(reminder).toContain('bonyeza 1')
    expect(buildCallScript(client, 'missed', visit)).toContain('hukuhudhuria')
    expect(buildCallScript({ ...client, language: 'en' }, 'missed', visit)).toContain('missed the clinic visit')
    expect(buildCallScript(null)).toBe('')
  })

  it('creates stable dedupe keys per client, type and visit', () => {
    expect(buildDedupeKey(client, 'remind', visit)).toBe('mother:m1:remind:2026-06-01')
    expect(buildDedupeKey(client, 'remind')).toBe('mother:m1:remind:general')
    expect(buildDedupeKey(null, 'remind', visit)).toBeNull()
  })
})
