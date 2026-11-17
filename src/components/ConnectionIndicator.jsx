import { Group, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { deriveSyncState, SYNC_STATE_META, SYNC_STATES } from '../lib/sync.js'

export function ConnectionIndicator({ size = 'sm', showLabel = true }) {
  const { t, busy, notificationSummary } = useApp()
  const online = useOnlineStatus()
  const navigate = useNavigate()

  const state = deriveSyncState({
    online,
    syncing: Boolean(busy.queue),
    failed: notificationSummary.failed,
  })
  const meta = SYNC_STATE_META[state]
  const label = t(meta.labelKey)
  const needsAttention = state === SYNC_STATES.ERROR || state === SYNC_STATES.OFFLINE

  const content = (
    <Group gap={6} wrap="nowrap">
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: meta.color,
          boxShadow: state === SYNC_STATES.SYNCING ? `0 0 0 3px ${meta.color}33` : undefined,
        }}
      />
      {showLabel ? (
        <Text size={size} c="dimmed" lh={1.1} className="connection-label">{label}</Text>
      ) : null}
    </Group>
  )

  return (
    <Tooltip
      label={t(state === SYNC_STATES.ERROR ? 'sync.errorHint' : meta.labelKey)}
      withArrow
      disabled={!needsAttention}
    >
      {needsAttention ? (
        <UnstyledButton
          aria-label={label}
          onClick={() => navigate('/notifications')}
          style={{ borderRadius: 999 }}
        >
          {content}
        </UnstyledButton>
      ) : (
        <Group
          gap={6}
          wrap="nowrap"
          px={8}
          py={4}
          style={{ borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff' }}
          aria-label={label}
        >
          {content}
        </Group>
      )}
    </Tooltip>
  )
}