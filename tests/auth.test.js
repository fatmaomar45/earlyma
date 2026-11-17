import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  isEmailValid,
  isPhoneValid,
  normalizePhone,
  validateWorker,
} from '../src/lib/validation.js'
import { passwordIssues, passwordStrength } from '../src/lib/crypto.js'
import { nextWorkerCode, normalizeDatabase } from '../src/lib/storage.js'
import {
  AuthApiError,
  mapRemoteUser,
  remoteLogin,
  remoteRegister,
} from '../src/lib/authApi.js'

// Configure the server before importing it (module reads config at import time).
process.env.AUTH_SECRET = 'test-secret-value'
process.env.AUTH_DATA_DIR = join(tmpdir(), `earlyma-auth-test-${Date.now()}`)
const server = await import('../server/index.mjs')

describe('email and phone validation', () => {
  it('accepts sensible emails and rejects malformed ones', () => {
    expect(isEmailValid('demo@example.com')).toBe(true)
    expect(isEmailValid('  Demo@Example.CO.UK ')).toBe(true)
    expect(isEmailValid('user.name+tag@example.co')).toBe(true)
    expect(isEmailValid('demo@example')).toBe(false)
    expect(isEmailValid('a..b@example.com')).toBe(false)
    expect(isEmailValid('.abc@example.com')).toBe(false)
    expect(isEmailValid('a b@example.com')).toBe(false)
    expect(isEmailValid('not-an-email')).toBe(false)
    expect(isEmailValid('missing@tld')).toBe(false)
  })

  it('accepts local and international numbers and rejects junk', () => {
    expect(isPhoneValid('0712 345 678')).toBe(true)
    expect(isPhoneValid('+255 (712) 345-678')).toBe(true)
    expect(isPhoneValid('0000000000')).toBe(false)
    expect(isPhoneValid('1111111111')).toBe(false)
    expect(isPhoneValid('123')).toBe(false)
    expect(isPhoneValid('')).toBe(false)
    expect(normalizePhone('+255 (712) 345-678')).toBe('+255712345678')
  })

  it('rejects a duplicate worker phone number', () => {
    const result = validateWorker(
      { fullName: 'Second Worker', phone: '0712345678', village: 'V', email: 'second@example.com' },
      { workers: [{ id: 'w1', phone: '0712 345 678', email: 'first@example.com' }] },
    )
    expect(result.errors.phone).toBe('validation.duplicatePhone')
  })
})

describe('password strength', () => {
  it('scores weak passwords low and strong passwords high', () => {
    expect(passwordStrength('').score).toBe(0)
    expect(passwordStrength('abc').valid).toBe(false)
    expect(passwordStrength('abcd1234').valid).toBe(true)
    expect(passwordStrength('Str0ng!Passw0rd').score).toBe(4)
    expect(passwordStrength('Str0ng!Passw0rd').labelKey).toBe('auth.passwordStrength.strong')
  })

  it('keeps the policy issues in the result', () => {
    const result = passwordStrength('short')
    expect(result.issues).toContain('validation.passwordShort')
    expect(passwordIssues('demo1234')).toEqual([])
  })
})

describe('storage: approval status and CHW codes', () => {
  it('defaults existing workers to active', () => {
    const db = normalizeDatabase({ workers: [{ id: 'w1', email: 'a@example.com' }] })
    expect(db.workers[0].approvalStatus).toBe('active')
  })

  it('preserves a pending approval status', () => {
    const db = normalizeDatabase({ workers: [{ id: 'w1', email: 'a@example.com', approvalStatus: 'pending' }] })
    expect(db.workers[0].approvalStatus).toBe('pending')
  })

  it('generates unique CHW codes even after deletions', () => {
    expect(nextWorkerCode([])).toBe('CHW-0001')
    expect(nextWorkerCode([{ code: 'CHW-0001' }, { code: 'CHW-0007' }])).toBe('CHW-0008')
    expect(nextWorkerCode([{ code: 'CHW-0002' }, { code: 'bad' }])).toBe('CHW-0003')
  })
})

describe('remote auth API client', () => {
  function jsonResponse(body, ok = true, status = 200) {
    return { ok, status, json: async () => body }
  }

  it('maps a server user without leaking credentials', () => {
    const mapped = mapRemoteUser({
      id: 'u1', fullName: 'Amina', email: 'a@example.com', role: 'chw', approvalStatus: 'pending', passwordHash: 'secret',
    })
    expect(mapped.role).toBe('chw')
    expect(mapped.approvalStatus).toBe('pending')
    expect(mapped.passwordHash).toBeNull()
    expect(mapped.remote).toBe(true)
  })

  it('posts credentials with cookies and returns the user', async () => {
    let captured
    const fetchImpl = async (url, options) => {
      captured = { url, options }
      return jsonResponse({ user: { id: 'u1', email: 'a@example.com' } })
    }
    const result = await remoteLogin({ email: 'a@example.com', password: 'pw' }, { fetchImpl })
    expect(result.ok).toBe(true)
    expect(captured.options.method).toBe('POST')
    expect(captured.options.credentials).toBe('include')
    expect(JSON.parse(captured.options.body)).toMatchObject({ email: 'a@example.com' })
    expect(result.user.id).toBe('u1')
  })

  it('surfaces a pending approval response', async () => {
    const fetchImpl = async () => jsonResponse({ pending: true, user: { id: 'u2' } }, true, 201)
    const result = await remoteRegister({ email: 'b@example.com' }, { fetchImpl })
    expect(result.pending).toBe(true)
    expect(result.user.id).toBe('u2')
  })

  it('maps error codes onto AuthApiError', async () => {
    const fetchImpl = async () => jsonResponse({ code: 'duplicate', error: 'duplicate' }, false, 409)
    await expect(remoteLogin({}, { fetchImpl })).rejects.toMatchObject({ code: 'duplicate' })
    const networkFetch = async () => { throw new TypeError('offline') }
    await expect(remoteLogin({}, { fetchImpl: networkFetch })).rejects.toBeInstanceOf(AuthApiError)
  })
})

