import { Anchor, Group, Paper, Stack, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { formatDate } from '../lib/dates.js'
import { EmptyState } from './EmptyState.jsx'
import { CategoryBadge, VisitStatusBadge } from './StatusBadge.jsx'

export function VisitList({
  visits = [],
  showClient = true,
  emptyTitle,
  emptyHint,
  limit,
  dense = false,
}) {
  const { t, language, locale } = useApp()
  const visible = limit ? visits.slice(0, limit) : visits

  if (!visible.length) {
    return <EmptyState icon="calendar" title={emptyTitle ?? t('visits.empty')} description={emptyHint ?? t('visits.emptyHint')} />
  }

  return (
    <Stack gap={dense ? 6 : 'xs'}>
      {visible.map((visit) => (
        <Paper key={visit.id} withBorder p={dense ? 'xs' : 'sm'} className="visit-row">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
              <Group gap="xs" wrap="wrap">
                <Text fw={650} size={dense ? 'sm' : 'md'}>{visit.name?.[language] ?? visit.name?.en}</Text>
                <VisitStatusBadge status={visit.status} />
              </Group>
              <Group gap="xs" wrap="wrap">
                {showClient ? (
                  <Text size="xs" c="dimmed">{visit.clientName}</Text>
                ) : null}
                <Text size="xs" c="dimmed">· {formatDate(visit.scheduledDate, locale)}</Text>
                <CategoryBadge category={visit.category} />
              </Group>
            </Stack>
            <Anchor component={Link} to={`/visits/${encodeURIComponent(visit.id)}`} size="sm" fw={600} style={{ flexShrink: 0 }}>
              {t('common.view')}
            </Anchor>
          </Group>
        </Paper>
      ))}
      {limit && visits.length > limit ? (
        <Group justify="flex-end">
          <Anchor component={Link} to="/visits" size="sm">{t('common.viewAll')}</Anchor>
        </Group>
      ) : null}
    </Stack>
  )
}
