import { describe, it, expect } from 'vitest'
import {
  createTranslator,
  LANGUAGES,
  localeFor,
  missingTranslationKeys,
  translate,
  translationKeys,
  translations,
} from '../src/lib/i18n.js'

describe('translations', () => {
  it('keeps English and Swahili in exact parity', () => {
    expect(missingTranslationKeys()).toEqual({ missingInSwahili: [], missingInEnglish: [] })
    const keys = translationKeys()
    expect(keys.en).toEqual(keys.sw)
    expect(keys.en.length).toBeGreaterThan(100)
  })

  it('contains no empty strings', () => {
    for (const language of ['en', 'sw']) {
      for (const [key, value] of Object.entries(translations[language])) {
        expect(value, `${language}.${key}`).toBeTypeOf('string')
        expect(value.trim().length, `${language}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('translates keys and interpolates variables', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard')
    expect(translate('sw', 'nav.dashboard')).not.toBe('Dashboard')
    expect(translate('en', 'common.showing', { from: 1, to: 10, total: 25 })).toBe('Showing 1–10 of 25')
    expect(translate('sw', 'common.showing', { from: 1, to: 10, total: 25 })).toContain('25')
  })

  it('falls back to English and then the key itself', () => {
    expect(translate('xx', 'nav.dashboard')).toBe('Dashboard')
    expect(translate('en', 'missing.key')).toBe('missing.key')
  })

  it('creates bound translators', () => {
    const t = createTranslator('sw')
    expect(t('nav.babies')).toBe(translations.sw['nav.babies'])
    expect(t('common.showing', { from: 2, to: 3, total: 3 })).toContain('2')
  })

  it('maps languages to Intl locales', () => {
    expect(LANGUAGES.map((language) => language.value)).toEqual(['en', 'sw'])
    expect(localeFor('sw')).toBe('sw-KE')
    expect(localeFor('en')).toBe('en-GB')
    expect(localeFor('unknown')).toBe('en-GB')
  })
})
