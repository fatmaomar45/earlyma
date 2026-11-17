import { describe, it, expect } from 'vitest'
import {
  applyDeliveryReceipt,
  backoffDelay,
  cancelNotification,
  createHttpProvider,
  createMockProvider,
  createNotification,
  createRateLimitedProvider,
  DEFAULT_MAX_ATTEMPTS,
  dispatchOne,
  dispatchQueue,
  enqueueNotification,
  findNotification,
  getProviderInfo,
  isRetryDue,
  notificationStatusKey,
  parseInboundReply,
  recordInboundReply,
  retryAllFailed,
  retryNotification,
  selectDispatchable,
  summarizeNotifications,
  validateOutgoing,
} from '../src/lib/notifications.js'

const now = new Date('2026-06-01T12:00:00.000Z')

function client(overrides = {}) {
  return {
    id: 'c1',
    type: 'mother',
    fullName: 'Amina Demo',
    phone: '0712 345 678',
    language: 'sw',
    workerId: 'w1',
    ...overrides,
  }
}

function entry(overrides = {}) {
  return createNotification(client(), 'Please attend the clinic.', 'remind', 'w1', now, { id: 'n1', ...overrides })
}

function provider(result = {}) {
  return {
    name: 'test',
    async send(payload) {
      return { ok: true, providerMessageId: 'p1', ...result, payload }
    },
  }
}

describe('createNotification and enqueueNotification', () => {
  it('creates queued entries with normalised phones and an audit event', () => {
    const notification = createNotification(client(), 'Hello', 'remind', 'w1', now, { id: 'n1' })
    expect(notification).toMatchObject({
      id: 'n1',
      status: 'queued',
      phone: '0712345678',
      direction: 'outbound',
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      clientId: 'c1',
      clientType: 'mother',
      workerId: 'w1',
      language: 'sw',
      nextRetryAt: now.toISOString(),
    })
    expect(notification.events).toHaveLength(1)
    expect(notification.events[0].status).toBe('queued')
  })

  it('adds entries to the front of the queue', () => {
    const first = entry({ id: 'n1' })
    const second = entry({ id: 'n2' })
    expect(enqueueNotification([first], second).map((item) => item.id)).toEqual(['n2', 'n1'])
    expect(enqueueNotification(null, second)).toHaveLength(1)
    expect(enqueueNotification([], null)).toEqual([])
  })

  it('deduplicates only active outbound entries', () => {
    const existing = { ...entry(), dedupeKey: 'mother:c1:remind:2026-06-01' }
    const duplicate = { ...entry({ id: 'n2' }), dedupeKey: existing.dedupeKey }
    expect(enqueueNotification([existing], duplicate)).toHaveLength(1)
    expect(enqueueNotification([existing], duplicate, { allowDuplicate: true })).toHaveLength(2)
    expect(enqueueNotification([{ ...existing, status: 'failed' }], duplicate)).toHaveLength(2)
    expect(enqueueNotification([{ ...existing, status: 'cancelled' }], duplicate)).toHaveLength(2)
    expect(enqueueNotification([{ ...existing, direction: 'inbound' }], duplicate)).toHaveLength(2)
  })

  it('looks up entries by id', () => {
    const notification = entry()
    expect(findNotification([notification], 'n1')).toBe(notification)
    expect(findNotification([notification], 'missing')).toBeNull()
  })
})

describe('dispatch eligibility', () => {
  it('computes exponential backoff with a cap', () => {
    expect(backoffDelay(1)).toBe(30_000)
    expect(backoffDelay(2)).toBe(60_000)
    expect(backoffDelay(3)).toBe(120_000)
    expect(backoffDelay(1, 100, 150)).toBe(100)
    expect(backoffDelay(20, 30_000)).toBe(30 * 60_000)
  })

  it('checks retry due times', () => {
    expect(isRetryDue({ nextRetryAt: null }, now)).toBe(true)
    expect(isRetryDue({ nextRetryAt: '2026-06-01T11:00:00.000Z' }, now)).toBe(true)
    expect(isRetryDue({ nextRetryAt: '2026-06-01T13:00:00.000Z' }, now)).toBe(false)
    expect(isRetryDue({ nextRetryAt: 'garbage' }, now)).toBe(true)
  })

  it('only selects queued, failed or stale processing entries', () => {
    const queued = entry({ id: 'queued' })
    const failed = { ...entry({ id: 'failed' }), status: 'failed' }
    const future = { ...entry({ id: 'future' }), nextRetryAt: '2026-06-01T13:00:00.000Z' }
    const exhausted = { ...entry({ id: 'exhausted' }), attempts: 3 }
    const stale = {
      ...entry({ id: 'stale' }),
      status: 'processing',
      attempts: 1,
      processingAt: '2026-06-01T11:00:00.000Z',
    }
    const fresh = {
      ...entry({ id: 'fresh' }),
      status: 'processing',
      processingAt: '2026-06-01T11:59:00.000Z',
    }
    const inbound = {
      ...entry({ id: 'inbound' }),
      direction: 'inbound',
      status: 'received',
      nextRetryAt: null,
    }
    const sent = { ...entry({ id: 'sent' }), status: 'sent' }

    const ids = selectDispatchable([queued, failed, future, exhausted, stale, fresh, inbound, sent], now)
      .map((item) => item.id)
    expect(ids).toEqual(['queued', 'failed', 'stale'])
  })
})

