import { randomId } from './crypto.js'
import { isPhoneValid, normalizePhone } from './validation.js'

export const NOTIFICATION_STORAGE_KEY = 'earlyma-notification-queue'

export const NOTIFICATION_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RECEIVED: 'received',
}

export const DEFAULT_MAX_ATTEMPTS = 3
export const DEFAULT_RETRY_BASE_MS = 30_000
export const MAX_BACKOFF_MS = 30 * 60_000
export const STALE_PROCESSING_MS = 5 * 60_000

export function isRetryDue(entry, now = new Date()) {
  if (!entry?.nextRetryAt) return true
  const due = new Date(entry.nextRetryAt).getTime()
  return Number.isFinite(due) ? due <= now.getTime() : true
}

export function backoffDelay(attempts, baseMs = DEFAULT_RETRY_BASE_MS, maxMs = MAX_BACKOFF_MS) {
  const safeAttempts = Math.max(1, Math.trunc(Number(attempts) || 1))
  return Math.min(baseMs * 2 ** (safeAttempts - 1), maxMs)
}

export function createNotification(client, message, type = 'remind', workerId = null, now = new Date(), options = {}) {
  const at = now instanceof Date ? now : new Date(now)
  const atIso = Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString()
  return {
    id: options.id ?? randomId('ntf'),
    clientId: client?.id ?? null,
    clientType: client?.type ?? null,
    clientLabel: client?.fullName ?? client?.label ?? 'Unknown client',
    phone: normalizePhone(client?.phone),
    message: String(message ?? ''),
    type,
    workerId,
    language: client?.language ?? options.language ?? 'sw',
    direction: 'outbound',
    status: NOTIFICATION_STATUS.QUEUED,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    provider: options.provider ?? null,
    providerMessageId: null,
    error: null,
    lastError: null,
    errorHistory: [],
    createdAt: atIso,
    updatedAt: atIso,
    processingAt: null,
    nextRetryAt: atIso,
    sentAt: null,
    deliveredAt: null,
    deliveryReceipt: null,
    dedupeKey: options.dedupeKey ?? null,
    manualRetries: 0,
    reply: null,
    events: [{ at: atIso, status: NOTIFICATION_STATUS.QUEUED, detail: 'Notification created.' }],
  }
}

/**
 * Add a notification to the persistent queue.
 * A dedupeKey prevents accidental double-sends of the same reminder. Failed
 * notifications are allowed to be queued again so retries still work.
 */
export function enqueueNotification(queue = [], notification, options = {}) {
  const safeQueue = Array.isArray(queue) ? queue : []
  if (!notification || typeof notification !== 'object') return safeQueue
  const dedupe = notification.dedupeKey
  if (dedupe && !options.allowDuplicate) {
    const existing = safeQueue.find((entry) => (
      entry &&
      entry.dedupeKey === dedupe &&
      entry.direction !== 'inbound' &&
      !['failed', 'cancelled'].includes(entry.status)
    ))
    if (existing) return safeQueue
  }
  return [notification, ...safeQueue]
}

export function findNotification(queue = [], id) {
  return (Array.isArray(queue) ? queue : []).find((entry) => entry?.id === id) ?? null
}

export function selectDispatchable(queue = [], now = new Date()) {
  return (Array.isArray(queue) ? queue : []).filter((entry) => {
    if (!entry || entry.direction === 'inbound') return false
    const isQueued = entry.status === NOTIFICATION_STATUS.QUEUED || entry.status === NOTIFICATION_STATUS.FAILED
    const isStaleProcessing = entry.status === NOTIFICATION_STATUS.PROCESSING && (
      !entry.processingAt || (now.getTime() - new Date(entry.processingAt).getTime()) > STALE_PROCESSING_MS
    )
    if (!isQueued && !isStaleProcessing) return false
    if ((entry.attempts ?? 0) >= (entry.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)) return false
    return isRetryDue(entry, now)
  })
}

export function validateOutgoing(entry) {
  if (!entry) return 'Notification entry is missing.'
  if (!isPhoneValid(entry.phone)) return 'Invalid phone number. The message was not sent.'
  const message = String(entry.message ?? '').trim()
  if (!message) return 'Message is empty. The message was not sent.'
  if (message.length > 1000) return 'Message is too long. The message was not sent.'
  return null
}

function appendEvent(entry, status, detail, atIso) {
  return [
    ...(Array.isArray(entry.events) ? entry.events : []),
    { at: atIso, status, ...(detail ? { detail } : {}) },
  ]
}

