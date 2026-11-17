import { describe, it, expect } from 'vitest'
import { hashPassword, passwordIssues, randomId, randomSalt, verifyPassword } from '../src/lib/crypto.js'

describe('random identifiers', () => {
  it('adds a prefix and generates unique values', () => {
    const first = randomId('mom')
    const second = randomId('mom')
    expect(first).toMatch(/^mom_/)
    expect(second).toMatch(/^mom_/)
    expect(first).not.toBe(second)
    expect(randomId()).toBeTruthy()
  })

  it('generates hexadecimal salts of the requested size', () => {
    expect(randomSalt(8)).toMatch(/^[0-9a-f]{16}$/)
    expect(randomSalt()).toMatch(/^[0-9a-f]{32}$/)
    expect(randomSalt(8)).not.toBe(randomSalt(8))
  })
})

describe('password hashing', () => {
  it('produces a self-describing PBKDF2 hash', async () => {
    const hash = await hashPassword('correct horse', 'salt', 50)
    expect(hash).toMatch(/^pbkdf2\$50\$salt\$[0-9a-f]{64}$/)
  })

  it('verifies the correct password and rejects wrong or malformed values', async () => {
    const hash = await hashPassword('demo1234', 'salt', 50)
    expect(await verifyPassword('demo1234', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
    expect(await verifyPassword('demo1234', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('demo1234', 'pbkdf2$0$salt$abc')).toBe(false)
    expect(await verifyPassword('demo1234', null)).toBe(false)
  })

  it('rejects empty passwords and invalid iteration counts', async () => {
    await expect(hashPassword('')).rejects.toThrow(/required/)
    await expect(hashPassword(null)).rejects.toThrow(/required/)
    const hash = 'pbkdf2$1$salt$' + '0'.repeat(64)
    expect(await verifyPassword('x', hash)).toBe(false)
  })

  it('reports password policy issues', () => {
    expect(passwordIssues('demo1234')).toEqual([])
    expect(passwordIssues('short1')).toContain('validation.passwordShort')
    expect(passwordIssues('12345678')).toContain('validation.passwordLetter')
    expect(passwordIssues('password')).toContain('validation.passwordNumber')
    expect(passwordIssues('')).toEqual([
      'validation.passwordShort',
      'validation.passwordLetter',
      'validation.passwordNumber',
    ])
  })
})