describe('dispatchOne', () => {
  it('validates outgoing entries', () => {
    expect(validateOutgoing(entry())).toBeNull()
    expect(validateOutgoing(null)).toMatch(/missing/)
    expect(validateOutgoing({ phone: '1', message: 'Hello' })).toMatch(/Invalid phone/)
    expect(validateOutgoing({ phone: '0712345678', message: '  ' })).toMatch(/empty/)
    expect(validateOutgoing({ phone: '0712345678', message: 'x'.repeat(1001) })).toMatch(/too long/)
  })

  it('marks provider acceptance as sent, not delivered', async () => {
    const result = await dispatchOne(entry(), provider(), now)
    expect(result.status).toBe('sent')
    expect(result.attempts).toBe(1)
    expect(result.providerMessageId).toBe('p1')
    expect(result.sentAt).toBe(now.toISOString())
    expect(result.deliveredAt).toBeNull()
    expect(result.deliveryReceipt).toBeNull()
    expect(result.events.map((event) => event.status)).toEqual(['queued', 'processing', 'sent'])
  })

  it('requires a verified receipt before showing delivered', async () => {
    const withoutReceipt = await dispatchOne(entry(), provider({ delivered: true }), now)
    expect(withoutReceipt.status).toBe('sent')

    const withReceipt = await dispatchOne(entry(), provider({
      delivered: true,
      receiptVerified: true,
      deliveredAt: '2026-06-01T12:30:00.000Z',
    }), now)
    expect(withReceipt.status).toBe('delivered')
    expect(withReceipt.deliveredAt).toBe('2026-06-01T12:30:00.000Z')
    expect(withReceipt.deliveryReceipt).toMatchObject({ verified: true })
  })

  it('requeues a transient failure with backoff', async () => {
    const failing = { name: 'test', async send() { return { ok: false, error: 'boom' } } }
    const result = await dispatchOne(entry(), failing, now)
    expect(result.status).toBe('queued')
    expect(result.attempts).toBe(1)
    expect(result.error).toContain('boom')
    expect(result.nextRetryAt).toBe(new Date(now.getTime() + 30_000).toISOString())
    expect(result.processingAt).toBeNull()
  })

  it('terminal-fails exhausted and invalid entries', async () => {
    const failing = { name: 'test', async send() { throw new Error('offline') } }
    const exhausted = await dispatchOne(entry({ maxAttempts: 1 }), failing, now)
    expect(exhausted.status).toBe('failed')
    expect(exhausted.nextRetryAt).toBeNull()
    expect(exhausted.error).toBe('offline')

    const invalid = await dispatchOne({ ...entry(), phone: '123' }, provider(), now)
    expect(invalid.status).toBe('failed')
    expect(invalid.error).toMatch(/Invalid phone/)
  })

  it('requires a provider with send()', async () => {
    await expect(dispatchOne(entry(), null, now)).rejects.toThrow(/send/)
    await expect(dispatchOne(null, provider(), now)).rejects.toThrow(/entry/)
  })

  it('dispatches only the eligible entries in a queue', async () => {
    const queue = [
      entry({ id: 'n1' }),
      { ...entry({ id: 'n2' }), nextRetryAt: '2026-06-01T13:00:00.000Z' },
      { ...entry({ id: 'n3' }), status: 'sent' },
    ]
    const result = await dispatchQueue(queue, provider(), now)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].id).toBe('n1')
    expect(result.queue.map((item) => item.status)).toEqual(['sent', 'queued', 'sent'])
  })
})

