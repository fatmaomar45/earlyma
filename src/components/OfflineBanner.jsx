import { Alert, Stack } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { deriveSyncState, SYNC_STATES } from '../lib/sync.js'
import { Icon } from './Icon.jsx'

export function OfflineBanner() {
  const { t, storageAvailable, storageError, busy, notificationSummary } = useApp()
  const online = useOnlineStatus()
  const navigate = useNavigate()

  const syncState = deriveSyncState({
    online,
    syncing: Boolean(busy.queue),
    failed: notificationSummary.failed,
  })

  return (
    <Stack gap={0}>
      {syncState === SYNC_STATES.OFFLINE ? (
        <Alert color="orange" variant="light" icon={<Icon name="wifiOff" size={18} />} radius={0}>
          {t('common.offlineBanner')}
        </Alert>
      ) : null}
      {syncState === SYNC_STATES.ERROR ? (
        <Alert
          color="red"
          variant="light"
          icon={<Icon name="alert" size={18} />}
          radius={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/notifications')}
        >
          {t('sync.errorHint')}
        </Alert>
      ) : null}
      {!storageAvailable ? (
        <Alert color="red" variant="light" icon={<Icon name="alert" size={18} />} radius={0}>
          {storageError || t('settings.storageUnavailable')}
        </Alert>
      ) : null}
    </Stack>
  )
}