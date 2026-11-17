// Earlyma secure authentication server (reference implementation).
//
// This is a real, dependency-free Node server that owns credentials and
// sessions. The browser app (VITE_AUTH_API_URL) delegates login/registration to
// it and only mirrors the returned profile. Passwords are hashed with scrypt,
// sessions are HMAC-signed and stored in an HttpOnly, SameSite cookie, and new
// CHW accounts require administrator approval.
//
// Run with:  npm run server   (PORT, AUTH_SECRET, AUTH_ALLOWED_ORIGIN, AUTH_DATA_DIR)
//
// This file exports its pure helpers so they can be unit-tested without opening
// a socket. It only listens when executed directly.

import { createServer } from 'node:http'
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.AUTH_DATA_DIR || join(__dirname, 'data')
const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, '..', 'dist')
const DATA_FILE = join(DATA_DIR, 'db.json')
const SECRET_FILE = join(DATA_DIR, 'secret')
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL || 12 * 60 * 60)
const PORT = Number(process.env.PORT || 3001)
const COOKIE_NAME = 'earlyma_session'

// ---------------------------------------------------------------------------
// Configuration / secrets (lazy so importing this module has no side effects)
// ---------------------------------------------------------------------------

let cachedSecret = null

export function getSecret() {
  if (cachedSecret) return cachedSecret
  if (process.env.AUTH_SECRET) {
    cachedSecret = process.env.AUTH_SECRET
    return cachedSecret
  }
  try {
    if (existsSync(SECRET_FILE)) {
      cachedSecret = readFileSync(SECRET_FILE, 'utf8').trim()
      return cachedSecret
    }
  } catch {
    // fall through and generate a new secret
  }
  const secret = randomBytes(32).toString('hex')
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(SECRET_FILE, secret, { mode: 0o600 })
  } catch {
    // If the data directory is read-only, keep the in-memory secret.
  }
  cachedSecret = secret
  return cachedSecret
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 32

function scrypt(password, salt, keylen = SCRYPT_KEYLEN) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required.')
  }
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string' || typeof password !== 'string') return false
  const [scheme, saltHex, hashHex] = encoded.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  try {
    const derived = await scrypt(password, Buffer.from(saltHex, 'hex'))
    const expected = Buffer.from(hashHex, 'hex')
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Session tokens (HMAC-signed, stateless) and cookie parsing
// ---------------------------------------------------------------------------

function sign(payload) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId, now = Date.now(), ttl = SESSION_TTL_SECONDS) {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: Math.floor(now / 1000) + ttl,
  })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.uid || !Number.isFinite(data?.exp)) return null
    if (data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

function parseCookies(header = '') {
  const out = {}
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}

// ---------------------------------------------------------------------------
// Validation helpers (kept dependency-free and shared with the client rules)
// ---------------------------------------------------------------------------

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizePhone(value) {
  const raw = String(value ?? '').trim()
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/\D/g, '')
  return `${plus}${digits}`
}

