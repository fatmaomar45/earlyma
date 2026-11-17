import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { formatDateTime } from '../lib/dates.js'
import { NotificationStatusBadge } from './StatusBadge.jsx'

export function NotificationListItem({ entry, onView, onRetry, onCancel, busy = false }) {
  const { t, locale } = useApp()
  const isInbound = entry.direction === 'inbound'
  const canRetry = ['queued', 'failed'].includes(entry.status) || (entry.status === 'processing' && !entry.processingAt)
  const canCancel = !isInbound && !['sent', 'delivered', 'cancelled', 'received'].includes(entry.status)

  return (
    <Paper withBorder p="sm" className="notification-row">
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Group gap="xs" wrap="wrap">
            <NotificationStatusBadge status={entry.status} />
            <Text size="sm" fw={650}>{entry.clientLabel}</Text>
            <Text size="xs" c="dimmed">{isInbound ? t('notifications.inbound') : t('notifications.outbound')}</Text>
          </Group>
          <Text size="xs" c="dimmed">{formatDateTime(entry.createdAt, locale)}</Text>
        </Group>
        <Text size="sm" lineClamp={3}>{entry.message || '—'}</Text>
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap="sm" wrap="wrap">
            <Text size="xs" c="dimmed">{entry.phone}</Text>
            <Text size="xs" c="dimmed">{t(`notifications.type.${entry.type}`, { defaultValue: entry.type })}</Text>
            {!isInbound ? <Text size="xs" c="dimmed">{t('notifications.attempts', { attempts: entry.attempts ?? 0, max: entry.maxAttempts ?? 3 })}</Text> : null}
            {entry.reply ? <Text size="xs" c="teal">{t('activity.notification.reply', { name: entry.clientLabel, intent: entry.reply.intent })}</Text> : null}
          </Group>
          <Group gap={6}>
            {onView ? <Button size="compact-xs" variant="subtle" onClick={() => onView(entry)}>{t('common.details')}</Button> : null}
            {onRetry && canRetry ? <Button size="compact-xs" variant="light" onClick={() => onRetry(entry)} loading={busy}>{t('notifications.retry')}</Button> : null}
            {onCancel && canCancel ? <Button size="compact-xs" variant="subtle" color="gray" onClick={() => onCancel(entry)}>{t('notifications.cancel')}</Button> : null}
          </Group>
        </Group>
        {entry.error ? <Text size="xs" c="red">{entry.error}</Text> : null}
        {entry.status === 'queued' && entry.nextRetryAt ? (
          <Text size="xs" c="dimmed">{t('notifications.nextRetry', { date: formatDateTime(entry.nextRetryAt, locale) })}</Text>
        ) : null}
      </Stack>
    </Paper>
  )
}
