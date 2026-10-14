import { describe, it, expect, vi } from 'vitest'
import {
  createNotification,
  enqueueNotification,
  dispatchQueue,
  selectDispatchable,
} from '../notifications.js'

describe('sms notification queue', () => {
  it('creates queued notification entries', () => {
    const client = { id: '1', label: 'Demo', phone: '0700 111 222' }
    const entry = createNotification(client, 'Hello', 'remind', 'worker-1')
    expect(entry.status).toBe('queued')
    expect(entry.attempts).toBe(0)
    expect(entry.phone).toBe('0700 111 222')

    const queue = enqueueNotification([], entry)
    expect(queue).toHaveLength(1)
  })

  it('marks failed provider responses and schedules retry', async () => {
    const client = { id: '1', label: 'Demo', phone: '0000000000' }
    const entry = createNotification(client, 'Hello')
    const queue = enqueueNotification([], entry)

    const provider = { async send(item) { return { ok: false, error: 'boom' } } }
    const { queue: updated, results } = await dispatchQueue(queue, provider)

    expect(results[0].status).toBe('queued')
    expect(updated[0].attempts).toBe(1)
    expect(updated[0].error).toContain('boom')
    expect(updated[0].nextRetryAt).not.toBeNull()
  })

  it('only dispatches due and eligible entries', () => {
    const entry = createNotification({ id: '1', label: 'Demo', phone: '0700' }, 'Hi')
    entry.status = 'sent'
    expect(selectDispatchable([entry])).toHaveLength(0)
  })
})