export function isValidEmail(value) {
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

export function isValidPhone(value) {
  const phone = normalizePhone(value)
  const digits = phone.startsWith('+') ? phone.slice(1) : phone
  if (!/^\d{9,15}$/.test(digits)) return false
  if (/^(\d)\1+$/.test(digits)) return false
  return true
}

export function passwordIssues(password) {
  const value = String(password ?? '')
  const issues = []
  if (value.length < 8) issues.push('validation.passwordShort')
  if (!/[a-zA-Z]/.test(value)) issues.push('validation.passwordLetter')
  if (!/\d/.test(value)) issues.push('validation.passwordNumber')
  return issues
}

export function nextWorkerCode(users = []) {
  const max = (Array.isArray(users) ? users : []).reduce((highest, user) => {
    const match = /(\d+)\s*$/.exec(String(user?.code ?? ''))
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `CHW-${String((Number.isFinite(max) ? max : 0) + 1).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function emptyDb() {
  return { users: [] }
}

function loadDb() {
  try {
    if (existsSync(DATA_FILE)) {
      const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
      if (parsed && Array.isArray(parsed.users)) {
        // Approval is no longer required: promote any previously-pending
        // accounts so existing users are not locked out after the change.
        let changed = false
        for (const user of parsed.users) {
          if (user.approvalStatus === 'pending') {
            user.approvalStatus = 'active'
            changed = true
          }
        }
        if (changed) {
          try { writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2)) } catch { /* ignore */ }
        }
        return parsed
      }
    }
  } catch {
    // fall through to a fresh database
  }
  return emptyDb()
}

function saveDb(db) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2))
}

function publicUser(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (process.env.AUTH_COOKIE_SECURE === 'true') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function applyCors(req, res) {
  const allowed = process.env.AUTH_ALLOWED_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function validateRegistration(body) {
  const fullName = String(body.fullName ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const village = String(body.village ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const facility = String(body.facility ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const password = String(body.password ?? '')
  const errors = {}
  if (fullName.length < 2) errors.fullName = 'validation.name'
  if (!isValidEmail(email)) errors.email = 'validation.email'
  if (!isValidPhone(phone)) errors.phone = 'validation.phone'
  if (!village) errors.village = 'validation.required'
  const pwIssues = passwordIssues(password)
  if (pwIssues.length) errors.password = pwIssues[0]
  return { errors, value: { fullName, email, phone, village, facility, password } }
}

async function handleRegister(req, res, body) {
  const { errors, value } = validateRegistration(body)
  if (Object.keys(errors).length) {
    return send(res, 400, { error: 'validation', code: 'validation', details: errors })
  }

  const db = loadDb()
  const emailTaken = db.users.some((user) => normalizeEmail(user.email) === value.email)
  const phoneTaken = db.users.some((user) => normalizePhone(user.phone) === value.phone)
  if (emailTaken || phoneTaken) {
    return send(res, 409, { error: 'duplicate', code: 'duplicate' })
  }

  const isFirst = db.users.length === 0
  const now = new Date().toISOString()
  const user = {
    id: randomBytes(12).toString('hex'),
    code: nextWorkerCode(db.users),
    fullName: value.fullName,
    phone: value.phone,
    village: value.village,
    facility: value.facility,
    email: value.email,
    role: isFirst ? 'admin' : 'chw',
    active: true,
    // Approval is not required: every account is active immediately.
    approvalStatus: 'active',
    passwordHash: await hashPassword(value.password),
    registrationDate: now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  }
  db.users.push(user)
  saveDb(db)

  // Registration signs the user in: issue a session cookie just like login.
  setSessionCookie(res, createSessionToken(user.id))

  if (user.approvalStatus === 'pending') {
    return send(res, 201, { pending: true, user: publicUser(user) })
  }
  return send(res, 201, { user: publicUser(user) })
}

async function handleLogin(req, res, body) {
  const email = normalizeEmail(body.email)
  const password = String(body.password ?? '')
  if (!email || !password) {
    return send(res, 400, { error: 'invalid', code: 'invalid' })
  }
  const db = loadDb()
  const user = db.users.find((entry) => normalizeEmail(entry.email) === email)
  // Always run a hash comparison to reduce user-enumeration timing signals.
  const hash = user?.passwordHash || 'scrypt$00$00'
  const valid = await verifyPassword(password, hash)
  if (!user || !valid) {
    return send(res, 401, { error: 'invalid', code: 'invalid' })
  }
  if (!user.active) {
    return send(res, 403, { error: 'inactive', code: 'inactive' })
  }
  // Self-heal: if no administrator exists, promote the account signing in.
  if (user.role !== 'admin' && !db.users.some((entry) => entry.role === 'admin' && entry.active)) {
    user.role = 'admin'
    user.updatedAt = new Date().toISOString()
    saveDb(db)
  }
  setSessionCookie(res, createSessionToken(user.id))
  return send(res, 200, { user: publicUser(user) })
}

function handleLogout(req, res) {
  clearSessionCookie(res)
  return send(res, 200, { ok: true })
}

function handleMe(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const data = verifySessionToken(cookies[COOKIE_NAME])
  if (!data) return send(res, 401, { error: 'unauthenticated', code: 'unauthenticated' })
  const db = loadDb()
  const user = db.users.find((entry) => entry.id === data.uid && entry.active)
  if (!user) return send(res, 401, { error: 'unauthenticated', code: 'unauthenticated' })
  return send(res, 200, { user: publicUser(user) })
}

async function handleRecover(req, res, body) {
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const password = String(body.password ?? '')
  if (!email || !phone || passwordIssues(password).length) {
    // Do not reveal whether the account exists.
    return send(res, 400, { error: 'invalid', code: 'invalid' })
  }
  const db = loadDb()
  const user = db.users.find((entry) => (
    normalizeEmail(entry.email) === email && normalizePhone(entry.phone) === phone
  ))
  if (!user) {
    return send(res, 400, { error: 'invalid', code: 'invalid' })
  }
  user.passwordHash = await hashPassword(password)
  user.updatedAt = new Date().toISOString()
  saveDb(db)
  return send(res, 200, { ok: true })
}

function requireAdmin(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const data = verifySessionToken(cookies[COOKIE_NAME])
  if (!data) {
    send(res, 401, { error: 'unauthenticated', code: 'unauthenticated' })
    return null
  }
  const db = loadDb()
  const user = db.users.find((entry) => entry.id === data.uid && entry.active)
  if (!user || user.role !== 'admin') {
    send(res, 403, { error: 'forbidden', code: 'forbidden' })
    return null
  }
  return { db, user }
}

function handleListWorkers(req, res) {
  const ctx = requireAdmin(req, res)
  if (!ctx) return undefined
  return send(res, 200, { workers: ctx.db.users.map(publicUser) })
}

async function handleApprove(req, res, body) {
  const ctx = requireAdmin(req, res)
  if (!ctx) return undefined
  const user = ctx.db.users.find((entry) => entry.id === body.id)
  if (!user) return send(res, 404, { error: 'notFound', code: 'notFound' })
  user.approvalStatus = 'active'
  user.active = true
  user.updatedAt = new Date().toISOString()
  saveDb(ctx.db)
  return send(res, 200, { user: publicUser(user) })
}

async function handleReject(req, res, body) {
  const ctx = requireAdmin(req, res)
  if (!ctx) return undefined
  const index = ctx.db.users.findIndex((entry) => entry.id === body.id)
  if (index === -1) return send(res, 404, { error: 'notFound', code: 'notFound' })
  if (ctx.db.users[index].id === ctx.user.id) {
    return send(res, 400, { error: 'self', code: 'self' })
  }
  ctx.db.users.splice(index, 1)
  saveDb(ctx.db)
  return send(res, 200, { ok: true })
}

// ---------------------------------------------------------------------------
// Static frontend (single-process deployment: API + built SPA on one origin)
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const AUTH_META = '<meta name="earlyma-auth-api" content="" />'

function readIndexHtml() {
  const indexPath = join(STATIC_DIR, 'index.html')
  const raw = readFileSync(indexPath, 'utf8')
  if (raw.includes('name="earlyma-auth-api"')) return raw
  // Marks the app to use same-origin remote auth (see src/lib/authApi.js).
  return raw.replace('</head>', `    ${AUTH_META}\n  </head>`)
}

function sendIndexHtml(req, res) {
  const html = readIndexHtml()
  const body = Buffer.from(html, 'utf8')
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES['.html'])
  res.setHeader('Content-Length', body.length)
  res.setHeader('Cache-Control', 'no-cache')
  res.end(req.method === 'HEAD' ? undefined : body)
  return true
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const root = resolve(STATIC_DIR)
  if (!existsSync(join(root, 'index.html'))) return false

  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return false
  }
  const relative = decoded.replace(/^\/+/, '') || 'index.html'
  let filePath = resolve(root, relative)
  if (filePath !== root && !filePath.startsWith(root + sep)) return false

  let isFile = false
  try {
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      filePath = join(filePath, 'index.html')
      isFile = true
    } else {
      isFile = true
    }
  } catch {
    // Unknown path: serve the SPA shell for extension-less routes only.
    if (extname(relative)) return false
    return sendIndexHtml(req, res)
  }

  if (!isFile) return false
  if (extname(filePath).toLowerCase() === '.html') return sendIndexHtml(req, res)

  const body = readFileSync(filePath)
  const ext = extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  res.setHeader('Content-Length', body.length)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(req.method === 'HEAD' ? undefined : body)
  return true
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handleRequest(req, res) {
  if (applyCors(req, res)) return undefined
  const url = new URL(req.url || '/', 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (req.method === 'GET' && path === '/api/health') {
    return send(res, 200, { ok: true })
  }
  if (req.method === 'POST' && path === '/api/register') {
    return handleRegister(req, res, await readJsonBody(req))
  }
  if (req.method === 'POST' && path === '/api/login') {
    return handleLogin(req, res, await readJsonBody(req))
  }
  if (req.method === 'POST' && path === '/api/logout') {
    return handleLogout(req, res)
  }
  if (req.method === 'GET' && path === '/api/me') {
    return handleMe(req, res)
  }
  if (req.method === 'POST' && path === '/api/recover') {
    return handleRecover(req, res, await readJsonBody(req))
  }
  if (req.method === 'GET' && path === '/api/workers') {
    return handleListWorkers(req, res)
  }
  if (req.method === 'POST' && path === '/api/workers/approve') {
    return handleApprove(req, res, await readJsonBody(req))
  }
  if (req.method === 'POST' && path === '/api/workers/reject') {
    return handleReject(req, res, await readJsonBody(req))
  }

  // Serve the built SPA for any other route (single-process deployment).
  if (!path.startsWith('/api') && serveStatic(req, res, path)) return undefined

  return send(res, 404, { error: 'notFound', code: 'notFound' })
}

export function createRequestHandler() {
  return (req, res) => {
    handleRequest(req, res).catch((error) => {
      send(res, 500, { error: 'server', code: 'server', message: String(error?.message || '') })
    })
  }
}

export function startServer(port = PORT) {
  const server = createServer(createRequestHandler())
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Earlyma auth server listening on http://localhost:${port}`)
  })
  return server
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  startServer()
}