describe('retry and cancellation', () => {
  it('retries failed entries without resetting attempts', () => {
    const failed = { ...entry(), status: 'failed', attempts: 3, maxAttempts: 3, error: 'boom' }
    const retried = retryNotification([failed], 'n1', now)[0]
    expect(retried.status).toBe('queued')
    expect(retried.attempts).toBe(3)
    expect(retried.maxAttempts).toBe(4)
    expect(retried.manualRetries).toBe(1)
    expect(retried.error).toBeNull()

    const delivered = { ...entry(), status: 'delivered' }
    expect(retryNotification([delivered], 'n1', now)[0]).toBe(delivered)
  })

  it('retries all terminal failures', () => {
    const queue = [
      { ...entry({ id: 'n1' }), status: 'failed' },
      { ...entry({ id: 'n2' }), status: 'failed' },
      entry({ id: 'n3' }),
    ]
    const retried = retryAllFailed(queue, now)
    expect(retried.filter((item) => item.status === 'queued')).toHaveLength(3)
    expect(retried[0].manualRetries).toBe(1)
  })

  it('cancels unfinished entries only', () => {
    const queued = entry({ id: 'n1' })
    const sent = { ...entry({ id: 'n2' }), status: 'sent' }
    const next = cancelNotification([queued, sent], 'n1', now)
    expect(next[0].status).toBe('cancelled')
    expect(next[0].nextRetryAt).toBeNull()
    expect(next[1]).toBe(sent)
  })
})

describe('delivery receipts', () => {
  const sent = { ...entry(), status: 'sent', providerMessageId: 'p1' }
  const receipt = { providerMessageId: 'p1', status: 'delivered', deliveredAt: '2026-06-01T12:20:00.000Z' }
  const verify = () => true

  it('requires backend verification before applying a receipt', () => {
    expect(applyDeliveryReceipt([sent], receipt).ok).toBe(false)
    expect(applyDeliveryReceipt([sent], receipt, { verify: () => false }).ok).toBe(false)
  })

  it('converts sent to delivered and ignores duplicates', () => {
    const first = applyDeliveryReceipt([sent], receipt, { verify })
    expect(first.ok).toBe(true)
    expect(first.queue[0].status).toBe('delivered')
    expect(first.queue[0].deliveryReceipt).toMatchObject({ verified: true, providerMessageId: 'p1' })

    const second = applyDeliveryReceipt(first.queue, receipt, { verify })
    expect(second.duplicate).toBe(true)
    expect(second.queue).toBe(first.queue)
  })

  it('rejects unknown messages and failed statuses', () => {
    expect(applyDeliveryReceipt([sent], { ...receipt, providerMessageId: 'other' }, { verify }).ok).toBe(false)
    expect(applyDeliveryReceipt([{ ...sent, status: 'queued' }], receipt, { verify }).ok).toBe(false)
    const failed = applyDeliveryReceipt([sent], { ...receipt, status: 'undelivered' }, { verify })
    expect(failed.ok).toBe(true)
    expect(failed.queue[0].status).toBe('failed')
  })
})

describe('inbound replies', () => {
  it('parses English and Swahili reply intents', () => {
    expect(parseInboundReply('1')).toEqual({ intent: 'confirmed', code: '1' })
    expect(parseInboundReply('YES')).toEqual({ intent: 'confirmed', code: '1' })
    expect(parseInboundReply('ndio')).toEqual({ intent: 'confirmed', code: '1' })
    expect(parseInboundReply('2')).toEqual({ intent: 'declined', code: '2' })
    expect(parseInboundReply('HAPANA')).toEqual({ intent: 'declined', code: '2' })
    expect(parseInboundReply('STOP').intent).toBe('stop')
    expect(parseInboundReply('msaada').intent).toBe('help')
    expect(parseInboundReply('something else').intent).toBe('unknown')
    expect(parseInboundReply('').intent).toBe('unknown')
  })

  it('rejects unverified webhooks', async () => {
    const result = await recordInboundReply([], { from: '0712345678', body: '1' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/verified webhook/)

    const rejected = await recordInboundReply([], { from: '0712345678', body: '1', verify: () => false })
    expect(rejected.ok).toBe(false)

    const badPhone = await recordInboundReply([], { from: '1', body: '1', trusted: true })
    expect(badPhone.ok).toBe(false)
  })

  it('records a trusted reply and links it to the matching outbound message', async () => {
    const outbound = { ...entry(), status: 'sent' }
    const result = await recordInboundReply([outbound], {
      from: '0712 345 678',
      body: 'NDIO',
      trusted: true,
      providerMessageId: 'inb-1',
    }, now)

    expect(result.ok).toBe(true)
    expect(result.inbound).toMatchObject({
      direction: 'inbound',
      status: 'received',
      intent: 'confirmed',
      code: '1',
      relatedId: 'n1',
      clientId: 'c1',
    })
    expect(result.related.reply.intent).toBe('confirmed')
    expect(result.queue).toHaveLength(2)

    const duplicate = await recordInboundReply(result.queue, {
      from: '0712345678',
      body: 'NDIO',
      trusted: true,
      providerMessageId: 'inb-1',
    }, now)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.queue).toHaveLength(2)
  })

  it('accepts a verified webhook signature', async () => {
    const result = await recordInboundReply([], {
      from: '0712345678',
      body: 'STOP',
      verify: async () => true,
    })
    expect(result.ok).toBe(true)
    expect(result.inbound.intent).toBe('stop')
  })
})

