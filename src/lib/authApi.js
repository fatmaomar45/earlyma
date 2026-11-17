// Client for the optional secure backend (server/index.mjs).
//
// When VITE_AUTH_API_URL is set, the app delegates credential checks to the
// server and only mirrors the returned profile locally. When it is not set, the
// app keeps using the clearly-labelled local demo authentication.
//
// The browser never receives or stores the password hash: the server owns
// credentials and sessions (HttpOnly cookie).

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export function getAuthApiUrl() {
  return env.VITE_AUTH_API_URL || ''
}

export function isRemoteAuthEnabled() {
  return Boolean(getAuthApiUrl())
}

export class AuthApiError extends Error {
  constructor(message, { status = 0, code = 'error', details = null } = {}) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function buildUrl(path) {
  const base = getAuthApiUrl().replace(/\/+$/, '')
  return `${base}${path}`
}

async function request(path, { method = 'GET', body, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new AuthApiError('Fetch is not available in this browser.', { code: 'unavailable' })
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), 15_000) : null
  try {
    const response = await doFetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller?.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new AuthApiError(payload?.error || `Request failed (${response.status})`, {
        status: response.status,
        code: payload?.code || 'error',
        details: payload?.details ?? null,
      })
    }
    return payload
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    throw new AuthApiError(error?.message || 'Network request failed.', { code: 'network' })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Map a server user record to the local worker shape used by the app. */
export function mapRemoteUser(user = {}) {
  const now = new Date().toISOString()
  return {
    id: user.id,
    type: 'worker',
    code: user.code || '',
    fullName: user.fullName || '',
    phone: user.phone || '',
    village: user.village || '',
    facility: user.facility || '',
    email: user.email || '',
    role: user.role === 'admin' ? 'admin' : 'chw',
    active: user.active !== false,
    approvalStatus: user.approvalStatus === 'pending' ? 'pending' : 'active',
    notes: user.notes || '',
    // The browser copy never holds a password hash; the server owns credentials.
    passwordHash: null,
    requiresPasswordReset: false,
    isDemo: false,
    remote: true,
    registrationDate: user.registrationDate || '',
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now,
  }
}

export async function remoteLogin(credentials = {}, options = {}) {
  const data = await request('/api/login', { method: 'POST', body: credentials, ...options })
  if (data?.pending) return { ok: true, pending: true }
  if (!data?.user) throw new AuthApiError('The server did not return a user.', { code: 'invalid' })
  return { ok: true, user: mapRemoteUser(data.user) }
}

export async function remoteRegister(details = {}, options = {}) {
  const data = await request('/api/register', { method: 'POST', body: details, ...options })
  if (data?.pending) return { ok: true, pending: true, user: data.user ? mapRemoteUser(data.user) : null }
  if (!data?.user) throw new AuthApiError('The server did not return a user.', { code: 'invalid' })
  return { ok: true, user: mapRemoteUser(data.user) }
}

export async function remoteRecover(details = {}, options = {}) {
  return request('/api/recover', { method: 'POST', body: details, ...options })
}

export async function remoteLogout(options = {}) {
  return request('/api/logout', { method: 'POST', ...options })
}

export async function remoteMe(options = {}) {
  const data = await request('/api/me', { method: 'GET', ...options })
  return data?.user ? { ok: true, user: mapRemoteUser(data.user) } : { ok: false, error: 'unauthenticated' }
}

export async function remoteApprove(id, options = {}) {
  return request('/api/workers/approve', { method: 'POST', body: { id }, ...options })
}

export async function remoteReject(id, options = {}) {
  return request('/api/workers/reject', { method: 'POST', body: { id }, ...options })
}

export async function remoteListWorkers(options = {}) {
  const data = await request('/api/workers', { method: 'GET', ...options })
  return Array.isArray(data?.workers) ? data.workers.map(mapRemoteUser) : []
}