describe('secure server authentication', () => {
  it('hashes and verifies passwords with scrypt', async () => {
    const hash = await server.hashPassword('correct horse')
    expect(hash).toMatch(/^scrypt\$/)
    expect(await server.verifyPassword('correct horse', hash)).toBe(true)
    expect(await server.verifyPassword('wrong', hash)).toBe(false)
    expect(await server.verifyPassword('x', 'not-a-hash')).toBe(false)
  })

  it('signs and verifies session tokens and rejects tampering/expiry', () => {
    const token = server.createSessionToken('u1')
    expect(server.verifySessionToken(token)?.uid).toBe('u1')
    expect(server.verifySessionToken(`${token}x`)).toBeNull()
    expect(server.verifySessionToken('garbage')).toBeNull()
    const expired = server.createSessionToken('u1', Date.now() - 60_000, -1)
    expect(server.verifySessionToken(expired)).toBeNull()
  })

  it('shares validation helpers with the client rules', () => {
    expect(server.isValidEmail('demo@example.com')).toBe(true)
    expect(server.isValidEmail('bad')).toBe(false)
    expect(server.isValidPhone('0712345678')).toBe(true)
    expect(server.isValidPhone('0000000000')).toBe(false)
    expect(server.nextWorkerCode([{ code: 'CHW-0003' }])).toBe('CHW-0004')
  })

  function mockReq({ method = 'GET', url = '/', body, cookie } = {}) {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const req = Readable.from(payload ? [Buffer.from(payload)] : [])
    req.method = method
    req.url = url
    req.headers = cookie ? { cookie } : {}
    return req
  }

  function mockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value },
      writeHead(status, headers) {
        this.statusCode = status
        for (const [key, value] of Object.entries(headers || {})) this.headers[String(key).toLowerCase()] = value
      },
      end(chunk) { if (chunk) this.body += chunk },
    }
  }

  async function call(method, url, body, cookie) {
    const res = mockRes()
    await server.handleRequest(mockReq({ method, url, body, cookie }), res)
    let json = {}
    try { json = JSON.parse(res.body || '{}') } catch { json = {} }
    return { status: res.statusCode, json, headers: res.headers }
  }

  function sessionCookie(res) {
    const header = res.headers['set-cookie']
    return String(header).split(';')[0]
  }

  it('registers, logs in without approval, and recovers a password end to end', async () => {
    // First account becomes the administrator and is active immediately.
    const admin = await call('POST', '/api/register', {
      fullName: 'Admin One', email: 'admin@example.com', phone: '0700000001',
      village: 'Demo Village', facility: 'Clinic', password: 'Admin12345',
    })
    expect(admin.status).toBe(201)
    expect(admin.json.user.role).toBe('admin')
    expect(admin.json.user.approvalStatus).toBe('active')
    expect(admin.json.user.code).toBe('CHW-0001')
    expect(admin.json.user.passwordHash).toBeUndefined()

    // Subsequent CHWs self-register and are active immediately (no approval).
    const chw = await call('POST', '/api/register', {
      fullName: 'CHW Two', email: 'chw@example.com', phone: '0700000002',
      village: 'Demo Village', facility: 'Clinic', password: 'Chw123456',
    })
    expect(chw.status).toBe(201)
    expect(chw.json.pending).toBeUndefined()
    expect(chw.json.user.approvalStatus).toBe('active')

    // Duplicate accounts are rejected.
    const duplicate = await call('POST', '/api/register', {
      fullName: 'CHW Two Again', email: 'CHW@example.com', phone: '0700000009',
      village: 'Demo Village', password: 'Chw123456',
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.json.code).toBe('duplicate')

    // The CHW can sign in straight away and read /api/me.
    const chwLogin = await call('POST', '/api/login', { email: 'chw@example.com', password: 'Chw123456' })
    expect(chwLogin.status).toBe(200)
    const chwCookie = sessionCookie(chwLogin)
    const me = await call('GET', '/api/me', undefined, chwCookie)
    expect(me.status).toBe(200)
    expect(me.json.user.email).toBe('chw@example.com')

    // Admin can also sign in.
    const adminLogin = await call('POST', '/api/login', { email: 'admin@example.com', password: 'Admin12345' })
    expect(adminLogin.status).toBe(200)

    // Recovery with matching email + phone sets a new password.
    const recover = await call('POST', '/api/recover', {
      email: 'chw@example.com', phone: '0700000002', password: 'NewPass123',
    })
    expect(recover.status).toBe(200)
    const oldLogin = await call('POST', '/api/login', { email: 'chw@example.com', password: 'Chw123456' })
    expect(oldLogin.status).toBe(401)
    const newLogin = await call('POST', '/api/login', { email: 'chw@example.com', password: 'NewPass123' })
    expect(newLogin.status).toBe(200)

    // Unauthenticated requests are rejected.
    const noMe = await call('GET', '/api/me')
    expect(noMe.status).toBe(401)
  })
})