describe('summaries and providers', () => {
  it('summarises notification statuses', () => {
    const queue = [
      entry({ id: 'n1' }),
      { ...entry({ id: 'n2' }), status: 'sent' },
      { ...entry({ id: 'n3' }), status: 'delivered' },
      { ...entry({ id: 'n4' }), status: 'failed' },
      { ...entry({ id: 'n5' }), status: 'sending' },
    ]
    expect(summarizeNotifications(queue)).toMatchObject({
      total: 5,
      queued: 1,
      sent: 1,
      delivered: 1,
      failed: 1,
      processing: 1,
      pending: 2,
      deliveryRate: 33,
      successRate: 67,
    })
    expect(summarizeNotifications([]).deliveryRate).toBe(0)
  })

  it('maps legacy and unknown status keys', () => {
    expect(notificationStatusKey('sending')).toBe('notification.status.processing')
    expect(notificationStatusKey('received')).toBe('notification.status.received')
    expect(notificationStatusKey('weird')).toBe('notification.status.unknown')
  })

  it('uses a deterministic mock provider', async () => {
    const success = createMockProvider({ failureRate: 0, latency: 0, random: () => 1 })
    expect((await success.send({ ...entry(), to: '0712345678', clientRequestId: 'n1' })).ok).toBe(true)

    const failure = createMockProvider({ failureRate: 1, latency: 0, random: () => 0 })
    expect((await failure.send(entry())).ok).toBe(false)
    expect((await success.send({ ...entry(), phone: '0000000000' })).ok).toBe(false)
    expect((await success.send({ ...entry(), phone: '123' })).ok).toBe(false)
  })

  it('sends through a backend proxy without credentials in the payload', async () => {
    expect(() => createHttpProvider({ endpoint: 'ftp://bad' })).toThrow(/HTTP or HTTPS/)
    expect(() => createHttpProvider({ endpoint: '' })).toThrow(/not configured/)

    let captured
    const fetchImpl = async (url, options) => {
      captured = { url, options }
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, messageId: 'gw-1', status: 'accepted' }
        },
      }
    }
    const proxy = createHttpProvider({ endpoint: 'https://example.test/api/sms', fetchImpl })
    const result = await proxy.send({ ...entry(), clientRequestId: 'n1' })
    expect(result).toMatchObject({ ok: true, providerMessageId: 'gw-1', delivered: false })
    expect(captured.url).toBe('https://example.test/api/sms')
    expect(captured.options.credentials).toBe('include')
    expect(JSON.parse(captured.options.body)).toEqual({
      to: '0712345678',
      message: 'Please attend the clinic.',
      type: 'remind',
      clientRequestId: 'n1',
      language: 'sw',
    })
    expect(JSON.stringify(captured.options)).not.toMatch(/apiKey|password|token/i)
  })

  it('treats only verified receipts as delivered in the HTTP provider', async () => {
    const proxy = createHttpProvider({
      endpoint: 'https://example.test/api/sms',
      async fetchImpl() {
        return { ok: true, status: 200, async json() { return { messageId: 'gw-2', status: 'delivered' } } }
      },
    })
    const result = await proxy.send(entry())
    expect(result.delivered).toBe(false)
    expect(result.receiptVerified).toBe(false)
  })

  it('surfaces HTTP proxy errors', async () => {
    const proxy = createHttpProvider({
      endpoint: 'https://example.test/api/sms',
      async fetchImpl() {
        return { ok: false, status: 500, async json() { return { error: 'backend down' } } }
      },
    })
    await expect(proxy.send(entry())).rejects.toThrow('backend down')
  })

  it('applies a client-side rate limit', async () => {
    const limited = createRateLimitedProvider(provider(), { maxPerMinute: 2, now: () => 1_000 })
    expect((await limited.send(entry())).ok).toBe(true)
    expect((await limited.send(entry())).ok).toBe(true)
    expect((await limited.send(entry())).error).toMatch(/rate limit/)
  })

  it('reports provider mode without reading credentials', () => {
    expect(getProviderInfo({}).mode).toBe('mock')
    expect(getProviderInfo({ VITE_SMS_API_URL: 'https://example.test/api/sms' }).mode).toBe('http')
    expect(getProviderInfo({ VITE_SMS_PROVIDER: 'http' }).mode).toBe('mock')
  })
})
