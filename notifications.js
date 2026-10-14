const STORAGE_KEY = 'earlyma-notification-queue'
const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 30_000

export const NOTIFICATION_STORAGE_KEY = STORAGE_KEY

export function isRetryDue(entry, now = new Date()) {
  if (!entry?.nextRetryAt) return true
  return new Date(entry.nextRetryAt).getTime() <= now.getTime()
}

export function createNotification(client, message, type = 'remind', workerId = null, now = new Date()) {
  return {
    id: crypto.randomUUID(),
    clientId: client?.id ?? null,
    clientLabel: client?.label ?? 'Unknown client',
    phone: client?.phone || 'No phone number saved',
    message,
    type,
    workerId,
    status: 'queued',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    providerMessageId: null,
    error: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    nextRetryAt: now.toISOString(),
    sentAt: null,
  }
}

export function enqueueNotification(queue = [], notification) {
  return [notification, ...(Array.isArray(queue) ? queue : [])]
}

export function selectDispatchable(queue = [], now = new Date()) {
  return (Array.isArray(queue) ? queue : []).filter((entry) => (
    entry &&
    (entry.status === 'queued' || entry.status === 'failed') &&
    entry.attempts < (entry.maxAttempts ?? MAX_ATTEMPTS) &&
    isRetryDue(entry, now)
  ))
}

function backoffDelay(attempts) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), 5 * 60_000)
}

export async function dispatchOne(entry, provider, now = new Date()) {
  const startedAt = now.toISOString()
  const updated = {
    ...entry,
    status: 'sending',
    attempts: entry.attempts + 1,
    updatedAt: startedAt,
  }

  try {
    const result = await provider.send(updated)
    if (!result?.ok) {
      throw new Error(result?.error || 'Provider rejected the message.')
    }

    return {
      ...updated,
      status: 'sent',
      providerMessageId: result.providerMessageId || result.id || null,
      sentAt: (result.sentAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      error: null,
      nextRetryAt: null,
    }
  } catch (error) {
    const failedAttempts = updated.attempts
    const terminal = failedAttempts >= (updated.maxAttempts ?? MAX_ATTEMPTS)
    const retryAt = new Date(now.getTime() + backoffDelay(failedAttempts))

    return {
      ...updated,
      status: terminal ? 'failed' : 'queued',
      error: error?.message || 'Unknown delivery error.',
      updatedAt: new Date().toISOString(),
      nextRetryAt: terminal ? null : retryAt.toISOString(),
    }
  }
}

export async function dispatchQueue(queue = [], provider, now = new Date()) {
  const targetIndexes = new Set(selectDispatchable(queue, now).map((entry) => entry.id))
  const next = [...queue]
  const results = []

  for (let i = 0; i < next.length; i += 1) {
    if (!targetIndexes.has(next[i]?.id)) continue
    const dispatched = await dispatchOne(next[i], provider, now)
    next[i] = dispatched
    results.push(dispatched)
  }

  return { queue: next, results }
}

export function createMockProvider() {
  return {
    async send(entry) {
      // Simulate a small amount of network latency and occasional failure so the
      // queue/retry behaviour is visible without a real SMS gateway.
      await new Promise((resolve) => setTimeout(resolve, 50))

      if (entry.phone === '0000000000' || entry.phone === 'fail') {
        return { ok: false, error: 'Delivery failed: invalid phone number.' }
      }

      if (Math.random() < 0.08) {
        return { ok: false, error: 'Delivery failed: provider timeout.' }
      }

      return {
        ok: true,
        providerMessageId: `mock-${entry.id.slice(0, 8)}`,
        sentAt: new Date().toISOString(),
      }
    },
  }
}

export function getDefaultProvider() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const endpoint = env?.VITE_SMS_API_URL
  return endpoint ? createHttpProvider({ endpoint }) : createMockProvider()
}

export function createHttpProvider(config = {}) {
  const endpoint = config.endpoint || import.meta.env?.VITE_SMS_API_URL
  if (!endpoint) {
    throw new Error('SMS provider endpoint is not configured.')
  }

  return {
    async send(entry) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          to: entry.phone,
          message: entry.message,
          clientLabel: entry.clientLabel,
          type: entry.type,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`)
      }

      return {
        ok: true,
        providerMessageId: payload.messageId || payload.id || null,
        sentAt: payload.sentAt || new Date().toISOString(),
      }
    },
  }
}