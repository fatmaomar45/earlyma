import { Group, Stack, Text, ThemeIcon, Timeline } from '@mantine/core'
import { useApp } from '../context/AppContext.jsx'
import { formatDateTime } from '../lib/dates.js'
import { Icon } from './Icon.jsx'

function actionIcon(action) {
  if (action?.startsWith('visit.')) return 'calendar'
  if (action?.startsWith('notification.')) return 'bell'
  if (action?.startsWith('call.')) return 'phone'
  if (action?.startsWith('worker.')) return 'users'
  if (action?.startsWith('demo.')) return 'shield'
  return 'user'
}

export function ActivityList({ activities = [], limit = 8 }) {
  const { t, locale, db } = useApp()
  const workers = db.workers ?? []
  const items = activities.slice(0, limit)
  if (!items.length) return <Text c="dimmed" size="sm">{t('activity.empty')}</Text>

  return (
    <Timeline bulletSize={28} lineWidth={2} active={items.length}>
      {items.map((activity) => {
        const key = `activity.${activity.action}`
        const translated = t(key, activity.meta ?? {})
        const message = translated === key ? t('activity.unknown') : translated
        const actor = workers.find((worker) => worker.id === activity.actorId)
        return (
          <Timeline.Item
            key={activity.id}
            bullet={<ThemeIcon size={24} radius="xl" variant="light" color="teal"><Icon name={actionIcon(activity.action)} size={13} /></ThemeIcon>}
          >
            <Stack gap={2}>
              <Text size="sm">{message}</Text>
              <Group gap="xs" wrap="wrap">
                <Text size="xs" c="dimmed">{formatDateTime(activity.at, locale)}</Text>
                {actor ? <Text size="xs" c="dimmed">· {actor.fullName}</Text> : null}
              </Group>
            </Stack>
          </Timeline.Item>
        )
      })}
    </Timeline>
  )
}
