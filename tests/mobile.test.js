import { describe, it, expect } from 'vitest'
import { translate, translations } from '../src/lib/i18n.js'

const REQUIRED_KEYS = [
  'sync.online',
  'sync.offline',
  'sync.syncing',
  'sync.error',
  'sync.errorHint',
  'dashboard.upcoming',
  'dashboard.mothersFollowUp',
  'dashboard.babiesFollowUp',
  'dashboard.followUpTotal',
  'dashboard.recordVisit',
  'dashboard.scheduleFollowUp',
  'dashboard.contactClient',
  'dashboard.todayTasks',
  'dashboard.quickActionsHint',
  'nav.more',
]

describe('mobile section 21 copy', () => {
  it('defines every required label in both English and Swahili', () => {
    for (const language of ['en', 'sw']) {
      for (const key of REQUIRED_KEYS) {
        expect(translations[language][key], `${language}.${key}`).toBeTypeOf('string')
        expect(translations[language][key].trim().length, `${language}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('distinguishes queued reminders from delivered ones', () => {
    expect(translate('en', 'notifications.status.queued')).not.toBe(translate('en', 'notifications.status.delivered'))
    expect(translate('sw', 'notifications.status.queued')).not.toBe(translate('sw', 'notifications.status.delivered'))
  })

  it('exposes all four connection states with distinct labels', () => {
    const labels = ['sync.online', 'sync.offline', 'sync.syncing', 'sync.error'].map((key) => translate('en', key))
    expect(new Set(labels).size).toBe(4)
    const swLabels = ['sync.online', 'sync.offline', 'sync.syncing', 'sync.error'].map((key) => translate('sw', key))
    expect(new Set(swLabels).size).toBe(4)
  })
})