function terminalFailure(entry, error, atIso) {
  return {
    ...entry,
    status: NOTIFICATION_STATUS.FAILED,
    error,
    lastError: error,
    errorHistory: [...(entry.errorHistory ?? []), { at: atIso, error }],
    updatedAt: atIso,
    processingAt: null,
    nextRetryAt: null,
    events: appendEvent(entry, NOTIFICATION_STATUS.FAILED, error, atIso),
  }
}

export async function dispatchOne(entry, provider, now = new Date()) {
  if (!provider || typeof provider.send !== 'function') {
    throw new Error('A notification provider with a send() method is required.')
  }
  if (!entry || typeof entry !== 'object') {
    throw new Error('A notification entry is required.')
  }

  const atIso = now.toISOString()
  const validationError = validateOutgoing(entry)
  if (validationError) {
    return terminalFailure({ ...entry, attempts: (entry.attempts ?? 0) + 1 }, validationError, atIso)
  }

  const processing = {
    ...entry,
    status: NOTIFICATION_STATUS.PROCESSING,
    attempts: (entry.attempts ?? 0) + 1,
    processingAt: atIso,
    updatedAt: atIso,
    nextRetryAt: null,
    events: appendEvent(entry, NOTIFICATION_STATUS.PROCESSING, null, atIso),
  }

  try {
    const result = await provider.send({
      ...processing,
      to: processing.phone,
      clientRequestId: processing.id,
    })
    if (!result?.ok) {
      throw new Error(result?.error || 'Provider rejected the message.')
    }

    // "Delivered" is only ever shown when the provider returned a verified
    // delivery receipt. A successful API call means "sent", not delivered.
    const delivered = result.delivered === true && result.receiptVerified === true
    const status = delivered ? NOTIFICATION_STATUS.DELIVERED : NOTIFICATION_STATUS.SENT

    return {
      ...processing,
      status,
      provider: result.provider ?? provider.name ?? processing.provider ?? null,
      providerMessageId: result.providerMessageId || result.id || null,
      providerStatus: result.providerStatus ?? null,
      sentAt: result.sentAt || atIso,
      deliveredAt: delivered ? (result.deliveredAt || atIso) : null,
      deliveryReceipt: delivered ? (result.receipt ?? { verified: true }) : null,
      updatedAt: atIso,
      processingAt: null,
      error: null,
      nextRetryAt: null,
      events: appendEvent(processing, status, delivered ? 'Provider confirmed delivery.' : 'Provider accepted the message. Delivery not confirmed.', atIso),
    }
  } catch (error) {
    const failed = {
      ...processing,
      error: String(error?.message || 'Unknown delivery error.').slice(0, 300),
      lastError: String(error?.message || 'Unknown delivery error.').slice(0, 300),
      errorHistory: [...(processing.errorHistory ?? []), { at: atIso, error: String(error?.message || 'Unknown delivery error.').slice(0, 300) }],
    }
    const terminal = failed.attempts >= (failed.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
    const retryAt = new Date(now.getTime() + backoffDelay(failed.attempts))
    return {
      ...failed,
      status: terminal ? NOTIFICATION_STATUS.FAILED : NOTIFICATION_STATUS.QUEUED,
      updatedAt: atIso,
      processingAt: null,
      nextRetryAt: terminal ? null : retryAt.toISOString(),
      events: appendEvent(failed, terminal ? NOTIFICATION_STATUS.FAILED : NOTIFICATION_STATUS.QUEUED, failed.error, atIso),
    }
  }
}

export async function dispatchQueue(queue = [], provider, now = new Date()) {
  const targetIds = new Set(selectDispatchable(queue, now).map((entry) => entry.id))
  const next = [...(Array.isArray(queue) ? queue : [])]
  const results = []
  for (let index = 0; index < next.length; index += 1) {
    if (!targetIds.has(next[index]?.id)) continue
    const dispatched = await dispatchOne(next[index], provider, now)
    next[index] = dispatched
    results.push(dispatched)
  }
  return { queue: next, results }
}

export function retryNotification(queue = [], id, now = new Date()) {
  return (Array.isArray(queue) ? queue : []).map((entry) => {
    if (entry?.id !== id) return entry
    if ([NOTIFICATION_STATUS.DELIVERED, NOTIFICATION_STATUS.CANCELLED, NOTIFICATION_STATUS.RECEIVED].includes(entry.status)) {
      return entry
    }
    const atIso = now.toISOString()
    return {
      ...entry,
      status: NOTIFICATION_STATUS.QUEUED,
      attempts: entry.attempts ?? 0,
      maxAttempts: Math.max(entry.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, (entry.attempts ?? 0) + 1),
      manualRetries: (entry.manualRetries ?? 0) + 1,
      nextRetryAt: atIso,
      updatedAt: atIso,
      processingAt: null,
      error: null,
      events: appendEvent(entry, NOTIFICATION_STATUS.QUEUED, 'Manual retry requested.', atIso),
    }
  })
}

export function retryAllFailed(queue = [], now = new Date()) {
  return (Array.isArray(queue) ? queue : []).reduce((current, entry) => (
    entry?.status === NOTIFICATION_STATUS.FAILED ? retryNotification(current, entry.id, now) : current
  ), queue)
}

export function cancelNotification(queue = [], id, now = new Date()) {
  const atIso = now.toISOString()
  return (Array.isArray(queue) ? queue : []).map((entry) => {
    if (entry?.id !== id) return entry
    if ([NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.DELIVERED, NOTIFICATION_STATUS.RECEIVED].includes(entry.status)) return entry
    return {
      ...entry,
      status: NOTIFICATION_STATUS.CANCELLED,
      nextRetryAt: null,
      updatedAt: atIso,
      events: appendEvent(entry, NOTIFICATION_STATUS.CANCELLED, 'Cancelled by user.', atIso),
    }
  })
}

export function applyDeliveryReceipt(queue = [], receipt = {}, options = {}) {
  if (typeof options.verify !== 'function') {
    return { ok: false, error: 'Receipt verification is not configured. Verify receipts on the backend before applying them.', queue }
  }
  if (!options.verify(receipt)) {
    return { ok: false, error: 'Invalid delivery receipt signature.', queue }
  }

  const messageId = receipt.providerMessageId || receipt.messageId
  const index = (queue ?? []).findIndex((entry) => entry?.providerMessageId === messageId)
  if (index === -1) return { ok: false, error: 'No notification matches this receipt.', queue }

  const entry = queue[index]
  if (entry.status === NOTIFICATION_STATUS.DELIVERED) {
    return { ok: true, duplicate: true, queue }
  }
  if (entry.status !== NOTIFICATION_STATUS.SENT) {
    return { ok: false, error: 'Receipt does not match a sent notification.', queue }
  }

  const atIso = new Date(receipt.deliveredAt || Date.now()).toISOString()
  const isDelivered = ['delivered', 'DELIVERED'].includes(receipt.status)
  const next = [...queue]
  next[index] = isDelivered
    ? {
        ...entry,
        status: NOTIFICATION_STATUS.DELIVERED,
        deliveredAt: atIso,
        deliveryReceipt: {
          providerMessageId: messageId,
          status: receipt.status,
          deliveredAt: atIso,
          verified: true,
        },
        updatedAt: atIso,
        events: appendEvent(entry, NOTIFICATION_STATUS.DELIVERED, 'Verified delivery receipt received.', atIso),
      }
    : terminalFailure(entry, `Provider reported status: ${String(receipt.status ?? 'unknown')}`, atIso)

  return { ok: true, queue: next }
}

export function parseInboundReply(body) {
  const text = String(body ?? '').trim().toUpperCase()
  if (!text) return { intent: 'unknown', code: null }
  const tokens = text.replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (tokens.includes('1') || tokens.includes('YES') || tokens.includes('NDIO') || tokens.includes('Y')) {
    return { intent: 'confirmed', code: '1' }
  }
  if (tokens.includes('2') || tokens.includes('NO') || tokens.includes('HAPANA') || tokens.includes('N')) {
    return { intent: 'declined', code: '2' }
  }
  if (tokens.includes('STOP') || tokens.includes('ACHA') || tokens.includes('UNSUBSCRIBE')) {
    return { intent: 'stop', code: 'STOP' }
  }
  if (tokens.includes('HELP') || tokens.includes('MSAADA')) {
    return { intent: 'help', code: 'HELP' }
  }
  return { intent: 'unknown', code: null }
}

/**
 * Record an inbound SMS reply (e.g. "PRESS 1").
 *
 * In production this must be called by a verified webhook handler on the
 * backend. The browser demo calls it with trusted: true from the simulator.
 */
export async function recordInboundReply(queue = [], payload = {}, now = new Date()) {
  if (!payload.trusted && typeof payload.verify !== 'function') {
    return { ok: false, error: 'Inbound replies must come from a verified webhook or the explicit demo simulator.', queue }
  }
  if (!payload.trusted && payload.verify && !(await payload.verify(payload))) {
    return { ok: false, error: 'Invalid inbound webhook signature.', queue }
  }

  const from = normalizePhone(payload.from)
  if (!isPhoneValid(from)) return { ok: false, error: 'Invalid sender phone number.', queue }

  const atIso = (now instanceof Date ? now : new Date(now)).toISOString()
  const body = String(payload.body ?? '').slice(0, 1000)
  const { intent, code } = parseInboundReply(body)
  const safeQueue = Array.isArray(queue) ? queue : []

  if (payload.providerMessageId && safeQueue.some((entry) => entry?.direction === 'inbound' && entry.providerMessageId === payload.providerMessageId)) {
    return { ok: true, duplicate: true, queue: safeQueue, inbound: null, related: null }
  }

  let related = null
  if (payload.relatedId) {
    related = safeQueue.find((entry) => entry?.id === payload.relatedId) ?? null
  } else {
    related = safeQueue
      .filter((entry) => entry?.direction !== 'inbound' && normalizePhone(entry?.phone) === from)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] ?? null
  }

  const inbound = {
    id: randomId('inb'),
    clientId: related?.clientId ?? null,
    clientType: related?.clientType ?? null,
    clientLabel: related?.clientLabel ?? 'Unknown sender',
    phone: from,
    message: body,
    type: 'reply',
    direction: 'inbound',
    status: NOTIFICATION_STATUS.RECEIVED,
    intent,
    code,
    relatedId: related?.id ?? null,
    providerMessageId: payload.providerMessageId ?? null,
    workerId: related?.workerId ?? null,
    createdAt: atIso,
    updatedAt: atIso,
    events: [{ at: atIso, status: NOTIFICATION_STATUS.RECEIVED, detail: `Inbound reply (${intent}).` }],
  }

  const next = [inbound, ...safeQueue]
  if (related) {
    const index = next.findIndex((entry) => entry?.id === related.id)
    if (index !== -1) {
      next[index] = {
        ...next[index],
        reply: { intent, code, body, at: atIso },
        updatedAt: atIso,
        events: appendEvent(next[index], 'reply', `Client replied: ${intent}`, atIso),
      }
      related = next[index]
    }
  }

  return { ok: true, queue: next, inbound, related }
}

