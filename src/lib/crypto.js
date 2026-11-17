const encoder = new TextEncoder()

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')

export function randomId(prefix = '') {
  const raw = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${raw}` : raw
}

export function randomSalt(bytes = 16) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random number generation is not available in this browser.')
  }
  const values = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(values)
  return Array.from(values).map((value) => value.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a password using PBKDF2-SHA-256.
 * The returned format is self-describing so parameters can be upgraded later:
 *   pbkdf2$<iterations>$<salt>$<hash>
 *
 * Browser-only authentication is a demo convenience, NOT a production security
 * boundary. Real deployments must authenticate against a backend.
 */
export async function hashPassword(password, salt = randomSalt(), iterations = 120_000) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required.')
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable. Use HTTPS or localhost, or connect a backend for authentication.')
  }

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return `pbkdf2$${iterations}$${salt}$${toHex(bits)}`
}

function constantTimeEqual(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  let mismatch = left.length === right.length ? 0 : 1
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false
  const parts = encoded.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = parts[2]
  const expected = parts[3]
  if (!Number.isFinite(iterations) || iterations < 1 || !salt || !expected) return false

  try {
    const actual = await hashPassword(password, salt, iterations)
    return constantTimeEqual(actual.split('$')[3], expected)
  } catch {
    return false
  }
}

export function passwordIssues(password) {
  const value = String(password ?? '')
  const issues = []
  if (value.length < 8) issues.push('validation.passwordShort')
  if (!/[a-zA-Z]/.test(value)) issues.push('validation.passwordLetter')
  if (!/\d/.test(value)) issues.push('validation.passwordNumber')
  return issues
}

/**
 * Score a password from 0 (empty/very weak) to 4 (strong) for the strength
 * meter. This is guidance only; `passwordIssues` remains the policy gate.
 */
export function passwordStrength(password) {
  const value = String(password ?? '')
  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  if (value.length < 8) score = Math.min(score, 1)
  const level = Math.max(0, Math.min(4, score))
  const labelKeys = [
    'auth.passwordStrength.weak',
    'auth.passwordStrength.weak',
    'auth.passwordStrength.fair',
    'auth.passwordStrength.good',
    'auth.passwordStrength.strong',
  ]
  const colors = ['red', 'red', 'orange', 'teal', 'green']
  return {
    score: level,
    labelKey: labelKeys[level],
    color: colors[level],
    valid: passwordIssues(value).length === 0,
    issues: passwordIssues(value),
  }
}
