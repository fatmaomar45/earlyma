// Connection/synchronisation state for the CHW mobile shell.
//
// Earlyma is local-first: every change is written to browser storage immediately
// and reminders wait in a persistent outbox. The indicator therefore reports how
// the device is currently syncing that outbox rather than a remote server link.
//
// States (all four are required by the mobile design brief):
//   online     – connected, nothing waiting, no failures
//   offline    – the device has no network; changes stay queued on the device
//   syncing    – connected and the local outbox is being processed
//   error      – connected but at least one queued message failed and needs a
//                safe retry (surfaced as "sync failed")

export const SYNC_STATES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  ERROR: 'error',
}

// i18n key + colour used by the visible indicator.
export const SYNC_STATE_META = {
  [SYNC_STATES.ONLINE]: { color: '#16a34a', labelKey: 'sync.online' },
  [SYNC_STATES.OFFLINE]: { color: '#f59e0b', labelKey: 'sync.offline' },
  [SYNC_STATES.SYNCING]: { color: '#2563eb', labelKey: 'sync.syncing' },
  [SYNC_STATES.ERROR]: { color: '#dc2626', labelKey: 'sync.error' },
}

/**
 * Derive the single indicator state from the device and outbox.
 * Order of precedence: offline > syncing > error > online.
 *
 * @param {object} input
 * @param {boolean} input.online  navigator.onLine
 * @param {boolean} input.syncing an outbox/sync run is currently in progress
 * @param {number}  input.failed  number of failed messages awaiting retry
 * @returns {'online'|'offline'|'syncing'|'error'}
 */
export function deriveSyncState({ online = true, syncing = false, failed = 0 } = {}) {
  if (!online) return SYNC_STATES.OFFLINE
  if (syncing) return SYNC_STATES.SYNCING
  if (Number(failed) > 0) return SYNC_STATES.ERROR
  return SYNC_STATES.ONLINE
}