export function summarizeNotifications(queue = []) {
  const summary = {
    total: 0,
    queued: 0,
    processing: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    cancelled: 0,
    received: 0,
    pending: 0,
  }
  for (const entry of Array.isArray(queue) ? queue : []) {
    if (!entry) continue
    summary.total += 1
    const status = entry.status === 'sending' ? NOTIFICATION_STATUS.PROCESSING : entry.status
    if (summary[status] !== undefined) summary[status] += 1
    if (status === NOTIFICATION_STATUS.QUEUED || status === NOTIFICATION_STATUS.PROCESSING) summary.pending += 1
  }
  const deliveryDenominator = summary.sent + summary.delivered + summary.failed
  summary.deliveryRate = deliveryDenominator > 0 ? Math.round((summary.delivered / deliveryDenominator) * 100) : 0
  summary.successRate = (summary.sent + summary.delivered + summary.failed) > 0
    ? Math.round(((summary.sent + summary.delivered) / (summary.sent + summary.delivered + summary.failed)) * 100)
    : 0
  return summary
}

export function notificationStatusKey(status) {
  const map = {
    queued: 'notification.status.queued',
    processing: 'notification.status.processing',
    sending: 'notification.status.processing',
    sent: 'notification.status.sent',
    delivered: 'notification.status.delivered',
    failed: 'notification.status.failed',
    cancelled: 'notification.status.cancelled',
    received: 'notification.status.received',
  }
  return map[status] ?? 'notification.status.unknown'
}

