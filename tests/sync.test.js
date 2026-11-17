import { describe, it, expect } from 'vitest'
import { deriveSyncState, SYNC_STATES, SYNC_STATE_META } from '../src/lib/sync.js'

describe('deriveSyncState', () => {
  it('is online when connected with no failures and nothing syncing', () => {
    expect(deriveSyncState({ online: true, syncing: false, failed: 0 })).toBe(SYNC_STATES.ONLINE)
  })

  it('is offline whenever the device has no network, regardless of other flags', () => {
    expect(deriveSyncState({ online: false })).toBe(SYNC_STATES.OFFLINE)
    expect(deriveSyncState({ online: false, syncing: true, failed: 3 })).toBe(SYNC_STATES.OFFLINE)
  })

  it('is syncing while the local outbox is being processed', () => {
    expect(deriveSyncState({ online: true, syncing: true })).toBe(SYNC_STATES.SYNCING)
  })

  it('is error when failed messages need a safe retry', () => {
    expect(deriveSyncState({ online: true, failed: 2 })).toBe(SYNC_STATES.ERROR)
  })

  it('treats a negative or non-numeric failure count as zero', () => {
    expect(deriveSyncState({ online: true, failed: -1 })).toBe(SYNC_STATES.ONLINE)
    expect(deriveSyncState({ online: true, failed: 'nope' })).toBe(SYNC_STATES.ONLINE)
  })

  it('provides a label and colour for every state', () => {
    for (const state of Object.values(SYNC_STATES)) {
      expect(SYNC_STATE_META[state]).toBeDefined()
      expect(SYNC_STATE_META[state].labelKey).toMatch(/^sync\./)
      expect(SYNC_STATE_META[state].color).toMatch(/^#/)
    }
  })
})