export function createMockProvider(options = {}) {
  const failureRate = Number.isFinite(options.failureRate) ? options.failureRate : 0.08
  const latency = Number.isFinite(options.latency) ? options.latency : 50
  const random = options.random ?? Math.random
  return {
    name: 'mock',
    async send(entry) {
      const validationError = validateOutgoing(entry)
      if (validationError) return { ok: false, error: validationError }

      if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency))

      if (entry.phone === '0000000000' || entry.phone === 'fail') {
        return { ok: false, error: 'Delivery failed: invalid phone number.' }
      }
      if (random() < failureRate) {
        return { ok: false, error: 'Delivery failed: provider timeout.' }
      }
      return {
        ok: true,
        providerMessageId: `mock-${entry.id.slice(0, 12)}`,
        sentAt: new Date().toISOString(),
        delivered: false,
        providerStatus: 'accepted',
      }
    },
  }
}

function assertHttpEndpoint(endpoint) {
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('SMS provider endpoint is not a valid URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SMS provider endpoint must use HTTP or HTTPS.')
  }
  return url
}

/**
 * HTTP provider for a secure backend/SMS proxy.
 *
 * The frontend deliberately has NO SMS credentials. Authentication uses the
 * same-origin session cookie set by the backend (`credentials: 'include'`).
 * Never put Twilio/Africa's Talking keys in a VITE_* variable: Vite inlines
 * them into the public bundle.
 */
export function createHttpProvider(config = {}) {
  const endpoint = config.endpoint || import.meta.env?.VITE_SMS_API_URL
  if (!endpoint) throw new Error('SMS provider endpoint is not configured.')
  assertHttpEndpoint(endpoint)

  const fetchImpl = config.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is not available in this environment.')
  const timeoutMs = Number(config.timeoutMs) || 15_000

  return {
    name: 'http',
    endpoint,
    async send(entry) {
      const validationError = validateOutgoing(entry)
      if (validationError) return { ok: false, error: validationError }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller?.signal,
          body: JSON.stringify({
            to: entry.phone,
            message: entry.message,
            type: entry.type,
            clientRequestId: entry.clientRequestId || entry.id,
            language: entry.language ?? null,
          }),
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || `SMS proxy returned HTTP ${response.status}`)
        }

        const receiptVerified = payload?.receiptVerified === true
        const providerSaysDelivered = payload?.status === 'delivered' || payload?.delivered === true
        return {
          ok: true,
          providerMessageId: payload?.messageId || payload?.id || null,
          sentAt: payload?.sentAt || new Date().toISOString(),
          delivered: receiptVerified && providerSaysDelivered,
          receiptVerified,
          providerStatus: payload?.status ?? 'accepted',
          receipt: receiptVerified ? payload?.receipt ?? { verified: true } : null,
        }
      } finally {
        if (timer) clearTimeout(timer)
      }
    },
  }
}

/** Client-side guard that complements (never replaces) backend rate limiting. */
export function createRateLimitedProvider(provider, options = {}) {
  const maxPerMinute = Math.max(1, Math.trunc(options.maxPerMinute ?? 20))
  const windowMs = options.windowMs ?? 60_000
  const nowFn = options.now ?? (() => Date.now())
  let timestamps = []
  return {
    name: provider.name ?? 'rate-limited',
    original: provider,
    async send(entry) {
      const current = nowFn()
      timestamps = timestamps.filter((timestamp) => current - timestamp < windowMs)
      if (timestamps.length >= maxPerMinute) {
        return { ok: false, error: 'Client rate limit reached. The message remains queued for retry.' }
      }
      timestamps.push(current)
      return provider.send(entry)
    },
  }
}

let cachedProvider = null
let cachedMode = null

export function getProviderInfo(env = import.meta.env) {
  const endpoint = env?.VITE_SMS_API_URL || ''
  const requested = env?.VITE_SMS_PROVIDER || (endpoint ? 'http' : 'mock')
  const mode = requested === 'http' && endpoint ? 'http' : 'mock'
  return {
    mode,
    endpoint: mode === 'http' ? endpoint : null,
    note: mode === 'http'
      ? 'Messages are sent through the configured backend proxy. The backend owns SMS credentials and delivery receipts.'
      : 'Mock provider: messages are queued and marked sent locally. No real SMS is sent.',
  }
}

export function getDefaultProvider() {
  const info = getProviderInfo()
  if (cachedProvider && cachedMode === info.mode + (info.endpoint ?? '')) return cachedProvider
  cachedProvider = info.mode === 'http'
    ? createRateLimitedProvider(createHttpProvider({ endpoint: info.endpoint }), { maxPerMinute: 20 })
    : createMockProvider()
  cachedMode = info.mode + (info.endpoint ?? '')
  return cachedProvider
}

export function resetDefaultProvider() {
  cachedProvider = null
  cachedMode = null
}
